# BasketStats Pro - Documentación Completa

## Descripción General

BasketStats Pro es un sistema profesional para la gestión, scraping y visualización de estadísticas de baloncesto de la Federación Española de Baloncesto (FEB). El proyecto automatiza la extracción de datos de partidos, ligas y jugadores, almacenando la información en una base de datos Supabase y ofreciendo una interfaz de usuario moderna basada en Streamlit para la administración y análisis de datos.

---

## Arquitectura General

- **Backend**: Python, Playwright, BeautifulSoup, Pydantic, Supabase
- **Frontend**: Streamlit (UI multipágina)
- **Base de datos**: Supabase (PostgreSQL gestionado)
- **Configuración**: Variables de entorno (.env), Pydantic Settings

---

## Estructura de Carpetas

- `src/database/`: Modelos y repositorio para acceso a Supabase
- `src/scraper/`: Scrapers para ligas y partidos (Playwright + BeautifulSoup)
- `src/ui/`: Interfaz de usuario Streamlit (app y páginas)
- `src/config.py`: Configuración centralizada
- `setup_db.py`: Script para inicializar el esquema de la base de datos
- `run_ui.py`: Script para lanzar la interfaz
- `capture_html.py`: Utilidad para depuración de scraping

---

## Principales Componentes y Funcionalidades

### 1. Scraping y Procesado de Datos

- **league_discovery.py**: Descubre todas las ligas y grupos disponibles en la FEB navegando y extrayendo opciones de los dropdowns de la web oficial.
- **league_crawler.py**: Extrae el calendario completo de una liga (jornadas, partidos, equipos, IDs) y lo almacena en Supabase.
- **game_scraper.py**: Scraper avanzado que extrae todos los datos de un partido (boxscore, jugadas, tiros, estadísticas avanzadas) y los guarda en la base de datos.
- **capture_html.py**: Herramienta para capturar el HTML de un partido para depuración y desarrollo de parsers.

### 2. Modelos y Repositorio de Datos

- **models.py**: Define los modelos de datos (Pydantic) para tiros, jugadas, estadísticas de jugadores y equipos, y el contenedor de partido completo.
- **repository.py**: Capa de acceso a datos para insertar, consultar y actualizar información en Supabase. Implementa patrones como get_or_create y upsert.

### 3. Interfaz de Usuario (Streamlit)

- **app.py**: Configura la app, carga variables de entorno y define la navegación multipágina.
- **pages/dashboard.py**: Muestra KPIs globales del sistema (ligas, partidos, procesados, pendientes).
- **pages/1_🏆_Ligas.py**: Gestión masiva de ligas, escaneo de calendarios y procesado batch de partidos.
- **pages/2_🎯_Partidos.py**: Inspector individual de partidos, procesamiento y visualización completa (boxscore, shooting chart, play-by-play, comparativa de equipos).
- **pages/3_📅_Calendario.py**: Visualización del calendario completo de una liga, organizado por jornadas.
- **pages/league_manager.py**: Importación y gestión de calendarios de ligas.
- **pages/game_inspector.py**: Procesamiento y visualización detallada de partidos individuales.

### 4. Configuración y Utilidades

- **config.py**: Centraliza la configuración usando Pydantic y variables de entorno.
- **setup_db.py**: Script para crear y verificar las tablas necesarias en Supabase.
- **run_ui.py**: Lanza la interfaz Streamlit desde la raíz del proyecto.

---

## Flujo de Trabajo

1. **Inicialización**: Ejecutar `setup_db.py` para crear las tablas necesarias en Supabase.
2. **Descubrimiento de Ligas**: Usar el script de discovery para poblar la tabla de ligas.
3. **Scraping de Calendarios**: Extraer el calendario de partidos de cada liga.
4. **Scraping de Partidos**: Procesar partidos individualmente o en batch para extraer todas las estadísticas.
5. **Visualización y Gestión**: Usar la interfaz Streamlit para analizar KPIs, gestionar ligas y partidos, y visualizar datos avanzados.

---

## Requisitos y Dependencias

- Python 3.10+
- Playwright
- Streamlit
- Supabase-py
- Pydantic
- Pandas, Plotly, dotenv, httpx, BeautifulSoup

Instalar dependencias:
```bash
pip install -r requirements.txt
```

---

## Ejecución

- **Lanzar la interfaz**:
  ```bash
  python run_ui.py
  ```
- **Inicializar base de datos**:
  ```bash
  python setup_db.py
  ```
- **Scraping manual**:
  Ejecutar scripts en `src/scraper/` según necesidad.

---

## Notas de Seguridad

- Las claves de Supabase deben almacenarse en `.env` y nunca subirse a repositorios públicos.
- El sistema está preparado para entornos de desarrollo y producción.

---

## Créditos y Autoría

Desarrollado por Mateo. Inspirado en la necesidad de automatizar y profesionalizar la gestión de estadísticas deportivas para la FEB.

---

## Contacto y Soporte

Para dudas, mejoras o soporte, contactar al autor o abrir un issue en el repositorio correspondiente.
