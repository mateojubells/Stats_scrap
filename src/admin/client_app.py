"""
BasketStats Pro â€” Portal de Equipo ðŸ€
======================================
AplicaciÃ³n de anÃ¡lisis de rendimiento para entrenadores.
EstÃ©tica NBA-style Dark Mode.

Secciones:
  ðŸ€ Mi Equipo     â€” Stats acumuladas + Shot Heatmap + Fichas de jugadores
  ðŸ“… HistÃ³rico     â€” Partidos disputados, box score, PBP
  ðŸ›¡ï¸ Scouting      â€” PreparaciÃ³n de partido vs rival
"""

import streamlit as st
import pandas as pd
import numpy as np
import plotly.graph_objects as go
import sys
import os
from pathlib import Path
from datetime import datetime
from dotenv import load_dotenv

# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
# PATH & ENV SETUP
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

root = Path(__file__).parent
sys.path.insert(0, str(root))
load_dotenv(root / ".env")

from src.shared.database.repository import SupabaseRepository

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
# CONFIGURACIÃ“N DE EQUIPO (Mock auth â€” cambiar por el ID real)
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

MY_TEAM_ID = 1  # â† Cambiar al ID de tu equipo en la tabla teams

# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
# PAGE CONFIG
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

st.set_page_config(
    page_title="BasketStats Pro",
    page_icon="ðŸ€",
    layout="wide",
    initial_sidebar_state="expanded",
)

# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
# DARK MODE CSS â€” NBA-Style
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

st.markdown("""
<style>
    /* â”€â”€ Base â”€â”€ */
    .stApp { background-color: #0e1117; }
    section[data-testid="stSidebar"] {
        background-color: #161b22;
        border-right: 1px solid #21262d;
    }

    /* â”€â”€ KPI Cards â”€â”€ */
    .kpi-card {
        background: linear-gradient(135deg, #161b22 0%, #1a1f2b 100%);
        border: 1px solid #21262d;
        border-radius: 16px;
        padding: 20px 16px;
        text-align: center;
        box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        transition: transform 0.2s, box-shadow 0.2s;
    }
    .kpi-card:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 30px rgba(0,0,0,0.5);
    }
    .kpi-value {
        font-size: 2.2rem;
        font-weight: 800;
        color: #e6edf3;
        line-height: 1.1;
    }
    .kpi-label {
        font-size: 0.7rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 1.5px;
        color: #8b949e;
        margin-bottom: 4px;
    }
    .kpi-delta {
        font-size: 0.75rem;
        color: #3fb950;
        font-weight: 600;
    }
    .kpi-delta.neg { color: #f85149; }

    /* â”€â”€ Section Headers â”€â”€ */
    .section-header {
        font-size: 1.3rem;
        font-weight: 700;
        color: #e6edf3;
        border-left: 4px solid #3fb950;
        padding-left: 12px;
        margin: 30px 0 16px 0;
    }

    /* â”€â”€ Player Card â”€â”€ */
    .player-card {
        background: linear-gradient(135deg, #161b22 0%, #1c2333 100%);
        border: 1px solid #21262d;
        border-radius: 16px;
        padding: 24px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    }
    .player-name {
        font-size: 1.6rem;
        font-weight: 800;
        color: #e6edf3;
    }
    .player-number {
        font-size: 1rem;
        color: #3fb950;
        font-weight: 700;
    }

    /* â”€â”€ Table styling â”€â”€ */
    .dataframe {
        border-radius: 12px !important;
    }
    
    /* â”€â”€ Tabs â”€â”€ */
    .stTabs [data-baseweb="tab-list"] {
        gap: 8px;
    }
    .stTabs [data-baseweb="tab"] {
        background-color: #161b22;
        border-radius: 8px;
        color: #8b949e;
        border: 1px solid #21262d;
    }
    .stTabs [aria-selected="true"] {
        background-color: #1a3a2a !important;
        color: #3fb950 !important;
        border-color: #3fb950 !important;
    }
    
    /* â”€â”€ Sidebar â”€â”€ */
    .sidebar-title {
        font-size: 1.5rem;
        font-weight: 800;
        color: #e6edf3;
        margin-bottom: 0;
    }
    .sidebar-sub {
        font-size: 0.8rem;
        color: #8b949e;
        margin-top: 0;
    }

    /* â”€â”€ Game Row â”€â”€ */
    .game-row {
        background: #161b22;
        border: 1px solid #21262d;
        border-radius: 12px;
        padding: 12px 16px;
        margin-bottom: 8px;
        display: flex;
        align-items: center;
        justify-content: space-between;
    }
    .game-win { border-left: 4px solid #3fb950; }
    .game-loss { border-left: 4px solid #f85149; }
    .score-big {
        font-size: 1.8rem;
        font-weight: 800;
        color: #e6edf3;
    }

    /* â”€â”€ Threat badge â”€â”€ */
    .threat-badge {
        background: linear-gradient(135deg, #3d1f00 0%, #4a2800 100%);
        border: 1px solid #f0883e;
        border-radius: 8px;
        padding: 4px 12px;
        font-size: 0.75rem;
        font-weight: 700;
        color: #f0883e;
        display: inline-block;
    }
    
    /* â”€â”€ Hide default header/footer â”€â”€ */
    header[data-testid="stHeader"] { background: transparent; }
    .block-container { padding-top: 2rem; }
</style>
""", unsafe_allow_html=True)


# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
# SESSION STATE & SUPABASE
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

if "repo" not in st.session_state:
    if not SUPABASE_URL or not SUPABASE_KEY:
        st.error("âŒ Configura SUPABASE_URL y SUPABASE_KEY en .env")
        st.stop()
    st.session_state.repo = SupabaseRepository(SUPABASE_URL, SUPABASE_KEY)

repo: SupabaseRepository = st.session_state.repo


# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
# HELPER: COURT DRAWING (Plotly)
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

def _court_shapes(color="#21262d", lw=1):
    """
    Returns list of plotly shapes that draw a half-court.
    Coordinate system: x 0-100, y 0-50 (half court).
    """
    import math
    shapes = []

    def _line(x0, y0, x1, y1):
        shapes.append(dict(
            type="line", x0=x0, y0=y0, x1=x1, y1=y1,
            line=dict(color=color, width=lw),
        ))

    def _rect(x0, y0, x1, y1):
        shapes.append(dict(
            type="rect", x0=x0, y0=y0, x1=x1, y1=y1,
            line=dict(color=color, width=lw),
        ))

    def _circle(xc, yc, r, **kw):
        shapes.append(dict(
            type="circle",
            x0=xc - r, y0=yc - r, x1=xc + r, y1=yc + r,
            line=dict(color=color, width=lw), **kw,
        ))

    # Outline
    _rect(0, 0, 100, 50)
    # Paint (zone)
    _rect(17, 6, 83, 44)
    # Free-throw lane
    _rect(30, 6, 70, 44)
    # Basket (small circle)
    _circle(50, 6.5, 1.5)
    # Free throw circle
    _circle(50, 25, 6)
    # Backboard
    _line(44, 5, 56, 5)
    # Restricted area arc
    theta = np.linspace(0, np.pi, 50)
    rx, ry = 4, 4
    for i in range(len(theta) - 1):
        x0 = 50 + rx * np.cos(theta[i])
        y0 = 6 + ry * np.sin(theta[i])
        x1 = 50 + rx * np.cos(theta[i + 1])
        y1 = 6 + ry * np.sin(theta[i + 1])
        _line(x0, y0, x1, y1)
    # Three-point line (arc)
    arc_r = 23.75
    arc_cx, arc_cy = 50, 6
    theta_3pt = np.linspace(0.18, np.pi - 0.18, 80)
    for i in range(len(theta_3pt) - 1):
        x0 = arc_cx + arc_r * np.cos(theta_3pt[i])
        y0 = arc_cy + arc_r * np.sin(theta_3pt[i])
        x1 = arc_cx + arc_r * np.cos(theta_3pt[i + 1])
        y1 = arc_cy + arc_r * np.sin(theta_3pt[i + 1])
        _line(x0, y0, x1, y1)
    # Three-point corners
    _line(3, 0, 3, 14)
    _line(97, 0, 97, 14)

    return shapes


def create_shot_chart(shots_df, title="Shot Chart", mode="scatter"):
    """
    Creates a Plotly shot chart on a basketball half-court.
    mode: 'scatter' (individual points) or 'heatmap' (density).
    """
    fig = go.Figure()

    if shots_df is not None and len(shots_df) > 0:
        if mode == "heatmap":
            fig.add_trace(go.Histogram2dContour(
                x=shots_df["x_coord"],
                y=shots_df["y_coord"],
                colorscale=[
                    [0.0, "rgba(0,0,0,0)"],
                    [0.2, "rgba(63,185,80,0.15)"],
                    [0.4, "rgba(63,185,80,0.35)"],
                    [0.6, "rgba(240,136,62,0.5)"],
                    [0.8, "rgba(240,136,62,0.7)"],
                    [1.0, "rgba(248,81,73,0.9)"],
                ],
                contours=dict(showlines=False),
                ncontours=20,
                showscale=False,
                hoverinfo="skip",
            ))
        else:
            made = shots_df[shots_df["made"] == True]
            missed = shots_df[shots_df["made"] == False]

            if len(made) > 0:
                fig.add_trace(go.Scatter(
                    x=made["x_coord"], y=made["y_coord"],
                    mode="markers",
                    marker=dict(color="#3fb950", size=8, symbol="circle",
                                line=dict(width=1, color="#1a3a2a")),
                    name="Acierto",
                    hovertemplate="Acierto<br>(%{x:.0f}, %{y:.0f})<extra></extra>",
                ))
            if len(missed) > 0:
                fig.add_trace(go.Scatter(
                    x=missed["x_coord"], y=missed["y_coord"],
                    mode="markers",
                    marker=dict(color="#f85149", size=7, symbol="x",
                                line=dict(width=1, color="#5c1a1a")),
                    name="Fallo",
                    hovertemplate="Fallo<br>(%{x:.0f}, %{y:.0f})<extra></extra>",
                ))

    fig.update_layout(
        shapes=_court_shapes(color="#30363d", lw=1.5),
        xaxis=dict(range=[-2, 102], showgrid=False, zeroline=False,
                   showticklabels=False, fixedrange=True),
        yaxis=dict(range=[-2, 52], showgrid=False, zeroline=False,
                   showticklabels=False, fixedrange=True,
                   scaleanchor="x", scaleratio=1),
        plot_bgcolor="#0e1117",
        paper_bgcolor="#0e1117",
        margin=dict(l=10, r=10, t=40, b=10),
        title=dict(text=title, font=dict(color="#e6edf3", size=14),
                   x=0.5, xanchor="center"),
        legend=dict(font=dict(color="#8b949e"), bgcolor="rgba(0,0,0,0)",
                    orientation="h", yanchor="bottom", y=1.02, xanchor="center", x=0.5),
        height=420,
    )
    return fig


# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
# HELPERS: HTML Components
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

def kpi_card(label, value, delta=None, prefix="", suffix=""):
    """Render a styled KPI card."""
    delta_html = ""
    if delta is not None:
        cls = "neg" if delta < 0 else ""
        sign = "+" if delta > 0 else ""
        delta_html = f'<div class="kpi-delta {cls}">{sign}{delta}</div>'
    return f"""
    <div class="kpi-card">
        <div class="kpi-label">{label}</div>
        <div class="kpi-value">{prefix}{value}{suffix}</div>
        {delta_html}
    </div>
    """


# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
# DATA LOADING (Cached)
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

@st.cache_data(ttl=120)
def load_team_info(_repo, team_id):
    """Load basic team info."""
    res = _repo.client.table("teams").select("*").eq("id", team_id).execute()
    return res.data[0] if res.data else None


@st.cache_data(ttl=120)
def load_team_games(_repo, team_id):
    """Load all PROCESSED games where team plays (home or away)."""
    home = (_repo.client.table("games")
            .select("*, home_team:teams!games_home_team_id_fkey(id, name), away_team:teams!games_away_team_id_fkey(id, name)")
            .eq("home_team_id", team_id)
            .eq("status", "PROCESSED")
            .order("date", desc=True)
            .execute())
    away = (_repo.client.table("games")
            .select("*, home_team:teams!games_home_team_id_fkey(id, name), away_team:teams!games_away_team_id_fkey(id, name)")
            .eq("away_team_id", team_id)
            .eq("status", "PROCESSED")
            .order("date", desc=True)
            .execute())
    all_games = (home.data or []) + (away.data or [])
    all_games.sort(key=lambda g: g.get("date") or "", reverse=True)
    return all_games


@st.cache_data(ttl=120)
def load_upcoming_games(_repo, team_id):
    """Load PENDING games for scouting."""
    home = (_repo.client.table("games")
            .select("*, home_team:teams!games_home_team_id_fkey(id, name), away_team:teams!games_away_team_id_fkey(id, name)")
            .eq("home_team_id", team_id)
            .eq("status", "PENDING")
            .order("date")
            .execute())
    away = (_repo.client.table("games")
            .select("*, home_team:teams!games_home_team_id_fkey(id, name), away_team:teams!games_away_team_id_fkey(id, name)")
            .eq("away_team_id", team_id)
            .eq("status", "PENDING")
            .order("date")
            .execute())
    all_games = (home.data or []) + (away.data or [])
    all_games.sort(key=lambda g: g.get("date") or "")
    return all_games


@st.cache_data(ttl=120)
def load_team_season_stats(_repo, team_id):
    """Aggregate season averages from stats_player_games for a team."""
    res = (_repo.client.table("stats_player_games")
           .select("*")
           .eq("team_id", team_id)
           .execute())
    if not res.data:
        return None
    df = pd.DataFrame(res.data)

    # Count distinct games
    n_games = df["game_id"].nunique()
    if n_games == 0:
        return None

    totals = {
        "games": n_games,
        "ppg": df["points"].sum() / n_games,
        "rpg": df["reb_tot"].sum() / n_games,
        "apg": df["assists"].sum() / n_games,
        "spg": df["steals"].sum() / n_games,
        "topg": df["turnovers"].sum() / n_games,
        "eff": df["valoracion"].sum() / n_games,
        "t2_pct": (df["t2_made"].sum() / df["t2_att"].sum() * 100) if df["t2_att"].sum() > 0 else 0,
        "t3_pct": (df["t3_made"].sum() / df["t3_att"].sum() * 100) if df["t3_att"].sum() > 0 else 0,
        "ft_pct": (df["ft_made"].sum() / df["ft_att"].sum() * 100) if df["ft_att"].sum() > 0 else 0,
    }
    return totals


@st.cache_data(ttl=120)
def load_team_players(_repo, team_id):
    """Load roster â€” players with current_team_id == team_id."""
    res = (_repo.client.table("players")
           .select("*")
           .eq("current_team_id", team_id)
           .order("name")
           .execute())
    return res.data or []


@st.cache_data(ttl=120)
def load_player_season_stats(_repo, player_id):
    """Aggregate season stats for a specific player."""
    res = (_repo.client.table("stats_player_games")
           .select("*")
           .eq("player_id", player_id)
           .execute())
    if not res.data:
        return None
    df = pd.DataFrame(res.data)
    n = len(df)
    return {
        "games": n,
        "ppg": round(df["points"].mean(), 1),
        "rpg": round(df["reb_tot"].mean(), 1),
        "apg": round(df["assists"].mean(), 1),
        "spg": round(df["steals"].mean(), 1),
        "topg": round(df["turnovers"].mean(), 1),
        "eff": round(df["valoracion"].mean(), 1),
        "mpg": None,  # minutes is text â€” we'll parse below
        "t2_pct": round(df["t2_made"].sum() / df["t2_att"].sum() * 100, 1) if df["t2_att"].sum() > 0 else 0,
        "t3_pct": round(df["t3_made"].sum() / df["t3_att"].sum() * 100, 1) if df["t3_att"].sum() > 0 else 0,
        "ft_pct": round(df["ft_made"].sum() / df["ft_att"].sum() * 100, 1) if df["ft_att"].sum() > 0 else 0,
        "fpg": round(df["fouls_comm"].mean(), 1),
        "bpg": round(df["blocks_for"].mean(), 1),
        "starter_pct": round(df["starter"].sum() / n * 100, 0) if n > 0 else 0,
    }


@st.cache_data(ttl=120)
def load_shots_for_team(_repo, team_id, game_id=None):
    """Load shots for a team (optionally filtered by game)."""
    q = _repo.client.table("shots").select("*").eq("team_id", team_id)
    if game_id:
        q = q.eq("game_id", game_id)
    res = q.execute()
    return pd.DataFrame(res.data) if res.data else pd.DataFrame()


@st.cache_data(ttl=120)
def load_shots_for_player(_repo, player_id):
    """Load all shots for a player (season)."""
    res = (_repo.client.table("shots")
           .select("*")
           .eq("player_id", player_id)
           .execute())
    return pd.DataFrame(res.data) if res.data else pd.DataFrame()


@st.cache_data(ttl=120)
def load_game_boxscore(_repo, game_id):
    """Full box score for a game."""
    res = (_repo.client.table("stats_player_games")
           .select("*, player:players(name, jersey_number), team:teams(name)")
           .eq("game_id", game_id)
           .order("starter", desc=True)
           .execute())
    return res.data or []


@st.cache_data(ttl=120)
def load_game_pbp(_repo, game_id):
    """Full play-by-play for a game."""
    res = (_repo.client.table("play_by_play")
           .select("*, player:players(name), team:teams(name)")
           .eq("game_id", game_id)
           .order("quarter")
           .order("minute", desc=True)
           .execute())
    return res.data or []


@st.cache_data(ttl=120)
def load_game_shots(_repo, game_id):
    """All shots for a game."""
    res = (_repo.client.table("shots")
           .select("*, player:players(name), team:teams(name)")
           .eq("game_id", game_id)
           .execute())
    return pd.DataFrame(res.data) if res.data else pd.DataFrame()


# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
# SIDEBAR â€” Navigation
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

with st.sidebar:
    st.markdown('<p class="sidebar-title">ðŸ€ BasketStats Pro</p>', unsafe_allow_html=True)
    st.markdown('<p class="sidebar-sub">Portal de Equipo</p>', unsafe_allow_html=True)
    st.markdown("---")

    # Team selector (for multi-team support / demo)
    all_teams_res = repo.client.table("teams").select("id, name").order("name").execute()
    all_teams = all_teams_res.data or []

    if all_teams:
        team_options = {t["name"]: t["id"] for t in all_teams}
        # Find current team name
        current_name = next((t["name"] for t in all_teams if t["id"] == MY_TEAM_ID), None)
        if current_name is None:
            current_name = all_teams[0]["name"]

        selected_team_name = st.selectbox(
            "ðŸ  Mi Equipo", options=list(team_options.keys()),
            index=list(team_options.keys()).index(current_name) if current_name in team_options else 0,
        )
        MY_TEAM_ID_ACTIVE = team_options[selected_team_name]
    else:
        st.warning("No hay equipos en la BD")
        st.stop()

    st.markdown("---")

    page = st.radio(
        "NavegaciÃ³n",
        ["ðŸ€ Mi Equipo", "ðŸ“… HistÃ³rico", "ðŸ›¡ï¸ Scouting"],
        label_visibility="collapsed",
    )

    st.markdown("---")
    st.caption(f"v2.0 â€” {datetime.now().strftime('%d/%m/%Y')}")

team_info = load_team_info(repo, MY_TEAM_ID_ACTIVE)
if not team_info:
    st.error(f"Equipo con ID={MY_TEAM_ID_ACTIVE} no encontrado")
    st.stop()

TEAM_NAME = team_info["name"]


# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
# PAGE 1: ðŸ€ MI EQUIPO
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

if page == "ðŸ€ Mi Equipo":
    st.markdown(f"# ðŸ€ {TEAM_NAME}")

    tab_general, tab_players = st.tabs(["ðŸ“Š General", "ðŸ‘¤ Jugadores"])

    # â”€â”€ TAB GENERAL â”€â”€
    with tab_general:
        stats = load_team_season_stats(repo, MY_TEAM_ID_ACTIVE)

        if not stats:
            st.info("No hay datos de temporada procesados para este equipo.")
            st.stop()

        st.markdown(f'<div class="section-header">Promedios por Partido ({stats["games"]} partidos)</div>',
                    unsafe_allow_html=True)

        # KPI Row 1 â€” Core stats
        cols = st.columns(6)
        kpis = [
            ("PTS", f'{stats["ppg"]:.1f}', None),
            ("REB", f'{stats["rpg"]:.1f}', None),
            ("AST", f'{stats["apg"]:.1f}', None),
            ("EFF", f'{stats["eff"]:.1f}', None),
            ("%T2", f'{stats["t2_pct"]:.1f}', "%"),
            ("%T3", f'{stats["t3_pct"]:.1f}', "%"),
        ]
        for col, (label, value, suffix) in zip(cols, kpis):
            with col:
                st.markdown(kpi_card(label, value, suffix=suffix or ""), unsafe_allow_html=True)

        # KPI Row 2 â€” Secondary
        cols2 = st.columns(4)
        kpis2 = [
            ("%TL", f'{stats["ft_pct"]:.1f}', "%"),
            ("ROB", f'{stats["spg"]:.1f}', None),
            ("PER", f'{stats["topg"]:.1f}', None),
            ("PARTIDOS", stats["games"], None),
        ]
        for col, (label, value, suffix) in zip(cols2, kpis2):
            with col:
                st.markdown(kpi_card(label, value, suffix=suffix or ""), unsafe_allow_html=True)

        st.markdown("")

        # Shot Heatmap
        st.markdown('<div class="section-header">Mapa de Calor de Tiros (Temporada)</div>',
                    unsafe_allow_html=True)

        shots_df = load_shots_for_team(repo, MY_TEAM_ID_ACTIVE)
        if len(shots_df) > 0:
            total_shots = len(shots_df)
            made_shots = shots_df["made"].sum()
            fg_pct = made_shots / total_shots * 100 if total_shots > 0 else 0

            c1, c2, c3 = st.columns([1, 3, 1])
            with c1:
                st.markdown(kpi_card("TIROS TOTALES", total_shots), unsafe_allow_html=True)
                st.markdown(kpi_card("ACIERTOS", int(made_shots)), unsafe_allow_html=True)
                st.markdown(kpi_card("FG%", f"{fg_pct:.1f}", suffix="%"), unsafe_allow_html=True)
            with c2:
                fig = create_shot_chart(shots_df, title=f"Heatmap â€” {TEAM_NAME}", mode="heatmap")
                st.plotly_chart(fig, width='stretch', config={"displayModeBar": False})
            with c3:
                # Zone breakdown
                if "zone" in shots_df.columns and shots_df["zone"].notna().any():
                    zone_stats = (shots_df.groupby("zone")
                                  .agg(total=("made", "count"), made=("made", "sum"))
                                  .assign(pct=lambda d: (d["made"] / d["total"] * 100).round(1))
                                  .sort_values("total", ascending=False))
                    st.markdown("**Por Zona**")
                    for zone, row in zone_stats.head(5).iterrows():
                        st.markdown(
                            f"<span style='color:#8b949e;font-size:0.8rem'>{zone}</span><br>"
                            f"<span style='color:#e6edf3;font-weight:700'>{row['pct']}%</span> "
                            f"<span style='color:#8b949e;font-size:0.75rem'>({int(row['made'])}/{int(row['total'])})</span>",
                            unsafe_allow_html=True,
                        )
                        st.markdown("")
        else:
            st.info("No hay datos de tiros disponibles.")

    # â”€â”€ TAB JUGADORES â”€â”€
    with tab_players:
        players = load_team_players(repo, MY_TEAM_ID_ACTIVE)
        if not players:
            st.info("No hay jugadores registrados para este equipo.")
        else:
            player_options = {f"#{p.get('jersey_number', '?')} {p['name']}": p for p in players}
            selected_player_label = st.selectbox("Selecciona un jugador", list(player_options.keys()))
            selected_player = player_options[selected_player_label]

            st.markdown("---")

            # Player Card
            pstats = load_player_season_stats(repo, selected_player["id"])

            col_info, col_chart = st.columns([1, 2])

            with col_info:
                st.markdown(f"""
                <div class="player-card">
                    <div class="player-number">#{selected_player.get('jersey_number', '?')}</div>
                    <div class="player-name">{selected_player['name']}</div>
                </div>
                """, unsafe_allow_html=True)

                if pstats:
                    st.markdown("")
                    st.markdown(f'<div class="section-header">Stats Temporada ({pstats["games"]}J)</div>',
                                unsafe_allow_html=True)
                    p_cols = st.columns(3)
                    p_kpis = [
                        ("PTS", pstats["ppg"]),
                        ("REB", pstats["rpg"]),
                        ("AST", pstats["apg"]),
                        ("EFF", pstats["eff"]),
                        ("ROB", pstats["spg"]),
                        ("TAP", pstats["bpg"]),
                    ]
                    for i, (label, val) in enumerate(p_kpis):
                        with p_cols[i % 3]:
                            st.markdown(kpi_card(label, val), unsafe_allow_html=True)

                    st.markdown("")
                    # Shooting splits
                    st.markdown("**Shooting Splits**")
                    split_cols = st.columns(3)
                    for col, (label, val) in zip(split_cols, [
                        ("T2%", pstats["t2_pct"]),
                        ("T3%", pstats["t3_pct"]),
                        ("TL%", pstats["ft_pct"]),
                    ]):
                        with col:
                            st.markdown(kpi_card(label, val, suffix="%"), unsafe_allow_html=True)
                else:
                    st.info("Sin estadÃ­sticas aÃºn.")

            with col_chart:
                st.markdown(f'<div class="section-header">Shot Chart â€” {selected_player["name"]}</div>',
                            unsafe_allow_html=True)
                p_shots = load_shots_for_player(repo, selected_player["id"])
                if len(p_shots) > 0:
                    fig = create_shot_chart(p_shots, title="", mode="scatter")
                    st.plotly_chart(fig, width='stretch', config={"displayModeBar": False})

                    made = p_shots["made"].sum()
                    total = len(p_shots)
                    pct = made / total * 100 if total > 0 else 0
                    st.caption(f"**{int(made)}/{total}** tiros â€” **{pct:.1f}%** FG")
                else:
                    st.info("No hay datos de tiros para este jugador.")


# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
# PAGE 2: ðŸ“… HISTÃ“RICO DE PARTIDOS
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

elif page == "ðŸ“… HistÃ³rico":
    st.markdown(f"# ðŸ“… HistÃ³rico â€” {TEAM_NAME}")

    games = load_team_games(repo, MY_TEAM_ID_ACTIVE)

    if not games:
        st.info("No hay partidos procesados para este equipo.")
        st.stop()

    # Build game labels
    game_labels = []
    for g in games:
        home_name = g.get("home_team", {}).get("name", "?")
        away_name = g.get("away_team", {}).get("name", "?")
        date_str = ""
        if g.get("date"):
            try:
                date_str = datetime.fromisoformat(g["date"].replace("Z", "+00:00")).strftime("%d/%m")
            except Exception:
                date_str = str(g["date"])[:10]

        is_home = g["home_team_id"] == MY_TEAM_ID_ACTIVE
        opponent = away_name if is_home else home_name
        my_score = g.get("home_score", 0) if is_home else g.get("away_score", 0)
        opp_score = g.get("away_score", 0) if is_home else g.get("home_score", 0)
        result = "W" if (my_score or 0) > (opp_score or 0) else "L"
        venue = "vs" if is_home else "@"

        label = f"{'ðŸŸ¢' if result == 'W' else 'ðŸ”´'} {date_str} | {venue} {opponent} ({my_score}-{opp_score})"
        game_labels.append(label)

    selected_idx = st.selectbox("Selecciona un partido", range(len(games)),
                                format_func=lambda i: game_labels[i])
    selected_game = games[selected_idx]

    st.markdown("---")

    # Score Header
    home_name = selected_game.get("home_team", {}).get("name", "?")
    away_name = selected_game.get("away_team", {}).get("name", "?")
    hs = selected_game.get("home_score", 0) or 0
    as_ = selected_game.get("away_score", 0) or 0

    c1, c2, c3 = st.columns([2, 1, 2])
    with c1:
        my_home = selected_game["home_team_id"] == MY_TEAM_ID_ACTIVE
        color = "#3fb950" if (hs > as_ and my_home) or (as_ > hs and not my_home) else "#f85149"
        st.markdown(f"""
        <div style="text-align:right">
            <div style="color:#8b949e;font-size:0.8rem">LOCAL</div>
            <div style="color:#e6edf3;font-size:1.2rem;font-weight:700">{home_name}</div>
            <div class="score-big">{hs}</div>
        </div>
        """, unsafe_allow_html=True)
    with c2:
        st.markdown("""
        <div style="text-align:center;padding-top:20px">
            <div style="color:#8b949e;font-size:2rem;font-weight:300">â€”</div>
        </div>
        """, unsafe_allow_html=True)
    with c3:
        st.markdown(f"""
        <div style="text-align:left">
            <div style="color:#8b949e;font-size:0.8rem">VISITANTE</div>
            <div style="color:#e6edf3;font-size:1.2rem;font-weight:700">{away_name}</div>
            <div class="score-big">{as_}</div>
        </div>
        """, unsafe_allow_html=True)

    st.markdown("---")

    # Tabs
    tab_box, tab_shots, tab_pbp = st.tabs(["ðŸ“‹ Box Score", "ðŸŽ¯ Mapa de Tiros", "ðŸ“ Play-by-Play"])

    with tab_box:
        boxscore = load_game_boxscore(repo, selected_game["id"])
        if boxscore:
            df_box = pd.DataFrame(boxscore)
            df_box["player_name"] = df_box["player"].apply(lambda p: p.get("name", "?") if isinstance(p, dict) else "?")
            df_box["jersey"] = df_box["player"].apply(lambda p: p.get("jersey_number", "") if isinstance(p, dict) else "")
            df_box["team_name"] = df_box["team"].apply(lambda t: t.get("name", "?") if isinstance(t, dict) else "?")

            display_cols = ["jersey", "player_name", "starter", "minutes", "points",
                            "t2_made", "t2_att", "t3_made", "t3_att",
                            "ft_made", "ft_att", "reb_off", "reb_def", "reb_tot",
                            "assists", "steals", "turnovers", "blocks_for",
                            "fouls_comm", "valoracion", "plus_minus"]
            col_labels = {"jersey": "#", "player_name": "Jugador", "starter": "Tit.",
                          "minutes": "MIN", "points": "PTS", "t2_made": "T2C", "t2_att": "T2I",
                          "t3_made": "T3C", "t3_att": "T3I", "ft_made": "TLC", "ft_att": "TLI",
                          "reb_off": "RO", "reb_def": "RD", "reb_tot": "RT",
                          "assists": "AST", "steals": "ROB", "turnovers": "PER",
                          "blocks_for": "TAP", "fouls_comm": "FP", "valoracion": "EFF",
                          "plus_minus": "+/-"}

            for team_name in [home_name, away_name]:
                team_df = df_box[df_box["team_name"] == team_name][display_cols].copy()
                team_df = team_df.rename(columns=col_labels)
                is_my_team = (team_name == home_name and selected_game["home_team_id"] == MY_TEAM_ID_ACTIVE) or \
                             (team_name == away_name and selected_game["away_team_id"] == MY_TEAM_ID_ACTIVE)
                icon = "ðŸ " if is_my_team else "ðŸ‘¥"
                st.markdown(f'<div class="section-header">{icon} {team_name}</div>', unsafe_allow_html=True)
                st.dataframe(team_df, width='stretch', hide_index=True, height=min(400, 40 + 35 * len(team_df)))
        else:
            st.info("No hay box score disponible.")

    with tab_shots:
        game_shots = load_game_shots(repo, selected_game["id"])
        if len(game_shots) > 0:
            shot_team_filter = st.radio(
                "Filtrar equipo",
                ["Ambos", home_name, away_name],
                horizontal=True,
            )
            if shot_team_filter == home_name:
                filtered = game_shots[game_shots["team_id"] == selected_game["home_team_id"]]
            elif shot_team_filter == away_name:
                filtered = game_shots[game_shots["team_id"] == selected_game["away_team_id"]]
            else:
                filtered = game_shots

            fig = create_shot_chart(filtered, title=f"Tiros â€” {shot_team_filter}", mode="scatter")
            st.plotly_chart(fig, width='stretch', config={"displayModeBar": False})

            if len(filtered) > 0:
                made = filtered["made"].sum()
                total = len(filtered)
                st.caption(f"**{int(made)}/{total}** â€” **{made/total*100:.1f}%** FG")
        else:
            st.info("No hay datos de tiros para este partido.")

    with tab_pbp:
        pbp_data = load_game_pbp(repo, selected_game["id"])
        if pbp_data:
            # Quarter filter
            quarters = sorted(set(e.get("quarter", 0) for e in pbp_data))
            q_filter = st.selectbox("Cuarto", ["Todos"] + [f"Q{q}" for q in quarters])

            filtered_pbp = pbp_data
            if q_filter != "Todos":
                q_num = int(q_filter.replace("Q", ""))
                filtered_pbp = [e for e in pbp_data if e.get("quarter") == q_num]

            # Display as timeline
            for ev in filtered_pbp:
                team_n = ev.get("team", {}).get("name", "") if isinstance(ev.get("team"), dict) else ""
                player_n = ev.get("player", {}).get("name", "") if isinstance(ev.get("player"), dict) else ""
                action = ev.get("action_type", "")
                minute = ev.get("minute", "")
                q = ev.get("quarter", "")
                score = f"{ev.get('home_score_partial', '')}-{ev.get('away_score_partial', '')}"
                value = ev.get("action_value", 0)

                # Color code
                is_my = team_n == TEAM_NAME
                dot_color = "#3fb950" if is_my else "#f0883e"

                action_display = action.replace("_", " ").upper()
                pts_badge = f" <span style='color:#3fb950;font-weight:700'>+{value}</span>" if value > 0 else ""

                st.markdown(f"""
                <div style="display:flex;gap:12px;align-items:center;padding:6px 0;border-bottom:1px solid #21262d">
                    <span style="color:#8b949e;font-size:0.75rem;min-width:30px">Q{q}</span>
                    <span style="color:#8b949e;font-size:0.8rem;min-width:45px">{minute}</span>
                    <span style="color:{dot_color};font-size:1.2rem">â—</span>
                    <span style="color:#e6edf3;font-weight:600;min-width:180px">{player_n or team_n}</span>
                    <span style="color:#8b949e">{action_display}{pts_badge}</span>
                    <span style="color:#8b949e;margin-left:auto;font-size:0.8rem">{score}</span>
                </div>
                """, unsafe_allow_html=True)
        else:
            st.info("No hay play-by-play disponible.")


# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
# PAGE 3: ðŸ›¡ï¸ SCOUTING (PreparaciÃ³n de Partido)
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

elif page == "ðŸ›¡ï¸ Scouting":
    st.markdown(f"# ðŸ›¡ï¸ PreparaciÃ³n de Partido â€” {TEAM_NAME}")

    upcoming = load_upcoming_games(repo, MY_TEAM_ID_ACTIVE)

    if not upcoming:
        st.info("No hay partidos pendientes en el calendario. Â¡La temporada ha terminado!")
        st.stop()

    # Next game
    next_game = upcoming[0]
    is_home = next_game["home_team_id"] == MY_TEAM_ID_ACTIVE
    rival_name = next_game.get("away_team", {}).get("name", "?") if is_home else next_game.get("home_team", {}).get("name", "?")
    rival_id = next_game["away_team_id"] if is_home else next_game["home_team_id"]
    venue = "ðŸ  LOCAL" if is_home else "âœˆï¸ VISITANTE"

    date_str = ""
    if next_game.get("date"):
        try:
            date_str = datetime.fromisoformat(next_game["date"].replace("Z", "+00:00")).strftime("%d/%m/%Y %H:%M")
        except Exception:
            date_str = str(next_game["date"])[:16]

    # Header
    st.markdown(f"""
    <div style="background:linear-gradient(135deg,#161b22 0%,#1c2333 100%);border:1px solid #21262d;
                border-radius:16px;padding:24px;display:flex;justify-content:space-between;align-items:center">
        <div>
            <div style="color:#8b949e;font-size:0.8rem">{venue}</div>
            <div style="color:#e6edf3;font-size:1.8rem;font-weight:800">{TEAM_NAME}
                <span style="color:#8b949e;font-weight:300"> vs </span>{rival_name}</div>
            <div style="color:#8b949e;font-size:0.9rem">ðŸ“… {date_str}</div>
        </div>
        <div class="threat-badge">PRÃ“XIMO PARTIDO</div>
    </div>
    """, unsafe_allow_html=True)

    st.markdown("")

    # H2H Comparison
    st.markdown('<div class="section-header">Comparativa Head-to-Head (Promedios Temporada)</div>',
                unsafe_allow_html=True)

    my_stats = load_team_season_stats(repo, MY_TEAM_ID_ACTIVE)
    rival_stats = load_team_season_stats(repo, rival_id)

    if my_stats and rival_stats:
        compare_metrics = [
            ("Puntos", "ppg"),
            ("Rebotes", "rpg"),
            ("Asistencias", "apg"),
            ("Robos", "spg"),
            ("PÃ©rdidas", "topg"),
            ("Eficiencia", "eff"),
        ]

        # Bar chart comparison
        categories = [m[0] for m in compare_metrics]
        my_values = [my_stats[m[1]] for m in compare_metrics]
        rival_values = [rival_stats[m[1]] for m in compare_metrics]

        fig_h2h = go.Figure()
        fig_h2h.add_trace(go.Bar(
            name=TEAM_NAME, y=categories, x=my_values,
            orientation="h",
            marker=dict(color="#3fb950", cornerradius=4),
            text=[f"{v:.1f}" for v in my_values],
            textposition="inside",
            textfont=dict(color="#ffffff", size=12, family="Arial Black"),
        ))
        fig_h2h.add_trace(go.Bar(
            name=rival_name, y=categories, x=rival_values,
            orientation="h",
            marker=dict(color="#f0883e", cornerradius=4),
            text=[f"{v:.1f}" for v in rival_values],
            textposition="inside",
            textfont=dict(color="#ffffff", size=12, family="Arial Black"),
        ))
        fig_h2h.update_layout(
            barmode="group",
            plot_bgcolor="#0e1117",
            paper_bgcolor="#0e1117",
            font=dict(color="#8b949e"),
            legend=dict(font=dict(color="#e6edf3"), orientation="h",
                        yanchor="bottom", y=1.02, xanchor="center", x=0.5),
            margin=dict(l=10, r=30, t=40, b=10),
            height=350,
            xaxis=dict(showgrid=True, gridcolor="#21262d"),
            yaxis=dict(showgrid=False),
        )
        st.plotly_chart(fig_h2h, width='stretch', config={"displayModeBar": False})

        # Shooting comparison
        st.markdown('<div class="section-header">Comparativa de Tiro</div>', unsafe_allow_html=True)
        cols = st.columns(3)
        for col, (label, key) in zip(cols, [("T2%", "t2_pct"), ("T3%", "t3_pct"), ("TL%", "ft_pct")]):
            with col:
                my_v = my_stats[key]
                riv_v = rival_stats[key]
                diff = my_v - riv_v
                winner = "ðŸŸ¢" if diff > 0 else "ðŸ”´"
                st.markdown(f"""
                <div class="kpi-card">
                    <div class="kpi-label">{label}</div>
                    <div style="display:flex;justify-content:space-around;margin-top:8px">
                        <div>
                            <div style="color:#3fb950;font-size:1.4rem;font-weight:800">{my_v:.1f}%</div>
                            <div style="color:#8b949e;font-size:0.7rem">{TEAM_NAME[:12]}</div>
                        </div>
                        <div style="color:#8b949e;font-size:1.5rem;padding-top:4px">{winner}</div>
                        <div>
                            <div style="color:#f0883e;font-size:1.4rem;font-weight:800">{riv_v:.1f}%</div>
                            <div style="color:#8b949e;font-size:0.7rem">{rival_name[:12]}</div>
                        </div>
                    </div>
                </div>
                """, unsafe_allow_html=True)
    else:
        st.warning("No hay suficientes datos para la comparativa. Procesa mÃ¡s partidos de ambos equipos.")

    st.markdown("")

    # Rival Roster â€” Threat Analysis
    st.markdown('<div class="section-header">ðŸŽ¯ AnÃ¡lisis de Amenazas â€” Plantilla Rival</div>',
                unsafe_allow_html=True)

    rival_players = load_team_players(repo, rival_id)

    if rival_players:
        # Get season stats for each rival player to sort by PPG
        rival_player_stats = {}
        for rp in rival_players:
            ps = load_player_season_stats(repo, rp["id"])
            if ps:
                rival_player_stats[rp["id"]] = ps

        # Sort by PPG descending
        sorted_players = sorted(
            rival_players,
            key=lambda p: rival_player_stats.get(p["id"], {}).get("ppg", 0),
            reverse=True,
        )

        # Display top threats
        for i, rp in enumerate(sorted_players):
            ps = rival_player_stats.get(rp["id"])
            if not ps:
                continue

            threat_level = ""
            if i == 0:
                threat_level = '<span class="threat-badge">âš ï¸ TOP THREAT</span>'
            elif i < 3:
                threat_level = '<span class="threat-badge">KEY PLAYER</span>'

            with st.expander(
                f"#{rp.get('jersey_number', '?')} {rp['name']} â€” {ps['ppg']} PTS | {ps['rpg']} REB | {ps['apg']} AST",
                expanded=(i == 0),
            ):
                st.markdown(threat_level, unsafe_allow_html=True)

                col_stats, col_chart = st.columns([1, 2])

                with col_stats:
                    s_cols = st.columns(3)
                    for sc, (label, val) in zip(s_cols, [
                        ("PTS", ps["ppg"]), ("REB", ps["rpg"]), ("AST", ps["apg"]),
                    ]):
                        with sc:
                            st.markdown(kpi_card(label, val), unsafe_allow_html=True)

                    s_cols2 = st.columns(3)
                    for sc, (label, val) in zip(s_cols2, [
                        ("T2%", f"{ps['t2_pct']}"), ("T3%", f"{ps['t3_pct']}"), ("TL%", f"{ps['ft_pct']}"),
                    ]):
                        with sc:
                            st.markdown(kpi_card(label, val, suffix="%"), unsafe_allow_html=True)

                    st.caption(f"Titular en {ps['starter_pct']:.0f}% de partidos | {ps['games']} partidos jugados")

                with col_chart:
                    rp_shots = load_shots_for_player(repo, rp["id"])
                    if len(rp_shots) > 0:
                        fig = create_shot_chart(
                            rp_shots,
                            title=f"Zonas de Tiro â€” {rp['name']}",
                            mode="heatmap",
                        )
                        st.plotly_chart(fig, width='stretch', config={"displayModeBar": False})

                        made = rp_shots["made"].sum()
                        total = len(rp_shots)
                        st.caption(f"{int(made)}/{total} tiros â€” {made/total*100:.1f}% FG")
                    else:
                        st.info("Sin datos de tiros.")
    else:
        st.info("No hay datos de jugadores del rival.")
