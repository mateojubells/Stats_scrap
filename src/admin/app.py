"""
BasketStats Admin - Centro de Mando
Sistema profesional de gestión y visualización de estadísticas FEB.

Páginas:
- 🏠 HOME: Dashboard y test de conexión
- 🏆 LIGAS: Gestión masiva (importar calendarios, procesado batch)
- 🎯 PARTIDOS: Inspector individual y visualización completa
"""

import streamlit as st
import sys
import os
import asyncio
import threading
from pathlib import Path
from dotenv import load_dotenv
from datetime import datetime

# Setup path
root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(root))

# Load environment variables
load_dotenv(root / ".env")

from src.shared.database.repository import SupabaseRepository

# Initialize repository
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

# ═════════════════════════════════════════════════════════════
# CONFIGURACIÓN
# ═════════════════════════════════════════════════════════════

st.set_page_config(
    page_title="BasketStats Admin",
    page_icon="🏀",
    layout="wide",
    initial_sidebar_state="expanded",
    menu_items={
        'About': "BasketStats Admin - Sistema profesional de scraping FEB"
    }
)

# CSS Custom
st.markdown("""
    <style>
    .stMetric {
        background-color: #f0f2f6;
        padding: 15px;
        border-radius: 10px;
    }
    .big-font {
        font-size: 24px !important;
        font-weight: bold;
    }
    </style>
""", unsafe_allow_html=True)

# ═════════════════════════════════════════════════════════════
# SESSION STATE & HELPER
# ═════════════════════════════════════════════════════════════

if "repo" not in st.session_state:
    if not SUPABASE_URL or not SUPABASE_KEY:
        st.error("❌ Credenciales de Supabase no configuradas. Configura SUPABASE_URL y SUPABASE_KEY en .env")
        st.stop()
    st.session_state.repo = SupabaseRepository(SUPABASE_URL, SUPABASE_KEY)

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

# ═════════════════════════════════════════════════════════════
# SIDEBAR
# ═════════════════════════════════════════════════════════════

with st.sidebar:
    st.title("🏀 BasketStats Admin")
    st.markdown("---")
    st.markdown("### 📊 Centro de Mando")
    st.markdown("Gestión profesional de estadísticas FEB")
    st.markdown("---")
    
    # Info de navegación
    st.info("📖 **Navegación**\n\n"
            "- 🏠 **Home**: Dashboard y test de conexión\n"
            "- 🏆 **Ligas**: Gestión masiva de ligas\n"
            "- 🎯 **Partidos**: Inspector y visualización")

# ═════════════════════════════════════════════════════════════
# FUNCIONES DE CACHÉ
# ═════════════════════════════════════════════════════════════

@st.cache_data(ttl=60)
def get_stats_summary(_repo):
    """Obtener estadísticas generales del sistema"""
    try:
        leagues = _repo.get_leagues()
        
        total_games = 0
        games_processed = 0
        games_pending = 0
        
        for league in leagues:
            games = _repo.get_games_by_league(league['id'])
            total_games += len(games)
            games_processed += sum(1 for g in games if g.get('status') == 'PROCESSED')
            games_pending += sum(1 for g in games if g.get('status') == 'PENDING')
        
        # Stats de jugadores
        players_count = _repo.client.table("players").select("*", count="exact").execute().count
        stats_count = _repo.client.table("stats_player_games").select("*", count="exact").execute().count
        
        return {
            'leagues': len(leagues),
            'total_games': total_games,
            'games_processed': games_processed,
            'games_pending': games_pending,
            'players': players_count,
            'stats': stats_count,
        }
    except Exception as e:
        st.error(f"Error obteniendo estadísticas: {str(e)}")
        return None

# ═════════════════════════════════════════════════════════════
# HOME PAGE
# ═════════════════════════════════════════════════════════════

st.title("🏠 BasketStats Admin - Centro de Mando")
st.markdown("### Sistema profesional de scraping y análisis FEB")
st.markdown("---")

# Test de conexión
st.subheader("🔌 Test de Conexión")

col1, col2, col3 = st.columns(3)

with col1:
    if st.button("🧪 Probar Conexión Supabase", use_container_width=True):
        with st.spinner("Probando conexión..."):
            try:
                # Test simple: obtener ligas
                leagues = st.session_state.repo.get_leagues()
                st.success(f"✅ Conexión exitosa - {len(leagues)} ligas encontradas")
            except Exception as e:
                st.error(f"❌ Error de conexión: {str(e)}")

with col2:
    st.metric("URL Configurada", "✅" if SUPABASE_URL else "❌")

with col3:
    st.metric("API Key Configurada", "✅" if SUPABASE_KEY else "❌")

st.markdown("---")

# Dashboard KPIs
st.subheader("📊 Dashboard del Sistema")

with st.spinner("Cargando estadísticas..."):
    stats = get_stats_summary(st.session_state.repo)
    
    if stats:
        col1, col2, col3, col4 = st.columns(4)
        
        with col1:
            st.metric(
                label="🏆 Ligas",
                value=stats['leagues'],
                help="Total de ligas importadas"
            )
        
        with col2:
            st.metric(
                label="🎯 Partidos",
                value=stats['total_games'],
                help="Total de partidos importados"
            )
        
        with col3:
            st.metric(
                label="✅ Procesados",
                value=stats['games_processed'],
                delta=f"{stats['games_pending']} pendientes",
                help="Partidos con estadísticas completas"
            )
        
        with col4:
            st.metric(
                label="👥 Jugadores",
                value=stats['players'],
                help="Jugadores únicos en la BD"
            )
        
        # Métricas adicionales
        st.markdown("---")
        
        col5, col6, col7, col8 = st.columns(4)
        
        with col5:
            st.metric(
                label="📈 Stats de Jugadores",
                value=stats['stats'],
                help="Total de registros en stats_player_games"
            )
        
        with col6:
            if stats['total_games'] > 0:
                progress = (stats['games_processed'] / stats['total_games']) * 100
                st.metric(
                    label="🎯 Progreso",
                    value=f"{progress:.1f}%",
                    help="Porcentaje de partidos procesados"
                )
        
        with col7:
            if stats['games_processed'] > 0:
                avg_stats = stats['stats'] / stats['games_processed']
                st.metric(
                    label="📊 Promedio Stats/Partido",
                    value=f"{avg_stats:.1f}",
                    help="Stats de jugadores por partido"
                )
        
        with col8:
            st.metric(
                label="🕐 Última Actualización",
                value=datetime.now().strftime("%H:%M"),
                help="Última vez que se recargaron los datos"
            )

st.markdown("---")

# Guía rápida
st.subheader("📖 Guía Rápida")

col1, col2 = st.columns(2)

with col1:
    st.markdown("""
    #### 🏆 Gestión de Ligas
    
    1. **Escanear Calendario**: Importa URLs de partidos desde la web FEB
    2. **Procesado Batch**: Scrapea todos los partidos pendientes de una liga
    3. **Barra de Progreso**: Visualiza el progreso en tiempo real
    4. **Manejo de Errores**: Los fallos no detienen el proceso
    
    👉 Ve a la página **Ligas** en el menú lateral
    """)

with col2:
    st.markdown("""
    #### 🎯 Inspector de Partidos
    
    1. **Selecciona Liga y Partido**: Filtra por liga primero
    2. **Procesar Individual**: Scrapea un partido específico
    3. **Visualización Completa**: Box Score, Shooting Chart, Play-by-Play
    4. **Comparación de Equipos**: Gráficos comparativos
    
    👉 Ve a la página **Partidos** en el menú lateral
    """)

st.markdown("---")

# Footer
st.markdown("""
    <div style='text-align: center; padding: 20px;'>
        <p style='color: #888;'>
            BasketStats Admin v1.0 | Powered by Supabase & Streamlit
        </p>
    </div>
""", unsafe_allow_html=True)

