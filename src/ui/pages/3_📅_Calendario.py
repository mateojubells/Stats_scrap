"""
📅 CALENDARIO DE LIGA

Visualización completa del calendario de una liga organizado por jornadas.
Permite ver todos los partidos en orden cronológico.
"""

import streamlit as st
from datetime import datetime
import pandas as pd

# ═════════════════════════════════════════════════════════════
# CONFIG
# ═════════════════════════════════════════════════════════════

st.set_page_config(
    page_title="Calendario | BasketStats",
    page_icon="📅",
    layout="wide"
)

# Inicializar repositorio
if 'repo' not in st.session_state:
    from src.database.repository import SupabaseRepository
    from src.config import get_supabase_url, get_supabase_key
    st.session_state.repo = SupabaseRepository(
        url=get_supabase_url(),
        key=get_supabase_key()
    )

# ═════════════════════════════════════════════════════════════
# FUNCIONES AUXILIARES
# ═════════════════════════════════════════════════════════════

@st.cache_data(ttl=60)
def get_leagues_list(_repo):
    """Obtener lista de ligas"""
    try:
        response = _repo.client.table("leagues")\
            .select("*")\
            .order("name")\
            .execute()
        return response.data
    except Exception as e:
        st.error(f"Error cargando ligas: {str(e)}")
        return []

@st.cache_data(ttl=30)
def get_league_calendar(_repo, league_id):
    """Obtener todos los partidos de una liga ordenados por jornada y fecha"""
    try:
        response = _repo.client.table("games")\
            .select("*, home_team:home_team_id(name), away_team:away_team_id(name)")\
            .eq("league_id", league_id)\
            .order("jornada")\
            .order("date")\
            .execute()
        return response.data
    except Exception as e:
        st.error(f"Error cargando calendario: {str(e)}")
        return []

def get_status_badge(status):
    """Retorna badge HTML según el estado del partido"""
    if status == "PROCESSED":
        return "🟢 PROCESADO"
    elif status == "PENDING":
        return "🟡 PENDIENTE"
    elif status == "ERROR":
        return "🔴 ERROR"
    else:
        return "⚪ DESCONOCIDO"

def format_date(date_str):
    """Formatea fecha a formato legible"""
    if not date_str:
        return "Sin fecha"
    try:
        dt = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
        return dt.strftime("%d/%m/%Y")
    except:
        return date_str

# ═════════════════════════════════════════════════════════════
# PÁGINA PRINCIPAL
# ═════════════════════════════════════════════════════════════

st.title("📅 Calendario Global de Liga")
st.markdown("### Visualización completa por jornadas")
st.markdown("---")

# ═════════════════════════════════════════════════════════════
# SELECTOR DE LIGA
# ═════════════════════════════════════════════════════════════

leagues = get_leagues_list(st.session_state.repo)

if not leagues:
    st.warning("⚠️ No hay ligas importadas")
    st.stop()

# Selector de liga
league_options = {f"{l['name']} ({l.get('group_name', 'N/A')})": l['id'] 
                  for l in leagues}

selected_league_str = st.selectbox(
    "🏆 Selecciona una liga:",
    options=list(league_options.keys())
)

selected_league_id = league_options[selected_league_str]

# Cargar calendario
games = get_league_calendar(st.session_state.repo, selected_league_id)

if not games:
    st.warning("⚠️ Esta liga no tiene partidos importados. Ve a 'Ligas' para escanear el calendario.")
    st.stop()

st.markdown("---")

# ═════════════════════════════════════════════════════════════
# ESTADÍSTICAS GENERALES
# ═════════════════════════════════════════════════════════════

total_games = len(games)
processed = sum(1 for g in games if g.get('status') == 'PROCESSED')
pending = sum(1 for g in games if g.get('status') == 'PENDING')
error = sum(1 for g in games if g.get('status') == 'ERROR')

# Obtener número de jornadas
jornadas = sorted(set(g.get('jornada', 0) for g in games if g.get('jornada')))
num_jornadas = len(jornadas)

col1, col2, col3, col4, col5 = st.columns(5)

with col1:
    st.metric("📊 Total Partidos", total_games)

with col2:
    st.metric("🗓️ Jornadas", num_jornadas)

with col3:
    st.metric("🟢 Procesados", processed)

with col4:
    st.metric("🟡 Pendientes", pending)

with col5:
    progress = (processed / total_games * 100) if total_games > 0 else 0
    st.metric("📈 Progreso", f"{progress:.1f}%")

st.markdown("---")

# ═════════════════════════════════════════════════════════════
# CALENDARIO POR JORNADAS
# ═════════════════════════════════════════════════════════════

st.subheader("📆 Calendario Completo")

# Agrupar por jornada
games_by_jornada = {}
for game in games:
    j = game.get('jornada', 0)
    if j not in games_by_jornada:
        games_by_jornada[j] = []
    games_by_jornada[j].append(game)

# Ordenar jornadas
sorted_jornadas = sorted(games_by_jornada.keys())

# Opciones de filtro
filter_col1, filter_col2 = st.columns([2, 1])

with filter_col1:
    filter_status = st.multiselect(
        "🔍 Filtrar por estado:",
        options=["PROCESSED", "PENDING", "ERROR"],
        default=["PROCESSED", "PENDING", "ERROR"]
    )

with filter_col2:
    show_scores = st.checkbox("🔢 Mostrar resultados", value=True)

st.markdown("---")

# Mostrar jornadas
for jornada in sorted_jornadas:
    jornada_games = games_by_jornada[jornada]
    
    # Filtrar por estado
    jornada_games = [g for g in jornada_games if g.get('status') in filter_status]
    
    if not jornada_games:
        continue
    
    # Estadísticas de la jornada
    j_total = len(jornada_games)
    j_processed = sum(1 for g in jornada_games if g.get('status') == 'PROCESSED')
    j_pending = sum(1 for g in jornada_games if g.get('status') == 'PENDING')
    
    # Expandible por jornada
    with st.expander(
        f"🗓️ **Jornada {jornada}** - {j_total} partidos "
        f"(🟢 {j_processed} | 🟡 {j_pending})",
        expanded=(jornada <= 2)  # Primeras 2 jornadas expandidas por defecto
    ):
        # Crear tabla de partidos
        table_data = []
        
        for game in jornada_games:
            home_name = game.get('home_team', {}).get('name', 'N/A')
            away_name = game.get('away_team', {}).get('name', 'N/A')
            date = format_date(game.get('date'))
            status = game.get('status', 'N/A')
            
            # Construir el versus con resultado si está procesado
            if show_scores and status == 'PROCESSED' and game.get('home_score') is not None:
                versus = f"{home_name} {game.get('home_score', 0)} - {game.get('away_score', 0)} {away_name}"
            else:
                versus = f"{home_name} vs {away_name}"
            
            table_data.append({
                'ID': game['id'],
                'Fecha': date,
                'Partido': versus,
                'Estado': get_status_badge(status),
                'FEB ID': game.get('feb_game_id', 'N/A')
            })
        
        # Mostrar tabla
        df = pd.DataFrame(table_data)
        st.dataframe(
            df,
            use_container_width=True,
            hide_index=True,
            column_config={
                'ID': st.column_config.NumberColumn('ID', width="small"),
                'Fecha': st.column_config.TextColumn('Fecha', width="small"),
                'Partido': st.column_config.TextColumn('Partido', width="large"),
                'Estado': st.column_config.TextColumn('Estado', width="small"),
                'FEB ID': st.column_config.TextColumn('FEB ID', width="medium")
            }
        )

st.markdown("---")

# ═════════════════════════════════════════════════════════════
# VISTA COMPACTA (OPCIONAL)
# ═════════════════════════════════════════════════════════════

with st.expander("📋 Ver tabla completa (todas las jornadas)"):
    all_games_data = []
    
    for game in games:
        if game.get('status') not in filter_status:
            continue
            
        home_name = game.get('home_team', {}).get('name', 'N/A')
        away_name = game.get('away_team', {}).get('name', 'N/A')
        
        if show_scores and game.get('status') == 'PROCESSED' and game.get('home_score') is not None:
            versus = f"{home_name} {game.get('home_score', 0)} - {game.get('away_score', 0)} {away_name}"
        else:
            versus = f"{home_name} vs {away_name}"
        
        all_games_data.append({
            'Jornada': game.get('jornada', 0),
            'ID': game['id'],
            'Fecha': format_date(game.get('date')),
            'Partido': versus,
            'Estado': get_status_badge(game.get('status', 'N/A'))
        })
    
    df_all = pd.DataFrame(all_games_data)
    
    st.dataframe(
        df_all,
        use_container_width=True,
        hide_index=True,
        height=600
    )
    
    # Botón de descarga CSV
    csv = df_all.to_csv(index=False).encode('utf-8')
    st.download_button(
        label="📥 Descargar calendario completo (CSV)",
        data=csv,
        file_name=f"calendario_{selected_league_str}.csv",
        mime="text/csv"
    )

# Footer
st.markdown("---")
st.markdown("""
    <div style='text-align: center; padding: 20px;'>
        <p style='color: #888;'>
            📅 Calendario Global | BasketStats Admin
        </p>
    </div>
""", unsafe_allow_html=True)
