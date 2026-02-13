"""
BasketStats Pro — Game Scraper (Supabase Edition)
====================================================
Scraper de partido que extrae datos completos y los guarda
directamente en Supabase via SupabaseRepository.

Conserva TODOS los parsers probados del full_game_scraper.py:
  - Shot Chart (div.shoot)
  - Play-by-Play (div.widget-keyfacts)
  - Player Box Score (div.responsive-scroll)
  - Team Stats (div.widget-teamstats)
  - Fecha (div.fecha > span.txt)

Cambios vs full_game_scraper.py:
  - Eliminada escritura de JSON
  - Inyección de SupabaseRepository
  - Llamada a repository.save_game_stats() al finalizar
  - Actualización de game.status a PROCESSED
"""

import asyncio
import logging
import re
from datetime import datetime, date
from pathlib import Path
from typing import List, Optional, Dict, Tuple

from playwright.async_api import async_playwright, Page, TimeoutError as PlaywrightTimeout
from bs4 import BeautifulSoup

import sys
sys.path.insert(0, str(Path(__file__).parent.parent))
from database.models import (
    FullGameData,
    ShotData,
    PlayByPlayEvent,
    PlayerGameStats,
    TeamAdvancedStats,
    ShotResult,
    ShotZone,
    PlayByPlayActionType,
)
from scraper.pbp_parser import parse_pbp_action_text

logger = logging.getLogger(__name__)

BASE_URL = "https://www.feb.es/competiciones/partido/{game_id}"


# ═════════════════════════════════════════════════════════════════════════════
# HELPER: SHOT ZONE CLASSIFICATION
# ═════════════════════════════════════════════════════════════════════════════

def classify_zone(x_pct: float, y_pct: float) -> ShotZone:
    if 35 <= x_pct <= 65 and y_pct < 30:
        return ShotZone.PAINT
    if (x_pct < 10 or x_pct > 90) and 20 <= y_pct <= 60:
        return ShotZone.CORNER_3
    if (15 <= x_pct <= 35 or 65 <= x_pct <= 85) and y_pct > 60:
        return ShotZone.WING_3
    if 40 <= x_pct <= 60 and y_pct > 70:
        return ShotZone.TOP_3
    if 25 <= x_pct <= 75 and 30 <= y_pct <= 65:
        return ShotZone.MID_RANGE
    if 45 <= x_pct <= 55 and 15 <= y_pct <= 25:
        return ShotZone.FREE_THROW
    return ShotZone.OTHER


# ═════════════════════════════════════════════════════════════════════════════
# PARSER 1: HEADER (Equipos, Fecha, Marcador)
# ═════════════════════════════════════════════════════════════════════════════

def extract_header_info(html: str) -> Dict:
    soup = BeautifulSoup(html, "lxml")
    result = {
        "home_team": "Unknown",
        "away_team": "Unknown",
        "final_score_home": 0,
        "final_score_away": 0,
        "game_date": None,
        "venue": None,
    }
    try:
        team_links = soup.select(".nombre a")
        if len(team_links) >= 2:
            result["home_team"] = team_links[0].get_text(strip=True)
            result["away_team"] = team_links[1].get_text(strip=True)
            logger.info(f"Equipos: {result['home_team']} vs {result['away_team']}")

        score_spans = soup.find_all("span", class_="resultado")
        if len(score_spans) >= 2:
            try:
                result["final_score_home"] = int(score_spans[0].get_text(strip=True))
                result["final_score_away"] = int(score_spans[1].get_text(strip=True))
                logger.info(f"Marcador: {result['final_score_home']}-{result['final_score_away']}")
            except (ValueError, IndexError):
                pass

        fecha_div = soup.select_one("div.fecha")
        if fecha_div:
            fecha_span = fecha_div.select_one("span.txt")
            if fecha_span:
                fecha_text = fecha_span.get_text(strip=True)
                dm = re.search(r"(\d{2})[/-](\d{2})[/-](\d{4})", fecha_text)
                if dm:
                    day, month, year = dm.groups()
                    try:
                        result["game_date"] = date(int(year), int(month), int(day))
                        logger.info(f"Fecha: {result['game_date']} ({fecha_text})")
                    except ValueError:
                        pass
    except Exception as e:
        logger.warning(f"Error header: {e}")
    return result


# ═════════════════════════════════════════════════════════════════════════════
# PARSER 2: PLAY-BY-PLAY
# ═════════════════════════════════════════════════════════════════════════════

def _classify_action(text: str) -> PlayByPlayActionType:
    t = text.lower()
    if any(k in t for k in ("tiro de 2", "tiro de 3", "anota", "anotado")):
        return PlayByPlayActionType.FIELD_GOAL_MISSED if ("falla" in t or "fallado" in t) else PlayByPlayActionType.FIELD_GOAL_MADE
    if "tiro libre" in t:
        return PlayByPlayActionType.FREE_THROW_MISSED if ("falla" in t or "fallado" in t) else PlayByPlayActionType.FREE_THROW_MADE
    if "rebote" in t:
        return PlayByPlayActionType.REBOUND_DEF if "defensivo" in t else PlayByPlayActionType.REBOUND_OFF
    if "asistencia" in t:
        return PlayByPlayActionType.ASSIST
    if "pérdida" in t or "perdida" in t:
        return PlayByPlayActionType.TURNOVER
    if "robo" in t or "recupera" in t:
        return PlayByPlayActionType.STEAL
    if "falta" in t:
        return PlayByPlayActionType.FOUL
    if "tapón" in t or "tapon" in t:
        return PlayByPlayActionType.BLOCK
    if any(k in t for k in ("sustitu", "entra", "sale")):
        return PlayByPlayActionType.SUBSTITUTION
    if "tiempo muerto" in t or "timeout" in t:
        return PlayByPlayActionType.TIMEOUT
    if "inicio" in t or "comienza" in t:
        return PlayByPlayActionType.PERIOD_START
    if "fin" in t or "final" in t:
        return PlayByPlayActionType.PERIOD_END
    return PlayByPlayActionType.UNKNOWN


def parse_play_by_play(html: str, game_id: str, home_team: str, away_team: str) -> List[PlayByPlayEvent]:
    soup = BeautifulSoup(html, "lxml")
    events = []
    try:
        container = soup.find("div", class_="widget-keyfacts")
        if not container:
            logger.warning("No se encontró div.widget-keyfacts")
            return events
        filas = container.find_all("div", class_="fila")
        logger.info(f"Encontradas {len(filas)} filas PBP")
        quarter = 1
        for fila in filas:
            try:
                classes = fila.get("class", [])
                is_local = "ver-local" in classes
                is_visit = "ver-visitante" in classes
                if not is_local and not is_visit:
                    text = fila.get_text(strip=True)
                    if "Fin" in text or "Cuarto" in text:
                        qm = re.search(r"(\d)", text)
                        if qm:
                            quarter = int(qm.group(1))
                    continue
                cols = fila.find_all("div", class_="columna")
                if len(cols) < 2:
                    continue
                wrapper = cols[1].find("div", class_="wrapper")
                cur_time = "00:00"
                sh, sa = None, None
                if wrapper:
                    ts = wrapper.find("span", class_="tiempo")
                    if ts:
                        tm = re.search(r"(\d{2}:\d{2})", ts.get_text(strip=True))
                        if tm:
                            cur_time = tm.group(1)
                    rs = wrapper.find("span", class_="resultado")
                    if rs:
                        sm = re.match(r"(\d+)-(\d+)", rs.get_text(strip=True))
                        if sm:
                            sh, sa = int(sm.group(1)), int(sm.group(2))
                accion = None
                if is_local and len(cols) >= 1:
                    accion = cols[0].find("span", class_="accion")
                elif is_visit and len(cols) >= 3:
                    accion = cols[2].find("span", class_="accion")
                if not accion:
                    continue
                full_text = accion.get_text(strip=True)
                player_name = None
                action_text = full_text
                team_name = None
                team_m = re.match(r"\(([^)]+)\)\s*(.+)", full_text)
                if team_m:
                    # Hay equipo en el texto, extraer jugador
                    remaining = team_m.group(2).strip()
                    # Incluir todos los diacríticos: acentos agudos (Á), graves (À), diéresis (Ü,Ï), cedilla (Ç), ñ, guiones, apóstrofes
                    pm = re.match(r"([A-Z][A-ZÁÀÂÄÉÈÊËÍÌÎÏÓÒÔÖÚÙÛÜÑÇÝ.\s\-']+?):\s*(.+)", remaining, re.IGNORECASE)
                    if pm:
                        player_name = pm.group(1).strip()
                        action_text = pm.group(2).strip()
                    else:
                        action_text = remaining
                
                # Asignar team_name basándose en is_local/is_visit para evitar discrepancias
                team_name = home_team if is_local else away_team
                
                # Parsear el action_text para extraer datos estructurados (esquema simplificado)
                parsed = parse_pbp_action_text(full_text)
                
                events.append(PlayByPlayEvent(
                    game_id=game_id, quarter=quarter, minute=cur_time,
                    team_name=team_name, player_name=player_name,
                    action_type=parsed["action_type"],  # Ultra-específico: 2pt_made, steal, etc.
                    action_value=parsed["action_value"],  # Puntos (2, 3, 1) o 0
                    stat_count=parsed["stat_count"],  # Número acumulado del paréntesis
                    free_throws_awarded=parsed["free_throws_awarded"],  # TL generados por falta
                    score_home=sh, score_away=sa,
                ))
            except Exception:
                continue
        logger.info(f"PBP: {len(events)} eventos")
    except Exception as e:
        logger.error(f"Error PBP: {e}")
    return events


# ═════════════════════════════════════════════════════════════════════════════
# PARSER 3: TEAM STATS
# ═════════════════════════════════════════════════════════════════════════════

def parse_team_stats(html: str, game_id: str, home_team: str, away_team: str) -> List[TeamAdvancedStats]:
    soup = BeautifulSoup(html, "lxml")
    home_s = TeamAdvancedStats(game_id=game_id, team_name=home_team)
    away_s = TeamAdvancedStats(game_id=game_id, team_name=away_team)
    label_map = {
        "TC": "fg", "T2": "fg2", "T3": "fg3", "TL": "ft",
        "RB": "total_rebounds", "AS": "assists", "TP": "blocks",
        "F": "fouls", "BR": "steals", "BP": "turnovers",
    }
    try:
        widget = soup.find("div", class_="widget-teamstats")
        if not widget:
            return [home_s, away_s]
        filas = widget.find_all("div", class_="fila")
        for fila in filas:
            try:
                cols = fila.find_all("div", class_="columna")
                if len(cols) < 3:
                    continue
                ld = cols[0].find("div", class_="data")
                lt = ld.find("span").get_text(strip=True) if ld and ld.find("span") else ""
                ls = cols[1].find("span")
                label = ls.get_text(strip=True) if ls else ""
                vd = cols[2].find("div", class_="data")
                vt = vd.find("span").get_text(strip=True) if vd and vd.find("span") else ""
                if label not in label_map:
                    continue
                fn = label_map[label]

                def _extract(txt):
                    bm = re.search(r"\[([^\]]+)\]", txt)
                    if not bm:
                        return None, None
                    bc = bm.group(1)
                    if "/" in bc:
                        parts = bc.split("/")
                        return int(parts[0].strip()), int(parts[1].strip())
                    return int(bc.strip()), None

                hm, ha = _extract(lt)
                am, aa = _extract(vt)
                if fn in ("fg", "fg2", "fg3", "ft"):
                    for stats_obj, made, att in [(home_s, hm, ha), (away_s, am, aa)]:
                        if made is not None:
                            setattr(stats_obj, f"{fn}_made", made)
                        if att is not None:
                            setattr(stats_obj, f"{fn}_attempted", att)
                            if made and att > 0:
                                setattr(stats_obj, f"{fn}_percentage", round((made / att) * 100, 1))
                else:
                    if hm is not None:
                        setattr(home_s, fn, hm)
                    if am is not None:
                        setattr(away_s, fn, am)
            except Exception:
                continue
    except Exception as e:
        logger.error(f"Error team stats: {e}")
    
    # SIEMPRE devolver exactamente 2 elementos (home y away)
    result = [home_s, away_s]
    logger.info(f"TeamStats: procesadas stats de {len(result)} equipos")
    return result


# ═════════════════════════════════════════════════════════════════════════════
# PARSER 4: PLAYER BOX SCORE
# ═════════════════════════════════════════════════════════════════════════════

def parse_player_boxscore(html: str, game_id: str, home_team: str, away_team: str) -> List[PlayerGameStats]:
    soup = BeautifulSoup(html, "lxml")
    players = []
    seen_players = set()  # Para detectar duplicados: (feb_player_id, team_name)
    
    try:
        sections = []
        for h1 in soup.find_all("h1", class_="titulo-modulo"):
            tn = h1.get_text(strip=True)
            nd = h1.find_next_sibling("div", class_="responsive-scroll")
            if nd and tn:
                sections.append((tn, nd))
        if not sections:
            return players
        
        # SOLO usar las primeras 2 secciones (local y visitante)
        # La página FEB duplica las tablas en otra sección (print/stats view)
        sections = sections[:2]
        logger.info(f"BoxScore: {len(sections)} tablas (limitado a 2)")
        
        # Procesar cada sección (0 = local, 1 = visitante)
        for section_idx, (team_name_html, container) in enumerate(sections):
            # Usar home_team/away_team en lugar del nombre del HTML para evitar discrepancias
            team_name = home_team if section_idx == 0 else away_team
            
            table = container.find("table")
            if not table:
                continue
            tbody = table.find("tbody")
            if not tbody:
                continue
            rows = tbody.find_all("tr")

            def _shoot(text):
                m = re.match(r"(\d+)/(\d+)", text.strip())
                return (int(m.group(1)), int(m.group(2))) if m else (0, 0)

            def _int(text):
                try:
                    return int(text.strip())
                except Exception:
                    return 0

            for row in rows:
                try:
                    if "row-total" in row.get("class", []):
                        continue
                    cells = row.find_all("td")
                    if len(cells) < 21:
                        continue
                    inicial = cells[0].get_text(strip=True)
                    starter = inicial == "*"
                    jersey = cells[1].get_text(strip=True)
                    
                    # Extraer nombre y feb_player_id del <a href="Jugador.aspx?i=XXXXXX&c=YYYYYY">
                    nc = cells[2]
                    a = nc.find("a")
                    pn = a.get_text(strip=True) if a else nc.get_text(strip=True)
                    
                    # Extraer FEB player ID del href (c=YYYYYY)
                    # NOTA: El parámetro 'c' es el ID único del jugador
                    # El parámetro 'i' es el ID de la liga/grupo (igual para todo el equipo)
                    feb_id = None
                    if a and a.get("href"):
                        href = a.get("href")
                        match = re.search(r"[?&]c=(\d+)", href)
                        if match:
                            feb_id = match.group(1)
                    
                    if not pn:
                        continue
                    mins = cells[3].get_text(strip=True) or "00:00"
                    pts = _int(cells[4].get_text())
                    f2m, f2a = _shoot(cells[5].get_text())
                    f3m, f3a = _shoot(cells[6].get_text())
                    fgm, fga = _shoot(cells[7].get_text())
                    ftm, fta = _shoot(cells[8].get_text())
                    ro = _int(cells[9].get_text())
                    rd = _int(cells[10].get_text())
                    rt = _int(cells[11].get_text())
                    ast = _int(cells[12].get_text())
                    stl = _int(cells[13].get_text())
                    tov = _int(cells[14].get_text())
                    blk = _int(cells[15].get_text())
                    blk_a = _int(cells[16].get_text())
                    # 17 = Mates (skip)
                    fc = _int(cells[18].get_text())
                    fr = _int(cells[19].get_text())
                    eff = _int(cells[20].get_text())
                    pm_text = cells[21].get_text(strip=True) if len(cells) > 21 else "0"
                    pm = _int(pm_text.replace("+", ""))
                    
                    # Detectar y omitir duplicados basados en feb_player_id (único por jugador)
                    player_key = feb_id if feb_id else f"{pn}_{team_name}"
                    if player_key in seen_players:
                        logger.warning(f"Duplicado detectado en HTML: {pn} ({feb_id}) en {team_name}. Omitiendo.")
                        continue
                    seen_players.add(player_key)
                    
                    players.append(PlayerGameStats(
                        game_id=game_id, team_name=team_name, player_name=pn,
                        jersey_number=jersey, feb_player_id=feb_id, starter=starter, minutes_played=mins,
                        points=pts, fg_made=fgm, fg_attempted=fga,
                        fg2_made=f2m, fg2_attempted=f2a, fg3_made=f3m, fg3_attempted=f3a,
                        ft_made=ftm, ft_attempted=fta,
                        rebounds_offensive=ro, rebounds_defensive=rd, rebounds_total=rt,
                        assists=ast, steals=stl, blocks=blk, blocks_against=blk_a,
                        turnovers=tov, fouls=fc, fouls_received=fr,
                        efficiency=eff, plus_minus=pm,
                    ))
                except Exception:
                    continue
        logger.info(f"BoxScore: {len(players)} jugadores")
    except Exception as e:
        logger.error(f"Error boxscore: {e}")
    return players


# ═════════════════════════════════════════════════════════════════════════════
# PARSER 5: SHOTS
# ═════════════════════════════════════════════════════════════════════════════

def parse_shots(html: str, game_id: str) -> List[ShotData]:
    soup = BeautifulSoup(html, "lxml")
    shots = []
    try:
        divs = soup.find_all("div", class_="shoot")
        if not divs:
            return shots
        logger.info(f"Shots: {len(divs)} elementos")
        for div in divs:
            try:
                classes = div.get("class", [])
                style = div.get("style", "")
                tid = next((int(c[1:]) for c in classes if c.startswith("t") and c[1:].isdigit()), None)
                pnum = next((int(c[2:]) for c in classes if c.startswith("p-") and c[2:].isdigit()), None)
                result = ShotResult.MADE if "success1" in classes else (ShotResult.MISSED if "success0" in classes else None)
                qtr = next((int(c[2:]) for c in classes if c.startswith("q-") and c[2:].isdigit()), None)
                top_m = re.search(r"top:\s*([\d.]+)%", style)
                left_m = re.search(r"left:\s*([\d.]+)%", style)
                if not all([tid is not None, pnum is not None, result, qtr, top_m, left_m]):
                    continue
                y, x = float(top_m.group(1)), float(left_m.group(1))
                shots.append(ShotData(
                    game_id=game_id, team_id=tid, player_number=pnum,
                    result=result, quarter=qtr, x_coordinate=x, y_coordinate=y,
                    zone=classify_zone(x, y), raw_style=style,
                ))
            except Exception:
                continue
        logger.info(f"Shots: {len(shots)} parseados")
    except Exception as e:
        logger.error(f"Error shots: {e}")
    return shots


# ═════════════════════════════════════════════════════════════════════════════
# TAB NAVIGATION
# ═════════════════════════════════════════════════════════════════════════════

async def _navigate_tab(page: Page, name: str) -> bool:
    logger.info(f"Navegando a pestaña: {name}")
    for sel in [f"a:has-text('{name}')", f"button:has-text('{name}')",
                f".tab:has-text('{name}')", f"li:has-text('{name}') a"]:
        try:
            el = await page.query_selector(sel)
            if el:
                await el.click()
                await asyncio.sleep(2)
                logger.info(f"Tab OK: {name}")
                return True
        except Exception:
            continue
    logger.warning(f"Tab FAIL: {name}")
    return False


# ═════════════════════════════════════════════════════════════════════════════
# MAIN SCRAPER
# ═════════════════════════════════════════════════════════════════════════════

async def scrape_game(game_id: str, headless: bool = True) -> FullGameData:
    """
    Extrae todos los datos de un partido. Devuelve FullGameData.
    NO guarda nada — la capa de arriba (app/CLI) llama a repository.save_game_stats().
    """
    logger.info(f"[SCRAPER] Iniciando partido {game_id}")
    url = BASE_URL.format(game_id=game_id)

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=headless)
        ctx = await browser.new_context(ignore_https_errors=True)
        page = await ctx.new_page()
        try:
            await page.goto(url, wait_until="domcontentloaded", timeout=30000)
            await page.wait_for_load_state("networkidle", timeout=10000)

            # Header
            html = await page.content()
            header = extract_header_info(html)

            # Shots
            shots = []
            if await _navigate_tab(page, "Gráfico de tiro"):
                await asyncio.sleep(3)
                await page.wait_for_load_state("networkidle", timeout=5000)
                shots = parse_shots(await page.content(), game_id)

            # PBP
            pbp = []
            if await _navigate_tab(page, "Directo"):
                await asyncio.sleep(3)
                try:
                    await page.wait_for_selector("div.widget-keyfacts", timeout=10000)
                except Exception:
                    pass
                await page.wait_for_load_state("networkidle", timeout=5000)
                pbp = parse_play_by_play(await page.content(), game_id, header["home_team"], header["away_team"])

            # Box score
            pstats = []
            if await _navigate_tab(page, "Ficha"):
                await asyncio.sleep(3)
                try:
                    await page.wait_for_selector("div.responsive-scroll", timeout=10000)
                except Exception:
                    pass
                await page.wait_for_load_state("networkidle", timeout=5000)
                pstats = parse_player_boxscore(await page.content(), game_id, header["home_team"], header["away_team"])

            # Team stats
            tstats = []
            if await _navigate_tab(page, "Estadísticas"):
                await asyncio.sleep(4)
                try:
                    await page.wait_for_selector("div.widget-teamstats", timeout=10000)
                except Exception:
                    pass
                await page.wait_for_load_state("networkidle", timeout=5000)
                tstats = parse_team_stats(await page.content(), game_id, header["home_team"], header["away_team"])

            data = FullGameData(
                game_id=game_id,
                home_team=header["home_team"],
                away_team=header["away_team"],
                final_score_home=header["final_score_home"],
                final_score_away=header["final_score_away"],
                game_date=header["game_date"],
                venue=header["venue"],
                shots=shots,
                play_by_play=pbp,
                player_stats=pstats,
                team_stats=tstats,
            )
            logger.info(
                f"[SCRAPER] OK: {header['home_team']} {header['final_score_home']}-"
                f"{header['final_score_away']} {header['away_team']} | "
                f"shots={len(shots)} pbp={len(pbp)} players={len(pstats)} tstats={len(tstats)}"
            )
            return data

        except Exception as e:
            logger.error(f"Error scraping {game_id}: {e}")
            raise
        finally:
            await browser.close()


async def scrape_and_save(game_id: str, db_game_id: int, repository, headless: bool = True) -> dict:
    """
    Wrapper completo: scrapea + guarda en Supabase + marca PROCESSED.
    Retorna contadores.
    """
    data = await scrape_game(game_id, headless=headless)
    counts = repository.save_game_stats(db_game_id, data)
    logger.info(f"Partido {game_id} guardado y marcado como PROCESSED")
    return counts
