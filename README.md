# 🏀 BasketStats Pro

Sistema completo de scraping, almacenamiento y visualización de estadísticas de baloncesto de la FEB (Federación Española de Baloncesto).

## 🚀 Quick Start

```bash
# 1. Instalar dependencias
pip install -r requirements.txt

# 2. Configurar variables de entorno
cp .env.example .env
# Editar .env con credenciales Supabase

# 3. Ejecutar aplicación
python run_ui.py
```

Se abrirá automáticamente en http://localhost:8501

---

## 📖 Documentación

| Documento | Propósito |
|-----------|----------|
| **[GETTING_STARTED.md](GETTING_STARTED.md)** | 📚 Guía paso a paso: setup, uso, troubleshooting |
| **[ARCHITECTURE.md](ARCHITECTURE.md)** | 🏗️ Cómo funciona interna: módulos, flujo de datos, BD |

### Leer en este orden:

1. **Este README** ← Estás aquí
2. **[GETTING_STARTED.md](GETTING_STARTED.md)** ← Cómo usar la app
3. **[ARCHITECTURE.md](ARCHITECTURE.md)** ← Cómo funciona internamente

---

## ✨ Características

✅ **Importar Ligas** - Descarga calendarios de FEB directamente  
✅ **Ver por Jornadas** - Agrupa partidos por semanas (jornadas 1-26)  
✅ **Procesar Partidos** - Extrae estadísticas detalladas  
✅ **Multi-Grupo** - Soporta ligas con múltiples grupos (Tercera FEB 10 grupos)  
✅ **BD en Cloud** - Supabase PostgreSQL  
✅ **Interfaz Web** - Streamlit (sin necesidad de frontend)

---

## 🏗️ Estructura del Proyecto

```
src/
├── database/          # 🗄️ Capa de persistencia
│   ├── models.py      # Validación de datos (Pydantic)
│   └── repository.py  # CRUD en Supabase
├── scraper/           # 🌐 Extracción de datos
│   ├── league_crawler.py        # Calendarios
│   ├── league_discovery.py      # Descubrimiento de ligas
│   └── game_scraper.py          # Estadísticas detalladas
├── ui/                # 🎨 Interfaz Streamlit
│   ├── app.py
│   ├── pages/
│   │   ├── 1_🏆_Ligas.py        # Importar
│   │   ├── 2_🎯_Partidos.py     # Listar
│   │   └── 3_📅_Calendario.py   # Por jornadas
│   └── ...
└── config.py          # ⚙️ Configuración
```

---

## 🗄️ Base de Datos (Supabase)

### Tablas Principales

```sql
leagues          -- Ligas/grupos descubiertos
├─ id, name, group_name
├─ base_url, feb_group_id
└─ season_year

games            -- Partidos importados
├─ feb_game_id, league_id
├─ home_team_id, away_team_id
├─ home_score, away_score
├─ jornada ← CLAVE: número de jornada (1-26)
└─ status (PENDING/PROCESSED)

teams            -- Equipos
├─ feb_id, name
└─ ...
```

---

## 🔑 Conceptos Clave

### **Jornada** 🗓️
- Número de semana/ronda (1, 2, 3, ..., 26)
- Se extrae del HTML: `<h1>Jornada 5 20/11/2025</h1>`
- Agrupa partidos por semana en la UI

### **Feb Group ID** 👥
- Identificador de grupo dentro de una categoría
- Ejemplo: Tercera FEB tiene 10 grupos (A-A, A-B, ..., E-B)
- Usado por Playwright para seleccionar grupo específico

### **Status de Partido** ⚡
- **PENDING**: Importado pero sin estadísticas
- **PROCESSED**: Estadísticas extraídas
- **ERROR**: Falla en procesamiento

---

## ⚙️ Configuración (.env)

```env
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**¿Dónde obtener?**
1. Ve a https://supabase.com
2. Settings → API Keys
3. Copia `Project URL` y `anon public key`

---

## 🐛 Solucionar Problemas

### "ModuleNotFoundError: No module named 'playwright'"
```bash
pip install playwright
playwright install
```

### "NotImplementedError" en Windows
→ Ya resuelto en código (threading)
→ Si persiste, cierra y reabre Streamlit

### "Could not find 'jornada' column"
→ Ya resuelto en código (UPDATE separado)
→ Se retryará en siguiente import

### "Wrong group imported"
→ Ya resuelto en código (routing inteligente)
→ UI detecta `feb_group_id` y usa crawler correcto

Para más detalles → Ver **[GETTING_STARTED.md](GETTING_STARTED.md)**

---

## 📖 Para Aprender Más

**¿Qué quieres hacer?**

- 📚 **Aprender a usar la app** → [GETTING_STARTED.md](GETTING_STARTED.md)
- 🏗️ **Entender cómo funciona** → [ARCHITECTURE.md](ARCHITECTURE.md)
- 🔧 **Modificar o extender** → Ver archivos en `src/`
- 🐛 **Debuggear** → Busca logs con tags `[GROUP]`, `[PARSE]`, `[REPO]`

---

## 📊 Estado del Proyecto

- ✅ Importar calendarios (todas las ligas)
- ✅ Manejar múltiples grupos
- ✅ Threading para Windows/Streamlit
- ✅ Validación de datos
- ✅ Visualización en UI
- ⏳ Procesamiento de estadísticas detalladas
- ⏳ Scheduler automático

---

## 🤝 Contribuir

El código está limpio y documentado. Para extender o modificar:

1. Lee [ARCHITECTURE.md](ARCHITECTURE.md) para entender flujo
2. Modifica `src/scraper/` para cambiar scrapers
3. Modifica `src/ui/pages/` para cambiar UI
4. Modifica `src/database/repository.py` para cambiar BD

---

**¿Preguntas?** Consulta los documentos o revisa los logs en consola. 📝
