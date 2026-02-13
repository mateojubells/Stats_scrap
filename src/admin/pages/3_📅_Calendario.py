"""
📅 Calendario — Vista por jornadas
Streamlit page that delegates to dashboard calendar view.
"""
import streamlit as st
import sys
from pathlib import Path

root = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(root))

from src.admin.pages.dashboard import render_dashboard

st.set_page_config(page_title="Calendario - BasketStats Admin", page_icon="📅", layout="wide")
render_dashboard()
