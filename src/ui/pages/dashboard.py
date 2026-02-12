"""
Dashboard - Vista principal con KPIs del sistema
"""

import streamlit as st
import pandas as pd

def render_dashboard():
    """Renderiza el dashboard con KPIs y resumen de ligas."""
    
    st.title("🏠 Dashboard")
    st.markdown("Vista general del sistema de scraping FEB")
    
    # ─────────────────────────────────────────────────────────────
    # KPIs
    # ─────────────────────────────────────────────────────────────
    
    repo = st.session_state.repo
    
    with st.spinner("Cargando estadísticas..."):
        stats = repo.get_dashboard_stats()
    
    col1, col2, col3, col4 = st.columns(4)
    
    with col1:
        st.metric(
            label="📋 Total de Ligas",
            value=stats["total_leagues"],
            help="Ligas descubiertas en el sistema"
        )
    
    with col2:
        st.metric(
            label="🏀 Partidos Importados",
            value=stats["total_games"],
            help="Total de partidos en base de datos"
        )
    
    with col3:
        st.metric(
            label="✅ Partidos Procesados",
            value=stats["total_processed"],
            delta=f"{stats['total_processed']}/{stats['total_games']}" if stats['total_games'] > 0 else "0/0",
            help="Partidos con estadísticas completas"
        )
    
    with col4:
        st.metric(
            label="⏳ Partidos Pendientes",
            value=stats["total_pending"],
            delta=f"-{stats['total_pending']}" if stats['total_pending'] > 0 else "0",
            delta_color="inverse",
            help="Partidos pendientes de procesar"
        )
    
    # ─────────────────────────────────────────────────────────────
    # RESUMEN DE LIGAS
    # ─────────────────────────────────────────────────────────────
    
    st.markdown("---")
    st.subheader("📊 Resumen de Ligas")
    
    with st.spinner("Cargando ligas..."):
        leagues = repo.get_all_leagues()
    
    if not leagues:
        st.info("No hay ligas en el sistema. Ejecuta el descubrimiento de ligas primero.")
        return
    
    # Build dataframe with game counts
    data = []
    for league in leagues:
        games = repo.get_games_by_league(league["id"])
        processed = sum(1 for g in games if g.get("status") == "PROCESSED")
        pending = sum(1 for g in games if g.get("status") == "PENDING")
        
        data.append({
            "ID": league["id"],
            "Liga": league["name"],
            "Grupo": league["group_name"],
            "Temporada": league["season_year"],
            "Partidos": len(games),
            "Procesados": processed,
            "Pendientes": pending,
            "URL": league["base_url"]
        })
    
    df = pd.DataFrame(data)
    
    st.dataframe(
        df,
        use_container_width=True,
        hide_index=True,
        column_config={
            "ID": st.column_config.NumberColumn("ID", width="small"),
            "Liga": st.column_config.TextColumn("Liga", width="medium"),
            "Grupo": st.column_config.TextColumn("Grupo", width="medium"),
            "Temporada": st.column_config.TextColumn("Temporada", width="small"),
            "Partidos": st.column_config.NumberColumn("Partidos", width="small"),
            "Procesados": st.column_config.NumberColumn("✅", width="small"),
            "Pendientes": st.column_config.NumberColumn("⏳", width="small"),
            "URL": st.column_config.LinkColumn("URL", width="large")
        }
    )
    
    # ─────────────────────────────────────────────────────────────
    # ACCIONES RÁPIDAS
    # ─────────────────────────────────────────────────────────────
    
    st.markdown("---")
    st.subheader("⚡ Acciones Rápidas")
    
    col1, col2, col3 = st.columns(3)
    
    with col1:
        if st.button("📥 Importar Ligas", use_container_width=True):
            st.session_state.page = "League Manager"
            st.rerun()
    
    with col2:
        if st.button("🔍 Inspeccionar Partidos", use_container_width=True):
            st.session_state.page = "Game Inspector"
            st.rerun()
    
    with col3:
        if st.button("🔄 Refrescar", use_container_width=True):
            st.rerun()
