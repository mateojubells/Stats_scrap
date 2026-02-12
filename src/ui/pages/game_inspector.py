"""
Game Inspector - Procesar partidos individuales y ver estadísticas
"""

import streamlit as st
import asyncio
import pandas as pd
from datetime import datetime

def render_game_inspector():
    """Renderiza el inspector de partidos con procesamiento y visualización."""
    
    st.title("🔍 Game Inspector")
    st.markdown("Procesa partidos individuales y visualiza estadísticas")
    
    repo = st.session_state.repo
    
    # ─────────────────────────────────────────────────────────────
    # SELECTOR DE LIGA
    # ─────────────────────────────────────────────────────────────
    
    leagues = repo.get_all_leagues()
    
    if not leagues:
        st.warning("⚠️ No hay ligas en el sistema.")
        return
    
    league_options = {
        f"{l['name']} - {l['group_name']} ({l['season_year']})": l["id"]
        for l in leagues
    }
    
    selected_league_name = st.selectbox(
        "Selecciona una liga",
        options=list(league_options.keys()),
        key="inspector_league"
    )
    
    league_id = league_options[selected_league_name]
    
    # ─────────────────────────────────────────────────────────────
    # SELECTOR DE PARTIDO
    # ─────────────────────────────────────────────────────────────
    
    games = repo.get_games_by_league(league_id)
    
    if not games:
        st.info("📥 No hay partidos importados para esta liga. Ve a League Manager para importar el calendario.")
        return
    
    game_options = {
        f"{g.get('date', 'N/A')} - {g.get('home_team', {}).get('name', 'N/A')} vs {g.get('away_team', {}).get('name', 'N/A')} [{g.get('status', 'PENDING')}]": g["id"]
        for g in games
    }
    
    selected_game_name = st.selectbox(
        "Selecciona un partido",
        options=list(game_options.keys()),
        key="inspector_game"
    )
    
    game_id = game_options[selected_game_name]
    game = repo.get_game_by_id(game_id)
    
    if not game:
        st.error("❌ No se pudo cargar el partido")
        return
    
    # ─────────────────────────────────────────────────────────────
    # INFO DEL PARTIDO
    # ─────────────────────────────────────────────────────────────
    
    st.markdown("---")
    
    col1, col2, col3 = st.columns([2, 2, 1])
    
    with col1:
        st.subheader("🏠 Local")
        st.markdown(f"### {game.get('home_team', {}).get('name', 'N/A')}")
        if game.get("home_score"):
            st.metric("Puntos", game["home_score"])
    
    with col2:
        st.subheader("✈️ Visitante")
        st.markdown(f"### {game.get('away_team', {}).get('name', 'N/A')}")
        if game.get("away_score"):
            st.metric("Puntos", game["away_score"])
    
    with col3:
        st.metric("Estado", game.get("status", "PENDING"))
        st.caption(f"Fecha: {game.get('date', 'N/A')}")
        if game.get("url"):
            st.link_button("🔗 FEB", game["url"], use_container_width=True)
    
    # ─────────────────────────────────────────────────────────────
    # ACCIONES
    # ─────────────────────────────────────────────────────────────
    
    st.markdown("---")
    
    if game.get("status") == "PENDING":
        st.subheader("⚙️ Procesar Partido")
        
        if st.button("🚀 Procesar Estadísticas Completas", use_container_width=True, type="primary"):
            with st.spinner("Procesando partido... Esto puede tardar algunos minutos."):
                try:
                    import sys
                    from pathlib import Path
                    root = Path(__file__).parent.parent.parent.parent
                    sys.path.insert(0, str(root))
                    
                    from src.scraper.game_scraper import scrape_and_save
                    
                    result = asyncio.run(scrape_and_save(
                        game_id=game["feb_game_id"],
                        db_game_id=game_id,
                        repository=repo,
                        headless=True
                    ))
                    
                    st.success(f"✅ Partido procesado exitosamente")
                    st.json(result)
                    st.rerun()
                    
                except Exception as e:
                    st.error(f"❌ Error al procesar partido: {str(e)}")
                    st.exception(e)
    
    elif game.get("status") == "PROCESSED":
        st.success("✅ Partido procesado")
        
        if st.button("🔄 Re-procesar", use_container_width=False):
            with st.spinner("Re-procesando partido..."):
                try:
                    import sys
                    from pathlib import Path
                    root = Path(__file__).parent.parent.parent.parent
                    sys.path.insert(0, str(root))
                    
                    from src.scraper.game_scraper import scrape_and_save
                    
                    result = asyncio.run(scrape_and_save(
                        game_id=game["feb_game_id"],
                        db_game_id=game_id,
                        repository=repo,
                        headless=True
                    ))
                    
                    st.success("✅ Partido re-procesado")
                    st.rerun()
                    
                except Exception as e:
                    st.error(f"❌ Error al re-procesar: {str(e)}")
                    st.exception(e)
    
    # ─────────────────────────────────────────────────────────────
    # ESTADÍSTICAS (solo si está procesado)
    # ─────────────────────────────────────────────────────────────
    
    if game.get("status") == "PROCESSED":
        st.markdown("---")
        st.subheader("📊 Estadísticas del Partido")
        
        # Tabs for different views
        tab1, tab2, tab3 = st.tabs(["📋 Box Score Local", "📋 Box Score Visitante", "⏱️ Play by Play"])
        
        stats = repo.get_player_stats_by_game(game_id)
        
        # Filter by team
        home_team_id = game.get("home_team_id")
        away_team_id = game.get("away_team_id")
        
        home_stats = [s for s in stats if s.get("team_id") == home_team_id]
        away_stats = [s for s in stats if s.get("team_id") == away_team_id]
        
        with tab1:
            if home_stats:
                df_home = pd.DataFrame([
                    {
                        "Jugador": s.get("player", {}).get("name", "N/A"),
                        "MIN": s.get("minutes", "00:00"),
                        "PTS": s.get("points", 0),
                        "T2": f"{s.get('t2_made', 0)}/{s.get('t2_att', 0)}",
                        "T3": f"{s.get('t3_made', 0)}/{s.get('t3_att', 0)}",
                        "TL": f"{s.get('ft_made', 0)}/{s.get('ft_att', 0)}",
                        "REB": s.get("reb_tot", 0),
                        "AST": s.get("assists", 0),
                        "VAL": s.get("valoracion", 0)
                    }
                    for s in home_stats
                ])
                
                st.dataframe(df_home, use_container_width=True, hide_index=True)
            else:
                st.info("Sin estadísticas disponibles")
        
        with tab2:
            if away_stats:
                df_away = pd.DataFrame([
                    {
                        "Jugador": s.get("player", {}).get("name", "N/A"),
                        "MIN": s.get("minutes", "00:00"),
                        "PTS": s.get("points", 0),
                        "T2": f"{s.get('t2_made', 0)}/{s.get('t2_att', 0)}",
                        "T3": f"{s.get('t3_made', 0)}/{s.get('t3_att', 0)}",
                        "TL": f"{s.get('ft_made', 0)}/{s.get('ft_att', 0)}",
                        "REB": s.get("reb_tot", 0),
                        "AST": s.get("assists", 0),
                        "VAL": s.get("valoracion", 0)
                    }
                    for s in away_stats
                ])
                
                st.dataframe(df_away, use_container_width=True, hide_index=True)
            else:
                st.info("Sin estadísticas disponibles")
        
        with tab3:
            pbp = repo.get_play_by_play(game_id, limit=50)
            
            if pbp:
                df_pbp = pd.DataFrame([
                    {
                        "Periodo": p.get("quarter", "N/A"),
                        "Minuto": p.get("minute", "N/A"),
                        "Acción": p.get("action_text", p.get("action_type", "N/A")),
                        "Marcador": f"{p.get('home_score_partial', '-')}-{p.get('away_score_partial', '-')}" if p.get('home_score_partial') is not None else "N/A"
                    }
                    for p in pbp
                ])
                
                st.dataframe(df_pbp, use_container_width=True, hide_index=True)
                st.caption(f"Mostrando últimos {len(pbp)} eventos")
            else:
                st.info("Sin play-by-play disponible")
