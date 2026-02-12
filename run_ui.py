"""
Script para iniciar la interfaz Streamlit desde la raíz del proyecto.
"""

import subprocess
import sys
from pathlib import Path

if __name__ == "__main__":
    ui_path = Path(__file__).parent / "src" / "ui" / "app.py"
    
    print(f"🚀 Iniciando Streamlit UI desde: {ui_path}")
    
    subprocess.run([
        sys.executable,
        "-m",
        "streamlit",
        "run",
        str(ui_path)
    ])
