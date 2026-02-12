# 🏗️ ARQUITECTURA COMPLETA - BasketStats Pro

## 📋 Índice

1. [Visión General](#visión-general)
2. [Estructura de Carpetas](#estructura-de-carpetas)
3. [Stack Tecnológico](#stack-tecnológico)
4. [Módulos Principales](#módulos-principales)
5. [Flujo de Datos](#flujo-de-datos)
6. [Base de Datos](#base-de-datos)
7. [Cómo Funciona Cada Componente](#cómo-funciona-cada-componente)

---

## 🎯 Visión General

**BasketStats Pro** es una aplicación completa de extracción, procesamiento y visualización de estadísticas de baloncesto de la liga española FEB.

### Funciones Principales

| Función | Descripción |
|---------|-------------|
| **🔍 League Discovery** | Descubre automáticamente todas las ligas en FEB.es |
| **📥 Calendar Import** | Descarga calendarios de ligas con jornadas y partidos |
| **📊 Game Processing** | Extrae estadísticas detalladas de partidos |
| **🎨 Data Visualization** | Interfaz web para visualizar datos importados |

---

## 📁 Estructura de Carpetas

```
Stats_scrap/
├── src/                          # 💻 CÓDIGO PRINCIPAL
│   ├── config.py                 # ⚙️ Configuración (Supabase, variables de entorno)
│   │
│   ├── database/                 # 🗄️ CAPA DE BASE DE DATOS
│   │   ├── models.py             # Modelos Pydantic (validación de datos)
│   │   └── repository.py         # SupabaseRepository (CRUD operations)
│   │
│   ├── scraper/                  # 🌐 CAPA DE SCRAPING
│   │   ├── league_discovery.py   # Descubrimiento automático de ligas
│   │   ├── league_crawler.py     # Extracción de calendarios y partidos
│   │   └── game_scraper.py       # Estadísticas detalladas de partidos
│   │
│   └── ui/                       # 🎨 INTERFAZ STREAMLIT
│       ├── app.py                # Aplicación principal
│       └── pages/                # Páginas de la aplicación
│           ├── 1_🏆_Ligas.py     # Gestor de ligas - importar calendarios
│           ├── 2_🎯_Partidos.py  # Inspector de partidos
│           ├── 3_📅_Calendario.py # Vista de calendario
│           ├── dashboard.py      # Inicio/dashboard
│           ├── game_inspector.py # Inspector detallado de partidos
│           └── league_manager.py # Gestor de ligas
│
├── .env                          # 🔐 Variables de entorno (NUNCA commitear)
├── .env.example                  # 📋 Template de .env
├── requirements.txt              # 📦 Dependencias Python
├── setup_db.py                   # 🗄️ Script de inicialización de BD
├── run_ui.py                     # ▶️ Lanzador de la UI
├── capture_html.py               # 🔧 Utilidad para capturar HTML (debug)
│
└── README.md                     # Documentación general

```

---

## 🛠️ Stack Tecnológico

| Componente | Tecnología | Propósito |
|-----------|-----------|----------|
| **Language** | Python 3.13+ | Lenguaje principal |
| **Web Scraping** | Playwright (async) | Automatización de navegador para JS rendering |
| **Web Framework** | Streamlit | Interfaz web reactiva sin frontend |
| **Database** | Supabase (PostgreSQL) | Base de datos cloud |
| **ORM** | Supabase Python SDK | Interacción con BD |
| **Validation** | Pydantic | Validación de modelos de datos |
| **HTTP Client** | httpx | Requests síncronos/asíncronos |
| **Parsing** | BeautifulSoup | Parsing de HTML |

---

## 🔧 Módulos Principales

### 1. **src/config.py** - Configuración
```python
# Lee variables de entorno
get_supabase_url()    # Returns: "https://xxxxx.supabase.co"
get_supabase_key()    # Returns: API key de Supabase
```

### 2. **src/database/models.py** - Validación de Datos
Define estructuras de datos con Pydantic:
- `ShotData` - Coordenadas de tiros
- `PlayByPlayEvent` - Eventos del partido
- `PlayerGameStats` - Estadísticas por jugador
- `TeamAdvancedStats` - Métricas avanzadas de equipo

### 3. **src/database/repository.py** - Operaciones de BD
```python
SupabaseRepository
├── Equipos (Teams)
│   ├── get_or_create_team()      # O obtiene existente o crea nuevo
│   ├── get_teams()               # Lista todas
│   └── update_team()             # Actualiza datos
│
├── Ligas (Leagues)
│   ├── get_leagues()             # Obtiene ligas con grupos
│   ├── get_league_by_id()        # Obtiene liga específica
│   └── get_games_by_league()     # Todos los partidos de una liga
│
├── Partidos (Games)
│   ├── upsert_game()             # Crea o actualiza partido
│   ├── get_pending_games()       # Partidos sin procesar
│   └── update_game_status()      # Cambia estado (PENDING→PROCESSED)
│
└── Estadísticas (Stats)
    ├── save_game_stats()         # Guarda estadísticas completas
    └── get_game_stats()          # Recupera estadísticas
```

### 4. **src/scraper/league_discovery.py** - Descubrimiento de Ligas
```
Função: discover_leagues()
1. Va a FEB.es
2. Extrae lista de categorías (Primera FEB, Segunda FEB, Tercera FEB, etc.)
3. Para cada categoría, extrae TODOS los grupos
4. Retorna:
   {
     "name": "Tercera FEB",
     "group_name": "Grupo C-A",
     "base_url": "https://www.feb.es/competiciones/calendario/tercerafeb/3/2025",
     "feb_group_id": "88886",  # ← Usado para seleccionar grupo
     ...
   }
```

### 5. **src/scraper/league_crawler.py** - Extracción de Calendarios
```
FLUJO COMPLETO:

crawl_league_with_group()
├─ Ejecuta en THREAD SEPARADO (evita conflictos Streamlit Windows)
├─ _extract_calendar_with_group() async
│  ├─ Playwright navega a URL base
│  ├─ Selecciona dropdown de grupo (si existe)
│  └─ Extrae HTML de calendario
├─ parse_calendario_html()
│  ├─ Busca headers: <h1>Jornada N DD/MM/YYYY</h1>
│  ├─ Para cada jornada, busca partidos
│  ├─ Extrae:
│  │  - Equipo local (nombre + feb_id)
│  │  - Equipo visitante (nombre + feb_id)
│  │  - Resultado (si ya jugado)
│  │  - Jornada (número)
│  │  - URL del partido
│  │  - feb_game_id
│  └─ Retorna lista de dicts
└─ Para cada partido:
   ├─ repository.get_or_create_team() - equipos
   ├─ repository.upsert_game() - partido en BD
   └─ Retorna result con game_id
```

### 6. **src/scraper/game_scraper.py** - Estadísticas de Partidos
```
scrape_and_save_game()
1. Descarga página completa del partido
2. Extrae de múltiples secciones HTML:
   - Shot Chart (div.shoot) → coordenadas de tiros
   - Play-by-Play (div.widget-keyfacts) → eventos cronológicos
   - Player Stats (div.responsive-scroll) → estadísticas por jugador
   - Team Stats (div.widget-teamstats) → métricas de equipo
3. Valida con Pydantic models
4. Guarda en BD via repository.save_game_stats()
5. Marca game.status = "PROCESSED"
```

---

## 📊 Flujo de Datos

### A. **Discovery → Import → Processing**

```
┌─────────────────────────────────────────────────────────────┐
│ 1. USER: Abre UI Streamlit (run_ui.py)                     │
└────────────────┬────────────────────────────────────────────┘
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. UI: Va a página "🏆 Ligas" (1_🏆_Ligas.py)              │
│    - Llama repo.get_leagues()                              │
│    - Muestra lista de ligas importadas                     │
└────────────────┬────────────────────────────────────────────┘
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. USER: Selecciona liga (ej: Tercera FEB Grupo C-A)       │
│    - ID: 8                                                  │
│    - feb_group_id: 88886                                    │
└────────────────┬────────────────────────────────────────────┘
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. USER: Click "Escanear Calendario"                       │
└────────────────┬────────────────────────────────────────────┘
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. UI: Llama crawl_league_with_group()                      │
│    base_url="https://www.feb.es/..."                       │
│    feb_group_id="88886"                                     │
│    league_id=8                                              │
└────────────────┬────────────────────────────────────────────┘
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ 6. SCRAPER: Thread → Playwright                            │
│    - Navega a base_url                                     │
│    - Selecciona grupo 88886 en dropdown                    │
│    - Expera que cargue HTML                                │
│    - Extrae HTML completo                                 │
└────────────────┬────────────────────────────────────────────┘
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ 7. PARSER: parse_calendario_html(html)                     │
│    - Busca todos <h1>Jornada N</h1>                        │
│    - Por cada jornada, busca partidos                      │
│    - Extrae: equipos, resultado, jornada, URL              │
│    - Retorna: List[Dict] con 182 partidos                  │
└────────────────┬────────────────────────────────────────────┘
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ 8. REPOSITORY: Upsert cada partido                         │
│    - get_or_create_team() x 2 (home + away)                │
│    - upsert_game() → INSERT/UPDATE en BD                   │
│    - Guarda: jornada, resultado, estado                    │
│    - Si error con jornada → continua sin ella              │
└────────────────┬────────────────────────────────────────────┘
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ 9. UI: Muestra resultado                                   │
│    ✅ "182 partidos importados"                            │
└─────────────────────────────────────────────────────────────┘
```

---

## 🗄️ Base de Datos (Supabase → PostgreSQL)

### Schema Simplificado

```sql
-- TEAMS: Equipos
CREATE TABLE teams (
  id BIGINT PRIMARY KEY,
  feb_id TEXT UNIQUE NOT NULL,  -- ID de FEB.es
  name TEXT NOT NULL,            -- Nombre del equipo
  current_team_id BIGINT,        -- Para historial
  jersey_number INTEGER,         -- Dorsal
  ...
);

-- LEAGUES: Ligas y sus grupos
CREATE TABLE leagues (
  id BIGINT PRIMARY KEY,
  name TEXT NOT NULL,                    -- "Primera FEB", "Tercera FEB", etc.
  group_name TEXT,                       -- "Grupo C-A", "Liga Regular ESTE", etc.
  base_url TEXT,                         -- URL de la categoría en FEB.es
  feb_group_id TEXT,                     -- ID para seleccionar grupo
  season_year TEXT,
  status TEXT DEFAULT 'ACTIVE'
);

-- GAMES: Partidos
CREATE TABLE games (
  id BIGINT PRIMARY KEY,
  feb_game_id TEXT UNIQUE NOT NULL,     -- ID de FEB.es
  league_id BIGINT REFERENCES leagues,  -- ← Qué liga/grupo
  date TIMESTAMP,                        -- Fecha del partido
  home_team_id BIGINT REFERENCES teams, -- Equipo local
  away_team_id BIGINT REFERENCES teams, -- Equipo visitante
  home_score INTEGER,                    -- Resultado (si jugado)
  away_score INTEGER,
  status TEXT DEFAULT 'PENDING',        -- PENDING / PROCESSED / ERROR
  jornada INTEGER,                       -- NÚMERO DE JORNADA (1-26, 1-34, etc)
  url TEXT,                              -- Link al partido
  updated_at TIMESTAMP DEFAULT now()
);
```

### Relaciones Clave

```
leagues (n) ──────── (1) categories
  |
  └─ MUCHOS grupos de una liga
     (ej: Tercera FEB tiene 10 grupos A-A, A-B, ..., E-B)

leagues (1) ────── (n) games
  |
  └─ MUCHOS partidos por liga/grupo

teams (1) ────── (n) games
  |
  └─ Como equipo local O visitante
```

---

## 🔄 Cómo Funciona Cada Componente

### **1. UI - run_ui.py y src/ui/app.py**

```python
# run_ui.py (punto de entrada)
if __name__ == "__main__":
    import subprocess
    subprocess.run(["streamlit", "run", "src/ui/app.py"])

# src/ui/app.py (aplicación principal)
def main():
    st.set_page_config(page_title="BasketStats", layout="wide")
    
    # Inicializar repositorio
    if 'repo' not in st.session_state:
        st.session_state.repo = SupabaseRepository(url, key)
    
    # Sidebar con navegación
    st.sidebar.title("📊 BasketStats")
    
    # Renderizar página actual
    # (Streamlit automáticamente carga pages/*.py)
```

### **2. Página 1: 🏆 Ligas (src/ui/pages/1_🏆_Ligas.py)**

**Funcionalidad:**
- Muestra tabla de ligas importadas
- Selector para elegir liga
- Button "Escanear Calendario"

**Flujo:**
```python
@st.cache_data
def get_leagues_list():
    return repo.get_leagues()  # SELECT * FROM leagues

# Mostrar tabla
leagues = get_leagues_list()
df = pd.DataFrame(leagues)
st.dataframe(df[['name', 'group_name', 'game_count', ...]])

# Selector
league_id = st.selectbox("Selecciona liga", options)

# Botón Escanear
if st.button("Escanear Calendario"):
    selected_league_full = next((l for l in leagues if l['id'] == league_id))
    
    # Detectar si tiene grupo
    if selected_league_full.get('feb_group_id'):
        # Liga con múltiples grupos → usar crawl_league_with_group
        games = crawl_league_with_group(
            base_url=selected_league_full['base_url'],
            feb_group_id=selected_league_full['feb_group_id'],
            repository=repo,
            league_id=league_id
        )
    else:
        # Liga simple → usar crawl_league
        games = crawl_league(...)
    
    st.success(f"✅ {len(games)} partidos importados")
```

### **3. Página 2: 🎯 Partidos (src/ui/pages/2_🎯_Partidos.py)**

**Funcionalidad:**
- Tabla de todos los partidos
- Filtros por liga, estado, jornada
- Link a detalles de cada partido

### **4. Página 3: 📅 Calendario (src/ui/pages/3_📅_Calendario.py)**

**Funcionalidad:**
- Vista por jornadas expandibles
- Agrupar partidos por jornada (1, 2, 3, ..., 26)
- Mostrar resultados si ya jugados

```python
# Agrupar por jornada
games_by_jornada = {}
for game in games:
    j = game.get('jornada', 0)
    if j not in games_by_jornada:
        games_by_jornada[j] = []
    games_by_jornada[j].append(game)

# Mostrar expandibles
for jornada in sorted_jornadas:
    with st.expander(f"🗓️ Jornada {jornada}"):
        st.dataframe(games_by_jornada[jornada])
```

---

## 🔑 Detalles Técnicos Críticos

### **A. Event Loop en Windows + Streamlit**

**Problema:** Playwright necesita crear subprocesos. Windows + Streamlit crea conflicto de event loops.

**Solución:** Ejecutar Playwright en thread separado
```python
def crawl_league_with_group(...):
    result = {}
    error = {}
    
    def _run_playwright():
        loop = asyncio.new_event_loop()  # ← Thread nuevo = loop nuevo
        asyncio.set_event_loop(loop)
        try:
            html = loop.run_until_complete(
                _extract_calendar_with_group(...)
            )
            result['html'] = html
        finally:
            loop.close()
    
    thread = threading.Thread(target=_run_playwright)
    thread.start()
    thread.join()
    return result['html']
```

### **B. Jornada (Número de Jornada)**

**Estructura:** Por cada partido está guardada la jornada (1-26 para Tercera FEB, 1-34 para Primera FEB).

**Flujo:**
```python
# 1. HTML contiene: <h1>Jornada 5 20/11/2025</h1>
# 2. Regex extrae: jornada_num = 5
# 3. Se guarda en dict: {"jornada": 5, ...}
# 4. Se pasa a upsert_game: jornada=5
# 5. Se guarda en BD: games.jornada = 5
# 6. UI agrupa por jornada
```

### **C. Feb Group ID (Para Ligas con Grupos)**

**Propósito:** Distinguir grupos dentro de la misma categoría

**Ejemplo - Tercera FEB:**
- Grupo A-A: feb_group_id = "88882"
- Grupo C-A: feb_group_id = "88886"
- Grupo E-B: feb_group_id = "88892"

**Uso:**
```python
# En Playwright, selecciona dropdown:
await page.select_option(
    "select#_ctl0_MainContentPlaceHolderMaster_grupoDropDownList",
    value="88886"  # ← Selecciona Grupo C-A
)
```

---

## 🚀 Puntos de Entrada

### Para **Nuevo Agente**

1. **Entender estructura:**
   - Leer este documento
   - Ver `src/` structure
   
2. **Correr la app:**
   ```bash
   python run_ui.py
   ```
   Abre http://localhost:8501

3. **Entender un flujo:**
   - Abrir `src/ui/pages/1_🏆_Ligas.py`
   - Buscar `st.button("Escanear")`
   - Seguir el flujo de `crawl_league_with_group()`

4. **Debuggear:**
   - Logs en consola muestran todo lo que ocurre
   - Buscar: `[GROUP]`, `[PARSE]`, `[REPO]` tags en logs

---

## 📝 Notas Importantes

✅ **Base de datos:**
- Supabase (PostgreSQL)
- Variables de entorno en `.env`

✅ **Configuración:**
- `src/config.py` carga variables
- `.env.example` muestra qué se necesita

✅ **Dependencias:**
- `requirements.txt` lista todas
- Instalar: `pip install -r requirements.txt`

✅ **Errores comúnes:**
- Event loop en Windows → solución: thread separado ✅ (implementado)
- Jornada None → retryar sin campo jornada ✅ (implementado)
- Selectores no encontrados → fallback a HTML directo ✅ (implementado)

---

Este documento proporciona todo lo necesario para entender, modificar o debuggear la aplicación. 🎉
