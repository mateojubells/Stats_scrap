# 🏀 BasketStats Pro

Sistema completo de scraping, almacenamiento y visualización de estadísticas de baloncesto de la FEB (Federación Española de Baloncesto). Incluye un **panel de administración** (Streamlit) y un **dashboard de cliente** (Next.js + Supabase).

---

## 🚀 Quick Start

### 1. Panel Admin (Streamlit)

```bash
pip install -r requirements.txt
cp .env.example .env            # Configurar SUPABASE_URL + SUPABASE_KEY
python run_ui.py                # → http://localhost:8501
```

### 2. Dashboard Cliente (Next.js)

```bash
cd src/client
cp .env.local.example .env.local  # Configurar NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY
pnpm install
pnpm dev                          # → http://localhost:3000
```

---

## 🏗️ Estructura del Proyecto

```
├── run_ui.py                   # Lanzador del admin Streamlit
├── requirements.txt            # Dependencias Python
├── src/
│   ├── shared/                 # Código compartido Python
│   │   ├── config.py           # Configuración (Pydantic Settings)
│   │   ├── database/
│   │   │   ├── models.py       # Modelos Pydantic (FullGameData, ShotData, etc.)
│   │   │   └── repository.py   # CRUD Supabase (SupabaseRepository)
│   │   └── scraper/
│   │       ├── game_scraper.py # Scraping con Playwright
│   │       ├── league_crawler.py
│   │       ├── league_discovery.py
│   │       └── pbp_parser.py   # Parser play-by-play
│   ├── admin/                  # Panel admin (Streamlit)
│   │   ├── app.py
│   │   └── pages/
│   │       ├── 1_🏆_Ligas.py
│   │       ├── 2_🎯_Partidos.py
│   │       ├── 3_📅_Calendario.py
│   │       ├── league_manager.py
│   │       ├── game_inspector.py
│   │       └── dashboard.py
│   └── client/                 # Dashboard React (Next.js 16)
│       ├── package.json
│       ├── app/
│       │   ├── layout.tsx      # Root layout + AuthProvider
│       │   ├── page.tsx        # Dashboard principal
│       │   ├── login/page.tsx  # Login / Registro
│       │   ├── player/page.tsx # Ficha de jugador
│       │   └── scouting/page.tsx # Scouting rival
│       ├── components/
│       │   ├── fiba-shot-chart.tsx   # Canvas FIBA (15:14)
│       │   ├── auth-guard.tsx
│       │   ├── app-sidebar.tsx
│       │   ├── top-bar.tsx
│       │   ├── dashboard/      # Widgets del dashboard
│       │   ├── player/         # Componentes ficha jugador
│       │   └── scouting/       # Componentes scouting
│       └── lib/
│           ├── supabase.ts     # Cliente Supabase
│           ├── types.ts        # Tipos TypeScript (DB schema)
│           ├── auth-context.tsx # AuthProvider (session + team)
│           └── api.ts          # API de datos (team-scoped)
```

---

## 🗄️ Base de Datos (Supabase)

### Tablas Principales

| Tabla | Descripción |
|-------|-------------|
| `leagues` | Ligas/grupos descubiertos |
| `teams` | Equipos |
| `players` | Jugadores (current_team_id) |
| `games` | Partidos (PENDING / PROCESSED) |
| `stats_player_games` | Estadísticas individuales por partido |
| `stats_team_games` | Estadísticas de equipo por partido |
| `shots` | Tiros (x, y, made, shot_type) |
| `play_by_play` | Jugada a jugada |
| `users` | Usuarios del dashboard (**team_id** → scoping) |

### Scoping por Equipo

Cada usuario del dashboard tiene un `team_id`. Todas las queries del cliente se filtran por ese equipo: partidos, jugadores, stats, tiros.

---

## 🔑 Variables de Entorno

### Python Admin (`.env`)
```env
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_KEY=eyJ...
```

### React Client (`src/client/.env.local`)
```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

---

## ✨ Características

### Admin (Streamlit)
- Importar calendarios de todas las ligas FEB
- Manejar múltiples grupos (Tercera FEB = 10 grupos)
- Procesar estadísticas detalladas con Playwright
- Visualización por jornadas

### Cliente (Next.js)
- Auth con Supabase (login/registro + team selector)
- Dashboard con stats de equipo en tiempo real
- Shot chart FIBA (canvas, 15:14, coordenadas reglamentarias)
- Ficha de jugador (promedios, radar, historial)
- Scouting rival (comparación, amenaza clave, H2H)

---

## 🐛 Solucionar Problemas

| Problema | Solución |
|----------|----------|
| `ModuleNotFoundError: playwright` | `pip install playwright && playwright install` |
| `NotImplementedError` en Windows | Cerrar y reabrir Streamlit |
| El dashboard no carga datos | Verificar `.env.local` con las keys correctas |
| No hay equipos en login | El admin debe importar ligas y procesar partidos primero |

---

**¿Preguntas?** Revisa los logs en consola o los archivos en `src/`. 📝
