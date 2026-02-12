"""
BasketStats Pro — League Crawler
===================================
Navega a la URL de calendario de una liga FEB.
Extrae Jornadas, Partidos, Equipos (con feb_id) e IDs de partido.
Guarda todo via SupabaseRepository.

Estructura HTML confirmada (calendario.html):
  <h1 class="titulo-modulo">Jornada N DD/MM/YYYY</h1>
  <table>
    <tr>
      <td class="equipo local">
        <div class="contenedorLogoEquipoCalendario equipoLocal">
          <img src="https://imagenes.feb.es/Imagen.aspx?i=FEB_ID&ti=1">
          <a href="...Equipo.aspx?i=FEB_ID">NOMBRE EQUIPO</a>
        </div>
      </td>
      <td class="resultado">
        <a href="...Partido.aspx?p=GAME_ID">72-69</a>
      </td>
      <td class="equipo visitante">
        <div class="contenedorLogoEquipoCalendario equipoVisitante">
          <img src="...?i=FEB_ID&ti=1">
          <a href="...Equipo.aspx?i=FEB_ID">NOMBRE EQUIPO</a>
        </div>
      </td>
    </tr>
  </table>
"""

import asyncio
import logging
import re
import sys
import threading
from datetime import date
from typing import List, Dict, Optional

from playwright.async_api import async_playwright
from bs4 import BeautifulSoup
import httpx

logger = logging.getLogger(__name__)


def parse_calendario_html(html: str) -> List[Dict]:
    """
    Parsea el HTML del calendario de liga.
    
    Returns:
        Lista de dicts con:
        {
            'jornada': int,
            'jornada_date': date | None,
            'feb_game_id': str,
            'home_team_name': str,
            'home_team_feb_id': str,
            'home_team_logo': str,
            'away_team_name': str,
            'away_team_feb_id': str,
            'away_team_logo': str,
            'home_score': int | None,
            'away_score': int | None,
            'game_url': str,
        }
    """
    soup = BeautifulSoup(html, "lxml")
    games = []

    # Encontrar todas las jornadas: <h1 class="titulo-modulo">Jornada N DD/MM/YYYY</h1>
    headers = soup.find_all("h1", class_="titulo-modulo")
    logger.info(f"🔍 [PARSE] Encontrados {len(headers)} headers de jornada")

    for header in headers:
        header_text = header.get_text(strip=True)
        logger.debug(f"🔍 [PARSE] Header text: {header_text}")

        # Parsear "Jornada 1 05/10/2025"
        jornada_match = re.match(
            r"Jornada\s+(\d+)\s+(\d{2}/\d{2}/\d{4})", header_text
        )
        if not jornada_match:
            logger.warning(f"⚠️  [PARSE] No match para: {header_text}")
            continue

        jornada_num = int(jornada_match.group(1))
        date_str = jornada_match.group(2)
        logger.info(f"✅ [PARSE] Jornada {jornada_num} encontrada, fecha: {date_str}")
        try:
            d, m, y = date_str.split("/")
            jornada_date = date(int(y), int(m), int(d))
        except ValueError:
            jornada_date = None
            logger.error(f"❌ [PARSE] Error parseando fecha: {date_str}")

        # Buscar la tabla siguiente al h1
        table = header.find_next("table")
        if not table:
            continue

        rows = table.find("tbody").find_all("tr") if table.find("tbody") else table.find_all("tr")

        for row in rows:
            cells = row.find_all("td")
            if len(cells) < 3:
                continue

            local_cell = cells[0]
            resultado_cell = cells[1]
            visitante_cell = cells[2]

            # ─── Equipo local ───
            home_name, home_feb_id, home_logo = _extract_team(local_cell)
            # ─── Equipo visitante ───
            away_name, away_feb_id, away_logo = _extract_team(visitante_cell)
            # ─── Resultado y game_id ───
            feb_game_id, home_score, away_score, game_url = _extract_result(resultado_cell)

            if not feb_game_id or not home_name or not away_name:
                continue

            game_dict = {
                "jornada": jornada_num,
                "jornada_date": jornada_date,
                "feb_game_id": feb_game_id,
                "home_team_name": home_name,
                "home_team_feb_id": home_feb_id,
                "home_team_logo": home_logo,
                "away_team_name": away_name,
                "away_team_feb_id": away_feb_id,
                "away_team_logo": away_logo,
                "home_score": home_score,
                "away_score": away_score,
                "game_url": game_url,
            }
            games.append(game_dict)
            logger.debug(f"  ✅ Added: Jornada {jornada_num} | {home_name} vs {away_name} (ID: {feb_game_id})")

    logger.info(f"✅ [PARSE] Calendario parseado: {len(games)} partidos en {len(headers)} jornadas")
    if len(games) > 0:
        logger.info(f"   📋 Ejemplo primer partido: Jornada {games[0]['jornada']}, {games[0]['home_team_name']} vs {games[0]['away_team_name']}")
    return games


def _extract_team(cell) -> tuple:
    """Extrae (name, feb_id, logo_url) de una celda de equipo."""
    name = ""
    feb_id = ""
    logo_url = ""

    link = cell.find("a")
    if link:
        name = link.get_text(strip=True)
        href = link.get("href", "")
        id_match = re.search(r"[?&]i=(\d+)", href)
        if id_match:
            feb_id = id_match.group(1)

    img = cell.find("img")
    if img:
        logo_url = img.get("src", "")

    return name, feb_id, logo_url


def _extract_result(cell) -> tuple:
    """Extrae (feb_game_id, home_score, away_score, url) de la celda resultado."""
    feb_game_id = ""
    home_score = None
    away_score = None
    game_url = ""

    link = cell.find("a")
    if link:
        game_url = link.get("href", "")
        # Extraer game_id: Partido.aspx?p=2487031
        id_match = re.search(r"[?&]p=(\d+)", game_url)
        if id_match:
            feb_game_id = id_match.group(1)

        # Extraer score: "72-69"
        score_text = link.get_text(strip=True)
        score_match = re.match(r"(\d+)\s*-\s*(\d+)", score_text)
        if score_match:
            home_score = int(score_match.group(1))
            away_score = int(score_match.group(2))

    return feb_game_id, home_score, away_score, game_url


async def crawl_league(
    calendar_url: str,
    repository,
    league_id: Optional[int] = None,
    headless: bool = True,
) -> List[Dict]:
    """
    Navega a la URL del calendario, extrae partidos y los guarda en Supabase.

    Args:
        calendar_url: URL de la página de calendario FEB.
        repository: SupabaseRepository instance.
        league_id: ID de liga en la tabla leagues (opcional).
        headless: Browser mode.

    Returns:
        Lista de dicts con los partidos procesados y sus IDs de BD.
    """
    logger.info(f"Crawling calendario: {calendar_url}")

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=headless)
        context = await browser.new_context(ignore_https_errors=True)
        page = await context.new_page()

        try:
            await page.goto(calendar_url, wait_until="domcontentloaded", timeout=30000)
            await page.wait_for_load_state("networkidle", timeout=15000)
            html = await page.content()
        finally:
            await browser.close()

    # Parsear HTML
    parsed_games = parse_calendario_html(html)

    # Insertar en BD
    results = []
    logger.info(f"🎯 [CRAWL] Iniciando inserción de {len(parsed_games)} partidos en BD...")
    for idx, g in enumerate(parsed_games, 1):
        # get_or_create equipos
        home_team = repository.get_or_create_team(
            feb_id=g["home_team_feb_id"],
            name=g["home_team_name"],
            logo_url=g["home_team_logo"],
        )
        away_team = repository.get_or_create_team(
            feb_id=g["away_team_feb_id"],
            name=g["away_team_name"],
            logo_url=g["away_team_logo"],
        )

        # Determinar status
        has_score = g["home_score"] is not None and g["away_score"] is not None
        status = "PENDING" if has_score else "SCHEDULED"

        # upsert game
        logger.debug(f"  📍 [CRAWL] Partido {idx}: Jornada={g['jornada']}, {g['home_team_name']} vs {g['away_team_name']}")
        game = repository.upsert_game(
            feb_game_id=g["feb_game_id"],
            home_team_id=home_team["id"],
            away_team_id=away_team["id"],
            game_date=g["jornada_date"],
            home_score=g["home_score"],
            away_score=g["away_score"],
            league_id=league_id,
            url=g["game_url"],
            status=status,
            jornada=g["jornada"],
        )

        results.append({
            **g,
            "db_game_id": game["id"],
            "db_status": game["status"],
        })

    logger.info(
        f"✅ [CRAWL] Calendario guardado: {len(results)} partidos, "
        f"{sum(1 for r in results if r['db_status'] == 'PENDING')} PENDING"
    )
    
    # Verificar jornadas guardadas
    jornadas_guardadas = sorted(set(r.get('jornada') for r in results))
    logger.info(f"📊 [CRAWL] Jornadas en datos extraídos: {jornadas_guardadas}")
    return results


def crawl_league_from_html(
    html: str,
    repository,
    league_id: Optional[int] = None,
) -> List[Dict]:
    """
    Versión síncrona que parsea HTML ya descargado (sin Playwright).
    Útil para tests o cuando el HTML ya se tiene.
    """
    parsed_games = parse_calendario_html(html)
    results = []

    for g in parsed_games:
        home_team = repository.get_or_create_team(
            feb_id=g["home_team_feb_id"],
            name=g["home_team_name"],
            logo_url=g["home_team_logo"],
        )
        away_team = repository.get_or_create_team(
            feb_id=g["away_team_feb_id"],
            name=g["away_team_name"],
            logo_url=g["away_team_logo"],
        )

        has_score = g["home_score"] is not None and g["away_score"] is not None
        status = "PENDING" if has_score else "SCHEDULED"

        game = repository.upsert_game(
            feb_game_id=g["feb_game_id"],
            home_team_id=home_team["id"],
            away_team_id=away_team["id"],
            game_date=g["jornada_date"],
            home_score=g["home_score"],
            away_score=g["away_score"],
            league_id=league_id,
            url=g["game_url"],
            status=status,
            jornada=g["jornada"],
        )

        results.append({**g, "db_game_id": game["id"], "db_status": game["status"]})

    return results


def crawl_league_with_group(
    base_url: str,
    feb_group_id: str,
    repository,
    league_id: Optional[int] = None,
    season_year: str = "2025",
    headless: bool = True,
) -> List[Dict]:
    """
    Navega a una liga con su grupo específico usando Playwright.
    Ejecuta en thread separado para evitar conflictos con event loop de Streamlit en Windows.
    
    Args:
        base_url: URL base de la categoría FEB
        feb_group_id: ID del grupo a navegar (ej: "88882")
        repository: SupabaseRepository instance
        league_id: ID de liga en tabla 'leagues'
        season_year: Año de temporada (ej: "2025")
        headless: Modo navegador
        
    Returns:
        Lista de dicts con partidos procesados
    """
    
    logger.info(
        f"[GROUP] Navegando a liga con grupo {feb_group_id} "
        f"en {season_year}..."
    )
    
    # Ejecutar Playwright en thread separado (evita conflictos con Streamlit)
    result = {}
    error = {}
    
    def _run_playwright():
        """Ejecuta Playwright en thread separado"""
        try:
            # Configurar policy para Windows ANTES de crear event loop
            if sys.platform == 'win32':
                asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
            
            # En el thread, crear nuevo event loop
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            
            try:
                html = loop.run_until_complete(
                    _extract_calendar_with_group(
                        base_url, feb_group_id, season_year, headless
                    )
                )
                result["html"] = html
            finally:
                loop.close()
                
        except Exception as e:
            logger.error(f"[GROUP] Error en thread: {e}")
            error["exception"] = e
    
    # Crear y ejecutar thread
    thread = threading.Thread(target=_run_playwright, daemon=False)
    thread.start()
    thread.join()  # Esperar a que termine
    
    # Verificar si hubo error
    if error:
        raise error["exception"]
    
    html = result.get("html")
    
    if not html:
        logger.error("[GROUP] No se pudo obtener HTML del calendario")
        return []
    
    # Parsear y guardar igual que en crawl_league_sync
    parsed_games = parse_calendario_html(html)
    
    results = []
    for g in parsed_games:
        home_team = repository.get_or_create_team(
            feb_id=g["home_team_feb_id"],
            name=g["home_team_name"],
            logo_url=g["home_team_logo"],
        )
        away_team = repository.get_or_create_team(
            feb_id=g["away_team_feb_id"],
            name=g["away_team_name"],
            logo_url=g["away_team_logo"],
        )
        
        has_score = g["home_score"] is not None and g["away_score"] is not None
        status = "PENDING" if has_score else "SCHEDULED"
        
        game = repository.upsert_game(
            feb_game_id=g["feb_game_id"],
            home_team_id=home_team["id"],
            away_team_id=away_team["id"],
            game_date=g["jornada_date"],
            home_score=g["home_score"],
            away_score=g["away_score"],
            league_id=league_id,
            url=g["game_url"],
            status=status,
            jornada=g["jornada"],
        )
        
        results.append({
            **g,
            "db_game_id": game["id"],
            "db_status": game["status"],
        })
    
    logger.info("="*60)
    logger.info(f"[GROUP] ✅ Importación completada para grupo {feb_group_id}")
    logger.info(f"[GROUP] Total partidos procesados: {len(results)}")
    logger.info(
        f"[GROUP] Estados: "
        f"{sum(1 for r in results if r['db_status'] == 'PENDING')} PENDING, "
        f"{sum(1 for r in results if r['db_status'] == 'SCHEDULED')} SCHEDULED, "
        f"{sum(1 for r in results if r['db_status'] == 'COMPLETED')} COMPLETED"
    )
    logger.info("="*60)
    return results


async def _extract_calendar_with_group(
    base_url: str,
    feb_group_id: str,
    season_year: str,
    headless: bool,
) -> Optional[str]:
    """
    Helper async para navegar a liga + extraer HTML.
    Simplificado: solo carga la URL y extrae HTML (ignora selectores problemáticos).
    """
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=headless)
        context = await browser.new_context(ignore_https_errors=True)
        page = await context.new_page()
        
        try:
            # Navegar a la URL base
            logger.info(f"  → Navegando a {base_url}...")
            await page.goto(base_url, wait_until="domcontentloaded", timeout=30000)
            
            # Esperar a que cargue completamente
            logger.info(f"  → Esperando carga de página...")
            try:
                await page.wait_for_load_state("networkidle", timeout=15000)
            except:
                logger.info(f"  ℹ️ Timeout en networkidle, continuando...")
            
            logger.info(f"  ✅ Página cargada. Grupo a importar: {feb_group_id}")
            
            # Seleccionar grupo - CRÍTICO: sin esto, se descarga el primer grupo (A-A)
            logger.info(f"  → Buscando selector de grupo...")
            selector_group = "select#_ctl0_MainContentPlaceHolderMaster_gruposDropDownList"
            
            try:
                # Esperar a que aparezca el dropdown (timeout más generoso)
                await page.wait_for_selector(selector_group, timeout=10000)
                logger.info(f"  ✅ Dropdown encontrado")
                
                # Obtener grupo actualmente seleccionado
                current_value = await page.evaluate(f'document.querySelector("{selector_group}").value')
                logger.info(f"  📍 Grupo actual en dropdown: {current_value}")
                
                # Si ya está en el grupo correcto, no hacer nada
                if current_value == feb_group_id:
                    logger.info(f"  ✅ Ya estamos en el grupo correcto: {feb_group_id}")
                else:
                    logger.info(f"  🔄 Cambiando a grupo {feb_group_id}...")
                    
                    # Seleccionar el grupo
                    await page.select_option(selector_group, value=feb_group_id)
                    logger.info(f"  ✅ Grupo {feb_group_id} seleccionado en dropdown")
                    
                    # Esperar a que la página recargue con el nuevo grupo
                    logger.info(f"  ⏳ Esperando recarga de página...")
                    await page.wait_for_load_state("networkidle", timeout=15000)
                    
                    # Verificar que se aplicó el cambio
                    new_value = await page.evaluate(f'document.querySelector("{selector_group}").value')
                    logger.info(f"  📍 Nuevo valor en dropdown: {new_value}")
                    
                    if new_value != feb_group_id:
                        raise ValueError(
                            f"❌ FALLO: Grupo no cambió correctamente. "
                            f"Esperado: {feb_group_id}, Actual: {new_value}"
                        )
                    
                    logger.info(f"  ✅ Grupo {feb_group_id} confirmado")
                    
            except Exception as e:
                logger.error(f"❌ Error fatal: No se pudo seleccionar grupo {feb_group_id}")
                logger.error(f"   Detalle: {str(e)}")
                raise ValueError(
                    f"No se pudo seleccionar el grupo {feb_group_id}. "
                    f"El dropdown puede no existir o el ID es incorrecto. Error: {str(e)[:150]}"
                )
            
            # Esperar a que aparezcan las jornadas
            logger.info(f"  → Esperando a que carguen las jornadas...")
            try:
                await page.wait_for_selector("h1.titulo-modulo", timeout=10000)
                logger.info(f"  ✅ Jornadas cargadas")
            except:
                logger.warning(f"  ⚠️ No se encontraron headers de jornada, pero continuando...")
            
            # Extraer HTML
            html = await page.content()
            logger.info(f"  ✅ HTML extraído exitosamente ({len(html)} bytes)")
            return html
            
        except Exception as e:
            logger.error(f"❌ Error fatal en _extract_calendar_with_group: {str(e)[:200]}")
            raise
        finally:
            await browser.close()


def crawl_league_sync(
    calendar_url: str,
    repository,
    league_id: Optional[int] = None,
) -> List[Dict]:
    """
    Versión SÍNCRONA del crawler usando httpx (sin Playwright, sin asyncio).
    Perfecto para Streamlit en Windows.

    Args:
        calendar_url: URL de la página de calendario FEB.
        repository: SupabaseRepository instance.
        league_id: ID de liga en la tabla leagues (opcional).

    Returns:
        Lista de dicts con los partidos procesados y sus IDs de BD.
    """
    logger.info(f"[SYNC] Crawling calendario: {calendar_url}")

    # Descargar HTML con httpx (síncrono)
    try:
        client = httpx.Client(timeout=30.0)
        response = client.get(calendar_url, follow_redirects=True)
        response.raise_for_status()
        html = response.text
        client.close()
    except Exception as e:
        logger.error(f"Error descargando calendario: {e}")
        raise

    # Parsear HTML
    parsed_games = parse_calendario_html(html)

    # Insertar en BD
    results = []
    for g in parsed_games:
        # get_or_create equipos
        home_team = repository.get_or_create_team(
            feb_id=g["home_team_feb_id"],
            name=g["home_team_name"],
            logo_url=g["home_team_logo"],
        )
        away_team = repository.get_or_create_team(
            feb_id=g["away_team_feb_id"],
            name=g["away_team_name"],
            logo_url=g["away_team_logo"],
        )

        # Determinar status
        has_score = g["home_score"] is not None and g["away_score"] is not None
        status = "PENDING" if has_score else "SCHEDULED"

        # upsert game
        game = repository.upsert_game(
            feb_game_id=g["feb_game_id"],
            home_team_id=home_team["id"],
            away_team_id=away_team["id"],
            game_date=g["jornada_date"],
            home_score=g["home_score"],
            away_score=g["away_score"],
            league_id=league_id,
            url=g["game_url"],
            status=status,
            jornada=g["jornada"],
        )

        results.append({**g, "db_game_id": game["id"], "db_status": game["status"]})

    logger.info(
        f"[SYNC] Calendario guardado: {len(results)} partidos, "
        f"{sum(1 for r in results if r['db_status'] == 'PENDING')} PENDING"
    )
    return results


