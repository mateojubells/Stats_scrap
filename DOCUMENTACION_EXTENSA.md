# DOCUMENTACION_EXTENSA.md

# BasketStats Pro — Documentación Técnica Detallada

## Índice
1. Introducción y visión global
2. Arquitectura y tecnologías
3. Estructura de carpetas y archivos
4. Explicación detallada de cada archivo/script
5. Modelos de datos y base de datos
6. Lógica de scraping y procesamiento
7. Interfaz de usuario (UI)
8. Configuración y utilidades
9. Ejemplo de flujo de uso
10. Buenas prácticas y troubleshooting
11. Recomendaciones para desarrolladores

---

## 1. Introducción y visión global
BasketStats Pro es una plataforma profesional para scraping, almacenamiento y visualización de estadísticas de baloncesto de la FEB. Automatiza la extracción de datos oficiales, los almacena en Supabase y ofrece una interfaz web moderna para su gestión y análisis.

---

## 2. Arquitectura y tecnologías
- **Lenguaje:** Python 3.10+
- **Scraping:** Playwright (async), BeautifulSoup
- **Backend:** Pydantic, Supabase-py
- **Frontend:** Streamlit (UI multipágina)
- **Base de datos:** Supabase (PostgreSQL)
- **Otros:** dotenv, pandas, plotly, httpx

### Diagrama general
```
[Web FEB] → [Scrapers Playwright] → [SupabaseRepository] → [Supabase DB]
                                              ↓
                                    [Streamlit UI]
```

---

## 3. Estructura de carpetas y archivos
```
Stats_scrap/
├── src/
│   ├── config.py
│   ├── database/
│   │   ├── models.py
│   │   └── repository.py
│   ├── scraper/
│   │   ├── league_discovery.py
│   │   ├── league_crawler.py
│   │   ├── game_scraper.py
│   │   └── pbp_parser.py
│   └── ui/
│       ├── app.py
│       └── pages/
│           ├── 1_🏆_Ligas.py
│           ├── 2_🎯_Partidos.py
│           ├── 3_📅_Calendario.py
│           ├── dashboard.py
│           ├── league_manager.py
│           └── game_inspector.py
├── setup_db.py
├── run_ui.py
├── requirements.txt
├── .env / .env.example
```

---

## 4. Explicación detallada de cada archivo/script

### src/config.py
- Centraliza la configuración de la app usando Pydantic.
- Lee variables de entorno (.env) para Supabase, scraping y entorno de ejecución.
- Permite cambiar parámetros sin tocar el código.

### src/database/models.py
- Define todos los modelos de datos (Pydantic): tiros, jugadas, jugadores, equipos, partidos, estadísticas avanzadas.
- Usa enums para tipos de tiro, zonas, acciones de jugada, etc.
- Garantiza validación y consistencia de los datos antes de guardar en BD.

### src/database/repository.py
- Capa de acceso a datos (SupabaseRepository).
- Métodos para CRUD en tablas: teams, players, games, stats_player_games, play_by_play, shots, stats_team_games.
- Patrón get_or_create para entidades maestras, upsert para partidos, delete+bulk insert para stats.
- Lógica idempotente: re-procesar un partido no genera duplicados.
- Maneja reconexión y refresco de schema.

### src/scraper/league_discovery.py
- Descubre todas las ligas y grupos disponibles en la web de la FEB.
- Usa Playwright para navegar, seleccionar temporada y extraer grupos de cada liga.
- Guarda los resultados en la tabla 'leagues' de Supabase.
- Función principal: `discover_leagues(repository, season_year, headless)`.

### src/scraper/league_crawler.py
- Extrae el calendario completo de una liga: jornadas, partidos, equipos, IDs.
- Parsea el HTML de la web oficial y estructura los datos.
- Devuelve lista de partidos con info detallada (equipos, fecha, marcador, IDs, logos).
- Integra con SupabaseRepository para guardar los datos.

### src/scraper/game_scraper.py
- Scraper avanzado de partidos: extrae boxscore, jugadas, tiros, estadísticas de equipos y jugadores.
- Usa Playwright y BeautifulSoup para navegar y parsear la web de cada partido.
- Llama a repository.save_game_stats() para guardar todo en Supabase.
- Actualiza el estado del partido a PROCESSED.
- Incluye lógica para clasificar zonas de tiro y parsear eventos de play-by-play.

### src/scraper/pbp_parser.py
- Parser especializado para convertir texto de jugadas (play-by-play) en acciones estructuradas.
- Utilizado por game_scraper.py para desglosar eventos cronológicos.

### src/ui/app.py
- Punto de entrada de la interfaz Streamlit.
- Configura la navegación multipágina y el layout global.
- Carga variables de entorno y prepara el repo para la sesión.

### src/ui/pages/dashboard.py
- Página principal de la UI.
- Muestra KPIs globales: total de ligas, partidos importados, procesados, pendientes.
- Resumen de ligas y acceso rápido a otras secciones.

### src/ui/pages/1_🏆_Ligas.py
- Gestión masiva de ligas: ver tabla, escanear calendario, procesado batch de partidos pendientes.
- Permite importar y procesar grandes volúmenes de datos de una vez.

### src/ui/pages/2_🎯_Partidos.py
- Inspector individual de partidos.
- Permite seleccionar liga y partido, procesar individualmente y visualizar boxscore, shooting chart, play-by-play y comparativa de equipos.

### src/ui/pages/3_📅_Calendario.py
- Visualización cronológica de todos los partidos de una liga, organizados por jornadas.
- Permite navegar y filtrar partidos fácilmente.

### src/ui/pages/league_manager.py
- Importación y gestión de calendarios de ligas.
- Selector de liga, importación de calendario, vista previa de partidos importados.

### src/ui/pages/game_inspector.py
- Procesamiento y visualización detallada de partidos individuales.
- Permite reprocesar partidos y ver todos los datos asociados.

### setup_db.py
- Script para crear y verificar las tablas necesarias en Supabase.
- Imprime el SQL necesario para crear la tabla 'leagues' y los índices.
- Ayuda a inicializar el proyecto desde cero.

### run_ui.py
- Script para lanzar la interfaz Streamlit desde la raíz del proyecto.
- Busca el archivo app.py y ejecuta `streamlit run`.

### requirements.txt
- Lista de todas las dependencias necesarias para el proyecto.

### .env / .env.example
- Variables de entorno: claves de Supabase, parámetros de scraping, configuración de entorno.

---

## 5. Modelos de datos y base de datos
- **leagues**: id, name, group_name, feb_group_id, base_url, season_year, discovered_at
- **teams**: id, feb_id, name, logo_url
- **players**: id, feb_id, name, team_id, bio_data
- **games**: id, feb_game_id, league_id, home_team_id, away_team_id, date, status
- **stats_player_games**: id, game_id, player_id, stats...
- **stats_team_games**: id, game_id, team_id, stats...
- **play_by_play**: id, game_id, event_type, timestamp, description
- **shots**: id, game_id, player_id, x, y, result, zone

Los modelos Pydantic en models.py reflejan y validan estos datos antes de insertarlos.

---

## 6. Lógica de scraping y procesamiento
- **league_discovery.py**: Navega por la web de la FEB, selecciona temporada y extrae todos los grupos de cada liga.
- **league_crawler.py**: Extrae el calendario completo de partidos de una liga, parseando HTML y guardando en BD.
- **game_scraper.py**: Para cada partido, extrae boxscore, jugadas, tiros, estadísticas avanzadas y guarda todo en Supabase.
- **pbp_parser.py**: Convierte texto de jugadas en eventos estructurados.
- Todo el scraping es asíncrono y tolerante a errores.

---

## 7. Interfaz de usuario (UI)
- **Streamlit multipágina**: app.py define la navegación y layout global.
- **dashboard.py**: KPIs y resumen del sistema.
- **1_🏆_Ligas.py**: Gestión masiva de ligas y procesamiento batch.
- **2_🎯_Partidos.py**: Inspector y visualización de partidos.
- **3_📅_Calendario.py**: Vista cronológica de partidos.
- **league_manager.py**: Importación y gestión de calendarios.
- **game_inspector.py**: Procesamiento y visualización detallada de partidos.
- Todas las páginas usan el repo central para acceder a los datos.

---

## 8. Configuración y utilidades
- **config.py**: Centraliza toda la configuración usando Pydantic y .env.
- **setup_db.py**: Inicializa la base de datos y verifica el esquema.
- **run_ui.py**: Lanza la interfaz de usuario.

---

## 9. Ejemplo de flujo de uso
1. Clona el repo y crea un entorno virtual.
2. Instala dependencias: `pip install -r requirements.txt`
3. Copia `.env.example` a `.env` y rellena tus claves de Supabase.
4. Ejecuta `python setup_db.py` para crear las tablas.
5. Lanza la interfaz: `python run_ui.py` o `streamlit run src/ui/app.py`
6. Usa la UI para descubrir ligas, importar calendarios y procesar partidos.

---

## 10. Buenas prácticas y troubleshooting
- Usa entornos virtuales para aislar dependencias.
- Nunca subas `.env` a repositorios públicos.
- Si hay errores de módulos, revisa requirements.txt y reinstala.
- Si la tabla 'leagues' no existe, ejecuta `setup_db.py` y copia el SQL en Supabase.
- Usa los logs para depurar scraping y errores de conexión.

---

## 11. Recomendaciones para desarrolladores
- Lee primero config.py y models.py para entender la estructura y configuración.
- Explora repository.py para ver cómo se accede a los datos.
- Usa la UI para probar el flujo completo antes de modificar scrapers.
- Añade tests para nuevos parsers o cambios en la lógica de scraping.
- Documenta cualquier cambio en la estructura de la base de datos.

---

> Para cualquier duda, sugerencia o bug, contactar al autor o abrir un issue en el repositorio.
