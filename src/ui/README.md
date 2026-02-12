# 🏀 FEB Stats Scraper - UI v2.0

Interfaz de usuario profesional para gestionar el sistema completo de scraping de estadísticas de la Federación Española de Baloncesto.

## 🚀 Inicio Rápido

### Opción 1: Desde la raíz del proyecto
```bash
python run_ui.py
```

### Opción 2: Desde el directorio de UI
```bash
cd src/ui
streamlit run app.py
```

La aplicación se abrirá automáticamente en `http://localhost:8501`

## 📋 Estructura de la Aplicación

```
src/ui/
├── app.py                      # Aplicación principal con navegación
└── pages/
    ├── dashboard.py            # HOME - Dashboard con KPIs
    ├── league_manager.py       # Gestión e importación de ligas
    └── game_inspector.py       # Procesamiento de partidos individuales
```

## 🎯 Funcionalidades

### 1. 🏠 Dashboard (HOME)

**KPIs en tiempo real:**
- 📋 Total de Ligas descubiertas
- 🏀 Partidos Importados
- ✅ Partidos Procesados
- ⏳ Partidos Pendientes

**Resumen de Ligas:**
- Tabla interactiva con todas las ligas
- Contador de partidos por liga (totales, procesados, pendientes)
- Links directos a FEB.es
- Acciones rápidas para navegar a otras secciones

### 2. 📋 League Manager

**Gestión de Calendarios:**
- Selector de liga con información completa
- **Importar Calendario**: Descarga automática de todos los partidos de una liga
- **Re-escanear Liga**: Elimina partidos existentes y vuelve a importar (con confirmación)
- Vista previa de partidos importados con estado

**Flujo de trabajo:**
1. Selecciona una liga del dropdown
2. Haz clic en "Importar Calendario"
3. El sistema descargará todos los partidos usando Playwright
4. Verás el progreso en tiempo real con spinners
5. Al finalizar, se mostrará la tabla con todos los partidos

### 3. 🔍 Game Inspector

**Procesamiento Individual:**
- Selector de liga y partido
- Vista detallada del partido (equipos, fecha, estado)
- **Procesar Partido**: Extrae estadísticas completas (box score + play-by-play)
- **Re-procesar**: Actualiza estadísticas de partidos ya procesados

**Visualización (para partidos procesados):**
- **Tab 1 - Box Score Local**: Estadísticas de jugadores del equipo local
- **Tab 2 - Box Score Visitante**: Estadísticas del equipo visitante
- **Tab 3 - Play by Play**: Eventos cronológicos del partido (últimos 50)

**Métricas mostradas:**
- Básicas: MIN, PTS, REB, AST, VAL
- Tiros: T2 (conv/lanz), T3 (conv/lanz), TL (conv/lanz)

## 🔧 Integración con Backend

La UI está completamente integrada con el sistema de scraping asíncrono:

### Scrapers utilizados:
- **`calendar_crawler.py`**: Importa calendarios completos de ligas
- **`game_scraper.py`**: Procesa estadísticas de partidos individuales

### Repository Methods:
```python
# Lecturas
repo.get_dashboard_stats()         # KPIs del dashboard
repo.get_all_leagues()             # Todas las ligas
repo.get_games_by_league(id)       # Partidos de una liga
repo.get_game_by_id(id)            # Detalle de un partido
repo.get_player_stats_by_game(id)  # Stats de jugadores
repo.get_play_by_play(id, limit)   # Eventos play-by-play

# Escrituras
repo.delete_games_by_league(id)    # Para re-escaneos
```

### Ejecución Asíncrona:
```python
# En league_manager.py
result = asyncio.run(crawl_league_calendar(
    league_id=league_id,
    feb_group_id=league["feb_group_id"],
    base_url=league["base_url"]
))

# En game_inspector.py
result = asyncio.run(scrape_full_game(game_id))
```

## 🎨 Características de UX

### Feedback Visual:
- ✅ `st.success()` para operaciones exitosas
- ❌ `st.error()` para errores con stacktrace
- ⏳ `st.spinner()` para operaciones largas
- ℹ️ `st.info()` para avisos contextuales
- ⚠️ `st.warning()` para confirmaciones (re-escaneo)

### Estado de Sesión:
- Repository singleton compartido entre páginas
- Navegación persistente
- Confirmaciones con session_state

### Diseño Responsive:
- `layout="wide"` para aprovechar pantalla completa
- Columnas adaptativas con `st.columns()`
- Tablas con `use_container_width=True`
- Configuración personalizada de columnas

## 📊 Base de Datos

### Tablas utilizadas:
- `leagues`: Ligas descubiertas (13 grupos FEB)
- `games`: Partidos importados
- `teams`: Equipos (auto-creados)
- `players`: Jugadores (auto-creados)
- `stats_player_games`: Estadísticas de jugadores por partido
- `play_by_play`: Eventos cronológicos

### Estados de Partidos:
- **PENDING**: Importado pero sin procesar
- **PROCESSED**: Con estadísticas completas

## 🚦 Workflow Completo

### 1. Descubrimiento Inicial (Una vez)
```bash
# Ejecutar desde raíz del proyecto
python test_discovery.py
```
✅ Descubre automaticamente las 13 ligas FEB (1 Primera + 2 Segunda + 10 Tercera)

### 2. Importar Calendarios (Por Liga)
1. Abre UI → League Manager
2. Selecciona liga
3. Click "Importar Calendario"
4. Espera (puede tardar varios minutos)
5. Verás todos los partidos importados con estado PENDING

### 3. Procesar Partidos (Individual o Masivo)
**Opción A - Individual (UI):**
1. Game Inspector → Selecciona liga y partido
2. Click "Procesar Estadísticas Completas"
3. Visualiza resultados en tabs

**Opción B - Masivo (Terminal):**
```python
# Script personalizado para procesar todos los pending
from src.scraper.game_scraper import scrape_full_game
import asyncio

pending_games = repo.get_games_by_league(league_id)
for game in [g for g in pending_games if g['status'] == 'PENDING']:
    asyncio.run(scrape_full_game(game['id']))
```

## 🔐 Configuración

Requiere archivo `.env` en la raíz del proyecto:
```env
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_KEY=eyJxxx...
```

## 🐛 Troubleshooting

### "Credenciales de Supabase no configuradas"
- Verifica que `.env` existe en la raíz
- Confirma que `SUPABASE_URL` y `SUPABASE_KEY` están definidos

### "No hay ligas en el sistema"
- Ejecuta `python test_discovery.py` para descubrir ligas

### "Error al importar calendario"
- Verifica que Playwright está instalado: `python -m playwright install`
- Confirma que la URL de la liga es válida
- Revisa logs en terminal para detalles

### "Column games.game_date does not exist"
- Ya resuelto: La columna se llama `date`, no `game_date`

## 📝 Notas Técnicas

### Arquitectura:
- **Patrón**: Repository + Async Scrapers + Streamlit UI
- **Estado**: Session state compartido entre páginas
- **Navegación**: Radio button en sidebar
- **Datos**: PostgreSQL via Supabase

### Performance:
- Importar calendario: ~2-5 minutos por liga (depende de cantidad de partidos)
- Procesar partido: ~30-60 segundos por partido
- Dashboard KPIs: <1 segundo (queries optimizadas)

### Limitaciones:
- Importación y procesamiento son síncronos (bloquea UI)
- Play-by-play limitado a últimos 50 eventos
- No hay sistema de colas para procesamiento masivo

## 🚀 Mejoras Futuras

- [ ] Sistema de colas con Celery/Redis para procesamiento asíncrono
- [ ] Dashboard con gráficos (Plotly/Altair)
- [ ] Filtros avanzados en tablas
- [ ] Exportación de datos (CSV/Excel)
- [ ] Logs en tiempo real (WebSockets)
- [ ] Sistema de notificaciones
- [ ] Multi-temporada support
- [ ] API REST para integraciones externas

## 📄 Licencia

Proyecto personal - FEB Stats Scraper v2.0+

---

**Desarrollado con ❤️ usando Streamlit + Playwright + Supabase**
