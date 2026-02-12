"""
🎯 INSPECTOR DE PARTIDOS
Página para gestión individual y visualización completa de partidos.

Funcionalidades:
- Selector de Liga → Partido
- Procesar partido individual
- Visualización completa:
  * Box Score (Local y Visitante)
  * Shooting Chart (Plotly)
  * Play-by-Play
  * Team Comparison
"""

import streamlit as st
import sys
import os
import asyncio
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
from pathlib import Path
from datetime import datetime
import threading

# Setup path
root = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(root))

from dotenv import load_dotenv
load_dotenv(root / ".env")

from src.database.repository import SupabaseRepository
from src.scraper.game_scraper import scrape_and_save

# ═════════════════════════════════════════════════════════════
# CONFIGURACIÓN
# ═════════════════════════════════════════════════════════════

st.set_page_config(
    page_title="Inspector de Partidos",
    page_icon="🎯",
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
def get_leagues_list(_repo):
    """Obtener lista de ligas"""
    return _repo.get_leagues()

@st.cache_data(ttl=30)
def get_games_by_league(_repo, league_id):
    """Obtener partidos de una liga"""
    return _repo.get_games_by_league(league_id)

@st.cache_data(ttl=30)
def get_game_stats(_repo, game_id):
    """Obtener todas las stats de un partido"""
    try:
        # Player stats
        player_stats = _repo.client.table("stats_player_games")\
            .select("*, player:players(name), team:teams(name)")\
            .eq("game_id", game_id)\
            .execute()
        
        # Shots
        shots = _repo.client.table("shots")\
            .select("*, player:players(name), team:teams(name)")\
            .eq("game_id", game_id)\
            .execute()
        
        # Play by play
        pbp = _repo.client.table("play_by_play")\
            .select("*, player:players(name), team:teams(name)")\
            .eq("game_id", game_id)\
            .order("id")\
            .execute()
        
        # Team stats
        team_stats = _repo.client.table("stats_team_games")\
            .select("*, team:teams(name)")\
            .eq("game_id", game_id)\
            .execute()
        
        return {
            'player_stats': player_stats.data,
            'shots': shots.data,
            'pbp': pbp.data,
            'team_stats': team_stats.data
        }
    except Exception as e:
        st.error(f"Error cargando stats: {str(e)}")
        return None

# ═════════════════════════════════════════════════════════════
# PÁGINA PRINCIPAL
# ═════════════════════════════════════════════════════════════

st.title("🎯 Inspector de Partidos")
st.markdown("### Gestión individual y visualización completa")
st.markdown("---")

# ═════════════════════════════════════════════════════════════
# SELECTORES: LIGA → PARTIDO
# ═════════════════════════════════════════════════════════════

st.subheader("🔍 Selección de Partido")

# Cargar ligas
leagues = get_leagues_list(st.session_state.repo)

if not leagues:
    st.warning("⚠️ No hay ligas importadas")
    st.stop()

# Selector de liga
league_options = {f"{l['id']} - {l['name']} ({l.get('group_name', 'N/A')})": l['id'] 
                  for l in leagues}

selected_league_str = st.selectbox(
    "1️⃣ Selecciona una liga:",
    options=list(league_options.keys())
)

selected_league_id = league_options[selected_league_str]

# Cargar partidos de la liga
games = get_games_by_league(st.session_state.repo, selected_league_id)

if not games:
    st.warning("⚠️ Esta liga no tiene partidos importados. Ve a 'Ligas' para escanear el calendario.")
    st.stop()

# Selector de partido
game_options = {}
for g in games:
    home_name = g.get('home_team', {}).get('name', 'N/A')
    away_name = g.get('away_team', {}).get('name', 'N/A')
    date = g.get('date', 'N/A')
    status = g.get('status', 'N/A')
    
    label = f"{g['id']} | {home_name} vs {away_name} | {date} | {status}"
    game_options[label] = g['id']

selected_game_str = st.selectbox(
    "2️⃣ Selecciona un partido:",
    options=list(game_options.keys())
)

selected_game_id = game_options[selected_game_str]

# Obtener detalles del partido
selected_game = next(g for g in games if g['id'] == selected_game_id)

st.markdown("---")

# ═════════════════════════════════════════════════════════════
# ENCABEZADO DEL PARTIDO
# ═════════════════════════════════════════════════════════════

st.subheader("📋 Información del Partido")

home_team = selected_game.get('home_team', {})
away_team = selected_game.get('away_team', {})
home_score = selected_game.get('home_score', 0)
away_score = selected_game.get('away_score', 0)
status = selected_game.get('status', 'N/A')
feb_id = selected_game.get('feb_game_id', 'N/A')

# Layout del encabezado
col1, col2, col3 = st.columns([2, 1, 2])

with col1:
    st.markdown(f"### {home_team.get('name', 'N/A')}")
    st.markdown(f"**Local**")

with col2:
    st.markdown(f"<h1 style='text-align: center;'>{home_score} - {away_score}</h1>", unsafe_allow_html=True)
    st.markdown(f"<p style='text-align: center;'>Estado: <b>{status}</b></p>", unsafe_allow_html=True)

with col3:
    st.markdown(f"### {away_team.get('name', 'N/A')}")
    st.markdown(f"**Visitante**")

st.markdown(f"**📅 Fecha**: {selected_game.get('date', 'N/A')} | **🆔 FEB ID**: {feb_id}")

st.markdown("---")

# ═════════════════════════════════════════════════════════════
# ACCIÓN: PROCESAR PARTIDO (SI PENDING)
# ═════════════════════════════════════════════════════════════

if status == 'PENDING':
    st.subheader("⚙️ Procesamiento")
    st.info("ℹ️ Este partido aún no ha sido procesado. Haz clic en el botón para scrapear sus estadísticas.")
    
    if st.button("🚀 PROCESAR PARTIDO AHORA", use_container_width=True, type="primary"):
        with st.spinner(f"⏳ Procesando partido (esto puede tardar 30-60 segundos)..."):
            try:
                result = run_async(
                    scrape_and_save(
                        game_id=str(feb_id),
                        db_game_id=selected_game_id,
                        repository=st.session_state.repo,
                        headless=True
                    )
                )
                
                st.success(f"✅ Partido procesado exitosamente!")
                st.balloons()
                
                # Limpiar caché y recargar
                st.cache_data.clear()
                st.rerun()
                
            except Exception as e:
                st.error(f"❌ Error al procesar partido: {str(e)}")
                st.exception(e)
    
    st.stop()

# ═════════════════════════════════════════════════════════════
# VISUALIZACIÓN (SI PROCESSED)
# ═════════════════════════════════════════════════════════════

if status != 'PROCESSED':
    st.warning(f"⚠️ Este partido tiene estado '{status}'. Solo los partidos PROCESSED tienen estadísticas.")
    st.stop()

st.subheader("📊 Estadísticas Completas")

# Botón de reprocesar
col1, col2 = st.columns([4, 1])
with col2:
    if st.button("🔄 Reprocesar", help="Elimina todos los datos de este partido y vuelve a procesarlo", type="secondary"):
        with st.spinner("⏳ Eliminando datos del partido..."):
            try:
                # Eliminar todos los datos del partido
                repo = st.session_state.repo
                
                # 1. Eliminar stats de jugadores
                repo.client.table("stats_player_games").delete().eq("game_id", selected_game_id).execute()
                
                # 2. Eliminar play-by-play
                repo.client.table("play_by_play").delete().eq("game_id", selected_game_id).execute()
                
                # 3. Eliminar tiros
                repo.client.table("shots").delete().eq("game_id", selected_game_id).execute()
                
                # 4. Eliminar stats de equipos
                repo.client.table("stats_team_games").delete().eq("game_id", selected_game_id).execute()
                
                # 5. Resetear estado del partido a PENDING
                repo.client.table("games").update({"status": "PENDING"}).eq("id", selected_game_id).execute()
                
                st.success("✅ Datos eliminados. Reprocesando partido...")
                
                # Procesar el partido de nuevo
                result = run_async(
                    scrape_and_save(
                        game_id=str(feb_id),
                        db_game_id=selected_game_id,
                        repository=repo,
                        headless=True
                    )
                )
                
                st.success(f"✅ Partido reprocesado exitosamente!")
                st.balloons()
                
                # Limpiar caché y recargar
                st.cache_data.clear()
                st.rerun()
                
            except Exception as e:
                st.error(f"❌ Error al reprocesar partido: {str(e)}")
                st.exception(e)

# Cargar stats
stats_data = get_game_stats(st.session_state.repo, selected_game_id)

if not stats_data:
    st.error("❌ No se pudieron cargar las estadísticas")
    st.stop()

# ═════════════════════════════════════════════════════════════
# TABS DE VISUALIZACIÓN
# ═════════════════════════════════════════════════════════════

tab1, tab2, tab3, tab4 = st.tabs([
    "📊 Box Score",
    "🎯 Shooting Chart",
    "📝 Play-by-Play",
    "⚔️ Team Comparison"
])

# ─────────────────────────────────────────────────────────────
# TAB 1: BOX SCORE
# ─────────────────────────────────────────────────────────────

with tab1:
    st.markdown("### 📊 Box Score - Estadísticas de Jugadores")
    
    player_stats = stats_data['player_stats']
    
    if not player_stats:
        st.warning("⚠️ No hay estadísticas de jugadores")
    else:
        # Obtener IDs de equipos del partido
        home_team_id = selected_game.get('home_team_id')
        away_team_id = selected_game.get('away_team_id')
        
        # Separar por equipo usando team_id y deduplicar por player_id
        seen_home = set()
        seen_away = set()
        home_stats = []
        away_stats = []
        
        for ps in player_stats:
            pid = ps.get('player_id')
            tid = ps.get('team_id')
            if tid == home_team_id and pid not in seen_home:
                seen_home.add(pid)
                home_stats.append(ps)
            elif tid == away_team_id and pid not in seen_away:
                seen_away.add(pid)
                away_stats.append(ps)
        
        def _build_boxscore_df(stats_list):
            """Construir DataFrame de box score sin valoracion ni plus_minus."""
            return pd.DataFrame([{
                'Jugador': ps.get('player', {}).get('name', 'N/A'),
                'MIN': ps.get('minutes', '00:00'),
                'PTS': ps.get('points', 0),
                'T2': f"{ps.get('t2_made', 0)}/{ps.get('t2_att', 0)}",
                'T3': f"{ps.get('t3_made', 0)}/{ps.get('t3_att', 0)}",
                'TL': f"{ps.get('ft_made', 0)}/{ps.get('ft_att', 0)}",
                'RO': ps.get('reb_off', 0),
                'RD': ps.get('reb_def', 0),
                'REB': ps.get('reb_tot', 0),
                'AST': ps.get('assists', 0),
                'STL': ps.get('steals', 0),
                'BLK': ps.get('blocks_for', 0),
                'TO': ps.get('turnovers', 0),
                'FC': ps.get('fouls_comm', 0),
                'FR': ps.get('fouls_rec', 0),
            } for ps in stats_list])
        
        # Equipo Local
        st.markdown(f"#### 🏠 {home_team.get('name', 'Local')} ({len(home_stats)} jugadores)")
        
        if home_stats:
            st.dataframe(_build_boxscore_df(home_stats), use_container_width=True, hide_index=True)
        else:
            st.info("Sin datos de jugadores locales")
        
        st.markdown("---")
        
        # Equipo Visitante
        st.markdown(f"#### ✈️ {away_team.get('name', 'Visitante')} ({len(away_stats)} jugadores)")
        
        if away_stats:
            st.dataframe(_build_boxscore_df(away_stats), use_container_width=True, hide_index=True)
        else:
            st.info("Sin datos de jugadores visitantes")

# ─────────────────────────────────────────────────────────────
# TAB 2: SHOOTING CHART
# ─────────────────────────────────────────────────────────────

with tab2:
    st.markdown("### 🎯 Shooting Chart - Visualización de Tiros")
    
    shots = stats_data['shots']
    
    if not shots:
        st.warning("⚠️ No hay datos de tiros")
    else:
        # Preparar datos
        df_shots = pd.DataFrame([{
            'x': s.get('x_coord', 0),
            'y': s.get('y_coord', 0),
            'made': 'Anotado' if s.get('made') else 'Fallado',
            'player': s.get('player', {}).get('name', 'N/A') if s.get('player') else 'N/A',
            'team': s.get('team', {}).get('name', 'N/A') if s.get('team') else 'N/A',
            'shot_type': s.get('zone', 'N/A'),
            'quarter': s.get('quarter', 'N/A')
        } for s in shots])
        
        # Filtro por equipo
        team_filter = st.selectbox(
            "Filtrar por equipo:",
            ['Todos', home_team.get('name'), away_team.get('name')]
        )
        
        if team_filter != 'Todos':
            df_shots = df_shots[df_shots['team'] == team_filter]
        
        # Crear scatter plot
        fig = px.scatter(
            df_shots,
            x='x',
            y='y',
            color='made',
            color_discrete_map={'Anotado': 'green', 'Fallado': 'red'},
            hover_data=['player', 'team', 'shot_type', 'quarter'],
            title='Mapa de Tiros',
            labels={'x': 'Coordenada X', 'y': 'Coordenada Y'}
        )
        
        # Configurar layout
        fig.update_layout(
            height=600,
            showlegend=True,
            legend_title="Resultado",
            xaxis_title="Coordenada X (Ancho cancha)",
            yaxis_title="Coordenada Y (Largo cancha)"
        )
        
        # Agregar líneas de la cancha (simplificado)
        fig.add_shape(
            type="rect",
            x0=0, y0=0, x1=100, y1=100,
            line=dict(color="black", width=2)
        )
        
        st.plotly_chart(fig, use_container_width=True)
        
        # Estadísticas de tiros
        col1, col2, col3 = st.columns(3)
        
        with col1:
            total_shots = len(df_shots)
            st.metric("🎯 Total Tiros", total_shots)
        
        with col2:
            made_shots = len(df_shots[df_shots['made'] == 'Anotado'])
            st.metric("✅ Anotados", made_shots)
        
        with col3:
            if total_shots > 0:
                accuracy = (made_shots / total_shots) * 100
                st.metric("📊 % Acierto", f"{accuracy:.1f}%")

# ─────────────────────────────────────────────────────────────
# TAB 3: PLAY-BY-PLAY
# ─────────────────────────────────────────────────────────────

with tab3:
    st.markdown("### 📝 Play-by-Play - Jugada a Jugada")
    
    pbp = stats_data['pbp']
    
    if not pbp:
        st.warning("⚠️ No hay datos de play-by-play")
    else:
        df_pbp = pd.DataFrame([{
            'ID': p.get('id', 0),
            'Tiempo': p.get('minute', 'N/A'),
            'Q': p.get('quarter', 'N/A'),
            'Equipo': p.get('team', {}).get('name', 'N/A') if p.get('team') else 'N/A',
            'Jugador': p.get('player', {}).get('name', 'N/A') if p.get('player') else 'N/A',
            'Acción': p.get('action_type', 'N/A'),
            'Descripción': p.get('action_text', 'N/A'),
            'Score': f"{p.get('score_home', '-')} - {p.get('score_away', '-')}"
        } for p in pbp])
        
        # Filtro por cuarto
        quarter_filter = st.selectbox(
            "Filtrar por cuarto:",
            ['Todos'] + sorted(df_pbp['Q'].unique().tolist())
        )
        
        if quarter_filter != 'Todos':
            df_pbp = df_pbp[df_pbp['Q'] == quarter_filter]
        
        # Mostrar tabla scrolleable
        st.dataframe(
            df_pbp,
            use_container_width=True,
            hide_index=True,
            height=600
        )

# ─────────────────────────────────────────────────────────────
# TAB 4: TEAM COMPARISON
# ─────────────────────────────────────────────────────────────

with tab4:
    st.markdown("### ⚔️ Comparación de Equipos")
    
    team_stats = stats_data['team_stats']
    
    if not team_stats or len(team_stats) < 2:
        st.warning("⚠️ No hay suficientes datos de equipos")
    else:
        # Identificar equipos
        home_team_stats = next((ts for ts in team_stats if ts.get('team', {}).get('name') == home_team.get('name')), None)
        away_team_stats = next((ts for ts in team_stats if ts.get('team', {}).get('name') == away_team.get('name')), None)
        
        if not home_team_stats or not away_team_stats:
            st.error("❌ No se pudieron cargar las stats de ambos equipos")
        else:
            # Preparar datos para comparación
            categories = ['Puntos', 'Rebotes', 'R.Off', 'R.Def', 'Asistencias', 'Robos', 'Tapones', 'Tap.Recibidos', 'Pérdidas', 'Faltas', 'Faltas Rec.']
            
            # Calcular puntos: (T2 × 2) + (T3 × 3) + TL
            home_points = (
                home_team_stats.get('t2_made', 0) * 2 +
                home_team_stats.get('t3_made', 0) * 3 +
                home_team_stats.get('ft_made', 0)
            )
            
            away_points = (
                away_team_stats.get('t2_made', 0) * 2 +
                away_team_stats.get('t3_made', 0) * 3 +
                away_team_stats.get('ft_made', 0)
            )
            
            home_values = [
                home_points,
                home_team_stats.get('reb_tot', 0),
                home_team_stats.get('reb_off', 0),
                home_team_stats.get('reb_def', 0),
                home_team_stats.get('assists', 0),
                home_team_stats.get('steals', 0),
                home_team_stats.get('blocks_for', 0),
                home_team_stats.get('blocks_against', 0),
                home_team_stats.get('turnovers', 0),
                home_team_stats.get('fouls_comm', 0),
                home_team_stats.get('fouls_rec', 0),
            ]
            
            away_values = [
                away_points,
                away_team_stats.get('reb_tot', 0),
                away_team_stats.get('reb_off', 0),
                away_team_stats.get('reb_def', 0),
                away_team_stats.get('assists', 0),
                away_team_stats.get('steals', 0),
                away_team_stats.get('blocks_for', 0),
                away_team_stats.get('blocks_against', 0),
                away_team_stats.get('turnovers', 0),
                away_team_stats.get('fouls_comm', 0),
                away_team_stats.get('fouls_rec', 0),
            ]
            
            # Crear gráfico de barras
            fig = go.Figure()
            
            fig.add_trace(go.Bar(
                name=home_team.get('name'),
                x=categories,
                y=home_values,
                marker_color='lightblue'
            ))
            
            fig.add_trace(go.Bar(
                name=away_team.get('name'),
                x=categories,
                y=away_values,
                marker_color='orange'
            ))
            
            fig.update_layout(
                title='Comparación Estadística',
                barmode='group',
                height=500,
                xaxis_title='Categoría',
                yaxis_title='Valor'
            )
            
            st.plotly_chart(fig, use_container_width=True)
            
            # Tabla comparativa
            st.markdown("#### 📊 Tabla Comparativa")
            
            df_comparison = pd.DataFrame({
                'Estadística': categories,
                home_team.get('name'): home_values,
                away_team.get('name'): away_values,
                'Diferencia': [h - a for h, a in zip(home_values, away_values)]
            })
            
            st.dataframe(df_comparison, use_container_width=True, hide_index=True)

st.markdown("---")

# Footer
st.markdown("""
    <div style='text-align: center; padding: 20px;'>
        <p style='color: #888;'>
            🎯 Inspector de Partidos | BasketStats Admin
        </p>
    </div>
""", unsafe_allow_html=True)
