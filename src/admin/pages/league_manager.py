"""
League Manager - Importar calendarios de ligas
"""

import streamlit as st
import pandas as pd
from datetime import datetime
from src.admin.session_utils import run_async

def render_league_manager():
    """Renderiza el gestor de ligas con importación de calendarios."""
    
    st.title("📋 League Manager")
    st.markdown("Importa calendarios completos de ligas FEB")
    
    repo = st.session_state.repo
    
    # ─────────────────────────────────────────────────────────────
    # SELECTOR DE LIGA
    # ─────────────────────────────────────────────────────────────
    
    leagues = repo.get_all_leagues()
    
    if not leagues:
        st.warning("⚠️ No hay ligas en el sistema.")
        st.info("Ejecuta `python test_discovery.py` para descubrir ligas automáticamente.")
        return
    
    # Build league options
    league_options = {
        f"{l['name']} - {l['group_name']} ({l['season_year']})": l["id"]
        for l in leagues
    }
    
    selected_league_name = st.selectbox(
        "Selecciona una liga",
        options=list(league_options.keys())
    )
    
    league_id = league_options[selected_league_name]
    league = next(l for l in leagues if l["id"] == league_id)
    
    # ─────────────────────────────────────────────────────────────
    # INFO DE LA LIGA
    # ─────────────────────────────────────────────────────────────
    
    st.markdown("---")
    
    col1, col2 = st.columns([2, 1])
    
    with col1:
        st.subheader(f"{league['name']} - {league['group_name']}")
        st.caption(f"Temporada: {league['season_year']}")
        
        if league["base_url"]:
            st.link_button("🔗 Ver en FEB.es", league["base_url"], use_container_width=False)
    
    with col2:
        games = repo.get_games_by_league(league_id)
        
        if games:
            processed = sum(1 for g in games if g.get("status") == "PROCESSED")
            pending = sum(1 for g in games if g.get("status") == "PENDING")
            
            st.metric("📊 Total Partidos", len(games))
            st.metric("✅ Procesados", processed)
            st.metric("⏳ Pendientes", pending)
        else:
            st.info("Sin partidos importados")
    
    # ─────────────────────────────────────────────────────────────
    # ACCIONES
    # ─────────────────────────────────────────────────────────────
    
    st.markdown("---")
    st.subheader("⚙️ Acciones")
    
    col1, col2 = st.columns(2)
    
    with col1:
        if st.button("📥 Importar Calendario", use_container_width=True, type="primary"):
            with st.spinner("Importando calendario... Esto puede tardar varios minutos."):
                try:
                    # Import async crawler
                    import sys
                    from pathlib import Path
                    root = Path(__file__).parent.parent.parent.parent
                    sys.path.insert(0, str(root))
                    
                    from src.shared.scraper.league_crawler import crawl_league
                    
                    # Run async function
                    games_list = run_async(crawl_league(
                        calendar_url=league["base_url"],
                        repository=repo,
                        league_id=league_id,
                        headless=True
                    ))
                    
                    st.success(f"✅ Calendario importado exitosamente: {len(games_list)} partidos guardados")
                    st.rerun()
                    
                except Exception as e:
                    st.error(f"❌ Error al importar calendario: {str(e)}")
                    st.exception(e)
    
    with col2:
        if st.button("🔄 Re-escanear Liga", use_container_width=True, disabled=len(games) == 0):
            if st.session_state.get("confirm_rescan", False):
                with st.spinner("Eliminando partidos y re-escaneando..."):
                    try:
                        # Delete existing games
                        deleted = repo.delete_games_by_league(league_id)
                        
                        # Re-import
                        import sys
                        from pathlib import Path
                        root = Path(__file__).parent.parent.parent.parent
                        sys.path.insert(0, str(root))
                        
                        from src.shared.scraper.league_crawler import crawl_league
                        
                        games_list = run_async(crawl_league(
                            calendar_url=league["base_url"],
                            repository=repo,
                            league_id=league_id,
                            headless=True
                        ))
                        
                        st.success(f"✅ Re-escaneo completo: {deleted} eliminados, {len(games_list)} importados")
                        st.session_state.confirm_rescan = False
                        st.rerun()
                        
                    except Exception as e:
                        st.error(f"❌ Error al re-escanear: {str(e)}")
                        st.exception(e)
            else:
                st.session_state.confirm_rescan = True
                st.warning("⚠️ Esto eliminará todos los partidos existentes. Haz clic nuevamente para confirmar.")
    
    # ─────────────────────────────────────────────────────────────
    # TABLA DE PARTIDOS
    # ─────────────────────────────────────────────────────────────
    
    if games:
        st.markdown("---")
        st.subheader("🏀 Partidos Importados")
        
        # Build dataframe
        data = []
        for game in games:
            data.append({
                "ID": game["id"],
                "Fecha": game.get("date", "N/A"),
                "Local": game.get("home_team", {}).get("name", "N/A"),
                "Visitante": game.get("away_team", {}).get("name", "N/A"),
                "Estado": game.get("status", "PENDING"),
                "URL": game.get("url", "")
            })
        
        df = pd.DataFrame(data)
        
        st.dataframe(
            df,
            use_container_width=True,
            hide_index=True,
            column_config={
                "ID": st.column_config.NumberColumn("ID", width="small"),
                "Fecha": st.column_config.TextColumn("Fecha", width="medium"),
                "Local": st.column_config.TextColumn("Local", width="medium"),
                "Visitante": st.column_config.TextColumn("Visitante", width="medium"),
                "Estado": st.column_config.TextColumn("Estado", width="small"),
                "URL": st.column_config.LinkColumn("URL", width="large")
            }
        )
        
        # Stats
        st.caption(f"Total: {len(games)} partidos | Última actualización: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
