"""
🏆 Ligas — Gestión masiva de ligas FEB
Streamlit page that delegates to league_manager.
"""
import streamlit as st
import sys
from pathlib import Path

# Ensure project root in path
root = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(root))

from src.admin.pages.league_manager import render_league_manager

st.set_page_config(page_title="Ligas - BasketStats Admin", page_icon="🏆", layout="wide")
render_league_manager()
