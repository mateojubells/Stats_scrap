"""
🎯 Partidos — Inspector individual de partidos
Streamlit page that delegates to game_inspector.
"""
import streamlit as st
import sys
from pathlib import Path

root = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(root))

from src.admin.pages.game_inspector import render_game_inspector

st.set_page_config(page_title="Partidos - BasketStats Admin", page_icon="🎯", layout="wide")
render_game_inspector()
