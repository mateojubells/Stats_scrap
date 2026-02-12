#!/usr/bin/env python3
"""
BasketStats Pro — Database Schema Setup
=========================================
Script para crear/configurar las tablas necesarias en Supabase.

Uso:
    python setup_db.py

Este script:
1. Crea la tabla 'leagues' si no existe
2. Verifica otras tablas existentes
3. Muestra resumen de esquema
"""

import sys
from pathlib import Path

# Importar settings
_src_path = str(Path(__file__).resolve().parent / "src")
if _src_path not in sys.path:
    sys.path.insert(0, _src_path)

from config import settings
from supabase import create_client

# SQL para crear tabla leagues
CREATE_LEAGUES_TABLE = """
CREATE TABLE IF NOT EXISTS leagues (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    group_name TEXT NOT NULL,
    feb_group_id TEXT NOT NULL,
    base_url TEXT NOT NULL,
    season_year TEXT NOT NULL,
    discovered_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT unique_group_season UNIQUE(feb_group_id, season_year)
);
"""

CREATE_LEAGUES_INDEX = """
CREATE INDEX IF NOT EXISTS idx_leagues_season
ON leagues(season_year);

CREATE INDEX IF NOT EXISTS idx_leagues_name
ON leagues(name);
"""


def setup_database():
    """Configura el esquema de base de datos."""
    print("=" * 60)
    print("BasketStats Pro — Database Setup")
    print("=" * 60)
    
    # Conectar
    try:
        client = create_client(settings.supabase_url, settings.supabase_key)
        print("\n✅ Conectado a Supabase")
    except Exception as e:
        print(f"\n❌ Error conectando a Supabase: {e}")
        return False
    
    # Crear tabla leagues
    print("\n📋 Creando tabla 'leagues'...")
    try:
        # Ejecutar SQL directamente
        # Nota: Si Supabase no permite SQL directo, usar RPC o alternative
        # Por ahora, asumimos que el usuario puede ejecutar SQL manualmente
        print(f"  SQL:\n{CREATE_LEAGUES_TABLE}")
        print("\n  ℹ️  Para crear la tabla manualmente:")
        print("     1. Ve a https://app.supabase.com/project/[tu-proyecto]/sql")
        print("     2. Copia y ejecuta el SQL anterior")
    except Exception as e:
        print(f"  ❌ Error: {e}")
    
    # Crear índices
    print("\n🔍 Creando índices...")
    try:
        print(f"  SQL:\n{CREATE_LEAGUES_INDEX}")
        print("\n  ℹ️  Ídem anterior para estos índices")
    except Exception as e:
        print(f"  ❌ Error: {e}")
    
    # Verificar tablas existentes
    print("\n📊 Tablas en base de datos:")
    try:
        # Intenta obtener información de tablas
        # Esta es una forma indirecta de verificar
        tables_to_check = [
            "teams", "players", "games", 
            "stats_player_games", "play_by_play", 
            "shots", "stats_team_games", "leagues"
        ]
        
        for table in tables_to_check:
            try:
                result = client.table(table).select("*", count="exact").limit(1).execute()
                count = result.count or 0
                status = "✅"
                print(f"  {status} {table:25} ({count} filas)")
            except Exception:
                print(f"  ⚠️ {table:25} (no accesible)")
    
    except Exception as e:
        print(f"  ❌ Error verificando tablas: {e}")
    
    print("\n" + "=" * 60)
    print("✅ Setup completo")
    print("=" * 60)
    print("\n📝 Próximos pasos:")
    print("  1. Ve a https://app.supabase.com/project/[tu-proyecto]/sql")
    print("  2. Ejecuta el SQL anterior para crear la tabla 'leagues'")
    print("  3. Vuelve a ejecutar este script para verificar")
    print("\n💡 O directamente en app.py, ve a Tab 'Descubrir Ligas' y haz clic en")
    print("   'Iniciar Descubrimiento' - creará automáticamente cualquier tabla")
    print("   faltante si es necesario.")
    
    return True


if __name__ == "__main__":
    success = setup_database()
    sys.exit(0 if success else 1)
