# 🚀 GETTING STARTED

## 📋 Prerequisitos

Antes de empezar, asegúrate tener:

- **Python 3.13+** → [Descargar](https://www.python.org/downloads/)
- **Git** (opcional, para clonar repo)
- **Editor** (VS Code, PyCharm, etc.)

---

## 🔧 Instalación (5 minutos)

### 1️⃣ Crear Virtual Environment

```bash
# Windows
python -m venv .venv
.\.venv\Scripts\activate

# macOS/Linux
python3 -m venv .venv
source .venv/bin/activate
```

### 2️⃣ Instalar Dependencias

```bash
pip install -r requirements.txt
```

> ⚠️ Primera vez tarda ~2 min (descarga Playwright browsers)

### 3️⃣ Configurar Variables de Entorno

Copia `.env.example` → `.env` y rellena:

```bash
# Copiar template
cp .env.example .env

# Editar .env con tus datos de Supabase
# SUPABASE_URL=https://xxxxx.supabase.co
# SUPABASE_KEY=eyXXXXXXXX
```

**¿Dónde obtener?**
1. Ve a https://supabase.com
2. Crea proyecto o usa existente
3. Settings → API Keys → `Project URL` y `anon public key`

### 4️⃣ Inicializar Base de Datos (Opcional)

Si es primera vez o necesitas resetear:

```bash
python setup_db.py
```

Esto crea todas las tablas en Supabase.

---

## ▶️ Ejecutar Aplicación

```bash
python run_ui.py
```

Debería abrir automáticamente en http://localhost:8501

### Interfaz Principal

```
┌─────────────────────────────────────┐
│     BasketStats Pro                 │  ← Título
├─────────────────────────────────────┤
│ 1. 🏆 Ligas         ← Importar       │
│ 2. 🎯 Partidos      ← Ver todos      │
│ 3. 📅 Calendario    ← Por jornadas   │
│ 🔧 Dashboard        ← Estadísticas   │
└─────────────────────────────────────┘
```

---

## 📚 Uso Paso a Paso

### **Flujo 1: Importar Calendario de una Liga**

#### Paso 1: Abrir Página "Ligas"
- Click sidebar → **🏆 Ligas**
- Verás tabla con ligas disponibles

#### Paso 2: Seleccionar Liga
```
Selecciona una liga: [Tercera FEB - Grupo C-A] ▼
```

#### Paso 3: Importar
- Click botón azul: **Escanear Calendario**
- Espera ~10-20 segundos
- ✅ Verás: "182 partidos importados"

#### Resultado
- BD actualizados con nuevos partidos
- Cada partido tiene:
  - Equipos (local/visitante)
  - Resultado (si ya jugado)
  - **Jornada** (número 1-26, etc.)
  - Estado (PENDING/PROCESSED)

---

### **Flujo 2: Ver Calendario por Jornadas**

#### Paso 1: Ir a "Calendario"
- Click sidebar → **📅 Calendario**

#### Paso 2: Seleccionar Liga
```
Selecciona liga: [Tercera FEB - Grupo C-A] ▼
```

#### Paso 3: Expandir Jornadas
```
🗓️ Jornada 1    ← Click para expandir
   🗓️ Jornada 2
   🗓️ Jornada 3
```

Cada jornada muestra:
| Fecha | Local | Score | Visitante | Estado |
|-------|-------|-------|-----------|--------|
| 20/11 | Equipo A | 75-68 | Equipo B | ✅ |

---

### **Flujo 3: Ver Detalles de Partido**

#### Paso 1: Ir a "Partidos"
- Click sidebar → **🎯 Partidos**

#### Paso 2: Buscar Partido
```
Busca: [____________________] ← Equipo, jornada, etc.
```

#### Paso 3: Ver Detalles
- Click en fila → Expande información
- Muestra si hay estadísticas procesadas

---

## 🔍 Solucionar Problemas

### ❌ **Error: "ModuleNotFoundError: No module named 'playwright'"**

**Solución:**
```bash
pip install playwright
playwright install
```

---

### ❌ **Error: "NotImplementedError" o timeout en Playwright**

**Contexto:** Windows + Playwright + Streamlit crean conflicto de event loops.

**Solución:** (Ya implementada en código)
- Playwright ejecuta en **thread separado**
- Cada thread tiene su propio event loop
- No hay conflicto con Streamlit

Si sigue fallando:
1. Cierra y reabre Streamlit
2. Prueba en otra categoría
3. Revisa logs en consola

---

### ❌ **Error: "Could not find 'jornada' column"**

**Contexto:** Supabase schema cache issue

**Solución:** (Ya implementada en código)
- Jornada se guarda en **UPDATE separado**
- Si falla, al menos se guarda el partido sin jornada
- Se reintenta en siguiente import

---

### ❌ **Error: "Wrong group imported (C-A importó A-A)"**

**Contexto:** Antes del fix, ligues con múltiples grupos no funcionaban

**Solución:** (Ya implementada en código)
- UI detecta `feb_group_id`
- Usa `crawl_league_with_group()` para multi-grupo
- Usa `crawl_league()` para single-grupo

---

### ❌ **Error: "Supabase connection refused"**

**Solución:**
1. Verifica `.env`:
   ```
   SUPABASE_URL=https://xxxxx.supabase.co  ← Sin trailing slash
   SUPABASE_KEY=ey...   ← anon public key, no admin
   ```

2. Prueba conexión:
   ```bash
   python -c "from src.config import *; print(get_supabase_url())"
   ```

---

## 🛠️ Comandos Útiles

### Ver registros de BD
```bash
# Contar partidos por liga
python -c "
from src.database.repository import SupabaseRepository
repo = SupabaseRepository()
leagues = repo.get_leagues()
for l in leagues:
    games = repo.get_games_by_league(l['id'])
    print(f'{l[\"name\"]}: {len(games)} partidos')
"
```

### Debug HTML capturado
```bash
# Captura HTML de una liga manual
python capture_html.py
# Genera: calendario_captured.html
# Abre en navegador para inspeccionar estructura
```

### Reset BD (⚠️ Peligroso)
```bash
# Solo si quieres empezar desde cero
python setup_db.py --reset
```

---

## 📊 Estructura de Datos en BD

### Tabla `games`

```sql
SELECT 
  id,                    -- PK
  feb_game_id,          -- ID único de FEB.es
  league_id,            -- ← Qué liga/grupo
  date,                 -- Fecha
  home_team_id,         -- Equipo local
  away_team_id,         -- Equipo visitante
  home_score,           -- Resultado
  away_score,
  jornada,              -- IMPORTANTE: número de jornada (1-26)
  status,               -- PENDING / PROCESSED
  url                   -- Link para scraping futuro
FROM games
LIMIT 5;
```

### Ejemplo Real

```
ID: 1000
feb_game_id: feb_100001
league_id: 8 (Tercera FEB C-A)
home_team_id: 50
away_team_id: 75
home_score: 75
away_score: 68
jornada: 5 ← Esto agrupa partidos por semana
status: PROCESSED
date: 2025-11-20
```

---

## 🔄 Desarrollo / Modificación para Nueva Liga

### Quiero añadir soporte para **Nueva Categoría**

#### 1. Descubrir la liga
```python
from src.scraper.league_discovery import discover_leagues

leagues = discover_leagues()  # Automático descubre todas
for l in leagues:
    if "Nueva" in l['name']:
        print(l)
        # Output:
        # {
        #   'name': 'Nueva Categoría',
        #   'base_url': 'https://www.feb.es/...',
        #   'group_name': 'Grupo A',
        #   'feb_group_id': '88899',  ← Si tiene grupos
        #   ...
        # }
```

#### 2. Añadir a BD
```bash
# En UI: 🏆 Ligas → [Refrescar] 
# (descubre y añade automáticamente)
```

#### 3. Importar calendario
- Selecciona en dropdown
- Click "Escanear"
- ¡Listo!

---

## 📖 Para Entender Mejor

Documentos para leer en orden:

1. **Este archivo** (GETTING_STARTED.md) ← Estás aquí
2. **[ARCHITECTURE.md](ARCHITECTURE.md)** - Cómo funciona todo internamente
3. **[README.md](README.md)** - Descripción general del proyecto

### Archivos de Código para Estudiar

Por complejidad ascendente:

1. `src/config.py` (50 líneas) - Configuración básica
2. `src/ui/pages/1_🏆_Ligas.py` (300 líneas) - UI principal
3. `src/database/repository.py` (400 líneas) - Operaciones BD
4. `src/scraper/league_crawler.py` (500 líneas) - Parsing y threading

---

## 🎓 Conceptos Clave

### Jornada
- **Qué es:** Número de semana/ronda de partidos
- **Rango:** 1-26 (Tercera FEB), 1-34 (Primera FEB), etc.
- **¿Por qué importante?** Agrupa partidos por semana en UI

### Feb Group ID
- **Qué es:** Identificador de grupo dentro de categoría
- **Ejemplo:** Tercera FEB tiene 10 grupos (A-A, A-B, ..., E-B)
- **¿Por qué importante?** Permite importar solo el grupo deseado

### Status de Partido
- **PENDING:** Importado pero sin estadísticas detalladas
- **PROCESSED:** Estadísticas extraídas y guardadas
- **ERROR:** Falla al procesar

### Threading
- **Qué es:** Ejecutar código en paralelo
- **¿Por qué aquí?** Playwright + Windows + Streamlit = conflicto
- **Solución:** Thread separado con su propio event loop

---

## 🎉 Ya Estás Listo!

Ahora puedes:
✅ Ejecutar la app
✅ Importar ligas
✅ Ver partidos y calendarios
✅ Entender la arquitectura
✅ Modificar y extender el código

Para preguntas, consulta **ARCHITECTURE.md** o revisa logs en consola. 📝

---

**¿Necesitas ayuda?** 
- Error específico → Sección "Solucionar Problemas" arriba ↑
- Cómo funciona X → Ver **ARCHITECTURE.md**
- Quiero modificar Z → Busca en archivos `src/`
