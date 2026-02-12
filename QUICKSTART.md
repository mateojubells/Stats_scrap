# ⚡ QUICKSTART — BasketStats Pro v2.0+

**Tarea**: Empezar a usar el sistema en 5 minutos.

---

## 🎯 Opción 1: Yo solo quiero que funcione

```bash
# 1. Configura .env
cp .env.example .env
# Edita .env: agrega SUPABASE_URL y SUPABASE_KEY

# 2. Verifica que todo está OK
python verify_setup.py

# Si dice "NO ENCONTRADA" en tabla 'leagues':
python setup_db.py
# → Copia el SQL en https://app.supabase.com/project/[ID]/sql
# → Click "Run"

# 3. Inicia la app
streamlit run app.py

# 4. En navegador (http://localhost:8501):
# - Tab: "🔍 Descubrir Ligas"
# - Click: "✅ Iniciar Descubrimiento"
# - Espera: 5-10 minutos
# - Resultado: ~16 ligas descubiertas
```

## 🎯 Opción 2: Test antes de empezar

```bash
# Check quick
python quick_test.py

# Debe retornar ✅ en todo
# Si todo OK → streamlit run app.py
```

---

## 📱 En la interfaz Streamlit

### Tab 1: 🔍 Descubrir Ligas
1. Año: "2025"
2. Headless: ✅ checked
3. Click: **"Iniciar Descubrimiento"**
4. Espera (verás logs):
   ```
   🔍 Descubriendo: Primera FEB
     → Liga Regular Grupo A
     → Liga Regular Grupo B
   ✅ Primera FEB: 2 grupos encontrados
   ...
   📊 Total descubierto: 16 groups
   ```

### Tab 2: 📋 Gestión de Liga
1. Dropdown: Selecciona una liga (ej: "Tercera FEB — Liga Regular A-A")
2. Click: **"🔍 Escanear [grupo]"**
3. Verás: Tabla de ~150-200 partidos
4. Filter: "PENDING"
5. Click: **"⚡ Procesar N partidos PENDING"**
6. Listo: Datos completos en BD (~5-10 min)

### Tab 3: 🎯 Partido Individual
1. Introduce FEB Game ID (ej: "2486850")
2. Click: "🚀 Procesar Partido"
3. Ver preview de datos

---

## 🐛 Si algo falla

| Error | Solución |
|-------|----------|
| "ModuleNotFoundError" | `pip install -r requirements.txt` |
| "Tabla 'leagues' no existe" | `python setup_db.py` |
| "Invalid Supabase key" | Verifica .env |
| "Playwright timeout" | `playwright install chromium` |

---

## 📊 Qué esperar

- ✅ Descubrimiento: 5-10 min (primera vez)
- ✅ Escaneo calendario: 1-2 min por liga
- ✅ Procesamiento PENDING: 5-15 min (depende del número)

---

## 🔗 Próximas Lecturas

1. Ver más: `README.md`
2. Setup detallado: `INSTALLATION_GUIDE.md`
3. Qué cambió: `CHANGELOG.md`
4. Todos los archivos: `FILES_INDEX.md`

---

**¡Listo!** 🚀
