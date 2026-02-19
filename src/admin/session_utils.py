"""
Utilities para inicializar y gestionar el session state de Streamlit
"""
import streamlit as st
import os
import sys
import asyncio
import threading
from pathlib import Path
from dotenv import load_dotenv

# Setup path
root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(root))

# Load environment variables
load_dotenv(root / ".env")

from src.shared.database.repository import SupabaseRepository


def init_session_state():
    """
    Inicializa el session_state con el repositorio de Supabase.
    Debe llamarse al principio de cada página Streamlit.
    """
    if "repo" not in st.session_state:
        SUPABASE_URL = os.getenv("SUPABASE_URL")
        SUPABASE_KEY = os.getenv("SUPABASE_KEY")
        
        if not SUPABASE_URL or not SUPABASE_KEY:
            st.error("❌ Credenciales de Supabase no configuradas. Configura SUPABASE_URL y SUPABASE_KEY en .env")
            st.stop()
        
        st.session_state.repo = SupabaseRepository(SUPABASE_URL, SUPABASE_KEY)


def run_async(coro):
    """
    Helper para ejecutar coroutines async desde Streamlit (Windows compatible).
    Resuelve el problema de NotImplementedError en Windows con asyncio y Playwright.
    """
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

