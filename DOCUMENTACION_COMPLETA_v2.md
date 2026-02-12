# BasketStats Pro - Documentación Técnica y Funcional (Revisión 2026)

## 1. Descripción General
BasketStats Pro es una plataforma integral para la extracción, almacenamiento y visualización de estadísticas de baloncesto de la FEB. Automatiza el scraping de datos oficiales, los almacena en Supabase y ofrece una interfaz web profesional para su gestión y análisis.

---

## 2. Estructura del Proyecto

```
Stats_scrap/
├── src/
│   ├── config.py                # Configuración central (entorno, Supabase, scraping)
│   ├── database/
│   │   ├── models.py            # Modelos Pydantic para validación y contratos
│   │   └── repository.py        # Acceso y lógica de datos (SupabaseRepository)
│   ├── scraper/
│   │   ├── league_discovery.py  # Descubrimiento automático de ligas y grupos
│   │   ├── league_crawler.py    # Extracción de calendarios y partidos
│   │   └── game_scraper.py      # Scraping avanzado de partidos
│   └── ui/
│       ├── app.py               # App principal Streamlit
│       └── pages/
│           ├── 1_🏆_Ligas.py         # Gestión masiva de ligas
│           ├── 2_🎯_Partidos.py      # Inspector de partidos
│           ├── 3_📅_Calendario.py    # Vista de calendario
│           ├── dashboard.py         # KPIs y resumen
│           ├── league_manager.py    # Importación de calendarios
│           └── game_inspector.py    # Procesamiento individual de partidos
├── setup_db.py                  # Script de inicialización de la base de datos
├── run_ui.py                    # Lanzador de la interfaz
├── capture_html.py              # Utilidad de depuración de scraping
├── requirements.txt             # Dependencias
├── .env / .env.example          # Variables de entorno
```

---

## 3. Principales Funcionalidades

### Scraping y Procesamiento
- **Descubrimiento de Ligas**: Navega y extrae automáticamente todas las ligas y grupos disponibles en la web de la FEB.
- **Extracción de Calendarios**: Descarga jornadas, partidos y equipos de cada liga.
- **Scraping de Partidos**: Obtiene boxscore, jugadas, tiros y estadísticas avanzadas de cada partido.
- **Depuración**: Herramienta para capturar HTML real y facilitar el desarrollo de parsers.

### Backend y Modelos
- **Modelos Pydantic**: Validan y estructuran los datos extraídos (jugadores, equipos, partidos, eventos, tiros, etc.).
- **SupabaseRepository**: Capa de acceso a datos, con métodos para CRUD, upserts y lógica idempotente.

### Interfaz de Usuario (Streamlit)
- **Dashboard**: KPIs globales y resumen de ligas y partidos.
- **Gestión de Ligas**: Importación masiva, escaneo de calendarios y batch processing.
- **Inspector de Partidos**: Procesamiento y visualización completa de partidos individuales (boxscore, shooting chart, play-by-play, comparativa de equipos).
- **Calendario**: Visualización cronológica de todos los partidos de una liga.

---

## 4. Flujo de Trabajo

1. **Configuración**: Editar `.env` con las claves de Supabase y parámetros de scraping.
2. **Inicialización**: Ejecutar `setup_db.py` para crear las tablas necesarias.
3. **Descubrimiento**: Usar la interfaz o scripts para poblar la tabla de ligas.
4. **Importación de Calendarios**: Descargar partidos de cada liga.
5. **Procesamiento de Partidos**: Scraping individual o batch de partidos para extraer todas las estadísticas.
6. **Visualización y Gestión**: Analizar y gestionar datos desde la interfaz web.

---

## 5. Requisitos y Dependencias
- Python 3.10+
- Playwright
- Streamlit
- Supabase-py
- Pydantic
- Pandas, Plotly, dotenv, httpx, BeautifulSoup

Instalación:
```bash
pip install -r requirements.txt
```

---

## 6. Ejecución Rápida

```bash
# 1. Configura .env
cp .env.example .env
# Edita .env con tus claves

# 2. Inicializa la base de datos
python setup_db.py

# 3. Lanza la interfaz
python run_ui.py
# o
cd src/ui
streamlit run app.py
```

---

## 7. Seguridad y Buenas Prácticas
- Nunca subas `.env` a repositorios públicos.
- El sistema soporta entornos de desarrollo y producción.
- Usa entornos virtuales para aislar dependencias.

---

## 8. Créditos y Contacto
Desarrollado por Mateo. Para soporte, sugerencias o bugs, contactar al autor o abrir un issue.

---

## 9. Recursos y Documentos Relacionados
- `README.md`: Resumen y guía rápida
- `GETTING_STARTED.md`: Guía paso a paso
- `ARCHITECTURE.md`: Detalle técnico y flujo de datos
- `src/ui/README.md`: Manual de la interfaz

---

## 10. Glosario de Módulos Clave
- **league_discovery.py**: Descubre ligas y grupos en la web de la FEB.
- **league_crawler.py**: Extrae calendarios completos de ligas.
- **game_scraper.py**: Scraping avanzado de partidos y estadísticas.
- **models.py**: Modelos de datos (Pydantic) para validación y contratos.
- **repository.py**: Acceso y lógica de datos en Supabase.
- **app.py**: App principal Streamlit y configuración global.
- **dashboard.py**: KPIs y resumen del sistema.
- **1_🏆_Ligas.py**: Gestión masiva de ligas y procesamiento batch.
- **2_🎯_Partidos.py**: Inspector y visualización de partidos.
- **3_📅_Calendario.py**: Vista cronológica de partidos.
- **league_manager.py**: Importación y gestión de calendarios.
- **game_inspector.py**: Procesamiento y visualización detallada de partidos.

---

> Para detalles de cada módulo, consulta los archivos mencionados o la documentación específica de cada uno.
