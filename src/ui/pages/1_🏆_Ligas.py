"""
🏆 GESTIÓN DE LIGAS
Página para gestión masiva de ligas FEB.

Funcionalidades:
- Ver tabla de ligas con contadores
- Escanear calendario de liga
- Procesado masivo (Batch) de partidos pendientes
"""

import streamlit as st
import sys
import os
import asyncio
import pandas as pd
import logging
from pathlib import Path
from datetime import datetime
import threading

# Setup path
root = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(root))

from dotenv import load_dotenv
load_dotenv(root / ".env")

# Logger
logger = logging.getLogger(__name__)

from src.database.repository import SupabaseRepository
from src.scraper.league_crawler import crawl_league, crawl_league_with_group
from src.scraper.game_scraper import scrape_and_save

# ═════════════════════════════════════════════════════════════
# CONFIGURACIÓN
# ═════════════════════════════════════════════════════════════

st.set_page_config(
    page_title="Gestión de Ligas",
    page_icon="🏆",
    layout="wide"
)

# Initialize repository
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

if "repo" not in st.session_state:
    st.session_state.repo = SupabaseRepository(SUPABASE_URL, SUPABASE_KEY)

# ═════════════════════════════════════════════════════════════
# HELPER FUNCTIONS
# ═════════════════════════════════════════════════════════════

def run_async(coro):
    """Helper para ejecutar coroutines async desde Streamlit (Windows compatible)"""
    result = [None]
    exception = [None]
    
    def run_in_thread():
        try:
            # Configurar policy para Windows (soporta subprocesos)
            if sys.platform == 'win32':
                asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
            
            # Crear nuevo loop en el thread
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            result[0] = loop.run_until_complete(coro)
        except Exception as e:
            exception[0] = e
        finally:
            loop.close()
    
    thread = threading.Thread(target=run_in_thread)
    thread.start()
    thread.join()
    
    if exception[0]:
        raise exception[0]
    
    return result[0]

@st.cache_data(ttl=30)
def get_leagues_with_stats(_repo):
    """Obtener ligas con estadísticas de partidos"""
    leagues = _repo.get_leagues()
    
    leagues_data = []
    for league in leagues:
        games = _repo.get_games_by_league(league['id'])
        total = len(games)
        processed = sum(1 for g in games if g.get('status') == 'PROCESSED')
        pending = sum(1 for g in games if g.get('status') == 'PENDING')
        
        leagues_data.append({
            'ID': league['id'],
            'Nombre': league['name'],
            'Temporada': league.get('season', 'N/A'),
            'Grupo': league.get('group_name', 'N/A'),
            'Total Partidos': total,
            'Procesados': processed,
            'Pendientes': pending,
            'URL': league.get('base_url', 'N/A')
        })
    
    return pd.DataFrame(leagues_data)

# ═════════════════════════════════════════════════════════════
# PÁGINA PRINCIPAL
# ═════════════════════════════════════════════════════════════

st.title("🏆 Gestión de Ligas")
st.markdown("### Control masivo de ligas y procesado batch")
st.markdown("---")

# Cargar ligas
df_leagues = get_leagues_with_stats(st.session_state.repo)

if df_leagues.empty:
    st.warning("⚠️ No hay ligas importadas. Ejecuta el script de descubrimiento primero.")
    st.code("python tests/test_discovery.py", language="bash")
    st.stop()

# Mostrar tabla de ligas
st.subheader("📊 Ligas Disponibles")

# Métricas generales
col1, col2, col3, col4 = st.columns(4)

with col1:
    st.metric("🏆 Total Ligas", len(df_leagues))

with col2:
    total_games = df_leagues['Total Partidos'].sum()
    st.metric("🎯 Total Partidos", total_games)

with col3:
    total_processed = df_leagues['Procesados'].sum()
    st.metric("✅ Procesados", total_processed)

with col4:
    total_pending = df_leagues['Pendientes'].sum()
    st.metric("⏳ Pendientes", total_pending)

st.markdown("---")

# Tabla interactiva
st.dataframe(
    df_leagues[['ID', 'Nombre', 'Grupo', 'Total Partidos', 'Procesados', 'Pendientes']],
    use_container_width=True,
    hide_index=True
)

st.markdown("---")

# ═════════════════════════════════════════════════════════════
# SELECTOR DE LIGA Y ACCIONES
# ═════════════════════════════════════════════════════════════

st.subheader("⚙️ Acciones por Liga")

# Selector de liga
league_options = {f"{row['ID']} - {row['Nombre']} ({row['Grupo']})": row['ID'] 
                  for _, row in df_leagues.iterrows()}

selected_league_str = st.selectbox(
    "Selecciona una liga:",
    options=list(league_options.keys())
)

selected_league_id = league_options[selected_league_str]
selected_league = df_leagues[df_leagues['ID'] == selected_league_id].iloc[0]

# Obtener los datos COMPLETOS de la liga para acceder a feb_group_id
all_leagues = st.session_state.repo.get_leagues()
selected_league_full = next((l for l in all_leagues if l['id'] == selected_league_id), None)

# Log de la selección
logger.info(f"[UI] Liga seleccionada: {selected_league['Nombre']} (Grupo: {selected_league['Grupo']}, ID: {selected_league_id})")
if selected_league_full:
    logger.info(f"[UI] - Nombre base de datos: {selected_league_full.get('name')}")
    logger.info(f"[UI] - feb_group_id: {selected_league_full.get('feb_group_id', 'N/A')}")
    logger.info(f"[UI] - base_url: {selected_league_full.get('base_url', 'N/A')}")

# Mostrar info de la liga seleccionada
col1, col2, col3 = st.columns(3)

with col1:
    st.info(f"**Total Partidos**: {selected_league['Total Partidos']}")

with col2:
    st.success(f"**Procesados**: {selected_league['Procesados']}")

with col3:
    st.warning(f"**Pendientes**: {selected_league['Pendientes']}")

st.markdown("---")

# ═════════════════════════════════════════════════════════════
# BOTÓN 1: ESCANEAR CALENDARIO
# ═════════════════════════════════════════════════════════════

st.subheader("🔄 Escanear Calendario")
st.markdown("Importa URLs de partidos desde la web oficial FEB")

if st.button("🔄 Ejecutar Escaneo de Calendario", use_container_width=True, type="primary"):
    # Contenedor para logs
    log_container = st.empty()
    logs = []
    
    # Configurar logging para capturar mensaje

    original_basicConfig = None
    def capture_logs(msg):
        logs.append(msg)
        # Mostrar logs en tiempo real (máximo 50 últimal)
        log_text = "\n".join(logs[-50:])
        with log_container:
            st.text_area(
                "📊 Logs de ejecución:",
                value=log_text,
                disabled=True,
                height=250
            )
    
    with st.spinner(f"⏳ Escaneando calendario de {selected_league['Nombre']}..."):
        try:
            calendar_url = selected_league['URL']
            
            if not calendar_url or calendar_url == 'N/A':
                st.error("❌ URL del calendario no disponible para esta liga")
            else:
                # Configurar logging temporal
                import logging
                st.session_state.log_list = []
                
                class StreamlitHandler(logging.Handler):
                    def emit(self, record):
                        try:
                            msg = self.format(record)
                            logs.append(msg)
                            log_text = "\n".join(logs[-50:])
                            with log_container:
                                st.text_area(
                                    "📊 Logs de ejecución:",
                                    value=log_text,
                                    disabled=True,
                                    height=250,
                                    key=f"logs_{len(logs)}"
                                )
                        except Exception:
                            pass
                
                # Agregar handler
                handler = StreamlitHandler()
                handler.setFormatter(logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s'))
                
                # Configurar loggers
                logging.getLogger("src.scraper.league_crawler").addHandler(handler)
                logging.getLogger("src.database.repository").addHandler(handler)
                logging.getLogger("src.scraper.league_crawler").setLevel(logging.DEBUG)
                logging.getLogger("src.database.repository").setLevel(logging.DEBUG)

                # Ejecutar crawler
                # Usar crawl_league_with_group si hay feb_group_id, sino usar crawl_league
                if selected_league_full and selected_league_full.get('feb_group_id'):
                    # Liga con grupo específico (ej: Tercera FEB grupos)
                    base_url = selected_league_full.get('base_url', calendar_url)
                    feb_group_id = selected_league_full.get('feb_group_id')
                    
                    logger.info("="*60)
                    logger.info(f"[UI] 🎯 USANDO crawl_league_with_group (GRUPO ESPECÍFICO)")
                    logger.info(f"[UI] Liga: {selected_league['Nombre']}")
                    logger.info(f"[UI] Grupo: {selected_league['Grupo']}")
                    logger.info(f"[UI] League ID: {selected_league_id}")
                    logger.info(f"[UI] Feb Group ID: {feb_group_id}")
                    logger.info(f"[UI] Base URL: {base_url}")
                    logger.info("="*60)
                    
                    games_data = crawl_league_with_group(
                        base_url=base_url,
                        feb_group_id=feb_group_id,
                        repository=st.session_state.repo,
                        league_id=selected_league_id,
                        headless=True
                    )
                else:
                    # Liga sin grupo específico (ej: Primera FEB)
                    logger.info("="*60)
                    logger.info(f"[UI] 🔄 USANDO crawl_league (LIGA SIMPLE)")
                    logger.info(f"[UI] Liga: {selected_league['Nombre']}")
                    logger.info(f"[UI] League ID: {selected_league_id}")
                    logger.info(f"[UI] Calendar URL: {calendar_url}")
                    logger.info("="*60)
                    games_data = run_async(
                        crawl_league(
                            calendar_url=calendar_url,
                            repository=st.session_state.repo,
                            league_id=selected_league_id,
                            headless=True
                        )
                    )
                
                logger.info(f"[UI] ✅ Importación completada: {len(games_data)} partidos")
                st.success(f"✅ Calendario escaneado: {len(games_data)} partidos importados/actualizados")
                
                # Limpiar caché para refrescar
                st.cache_data.clear()
                st.rerun()
                
        except Exception as e:
            st.error(f"❌ Error al escanear calendario: {str(e)}")
            st.exception(e)

st.markdown("---")

# ═════════════════════════════════════════════════════════════
# BOTÓN 2: PROCESADO MASIVO (BATCH)
# ═════════════════════════════════════════════════════════════

st.subheader("🚀 Procesado Masivo (Batch)")
st.markdown("Procesa **TODOS** los partidos pendientes de la liga seleccionada")

# Warning
st.warning(f"""
⚠️ **ATENCIÓN**: Esta operación procesará **{selected_league['Pendientes']} partidos pendientes**.

Cada partido toma ~30-60 segundos. Tiempo estimado total: 
**{selected_league['Pendientes'] * 45 / 60:.1f} minutos**

El proceso es resiliente: si un partido falla, continúa con el siguiente.
""")

if st.button("🚀 INICIAR PROCESADO BATCH", use_container_width=True, type="secondary"):
    # Obtener partidos pendientes
    games = st.session_state.repo.get_games_by_league(selected_league_id)
    pending_games = [g for g in games if g.get('status') == 'PENDING']
    
    if not pending_games:
        st.info("✅ No hay partidos pendientes en esta liga")
        st.stop()
    
    st.markdown(f"### 📊 Procesando {len(pending_games)} partidos...")
    
    # Contenedores para progreso
    progress_bar = st.progress(0)
    status_text = st.empty()
    metrics_container = st.empty()
    
    # Contadores
    processed_count = 0
    failed_count = 0
    failed_games = []
    
    start_time = datetime.now()
    
    # Iterar sobre partidos
    for idx, game in enumerate(pending_games, 1):
        try:
            # Update status
            status_text.markdown(f"""
            **Partido {idx}/{len(pending_games)}**  
            🏀 {game.get('home_team', {}).get('name', 'N/A')} vs {game.get('away_team', {}).get('name', 'N/A')}  
            📅 {game.get('date', 'N/A')} | 🆔 FEB ID: {game.get('feb_game_id', 'N/A')}
            """)
            
            # Procesar partido
            result = run_async(
                scrape_and_save(
                    game_id=str(game.get('feb_game_id')),
                    db_game_id=game.get('id'),
                    repository=st.session_state.repo,
                    headless=True
                )
            )
            
            processed_count += 1
            
        except Exception as e:
            failed_count += 1
            failed_games.append({
                'game_id': game.get('id'),
                'feb_id': game.get('feb_game_id'),
                'teams': f"{game.get('home_team', {}).get('name', 'N/A')} vs {game.get('away_team', {}).get('name', 'N/A')}",
                'error': str(e)
            })
        
        # Update progress
        progress = idx / len(pending_games)
        progress_bar.progress(progress)
        
        # Update metrics
        with metrics_container:
            col1, col2, col3 = st.columns(3)
            with col1:
                st.metric("✅ Procesados", processed_count)
            with col2:
                st.metric("❌ Fallidos", failed_count)
            with col3:
                elapsed = (datetime.now() - start_time).seconds
                remaining = (elapsed / idx) * (len(pending_games) - idx) if idx > 0 else 0
                st.metric("⏱️ Tiempo Restante", f"{remaining / 60:.1f} min")
    
    # Reporte final
    st.markdown("---")
    st.markdown("### 📋 Reporte Final")
    
    col1, col2, col3 = st.columns(3)
    
    with col1:
        st.success(f"✅ **Procesados**: {processed_count}")
    
    with col2:
        st.error(f"❌ **Fallidos**: {failed_count}")
    
    with col3:
        total_time = (datetime.now() - start_time).seconds / 60
        st.info(f"⏱️ **Tiempo Total**: {total_time:.1f} min")
    
    # Mostrar errores si los hay
    if failed_games:
        st.markdown("---")
        st.subheader("❌ Partidos Fallidos")
        
        failed_df = pd.DataFrame(failed_games)
        st.dataframe(failed_df, use_container_width=True, hide_index=True)
        
        # Opción de descargar log
        csv = failed_df.to_csv(index=False)
        st.download_button(
            label="📥 Descargar Log de Errores",
            data=csv,
            file_name=f"failed_games_{selected_league_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv",
            mime="text/csv"
        )
    
    # Limpiar caché
    st.cache_data.clear()
    
    st.balloons()
    
    if st.button("🔄 Refrescar Página", use_container_width=True):
        st.rerun()

st.markdown("---")

# Footer
st.markdown("""
    <div style='text-align: center; padding: 20px;'>
        <p style='color: #888;'>
            🏆 Gestión de Ligas | BasketStats Admin
        </p>
    </div>
""", unsafe_allow_html=True)
