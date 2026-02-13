"""
BasketStats Pro — SupabaseRepository
======================================
Capa de datos para insertar/consultar partidos en Supabase (PostgreSQL).

Tablas soportadas:
  teams, players, games,
  stats_player_games, play_by_play, shots, stats_team_games

Patrón: get_or_create para maestras, upsert para partidos,
        delete + bulk insert para stats (idempotente al re-procesar).
"""

import logging
import re
from datetime import date, datetime
from typing import Optional, List, Dict

from supabase import create_client, Client

logger = logging.getLogger(__name__)


class SupabaseRepository:
    """Repositorio central para operaciones contra Supabase."""

    def __init__(self, url: str, key: str):
        self.url = url
        self.key = key
        self.client: Client = create_client(url, key)
    
    def refresh_connection(self):
        """Reinicia la conexión para limpiar el schema cache de PostgREST."""
        self.client = create_client(self.url, self.key)
        
        # Forzar recarga del schema de stats_team_games con una query dummy
        try:
            self.client.table("stats_team_games").select("id").limit(1).execute()
            logger.info("Schema cache de stats_team_games actualizado")
        except Exception as e:
            logger.warning(f"No se pudo actualizar schema cache: {e}")
        
        logger.info("Conexión a Supabase renovada")

    # ─────────────────────────────────────────────────────────────
    # TEAMS
    # ─────────────────────────────────────────────────────────────

    def get_or_create_team(self, feb_id: str, name: str, logo_url: str = "") -> dict:
        """
        Busca un equipo por feb_id.  Si no existe, lo crea.
        Retorna la fila completa {id, feb_id, name, logo_url}.
        """
        res = (
            self.client.table("teams")
            .select("*")
            .eq("feb_id", feb_id)
            .execute()
        )
        if res.data:
            return res.data[0]

        row = {"feb_id": feb_id, "name": name, "logo_url": logo_url}
        res = self.client.table("teams").insert(row).execute()
        logger.info(f"Equipo creado: {name} (feb_id={feb_id})")
        return res.data[0]

    def get_team_by_name(self, name: str) -> Optional[dict]:
        """Busca equipo por nombre con matching flexible."""
        # 1. Intentar match exacto
        res = (
            self.client.table("teams")
            .select("*")
            .eq("name", name)
            .execute()
        )
        if res.data:
            return res.data[0]
        
        # 2. Normalizar y buscar (trim + uppercase)
        normalized = ' '.join(name.upper().split())
        logger.debug(f"Búsqueda exacta fallida para '{name}'. Probando normalizado: '{normalized}'")
        
        all_teams = self.client.table("teams").select("*").execute()
        for team in all_teams.data:
            team_normalized = ' '.join(team['name'].upper().split())
            if team_normalized == normalized:
                logger.info(f"Match normalizado: '{name}' -> '{team['name']}' (ID {team['id']})")
                return team
        
        # 3. Búsqueda parcial (contiene)
        for team in all_teams.data:
            team_norm = ' '.join(team['name'].upper().split())
            if normalized in team_norm or team_norm in normalized:
                logger.warning(f"Match parcial: '{name}' -> '{team['name']}' (ID {team['id']})")
                return team
        
        logger.error(f"No se encontró equipo para: '{name}'. Equipos disponibles: {[t['name'] for t in all_teams.data[:5]]}")
        return None

    # ─────────────────────────────────────────────────────────────
    # PLAYERS
    # ─────────────────────────────────────────────────────────────

    def get_or_create_player(
        self,
        name: str,
        team_id: int,
        feb_player_id: str = None,
        jersey_number: int = None,
    ) -> dict:
        """
        Busca o crea jugador usando FEB Player ID como identificador único.
        
        ESTRATEGIA (anti-duplicados):
        1. Si llega feb_player_id: buscar por feb_player_id → IDENTIFICADOR MÁS FIABLE
        2. Si existe: actualizar name (si más largo), current_team_id, jersey_number
        3. Si NO existe con feb_player_id: buscar por (team_id, name) como fallback
        4. Si NO existe: crear nuevo con feb_player_id
        
        Args:
            name: Nombre del jugador (puede ser corto "J. GRANGER" o largo "GRANGER, JAYSON")
            team_id: ID del equipo actual
            feb_player_id: ID único de FEB (extraído de Jugador.aspx?i=XXXXXX) - CLAVE ÚNICA
            jersey_number: Número de camiseta actual (puede cambiar)
            
        Returns:
            dict: Player row {id, feb_player_id, name, current_team_id, jersey_number}
        """
        existing_player = None
        
        # ── PASO 1: Buscar por feb_player_id (más fiable, único global) ──
        if feb_player_id:
            res = (
                self.client.table("players")
                .select("*")
                .eq("feb_player_id", feb_player_id)
                .execute()
            )
            if res.data:
                existing_player = res.data[0]
                
                # ── PASO 2: Actualizar datos si hay cambios ──
                updates = {}
                
                # Actualizar nombre si el nuevo es más largo
                existing_name = existing_player["name"]
                if self._is_longer_name(name, existing_name):
                    updates["name"] = name
                    logger.info(
                        f"✅ Nombre actualizado: '{existing_name}' → '{name}' "
                        f"(feb_id={feb_player_id})"
                    )
                
                # Actualizar equipo si cambió
                if existing_player["current_team_id"] != team_id:
                    updates["current_team_id"] = team_id
                    logger.info(
                        f"🔄 Jugador cambió de equipo: {name} "
                        f"(team_id: {existing_player['current_team_id']} → {team_id})"
                    )
                
                # Actualizar jersey_number si cambió
                if jersey_number is not None and existing_player.get("jersey_number") != jersey_number:
                    updates["jersey_number"] = jersey_number
                    logger.info(
                        f"🔄 Jersey actualizado: {name} "
                        f"(#{existing_player.get('jersey_number')} → #{jersey_number})"
                    )
                
                # Aplicar updates si hay cambios
                if updates:
                    update_res = (
                        self.client.table("players")
                        .update(updates)
                        .eq("feb_player_id", feb_player_id)
                        .execute()
                    )
                    existing_player.update(updates)
                
                return existing_player
        
        # ── PASO 3: Fallback - buscar por (team_id, nombre) ──
        if not existing_player:
            res = (
                self.client.table("players")
                .select("*")
                .eq("name", name)
                .eq("current_team_id", team_id)
                .execute()
            )
            if res.data:
                existing_player = res.data[0]
                
                # Si encontramos por nombre pero ahora tenemos feb_player_id, actualizarlo
                updates = {}
                if feb_player_id and not existing_player.get("feb_player_id"):
                    updates["feb_player_id"] = feb_player_id
                    logger.info(
                        f"✅ FEB ID añadido: {name} → feb_id={feb_player_id}"
                    )
                
                # Actualizar jersey_number si lo tenemos
                if jersey_number is not None and not existing_player.get("jersey_number"):
                    updates["jersey_number"] = jersey_number
                    logger.info(
                        f"✅ Jersey añadido: {name} → #{jersey_number}"
                    )
                
                # Aplicar updates si hay
                if updates:
                    update_res = (
                        self.client.table("players")
                        .update(updates)
                        .eq("id", existing_player["id"])
                        .execute()
                    )
                    existing_player.update(updates)
                
                return existing_player
        
        # ── PASO 4: No existe - crear nuevo ──
        row = {
            "name": name,
            "current_team_id": team_id,
        }
        if feb_player_id:
            row["feb_player_id"] = feb_player_id
        if jersey_number is not None:
            row["jersey_number"] = jersey_number
        
        res = self.client.table("players").insert(row).execute()
        logger.info(
            f"🆕 Jugador creado: {name} "
            f"(team={team_id}, feb_id={feb_player_id or 'N/A'}, jersey={jersey_number or 'N/A'})"
        )
        return res.data[0]
    
    def _is_longer_name(self, new_name: str, existing_name: str) -> bool:
        """
        Determina si un nombre es más completo que otro.
        
        Criterios:
        - Más caracteres
        - Contiene coma (formato "APELLIDO, NOMBRE")
        - No tiene iniciales con punto (J. → JASON)
        """
        new_len = len(new_name)
        existing_len = len(existing_name)
        
        # Más largo en caracteres
        if new_len > existing_len:
            return True
        
        # Formato completo con coma vs sin coma
        if "," in new_name and "," not in existing_name:
            return True
        
        # Sin iniciales (J.) vs con iniciales
        if "." not in new_name and "." in existing_name:
            return True
        
        return False

    # ─────────────────────────────────────────────────────────────
    # GAMES
    # ─────────────────────────────────────────────────────────────

    def upsert_game(
        self,
        feb_game_id: str,
        home_team_id: int,
        away_team_id: int,
        game_date: Optional[date] = None,
        home_score: Optional[int] = None,
        away_score: Optional[int] = None,
        league_id: Optional[int] = None,
        url: str = "",
        status: str = "PENDING",
        jornada: Optional[int] = None,
    ) -> dict:
        """
        Crea o actualiza un partido por feb_game_id.
        Si league_id es None o 0, no se incluye en el insert (queda NULL en BD).
        Retorna la fila completa.
        """
        res = (
            self.client.table("games")
            .select("*")
            .eq("feb_game_id", feb_game_id)
            .execute()
        )

        row = {
            "feb_game_id": feb_game_id,
            "home_team_id": home_team_id,
            "away_team_id": away_team_id,
            "url": url,
            "status": status,
        }
        if league_id and league_id > 0:
            row["league_id"] = league_id
        if game_date is not None:
            row["date"] = game_date.isoformat()
        if home_score is not None:
            row["home_score"] = home_score
        if away_score is not None:
            row["away_score"] = away_score
        # NOTE: No agregar jornada aquí para evitar schema cache issues
        # Se hará UPDATE por separado después si jornada existe

        if res.data:
            game_id = res.data[0]["id"]
            try:
                self.client.table("games").update(row).eq("id", game_id).execute()
                logger.info(f"✅ Partido actualizado: {feb_game_id}")
            except Exception as e:
                logger.warning(f"⚠️  Error actualizando: {e}")
                raise
            
            # UPDATE jornada por separado si existe
            if jornada is not None:
                try:
                    logger.info(f"📝 [REPO] Guardando jornada={jornada} para feb_game_id={feb_game_id}")
                    self.client.table("games").update({"jornada": jornada}).eq("id", game_id).execute()
                    logger.info(f"✅ Jornada actualizada: {feb_game_id} (jornada={jornada})")
                except Exception as e:
                    # Si falla con columna jornada, simplemente log y continua
                    logger.warning(f"⚠️  No se pudo actualizar jornada: {str(e)[:100]}")
            
            # Refetch para devolver fila actualizada
            return self.client.table("games").select("*").eq("id", game_id).execute().data[0]
        else:
            try:
                res = self.client.table("games").insert(row).execute()
                game_id = res.data[0]["id"]
                logger.info(f"✅ Partido creado: {feb_game_id}")
            except Exception as e:
                logger.error(f"❌ Error creando partido: {e}")
                raise
            
            # UPDATE jornada por separado si existe
            if jornada is not None:
                try:
                    logger.info(f"📝 [REPO] Guardando jornada={jornada} para feb_game_id={feb_game_id}")
                    self.client.table("games").update({"jornada": jornada}).eq("id", game_id).execute()
                    logger.info(f"✅ Jornada guardada: {feb_game_id} (jornada={jornada})")
                except Exception as e:
                    # Si falla, simplemente log y continua
                    logger.warning(f"⚠️  No se pudo guardar jornada: {str(e)[:100]}")
            
            return self.client.table("games").select("*").eq("id", game_id).execute().data[0]

    def get_game_by_feb_id(self, feb_game_id: str) -> Optional[dict]:
        res = (
            self.client.table("games")
            .select("*")
            .eq("feb_game_id", feb_game_id)
            .execute()
        )
        return res.data[0] if res.data else None

    def get_pending_games(self, league_id: Optional[int] = None) -> List[dict]:
        """Devuelve partidos con status=PENDING."""
        query = self.client.table("games").select("*").eq("status", "PENDING")
        if league_id is not None:
            query = query.eq("league_id", league_id)
        return query.execute().data

    def update_game_status(self, game_id: int, status: str):
        self.client.table("games").update({"status": status}).eq("id", game_id).execute()

    # ─────────────────────────────────────────────────────────────
    # SAVE GAME STATS  (delete + bulk insert — idempotente)
    # ─────────────────────────────────────────────────────────────

    def save_game_stats(self, game_db_id: int, data) -> dict:
        """
        Recibe un game_db_id (PK de 'games') y un FullGameData.
        1. Borra stats previas de ese game_id.
        2. Inserta shots, play_by_play, stats_player_games, stats_team_games.
        3. Actualiza games.status = 'PROCESSED'.

        Retorna contadores {shots, pbp, players, team_stats}.
        """
        feb_game_id = data.game_id  # string que viene del scraper
        
        # Renovar conexión para asegurar schema actualizado (evita error PGRST204)
        self.refresh_connection()

        # Resolver IDs de equipos por nombre
        logger.info(f"Buscando equipos: home='{data.home_team}', away='{data.away_team}'")
        home_team = self.get_team_by_name(data.home_team)
        away_team = self.get_team_by_name(data.away_team)

        if not home_team or not away_team:
            # Obtener lista de equipos disponibles para el mensaje de error
            all_teams = self.client.table("teams").select("name").execute()
            available = [t['name'] for t in all_teams.data]
            raise ValueError(
                f"Equipos no encontrados en BD:\n"
                f"  Buscado HOME: '{data.home_team}' -> {'ENCONTRADO' if home_team else 'NO ENCONTRADO'}\n"
                f"  Buscado AWAY: '{data.away_team}' -> {'ENCONTRADO' if away_team else 'NO ENCONTRADO'}\n"
                f"  Equipos disponibles en BD ({len(available)}): {', '.join(available[:10])}..."
            )

        home_team_id = home_team["id"]
        away_team_id = away_team["id"]

        # ── 1. Borrar datos previos ──
        for table in ("shots", "play_by_play", "stats_player_games", "stats_team_games"):
            self.client.table(table).delete().eq("game_id", game_db_id).execute()
        logger.info(f"Stats previas borradas para game_id={game_db_id}")

        # ── 2. Actualizar marcador en games ──
        update_payload = {
            "home_score": data.final_score_home,
            "away_score": data.final_score_away,
            "status": "PROCESSED",
        }
        if data.game_date:
            update_payload["date"] = data.game_date.isoformat()
        self.client.table("games").update(update_payload).eq("id", game_db_id).execute()

        # ── 3. CREAR JUGADORES PRIMERO (de stats_player_games) ──
        # Esto crea diccionarios para mapear jugadores a IDs
        player_map = {}  # {"PLAYER NAME": player_id, ...}
        player_number_map = {}  # {(team_id, jersey_number): player_id, ...}
        player_rows = []
        seen_players = set()  # Para prevenir duplicados: player_id (un jugador solo puede aparecer una vez por partido)
        
        for ps in data.player_stats:
            # Resolver team_id
            if ps.team_name == data.home_team:
                ps_team_id = home_team_id
            elif ps.team_name == data.away_team:
                ps_team_id = away_team_id
            else:
                t = self.get_team_by_name(ps.team_name)
                ps_team_id = t["id"] if t else home_team_id  # fallback

            # get_or_create_player CON feb_player_id + jersey_number (previene duplicados)
            jersey_num = None
            if ps.jersey_number:
                try:
                    jersey_num = int(ps.jersey_number)
                except (ValueError, TypeError):
                    pass  # No es numérico, dejamos None
            
            player = self.get_or_create_player(
                name=ps.player_name,
                team_id=ps_team_id,
                feb_player_id=ps.feb_player_id,  # ✅ CLAVE ÚNICA
                jersey_number=jersey_num,
            )
            
            # Verificar si ya procesamos este jugador en este partido
            player_key = player["id"]
            if player_key in seen_players:
                logger.warning(f"Jugador duplicado detectado: {ps.player_name} (player_id={player['id']}, team_id={ps_team_id}). Omitiendo.")
                continue
            seen_players.add(player_key)
            
            # Guardar en maps para usar en shots/pbp
            player_map[ps.player_name] = player["id"]
            
            # Mapear también por número de camiseta (para shots)
            if jersey_num is not None:
                player_number_map[(ps_team_id, jersey_num)] = player["id"]

            player_rows.append({
                "game_id": game_db_id,
                "player_id": player["id"],
                "team_id": ps_team_id,
                "starter": ps.starter,
                "minutes": ps.minutes_played,
                "points": ps.points,
                "t2_made": ps.fg2_made,
                "t2_att": ps.fg2_attempted,
                "t3_made": ps.fg3_made,
                "t3_att": ps.fg3_attempted,
                "ft_made": ps.ft_made,
                "ft_att": ps.ft_attempted,
                "reb_off": ps.rebounds_offensive,
                "reb_def": ps.rebounds_defensive,
                "reb_tot": ps.rebounds_total,
                "assists": ps.assists,
                "steals": ps.steals,
                "turnovers": ps.turnovers,
                "blocks_for": ps.blocks,
                "blocks_against": getattr(ps, "blocks_against", 0),
                "fouls_comm": ps.fouls,
                "fouls_rec": ps.fouls_received,
                "valoracion": ps.efficiency or 0,
                "plus_minus": ps.plus_minus or 0,
            })
        
        if player_rows:
            self._bulk_insert("stats_player_games", player_rows)
            logger.info(f"Guardadas stats de {len(player_rows)} jugadores")

        # ── 4. PLAY-BY-PLAY PRIMERO (para obtener IDs y vincular shots) ──
        pbp_rows = []
        
        # Crear un map normalizado de nombres de jugadores (sin acentos, mayúsculas, etc.)
        import unicodedata
        def normalize_name(name):
            """Normaliza nombre: sin acentos, mayúsculas, espacios extra, sin comas ni puntos"""
            if not name:
                return ""
            # Quitar acentos
            nfd = unicodedata.normalize('NFD', name)
            without_accents = ''.join(c for c in nfd if unicodedata.category(c) != 'Mn')
            # Quitar comas, puntos, mayúsculas y sin espacios extra
            cleaned = without_accents.replace(',', '').replace('.', '').upper()
            return ' '.join(cleaned.split())
        
        player_map_normalized = {normalize_name(k): v for k, v in player_map.items()}
        
        unmatched_players = set()
        
        # Limpiar partial scores: propagar último marcador conocido
        last_home_score = 0
        last_away_score = 0
        
        for ev in data.play_by_play:
            ev_team_id = home_team_id if ev.team_name == data.home_team else away_team_id

            # Resolver player_id con normalización de nombres
            ev_player_id = None
            if ev.player_name:
                ev_player_id = player_map.get(ev.player_name)
                if not ev_player_id:
                    normalized = normalize_name(ev.player_name)
                    ev_player_id = player_map_normalized.get(normalized)
                    if not ev_player_id:
                        unmatched_players.add((ev.player_name, normalized, ev.action_type))

            # Propagar partial scores: usar último conocido si actual es None
            if ev.score_home is not None:
                last_home_score = ev.score_home
            if ev.score_away is not None:
                last_away_score = ev.score_away

            pbp_rows.append({
                "game_id": game_db_id,
                "quarter": ev.quarter,
                "minute": ev.minute,
                "team_id": ev_team_id,
                "player_id": ev_player_id,
                "action_type": ev.action_type,  # Ultra-específico: 2pt_made, steal, sub_in, etc.
                "action_value": ev.action_value or 0,
                "stat_count": ev.stat_count,
                "free_throws_awarded": ev.free_throws_awarded or 0,  # TL generados por falta
                "home_score_partial": last_home_score,
                "away_score_partial": last_away_score,
            })
        
        # Insertar PBP y obtener IDs generados
        pbp_ids = []  # Lista de IDs generados en orden
        if pbp_rows:
            pbp_ids = self._bulk_insert_returning_ids("play_by_play", pbp_rows)
            
            pbp_with_player = sum(1 for row in pbp_rows if row["player_id"] is not None)
            pbp_without_player = len(pbp_rows) - pbp_with_player
            logger.info(f"Guardados {len(pbp_rows)} eventos PBP ({pbp_with_player} con player_id, {pbp_without_player} sin)")
            
            if unmatched_players:
                logger.warning(f"⚠️ {len(unmatched_players)} jugadores únicos NO encontrados en play_by_play:")
                for pname, pnorm, action in sorted(unmatched_players):
                    logger.warning(f"  - '{pname}' (normalizado: '{pnorm}') en acción: {action}")
            else:
                logger.info("✅ All play-by-play events successfully matched to players")

        # ── 5. SHOTS → vinculados a PBP via pbp_id ──
        # Construir un índice de PBP para vincular tiros
        # Criterio: mismo quarter + mismo player_id + action_type de tiro (_made o _missed)
        # Un PBP puede tener múltiples tiros del mismo jugador en el mismo quarter,
        # así que usamos listas para manejar colisiones
        from collections import defaultdict
        pbp_shot_lists = defaultdict(list)  # (quarter, player_id) → [pbp_id, ...]
        
        # Nuevos action_type específicos: 2pt_made, 2pt_missed, 3pt_made, 3pt_missed, ft_made, ft_missed, dunk_made
        shot_action_types = {"2pt_made", "2pt_missed", "3pt_made", "3pt_missed", "ft_made", "ft_missed", "dunk_made"}
        
        for idx, row in enumerate(pbp_rows):
            action = row.get("action_type", "")
            if action in shot_action_types:
                if idx < len(pbp_ids):
                    key = (row["quarter"], row["player_id"])
                    # _made types incluyen: 2pt_made, 3pt_made, ft_made, dunk_made
                    pbp_shot_lists[key].append({
                        "pbp_id": pbp_ids[idx],
                        "made": action.endswith("_made"),  # Detecta si termina en _made
                    })
        
        shots_rows = []
        linked_count = 0
        for s in data.shots:
            t_id = home_team_id if s.team_id == 0 else away_team_id
            p_id = player_number_map.get((t_id, s.player_number))
            
            # Intentar vincular con PBP
            pbp_id = None
            if p_id:
                key = (s.quarter, p_id)
                candidates = pbp_shot_lists.get(key, [])
                shot_made = s.result == "made"
                # Buscar match con mismo resultado (made/missed)
                for i, c in enumerate(candidates):
                    if c["made"] == shot_made:
                        pbp_id = c["pbp_id"]
                        candidates.pop(i)  # Consumir para evitar doble vinculación
                        linked_count += 1
                        break
            
            # ── ROTACIÓN Y NORMALIZACIÓN: convertir horizontal → vertical ──
            # FEB usa X=largo (0-100), Y=ancho (0-100)
            # Dashboard usa orientación vertical: canasta arriba, medio campo abajo
            # Resultado: Y ∈ [0,50], X ∈ [0,100], canasta en (50, ~5.5)
            
            x_orig = s.x_coordinate
            y_orig = s.y_coordinate
            
            if x_orig > 50:
                # Canasta derecha → rotar y reflejar
                x_norm = 100 - y_orig
                y_norm = 100 - x_orig
            else:
                # Canasta izquierda → rotar directo
                x_norm = y_orig
                y_norm = x_orig
            
            shots_rows.append({
                "game_id": game_db_id,
                "pbp_id": pbp_id,
                "player_id": p_id,
                "team_id": t_id,
                "x_coord": x_norm,
                "y_coord": y_norm,
                "made": s.result == "made",
                "quarter": s.quarter,
                "zone": s.zone,
            })
        if shots_rows:
            self._bulk_insert("shots", shots_rows)
            logger.info(f"Guardados {len(shots_rows)} tiros ({linked_count} vinculados a PBP, rotación vertical aplicada)")

        # ── 6. STATS_TEAM_GAMES (COMPLETAS) ──
        # Calcular reb_off, reb_def, blocks_against, fouls_rec desde los player stats
        team_aggregated = {}
        for pr in player_rows:
            tid = pr["team_id"]
            if tid not in team_aggregated:
                team_aggregated[tid] = {"reb_off": 0, "reb_def": 0, "blocks_against": 0, "fouls_rec": 0}
            team_aggregated[tid]["reb_off"] += pr.get("reb_off", 0) or 0
            team_aggregated[tid]["reb_def"] += pr.get("reb_def", 0) or 0
            team_aggregated[tid]["blocks_against"] += pr.get("blocks_against", 0) or 0
            team_aggregated[tid]["fouls_rec"] += pr.get("fouls_rec", 0) or 0

        # SOLO procesar las primeras 2 team stats (home y away) para evitar duplicados
        team_stats_to_process = data.team_stats[:2] if len(data.team_stats) >= 2 else data.team_stats
        
        team_stats_rows = []
        seen_teams = set()  # Prevenir duplicados por team_id
        
        for ts in team_stats_to_process:
            if ts.team_name == data.home_team:
                ts_team_id = home_team_id
            elif ts.team_name == data.away_team:
                ts_team_id = away_team_id
            else:
                continue
            
            # Evitar duplicados: un equipo solo puede aparecer una vez
            if ts_team_id in seen_teams:
                logger.warning(f"Team stats duplicado detectado para team_id={ts_team_id}. Omitiendo.")
                continue
            seen_teams.add(ts_team_id)

            agg = team_aggregated.get(ts_team_id, {})
            team_stats_rows.append({
                "game_id": game_db_id,
                "team_id": ts_team_id,
                # Field Goals (Total)
                "fg_made": ts.fg_made,
                "fg_att": ts.fg_attempted,
                "fg_pct": ts.fg_percentage,
                # Tiros de 2
                "t2_made": ts.fg2_made,
                "t2_att": ts.fg2_attempted,
                "t2_pct": ts.fg2_percentage,
                # Tiros de 3
                "t3_made": ts.fg3_made,
                "t3_att": ts.fg3_attempted,
                "t3_pct": ts.fg3_percentage,
                # Tiros libres
                "ft_made": ts.ft_made,
                "ft_att": ts.ft_attempted,
                "ft_pct": ts.ft_percentage,
                # Rebotes (total del scraper + off/def de player stats)
                "reb_tot": ts.total_rebounds or 0,
                "reb_off": agg.get("reb_off", 0),
                "reb_def": agg.get("reb_def", 0),
                # Otras estadísticas
                "assists": ts.assists or 0,
                "steals": ts.steals or 0,
                "turnovers": ts.turnovers or 0,
                "blocks_for": ts.blocks or 0,
                "blocks_against": agg.get("blocks_against", 0),
                "fouls_comm": ts.fouls or 0,
                "fouls_rec": agg.get("fouls_rec", 0)
            })
        
        # Asegurar que solo tenemos exactamente 2 team stats (home y away)
        if len(team_stats_rows) > 2:
            logger.error(f"ADVERTENCIA: Se generaron {len(team_stats_rows)} team stats (esperado: 2). Usando solo los primeros 2.")
            team_stats_rows = team_stats_rows[:2]
        
        if team_stats_rows:
            # Refrescar conexión justo antes del insert para forzar schema actualizado
            logger.info("Refrescando schema de stats_team_games...")
            self.refresh_connection()
            
            self._bulk_insert("stats_team_games", team_stats_rows)
            logger.info(f"Guardadas stats de {len(team_stats_rows)} equipos")

        counts = {
            "shots": len(shots_rows),
            "pbp": len(pbp_rows),
            "stats": len(player_rows),
            "team_stats": len(team_stats_rows),
        }
        logger.info(f"Game {game_db_id} guardado: {counts}")
        return counts

    # ─────────────────────────────────────────────────────────────
    # LEAGUES (for league discovery)
    # ─────────────────────────────────────────────────────────────

    def upsert_league(
        self,
        name: str,
        group_name: str,
        feb_group_id: str,
        base_url: str,
        season_year: str,
    ) -> dict:
        """
        Inserta o actualiza una liga/grupo en la tabla 'leagues'.
        
        Args:
            name: Nombre de la categoría (ej: "Tercera FEB")
            group_name: Nombre del grupo (ej: "Liga Regular A-A")
            feb_group_id: ID del grupo en FEB (ej: "88882")
            base_url: URL base para crawlear
            season_year: Año de temporada (ej: "2025")
            
        Returns:
            Fila insertada/actualizada desde Supabase
        """
        # Buscar si ya existe
        res = (
            self.client.table("leagues")
            .select("*")
            .eq("feb_group_id", feb_group_id)
            .eq("season_year", season_year)
            .execute()
        )
        
        if res.data:
            # Actualizar
            league_record = res.data[0]
            update_row = {
                "name": name,
                "group_name": group_name,
                "base_url": base_url,
            }
            self.client.table("leagues").update(update_row).eq(
                "id", league_record["id"]
            ).execute()
            logger.debug(f"Liga actualizada: {name} - {group_name}")
            return league_record
        
        # Crear
        row = {
            "name": name,
            "group_name": group_name,
            "feb_group_id": feb_group_id,
            "base_url": base_url,
            "season_year": season_year,
        }
        res = self.client.table("leagues").insert(row).execute()
        logger.info(f"Liga creada: {name} - {group_name}")
        return res.data[0]

    def get_leagues(self, season_year: Optional[str] = None) -> List[dict]:
        """
        Recupera todas las ligas (opcionalmente filtradas por año).
        
        Returns:
            Lista de dicts con campos: id, name, group_name, feb_group_id, base_url, season_year
        """
        query = self.client.table("leagues").select("*")
        
        if season_year:
            query = query.eq("season_year", season_year)
        
        res = query.execute()
        return res.data or []

    def get_all_leagues(self) -> List[dict]:
        """Alias para get_leagues() sin filtro."""
        return self.get_leagues()

    def get_games_by_league(self, league_id: int) -> List[dict]:
        """
        Recupera todos los partidos de una liga.
        
        Returns:
            Lista de games con join a teams para nombres
        """
        res = (
            self.client.table("games")
            .select("*, home_team:teams!games_home_team_id_fkey(name), away_team:teams!games_away_team_id_fkey(name)")
            .eq("league_id", league_id)
            .order("date")
            .execute()
        )
        return res.data or []

    def get_game_by_id(self, game_id: int) -> Optional[dict]:
        """
        Recupera un partido por ID con datos de teams.
        """
        res = (
            self.client.table("games")
            .select("*, home_team:teams!games_home_team_id_fkey(name, logo_url), away_team:teams!games_away_team_id_fkey(name, logo_url)")
            .eq("id", game_id)
            .execute()
        )
        return res.data[0] if res.data else None

    def get_player_stats_by_game(self, game_id: int) -> List[dict]:
        """
        Recupera estadísticas de jugadores para un partido.
        """
        res = (
            self.client.table("stats_player_games")
            .select("*, player:players(name), team:teams(name)")
            .eq("game_id", game_id)
            .order("points", desc=True)
            .execute()
        )
        return res.data or []

    def get_play_by_play(self, game_id: int, limit: int = 10) -> List[dict]:
        """
        Recupera eventos play-by-play de un partido.
        """
        res = (
            self.client.table("play_by_play")
            .select("*")
            .eq("game_id", game_id)
            .order("minute")
            .limit(limit)
            .execute()
        )
        return res.data or []

    def get_dashboard_stats(self) -> dict:
        """
        Recupera estadísticas para el dashboard.
        
        Returns:
            Dict con: total_leagues, total_games, total_processed, total_pending
        """
        # Total ligas
        leagues = self.client.table("leagues").select("*", count="exact").execute()
        
        # Total games
        games = self.client.table("games").select("*", count="exact").execute()
        
        # Games procesados
        processed = (
            self.client.table("games")
            .select("*", count="exact")
            .eq("status", "PROCESSED")
            .execute()
        )
        
        # Games pending
        pending = (
            self.client.table("games")
            .select("*", count="exact")
            .eq("status", "PENDING")
            .execute()
        )
        
        return {
            "total_leagues": leagues.count or 0,
            "total_games": games.count or 0,
            "total_processed": processed.count or 0,
            "total_pending": pending.count or 0,
        }

    def delete_games_by_league(self, league_id: int) -> int:
        """
        Elimina todos los partidos de una liga (para re-escanear).
        
        Returns:
            Número de registros eliminados
        """
        # Get games to delete
        games = (
            self.client.table("games")
            .select("id")
            .eq("league_id", league_id)
            .execute()
        )
        
        if not games.data:
            return 0
        
        count = len(games.data)
        
        # Delete (cascade should handle related records)
        self.client.table("games").delete().eq("league_id", league_id).execute()
        
        logger.info(f"Eliminados {count} partidos de league_id={league_id}")
        return count

    # ─────────────────────────────────────────────────────────────
    # HELPERS
    # ─────────────────────────────────────────────────────────────

    def _bulk_insert(self, table: str, rows: List[dict], batch_size: int = 500):
        """Inserta filas en lotes para evitar límites de payload."""
        for i in range(0, len(rows), batch_size):
            batch = rows[i : i + batch_size]
            try:
                self.client.table(table).insert(batch).execute()
            except Exception as e:
                # Si es error PGRST204 (schema cache), reintentar una vez
                error_str = str(e)
                if "PGRST204" in error_str or "schema cache" in error_str:
                    logger.warning(f"Error de schema cache en {table}, refrescando y reintentando...")
                    self.refresh_connection()
                    # Segundo intento
                    self.client.table(table).insert(batch).execute()
                else:
                    raise
        logger.debug(f"  → {table}: {len(rows)} filas insertadas")

    def _bulk_insert_returning_ids(self, table: str, rows: List[dict], batch_size: int = 500) -> List[int]:
        """
        Inserta filas y retorna los IDs generados en orden.
        Necesario para vincular shots -> play_by_play.
        """
        all_ids = []
        for i in range(0, len(rows), batch_size):
            batch = rows[i : i + batch_size]
            try:
                res = self.client.table(table).insert(batch).execute()
                all_ids.extend(row["id"] for row in res.data)
            except Exception as e:
                error_str = str(e)
                if "PGRST204" in error_str or "schema cache" in error_str:
                    logger.warning(f"Error de schema cache en {table}, refrescando y reintentando...")
                    self.refresh_connection()
                    res = self.client.table(table).insert(batch).execute()
                    all_ids.extend(row["id"] for row in res.data)
                else:
                    raise
        logger.debug(f"  → {table}: {len(rows)} filas insertadas, {len(all_ids)} IDs retornados")
        return all_ids

    def _find_player(self, name: str, team_id: int) -> Optional[dict]:
        """Busca jugador por nombre y current_team_id (sin crear)."""
        res = (
            self.client.table("players")
            .select("*")
            .eq("name", name)
            .eq("current_team_id", team_id)
            .execute()
        )
        return res.data[0] if res.data else None
