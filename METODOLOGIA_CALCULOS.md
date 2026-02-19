# Metodología y Cálculos - HoopsIQ

## Índice
1. [Quintetos (Lineups)](#quintetos-lineups)
2. [Impacto On/Off](#impacto-onoff)
3. [Estadísticas Avanzadas (Four Factors)](#estadísticas-avanzadas-four-factors)
4. [Análisis de Tiro](#análisis-de-tiro)
5. [Benchmarking vs Liga](#benchmarking-vs-liga)

---

## Quintetos (Lineups)

### Objetivo
Identificar las combinaciones de 5 jugadores que han jugado juntos y evaluar su rendimiento colectivo.

### Fuente de Datos
- **Tabla**: `play_by_play`
- **Campos clave**: 
  - `action_type` (sub_in, sub_out)
  - `home_score_partial`, `away_score_partial` (marcador acumulado)
  - `team_id`, `player_id`, `quarter`, `minute`
- **Tabla**: `stats_player_games` (campo `starter` para identificar el quinteto inicial)

### Algoritmo

1. **Inicialización por partido**:
   - Se identifica el quinteto inicial usando jugadores con `starter = true`
   - Se rastrea el marcador parcial (`home_score_partial`, `away_score_partial`) en cada evento del PBP

2. **Procesamiento de sustituciones**:
   - Cuando ocurre un `sub_out` o `sub_in`:
     - Se **cierra el stint** (periodo de tiempo) del quinteto actual
     - Se calcula la duración del stint: `tiempo_actual - tiempo_previo`
     - Se calculan los puntos a favor y en contra durante ese stint usando los diferenciales de score parcial

3. **Cálculo de los stints**:
   ```typescript
   duration = currentTime - prevTime
   scoreFor = isHome ? lastHomeScore : lastAwayScore  // Puntos anotados por nuestro equipo
   scoreAgainst = isHome ? lastAwayScore : lastHomeScore  // Puntos permitidos
   
   // Puntos durante este stint específico:
   ptsFor += scoreFor - prevScoreFor
   ptsAgainst += scoreAgainst - prevScoreAgainst
   ```

4. **Cierre del partido**:
   - Al finalizar el partido, se actualiza el marcador con el resultado final (`game.home_score`, `game.away_score`)
   - Se cierra el último stint del partido

5. **Acumulación multi-partido**:
   - Se agrupa por la clave del quinteto (IDs ordenados: "1-3-5-7-9")
   - Se suman minutos, PF (puntos a favor), PC (puntos en contra) y número de stints

### Métricas Reportadas
- **Min**: Minutos totales jugados juntos
- **PF**: Puntos a favor (anotados mientras el quinteto estaba en pista)
- **PC**: Puntos en contra (recibidos mientras el quinteto estaba en pista)  
- **Net +/−**: PF - PC (diferencial neto)
- **Quinteto**: Los 5 jugadores (nombre y dorsal)
- **Stints**: Número de periodos de tiempo distintos que jugaron juntos

### Limitaciones
- Requiere datos completos de sustituciones en el PBP
- No diferencia calidad de posesiones (no calcula rating por 100 posesiones)
- Si hay errores en el registro de sustituciones, puede afectar la precisión

---

## Impacto On/Off

### Objetivo
Medir el rendimiento del equipo cuando un jugador específico está EN pista versus cuando está FUERA de pista.

### Fuente de Datos
- **Tabla**: `stats_player_games`
- **Campos clave**: 
  - `plus_minus` (diferencial de puntos mientras el jugador estuvo en pista)
  - `minutes` (minutos jugados)
  - `points` (puntos anotados por el jugador)
- **Tabla**: `games`
- **Campos clave**: 
  - `home_score`, `away_score` (resultado final del partido)
  - `home_team_id`, `away_team_id`

### Algoritmo

1. **Por cada jugador y partido**:
   
   a) **Plus-Minus EN pista** (`onPM`):
   ```typescript
   onPM = stats_player_games.plus_minus
   ```
   - Este valor ya viene calculado en la tabla `stats_player_games`
   - Representa la diferencia de puntos mientras el jugador estuvo en cancha

   b) **Margen del partido** (`gameMargin`):
   ```typescript
   isHome = game.home_team_id === teamId
   gameMargin = isHome 
     ? (game.home_score - game.away_score)
     : (game.away_score - game.home_score)
   ```
   - Es el resultado final del partido desde la perspectiva de nuestro equipo
   - Positivo = victoria, negativo = derrota

   c) **Plus-Minus FUERA de pista** (`offPM`):
   ```typescript
   offPM = gameMargin - onPM
   ```
   - Representa implícitamente el margen del equipo durante los minutos que el jugador NO estuvo en pista
   
2. **Acumulación y promedio**:
   ```typescript
   totalOnPM += onPM    // Suma de todos los partidos
   totalOffPM += offPM  // Suma de todos los partidos
   
   avgOnPM = totalOnPM / gp   // Promedio por partido (gp = games played)
   avgOffPM = totalOffPM / gp
   ```

### Métricas Reportadas
- **GP**: Partidos jugados
- **Min**: Promedio de minutos por partido
- **Pts**: Promedio de puntos anotados por partido
- **En Pista +/−**: Plus-minus promedio cuando el jugador está jugando
- **Fuera +/−**: Plus-minus promedio cuando el jugador está en el banco

### Interpretación

| Escenario | En Pista | Fuera | Interpretación |
|-----------|----------|-------|----------------|
| Jugador Elite | +8 | -3 | El equipo es +11 mejor con él (diferencia de 11 puntos) |
| Jugador Positivo | +5 | +2 | El equipo es +3 mejor con él |
| Jugador Negativo | -2 | +4 | El equipo es -6 peor con él (mejor sin él) |
| Neutral | +3 | +3 | El jugador no impacta significativamente |

**Importante**: Si la mayoría de partidos son victorias, es común que tanto `En Pista` como `Fuera` sean positivos. Lo relevante es la **diferencia** entre ambos valores.

### Ejemplo Detallado

Partido donde el equipo ganó +10:
- Jugador A jugó 30 min con +12 PM → Fuera: 10 - 12 = **-2** (el equipo fue peor los 10 min sin él)
- Jugador B jugó 35 min con +6 PM → Fuera: 10 - 6 = **+4** (el equipo fue mejor los 5 min sin él)

### Limitaciones
- No normaliza por minutos REALES fuera de pista (un jugador que juega 38 min tendrá solo 2 min de offPM)
- No ajusta por calidad de rivales
- En partidos muy desequilibrados puede dar valores extremos
- **No es un rate per-minuto**, es un total por partido

---

## Estadísticas Avanzadas (Four Factors)

### Objetivo
Los **Four Factors** de Dean Oliver son 4 métricas que mejor predicen el resultado de un partido de baloncesto, ordenadas por importancia:
1. Eficiencia de tiro (eFG%)
2. Control de pérdidas (TOV%)
3. Rebote ofensivo (ORB%)
4. Tiros libres (FT Rate)

### Fuente de Datos
- **Tabla**: `stats_team_games`
- **Campos clave**: `fgm`, `fga`, `t3m`, `turnovers`, `possessions`, `offensive_rebounds`, `defensive_rebounds`, `fta`

### Cálculos

#### 1. eFG% (Effective Field Goal Percentage)
```typescript
eFG% = ((FGM + 0.5 × T3M) / FGA) × 100
```

**Explicación**: 
- Ajusta el % de tiro normal para reflejar que un triple vale 1.5× más que un doble
- Un 40% en triples (0.4 × 3 = 1.2 ppp) equivale a un eFG% de 60% (0.4 + 0.5 × 0.4 = 0.6)

**Interpretación**:
- Mayor es mejor (más eficiencia anotadora)
- Liga típica: ~50-52%
- Elite: >55%

#### 2. TOV% (Turnover Percentage)
```typescript
TOV% = (Turnovers / Possessions) × 100
```

**Explicación**: 
- Porcentaje de posesiones que terminan en pérdida de balón
- NO es solo pérdidas/partido, sino pérdidas/posesión

**Interpretación**:
- **Menor es mejor** (menos pérdidas)
- Liga típica: ~13-15%
- Elite: <12%

#### 3. ORB% (Offensive Rebound Percentage)
```typescript
ORB% = (Offensive_Rebounds / (Offensive_Rebounds + Opponent_Defensive_Rebounds)) × 100
```

**Explicación**: 
- Porcentaje de rebotes ofensivos capturados de los disponibles
- Mide la capacidad de generar segundas oportunidades

**Interpretación**:
- Mayor es mejor (más segundas oportunidades)
- Liga típica: ~25-30%
- Elite: >32%

#### 4. FT Rate (Free Throw Rate)
```typescript
FT_Rate = (FTA / FGA) × 100
```

**Explicación**: 
- Tiros libres intentados por cada tiro de campo intentado
- Mide agresividad y capacidad de generar faltas

**Interpretación**:
- Mayor es mejor (más posesiones extra por faltas)
- Liga típica: ~20-25%
- Elite: >30%

### Benchmarking vs Liga

Para cada factor, se compara el valor del equipo con la media de la liga:
```typescript
diff = teamValue - leagueAvg
```

**Visualización**:
- **Borde verde** + fondo verde claro: El equipo está mejor que la media
- **Borde rojo** + fondo rojo claro: El equipo está peor que la media

**Importante**: Para TOV%, la lógica se invierte ya que menor es mejor.

---

## Análisis de Tiro

### Objetivo
Visualizar la distribución espacial de los tiros y calcular eficiencias de tiro. Los datos de tiros pasan por un pipeline de transformación complejo que incluye plegado de coordenadas, vinculación inteligente con eventos PBP, y clasificación multidimensional de zonas.

### Fuente de Datos
- **Tabla**: `shots` (procesada por `repository.save_game_stats`)
- **Campos key**: `x_coord`, `y_coord`, `zone`, `made`, `team_id`, `player_id`, `quarter`, `game_id`, `pbp_id`, `action_type`
- **Tabla**: `play_by_play` (para vinculación de tiros y tipos de acción)

### Pipeline de Procesamiento

#### Paso 1: Extracción de Coordenadas CSS (Backend - `game_scraper.py`)

El scraper extrae tiros del gráfico HTML de FEB:

```html
<div class="shoot t1 p-11 success0 q-1" style="top: 85.4545%; left: 76.3752%; display: block;"></div>
```

**Parsing**:
```python
# parse_shots() extrae coordenadas CSS directamente
css_style = "top: 85.4545%; left: 76.3752%"
y_coordinate = float(top_m.group(1))    # 85.4545 (top)
x_coordinate = float(left_m.group(1))   # 76.3752 (left)

# ShotData se crea con estos valores RAW (sin transformar):
ShotData(
    game_id=game_id,
    team_id=t_id,
    player_number=p_no,
    result=ShotResult.MISSED,
    quarter=1,
    x_coordinate=76.3752,      # ← CSS left (largo de cancha, 0-100)
    y_coordinate=85.4545,      # ← CSS top (ancho de cancha, 0-100)
    zone=ShotZone.MID_RANGE,   # ← Placeholder temporal
    raw_style="..."
)
```

**Contexto FEB**:
- Cancha FEB mostrada horizontal completa (100% = 2 mitades)
- Baskets en ambas esquinas (izquierda y derecha)
- **left** ∈ [0,100] = largo (basket a basket)
- **top** ∈ [0,100] = ancho (banda a banda)

#### Paso 2: Plegado de Cancha Completa → Media Cancha (Backend - `repository.py` líneas 676-706)

**Objetivo**: Normalizar todos los tiros a una única mitad de cancha (formato estándar de análisis).

**Regla de transformación**:
```python
css_left = s.x_coordinate   # CSS left (posición a lo largo de la cancha)
css_top = s.y_coordinate    # CSS top (posición a lo ancho de la cancha)

if css_left > 50:
    # Mitad lejana (derecha) → espejar para plegar sobre media cancha
    x_norm = 100 - css_top    # ancho espejado: [0, 100] → [100, 0]
    y_norm = 100 - css_left   # profundidad espejada: [0, 100] → [100, 0]
else:
    # Mitad cercana (izquierda) → usar directamente (swap ejes CSS → BD)
    x_norm = css_top          # ancho tal cual: [0, 100]
    y_norm = css_left         # profundidad tal cual: [0, 50]
```

**Resultado**: Coordenadas normalizadas en espacio de media cancha:
- **x_coord** ∈ [0, 100]: ancho (zona left/center/right)
- **y_coord** ∈ [0, 50]: profundidad desde línea de fondo (zona baseline/paint/midcourt)
- **Canasta** en aprox (50, 5.75)

**Ejemplo**:
```
CSS: top=85.45%, left=76.38% (mitad derecha, ala)
left > 50 → espejar
x_norm = 100 - 85.45 = 14.55
y_norm = 100 - 76.38 = 23.62
→ DB: (14.55, 23.62) en media cancha (ala izquierda equivalente)
```

#### Paso 3: Vinculación Smart PBP-Shot (Backend - `repository.py` líneas 698-735)

**Objetivo**: Asignar cada tiro a su evento PBP correspondiente (`action_type`: 2pt_made, 3pt_missed, etc.), preferiendo coincidencias coherentes con la posición.

**Contexto**: El PBP contiene acciones ultra-específicas extradas del parser pbp_parser.py:
- **2pt_made**, **2pt_missed**: Tiros dentro del arco
- **3pt_made**, **3pt_missed**: Tiros desde la línea de triple
- **ft_made**, **ft_missed**: Tiros libres
- **dunk_made**: Mates

**Algoritmo simple (OLD)**: Matching greedy FIFO
```python
# Problema: Si hay 2+ tiros del mismo resultado en el mismo quarter,
# se asignan en orden FIFO sin considerar coherencia geográfica
# → Resultado: cross-linking (tiro de 3pt vinculado a 2pt_made, etc.)
```

**Algoritmo inteligente (NEW)**: Matriz de coherencia geométrica
```python
# PASO 1: Calcular si las coordenadas normalizadas están FUERA de la línea de triple
def _is_beyond_3pt_line(x: float, y: float) -> bool:
    """True si coord están fuera/sobre la línea de triple FIBA."""
    # Esquinas de la línea de triple
    THREE_CORNER_X_LEFT = 10.26
    THREE_CORNER_X_RIGHT = 89.90
    THREE_CORNER_Y_MAX = 12.83
    
    # Arco de la línea de triple
    THREE_ARC_CENTER_X = 50.0
    THREE_ARC_CENTER_Y = 5.75
    THREE_ARC_RADIUS = 25.4  # Calibrado para FIBA
    
    # Líneas rectas en esquinas
    if (x <= THREE_CORNER_X_LEFT or x >= THREE_CORNER_X_RIGHT) and y <= THREE_CORNER_Y_MAX:
        return True
    
    # Arco
    dx = x - THREE_ARC_CENTER_X
    dy = y - THREE_ARC_CENTER_Y
    dist = sqrt(dx² + dy²)
    return dist >= THREE_ARC_RADIUS

# PASO 2: Preferir candidatos PBP coherentes con la posición
for s in data.shots:
    # Obtener candidatos (PBP con mismo resultado en mismo quarter)
    candidates = pbp_shot_lists[(s.quarter, s.player_id)]
    shot_made = s.result == "made"
    coord_is_3pt = _is_beyond_3pt_line(x_norm, y_norm)
    
    # Buscar match PREFERENTE (mismo resultado + tipo coherente)
    best_idx = None
    fallback_idx = None
    
    for i, c in enumerate(candidates):
        if c["made"] != shot_made:
            continue
        
        c_is_3pt = c["action_type"].startswith("3pt")
        if c_is_3pt == coord_is_3pt:  # ← COHERENTE
            best_idx = i
            break  # Tomar el primero coherente
        elif fallback_idx is None:
            fallback_idx = i  # Guardar fallback no coherente
    
    # Aplicar matching: preferente si existe, sino fallback
    chosen_idx = best_idx if best_idx is not None else fallback_idx
    if chosen_idx is not None:
        pbp_id = candidates[chosen_idx]["pbp_id"]
        pbp_action = candidates[chosen_idx]["action_type"]
        candidates.pop(chosen_idx)  # Consumir para evitar doble vinculación
        
        # Logging diagnóstico si se evitó un cross-link
        if best_idx is not None and fallback_idx is not None and best_idx != fallback_idx:
            logger.info(f"🎯 SMART MATCH: Player #{...} Q{...} "
                       f"coord({x_norm:.1f},{y_norm:.1f}) → {pbp_action}")
```

**Resultado**: Cada shot vinculado a un PBP event con `pbp_id` y `action_type` preciso.

#### Paso 4: Clasificación de Zonas Multidimensional (Backend - `repository.py` líneas 618-650)

**Objetivo**: Asignar cada tiro a una zona (`"paint"`, `"mid-range"`, `"3pt"`) usando 2 criterios con prioridad:

```python
def classify_zone_final(x: float, y: float, pbp_action_type: str = None) -> str:
    """
    Clasificación de zona en 3 categorías: 3pt, paint, mid-range.
    Prioridad:
      1. PBP action_type (3pt_made/3pt_missed → "3pt")
      2. Coordenadas: paint → "paint", fuera del arco → "3pt", resto → "mid-range"
    """
    # PAINT (rectángulo calibrado)
    PAINT_X_MIN, PAINT_X_MAX = 33.46, 66.28
    PAINT_Y_MAX = 19.94
    
    # LÍNEA DE TRIPLE (perímetro FIBA calibrado)
    THREE_ARC_CENTER_X, THREE_ARC_CENTER_Y = 50.0, 5.75
    THREE_ARC_RADIUS = 25.4
    THREE_CORNER_X_LEFT = 10.26
    THREE_CORNER_X_RIGHT = 89.90
    THREE_CORNER_Y_MAX = 12.83
    
    # Paso 1: PBP indica triple → 3pt directamente
    if pbp_action_type and pbp_action_type.startswith("3pt"):
        return "3pt"
    
    # Paso 2: PBP indica 2pt o dunk → solo paint o mid-range (nunca 3pt)
    is_confirmed_2pt = pbp_action_type and (pbp_action_type.startswith("2pt") or pbp_action_type.startswith("dunk"))
    
    # ¿Está en el PAINT?
    if PAINT_X_MIN <= x <= PAINT_X_MAX and 0 <= y <= PAINT_Y_MAX:
        return "paint"
    
    # Si PBP confirma 2pt/dunk, es mid-range (no puede ser triple)
    if is_confirmed_2pt:
        return "mid-range"
    
    # Paso 3: Sin PBP vinculado → usar geometría de línea de triple
    # Esquinas
    if (x <= THREE_CORNER_X_LEFT or x >= THREE_CORNER_X_RIGHT) and y <= THREE_CORNER_Y_MAX:
        return "3pt"
    
    # Arco
    dx = x - THREE_ARC_CENTER_X
    dy = y - THREE_ARC_CENTER_Y
    dist = sqrt(dx² + dy²)
    if dist >= THREE_ARC_RADIUS:
        return "3pt"
    
    # Todo lo demás: mid-range
    return "mid-range"
```

**Resultado final en BD (`shots` table)**:
```json
{
  "id": 64877,
  "game_id": 2774,
  "pbp_id": 64877,
  "x_coord": 14.55,
  "y_coord": 23.62,
  "made": false,
  "quarter": 1,
  "zone": "mid-range",
  "action_type": "2pt_missed"
}
```

### Clasificación de Tiros (Frontend Rendering)

#### Por Zona en BD

El frontend simplemente Lee la columna `zone` de la tabla `shots`:

```typescript
// Identificar si un tiro es de 3 puntos (por zona guardada en BD):
isThree = (shot: Shot) => shot.zone === "3pt"
isTwoPointer = (shot: Shot) => shot.zone === "paint" || shot.zone === "mid-range"

twos = shots.filter((s) => !isThree(s))
threes = shots.filter(isThree)
```

#### Fallback: Por Distancia (si zona no está disponible)

```typescript
// Distancia desde la canasta FIBA (50, 5.75) a (100 × 0.15m, 50 × 0.15m)
const distanceFromBasketM = Math.sqrt(
  ((shot.x_coord - 50) * 0.15)² + ((shot.y_coord - 5.75) * 0.15)²
)

// Línea de 3 FIBA = 6.75m
const isThreeFallback = distanceFromBasketM > 6.75
```

### Métricas Calculadas

#### TC% (Total shooting percentage)
```typescript
TC% = (FGM / FGA) × 100
```

#### T2% (Two-point percentage)
```typescript
T2% = (T2M / T2A) × 100
```

#### T3% (Three-point percentage)
```typescript
T3% = (T3M / T3A) × 100
```

#### eFG% (Effective Field Goal %)
```typescript
eFG% = ((FGM + 0.5 × T3M) / FGA) × 100
```

#### PPS (Points Per Shot)
```typescript
totalPoints = (T2M × 2) + (T3M × 3)
PPS = totalPoints / FGA
```

**Interpretación de PPS**:
- 1.0 pps = 50% de eFG% (muy malo)
- 1.1 pps = 55% de eFG% (promedio)
- 1.2 pps = 60% de eFG% (bueno)
- 1.3+ pps = 65%+ de eFG% (elite)

### Mapa de Calor (Shot Chart)

El componente `FibaShotChart` renderiza visualmente:
- **Círculos verdes**: Tiros anotados (`made = true`)
- **Círculos rojos**: Tiros fallados (`made = false`)
- **Tamaño**: Constante (~0.8 en SVG), no varía por densidad

**Transformación de coordenadas BD → SVG**:
```typescript
// BD: x ∈ [0,100], y ∈ [0,50], basket en (50, 5.75)
// SVG: viewBox="0 0 100 94" (FIBA 15m × 14.1m), basket en (50, 88.25)

toSvgX = (bdX: number) => bdX                    // Direct mapping [0,100] → [0,100]
toSvgY = (bdY: number) => 94 - (bdY * 1.88)     // Inverted: [0,50] → [94,0], factor 94/50=1.88
```

**Colorización por zona**:
- Zona PAINT: círculos **menores brillo**
- Zona MID-RANGE: círculos **brillo medio**
- Zona 3PT: círculos **máximo brillo**

**Filtros**:
- Por cuarto (Q1, Q2, Q3, Q4, o Todos)
- Por equipo (Todos, Home, Away)
- Las coordenadas X/Y se escalan a la cancha FIBA reglamentaria

### Limitaciones y Consideraciones

1. **Cross-linking previo**: Partidos procesados ANTES de la implementación del smart matching pueden tener vinculaciones incorrectas. Requieren **re-procesamiento**.

2. **Ventana de búsqueda PBP**: ±3 eventos. Si hay muchos eventos intermedios, podría no encontrar el shot correspondiente.

3. **Precisión de coordenadas CSS**: La precisión depende de la calidad del HTML/JS de FEB. Zonas muy exactas no son garantizadas.

4. **Player ID mismatches**: Si el scraper no extrae correctamente el `feb_player_id` del URL Jugador.aspx, el shot puede no vincularse a un player válido.

---

## Benchmarking vs Liga

### Objetivo
Comparar las estadísticas del equipo contra la media de toda la liga.

### Fuente de Datos
- **Función**: `getLeagueBenchmark(leagueId)`
- **Cálculo**: Promedio de `stats_team_games` agrupado por liga

### Proceso

1. **Obtener media del equipo**:
```typescript
teamAvg = AVG(stats_team_games WHERE team_id = X)
```

2. **Obtener media de la liga**:
```typescript
leagueAvg = AVG(stats_team_games WHERE league_id = Y)
```

3. **Calcular percentil** (aproximado):
```typescript
// Para cada métrica, se determina en qué posición está el equipo
percentile = (número de equipos peores / total equipos) × 100
```

4. **Visualización: Bullet Chart**:
```
|----[====XXXX====]-----| → XX = posición del equipo
^                       ^
0                     100
        ^ = media de la liga
```

### Métricas Benchmarked

Típicamente se comparan:
- **PPP** (Puntos Por Partido)
- **RPP** (Rebotes Por Partido)
- **APP** (Asistencias Por Partido)
- **TC%** (Porcentaje de Tiro de Campo)
- **TO** (Pérdidas Por Partido)
- **+/−** (Plus-Minus Promedio)

**Interpretación**:
- Valor del equipo **a la derecha** de la media de liga = mejor que promedio
- Valor del equipo **a la izquierda** de la media de liga = peor que promedio

---

## Desglose de Puntos (Scoring Breakdown)

### Objetivo
Clasificar de dónde provienen los puntos del equipo.

### Categorías

#### 1. Juego Regular
```typescript
regular = totalPoints - (offTurnover + secondChance + fastbreak)
```
- Puntos en transiciones normales de ataque posicional

#### 2. Tras Pérdida Rival (Off Turnover)
```typescript
offTurnover = puntos anotados inmediatamente después de un TO del rival
```
- Se cuentan jugadas marcadas como `action_type LIKE '%turnover%'` seguidas de anotación

#### 3. Segunda Oportunidad (Second Chance)
```typescript
secondChance = puntos tras rebote ofensivo
```
- Anotaciones que siguen a un `action_type = 'offensive_rebound'`

#### 4. Contraataque (Fastbreak)
```typescript
fastbreak = puntos marcados en menos de 8 segundos de posesión
```
- Se mide el tiempo entre posesión ganada y anotación

### Visualización

**Gráfico de Torta (Pie Chart)**:
- Cada categoría con color distintivo
- Porcentajes y totales absolutos
- Leyenda con valores y porcentajes

---

## Red de Asistencias (Assist Network)

### Objetivo
Conectar jugadores mediante eventos de asistencia, mostrando:
- **Asistencias Dadas**: Jugadores a quiénes asistió (canastas que armó)
- **Asistencias Recibidas**: Jugadores que lo asistieron (canastas facturadas para otros)

### Flujo de Datos Completo

#### 1. **Extracción de Datos (Backend - `repository.py`)**

**Ubicación**: [src/shared/database/repository.py: líneas 545-562](src/shared/database/repository.py#L545-L562)

La tabla `play_by_play` se popula desde el scraper con eventos de tipo "assist":

```python
pbp_rows.append({
    "game_id": game_db_id,
    "quarter": ev.quarter,
    "minute": ev.minute,
    "team_id": ev_team_id,          # ← Equipo que hizo el assist
    "player_id": ev_player_id,      # ← ID del jugador (puede ser None si no se matcheó)
    "action_type": ev.action_type,  # ← Valor: "assist" (parseado por pbp_parser.py)
    "action_value": ev.action_value,
    "stat_count": ev.stat_count,
    "free_throws_awarded": ev.free_throws_awarded,
    "home_score_partial": last_home_score,
    "away_score_partial": last_away_score,
})
```

**Parsing de Assist**: El parser detecta asistencias en el texto PBP:

**Ubicación**: [src/shared/scraper/pbp_parser.py: línea 151](src/shared/scraper/pbp_parser.py#L151)

```python
# ─── ASISTENCIA ───
if "ASISTENCIA" in t:
    result["action_type"] = "assist"
    result["stat_count"] = _extract_stat_count(action_part)
    return result
```

#### 2. **Carga de Datos (Frontend API - `api.ts`)**

**Ubicación**: [src/client/lib/api.ts: función `getPlayerSynergyData` líneas 1004-1195](src/client/lib/api.ts#L1004-L1195)

```typescript
// PASO 1: Cargar stats de todos los jugadores del equipo en los juegos seleccionados
let query = supabase
  .from("stats_player_games")
  .select("*, player:players(*), game:games(id, home_team_id, away_team_id, home_score, away_score)")
  .eq("team_id", teamId)
if (gameIds && gameIds.length > 0) {
  query = query.in("game_id", gameIds)
}
const { data: allStats } = await query
// ↑ Retorna: [
//   { player_id: 1, player: {id:1, name:"Juan", ...}, points: 15, game_id: 100, ... },
//   { player_id: 2, player: {id:2, name:"Pedro", ...}, points: 12, game_id: 100, ... },
//   ...
// ]
```

**Ubicación**: [líneas 1097-1109](src/client/lib/api.ts#L1097-L1109)

```typescript
// PASO 2: Cargar eventos PBP (Play-by-Play) del equipo
const { data: allPbpRaw } = await supabase
  .from("play_by_play")
  .select("id, game_id, action_type, player_id")
  .eq("team_id", teamId)            // ← Solo del equipo actual
  .in("game_id", gids)
  .order("id", { ascending: true })
  .limit(10000)                     // ← Limit: máximo 10000 eventos
const allPbp = allPbpRaw as PbpRow[]
// ↑ Retorna: [
//   {id: 1000, game_id: 100, action_type: "assist", player_id: 1 },
//   {id: 1001, game_id: 100, action_type: "2pt_made", player_id: 2 },
//   {id: 1002, game_id: 100, action_type: "foul_comm", player_id: 3 },
//   ...
// ]
```

#### 3. **Construcción del Mapa de Jugadores**

**Ubicación**: [líneas 1110-1130](src/client/lib/api.ts#L1110-L1130)

⚠️ **CRÍTICO**: El mapa debe incluir TODOS los jugadores del equipo, no solo los que tienen stats:

```typescript
// Primero: agregar jugadores que jugaron (tienen stats_player_games)
const playerMap = new Map<number, Player>()
for (const [, stats] of byGame) {
  for (const s of stats) {
    const p = (s as any).player as Player | undefined
    if (p) playerMap.set(p.id, p)   // ← p.id es la key, p es el objeto Player completo
  }
}

// Segundo: agregar TODOS los jugadores del roster (incluso si no jugaron)
const { data: rosterRaw } = await supabase
  .from("players")
  .select("*")
  .eq("current_team_id", teamId)
const roster = rosterRaw as Player[]
for (const p of roster) {
  if (!playerMap.has(p.id)) {
    playerMap.set(p.id, p)          // ← Añadir si no está ya (evita duplicados)
  }
}
// ↑ playerMap ahora contiene todos los jugadores: {1: Player, 2: Player, 3: Player, ...}
```

**Por qué es importante**: Si A hace un assist pero no está en stats_player_games (ej: 0 min jugados), no sería encontrado en la búsqueda. Ahora con el roster completo, siempre se encontrará.

#### 4. **Búsqueda de Asistencias - Lógica Bidireccional**

**Ubicación**: [líneas 1140-1170](src/client/lib/api.ts#L1140-L1170)

**ASISTENCIAS DADAS** (When `playerId` hace assist, ¿a quién le asistió?):

```typescript
if (ev.action_type === "assist" && ev.player_id === playerId) {
  let scorerId: number | null = null
  
  // Buscar hacia ATRÁS (la canasta podría venir antes del evento assist)
  for (let j = i - 1; j >= Math.max(0, i - 3); j--) {
    const prev = events[j]
    if (prev.action_type?.includes("made")     // ← 2pt_made, 3pt_made, dunk_made
        && prev.player_id                       // ← player_id debe existir
        && prev.player_id !== playerId) {       // ← no contar assists a sí mismo
      scorerId = prev.player_id
      break            // ← FIN: encontramos al scorer
    }
    if (prev.action_type === "assist" || breaksSearch(prev.action_type)) 
      break  // ← STOP: otro assist o evento significativo (no seguir buscando)
  }
  
  // Buscar hacia ADELANTE si no encontramos hacia atrás
  if (!scorerId) {
    for (let j = i + 1; j < Math.min(i + 4, events.length); j++) {
      const next = events[j]
      if (next.action_type?.includes("made") && next.player_id && next.player_id !== playerId) {
        scorerId = next.player_id
        break
      }
      if (next.action_type === "assist" || breaksSearch(next.action_type)) break
    }
  }
  
  // Registrar la asistencia
  if (scorerId) {
    const scorer = playerMap.get(scorerId)  // ← Buscar en el mapa: playerMap[scorerId]
    if (scorer) {
      if (!assistsGiven.has(scorer.id)) {
        assistsGiven.set(scorer.id, { player: scorer, count: 0 })
      }
      assistsGiven.get(scorer.id)!.count++  // ← Incrementar contador
    }
  }
}
```

**Ventana de búsqueda**: ±3 eventos (típicamente suficiente para FEB PBP)

**Ubicación**: [líneas 1172-1210](src/client/lib/api.ts#L1172-L1210)

**ASISTENCIAS RECIBIDAS** (When `playerId` anota, ¿quién lo asistió?):

```typescript
if (ev.action_type?.includes("made")           // ← 2pt_made, 3pt_made, dunk_made
    && !ev.action_type.includes("ft_")         // ← Excluir free throws (no se asisten)
    && ev.player_id === playerId) {            // ← Es nuestro jugador quien anota
  
  let assisterId: number | null = null
  
  // Buscar hacia ATRÁS (assist típicamente viene antes de la canasta)
  for (let j = i - 1; j >= Math.max(0, i - 3); j--) {
    const prev = events[j]
    if (prev.action_type === "assist"          // ← Exactamente "assist"
        && prev.player_id                       // ← player_id debe existir
        && prev.player_id !== playerId) {       // ← no contar assists de sí mismo
      assisterId = prev.player_id
      break
    }
    if (breaksSearch(prev.action_type)) break  // ← STOP: evento significativo
  }
  
  // Buscar hacia ADELANTE si no encontramos hacia atrás (FEB PBP puede registrar después)
  if (!assisterId) {
    for (let j = i + 1; j < Math.min(i + 4, events.length); j++) {
      const next = events[j]
      if (next.action_type === "assist" && next.player_id && next.player_id !== playerId) {
        assisterId = next.player_id
        break
      }
      if (breaksSearch(next.action_type)) break
    }
  }
  
  // Registrar la asistencia recibida
  if (assisterId) {
    const assister = playerMap.get(assisterId)  // ← Buscar en el mapa
    if (assister) {
      if (!assistsReceived.has(assister.id)) {
        assistsReceived.set(assister.id, { player: assister, count: 0 })
      }
      assistsReceived.get(assister.id)!.count++  // ← Incrementar contador
    }
  }
}
```

**Helper Function** que define qué eventos rompen la búsqueda:

**Ubicación**: [línea 1132](src/client/lib/api.ts#L1132)

```typescript
const breaksSearch = (a: string | undefined) =>
  !!a && (
    a.includes("made")               // ← Otro basket interrumpe
    || a.includes("missed")          // ← Otro fallo interrumpe
    || a.includes("turnover")        // ← Pérdida interrumpe
  )
```

#### 5. **Retorno de Datos**

**Ubicación**: [líneas 1219-1225](src/client/lib/api.ts#L1219-L1225)

```typescript
return {
  partners: partners.slice(0, 5),              // ← Top 5 de mejores "socios" por +/−
  assistsGiven: Array.from(assistsGiven.values())
    .sort((a, b) => b.count - a.count)        // ← Ordenar descendente por cantidad
    .slice(0, 5),                              // ← Top 5
  assistsReceived: Array.from(assistsReceived.values())
    .sort((a, b) => b.count - a.count)        // ← Ordenar descendente
    .slice(0, 5),
}
```

### UI / Visualización

**Ubicación**: [src/client/components/player/synergy-tab.tsx: líneas 176-280](src/client/components/player/synergy-tab.tsx#L176-L280)

Se muestran dos secciones de gráficos de barras horizontales (recharts BarChart):

1. **Asistencias Dadas** (verde):
   - Jugadores a quiénes asistió
   - Barras proporcionales al count
   
2. **Asistencias Recibidas** (azul):
   - Jugadores que lo asistieron
   - Barras proporcionales al count

Si `assistsGiven.length === 0` o `assistsReceived.length === 0`, mostrar "Sin datos".

### Limitaciones Actuales

1. **Player ID Mismatches** en el scraper pueden causar que assists queden con `player_id = null`
   - Mitigation: Normalización de nombres en [repository.py: línea 509-527](src/shared/database/repository.py#L509-L527)

2. **Ventana de búsqueda pequeña** (±3 eventos): podría perder assists si hay muchos eventos intermedios
   - Mitigation: Aumentar a ±4 o ±5 si es necesario

3. **No diferencia tipo de assist**: Todas las asistencias pesan igual
   - NBA diferencia: "pass assist" vs "screen on ball" vs "handoff" — FEB no lo tiene

4. **No contabiliza "dimes" (asistencias a 3PT)**: Todos los asists valen igual
   - Mejora futura: ponderar assists a triples como +1 punto

### Debugging Checklist

Si sigue mostrando "Sin datos":

```
1. Verificar: ¿Hay eventos "assist" en la tabla play_by_play?
   SELECT COUNT(*) FROM play_by_play WHERE action_type = 'assist' AND team_id = X

2. Verificar: ¿Esos "assist" tienen player_id válido (no NULL)?
   SELECT player_id, COUNT(*) FROM play_by_play 
   WHERE action_type = 'assist' AND team_id = X
   GROUP BY player_id

3. Verificar: ¿Los player_ids del PBP existen en la tabla players?
   SELECT DISTINCT p.player_id FROM play_by_play p
   LEFT JOIN players pl ON p.player_id = pl.id
   WHERE p.action_type = 'assist' AND pl.id IS NULL

4. Verificar: ¿Hay eventos "made" (baskets) después de los assists?
   SELECT * FROM play_by_play 
   WHERE action_type LIKE '%made%' AND game_id IN (...)
   ORDER BY id
```

---

## Game Center — Análisis Detallado de Partidos

### Objetivo General
Proporcionar análisis profundo de partidos individuales mediante 5 pestañas temáticas: resumen de caja, evolución del marcador, detección de rachas, timeline de eventos y mapa de tiros.

### Datos de Entrada
- **Tabla `games`**: Información del partido (equipos, marcador final)
- **Tabla `stats_player_games`**: Estadísticas individuales por juego
- **Tabla `stats_team_games`**: Totales de equipo por juego
- **Tabla `play_by_play`**: Eventos cronológicos con marcadores parciales
- **Tabla `shots`**: Coordenadas y resultado de cada tiro

---

## Pestaña 1: Box Score & Resumen Avanzado

### Objetivo
Mostrar estadísticas de jugadores, comparativas de equipo, y los Four Factors de Dean Oliver.

### Estructura de Datos

#### 1. Tabla de Box Score
**Fuente**: `stats_player_games` filtrada por `game_id`

**Columnas mostradas** (por orden de importancia):
```
MIN | PTS | REB | AST | TO | ST | BLK | +/- | PIR | eFG% | TS%
```

**Agrupación**: Titulares primero (`starter = true`), luego banquillo

#### 2. Cálculos a Nivel de Jugador

**eFG% (Effective Field Goal %)**
```typescript
eFG% = ((FGM + 0.5 × T3M) / FGA) × 100
```
Donde:
- `FGM` = Tiros de campo anotados (2PT + 3PT)
- `T3M` = Triples anotados
- `FGA` = Tiros de campo intentados (2PT + 3PT)

**Interpretación**: Ajusta el porcentaje de tiro para reflejar que un triple vale 50% más.

**TS% (True Shooting %)**
```typescript
TS% = (PTS / (2 × (FGA + 0.44 × FTA))) × 100
```
Donde:
- `PTS` = Puntos totales
- `FTA` = Tiros libres intentados
- Factor 0.44 = aproximación de posesiones por FT

**Interpretación**: Porcentaje "verdadero" incluyendo tiros libres. Liga ~54%, Elite >60%.

#### 3. Agregación a Nivel de Equipo

Se agregan `stats_player_games` por equipo para obtener totales, permitiendo calcular ratios a nivel colectivo:

```typescript
// Agregación
const aggregateTeam = (players: StatsPlayerGame[]) => {
  const sum = (fn: (s: StatsPlayerGame) => number) =>
    players.reduce((a, s) => a + fn(s), 0)
  
  const pts = sum((s) => s.points ?? 0)
  const t2m = sum((s) => s.t2_made ?? 0)
  const t2a = sum((s) => s.t2_att ?? 0)
  const t3m = sum((s) => s.t3_made ?? 0)
  const t3a = sum((s) => s.t3_att ?? 0)
  const ftm = sum((s) => s.ft_made ?? 0)
  const fta = sum((s) => s.ft_att ?? 0)
  
  const fgm = t2m + t3m
  const fga = t2a + t3a
  const reb = sum((s) => s.reb_tot ?? 0)
  const rebOff = sum((s) => s.reb_off ?? 0)
  const rebDef = sum((s) => s.reb_def ?? 0)
  const ast = sum((s) => s.assists ?? 0)
  const to = sum((s) => s.turnovers ?? 0)
  const stl = sum((s) => s.steals ?? 0)
  const blk = sum((s) => s.blocks_for ?? 0)

  return { pts, t2m, t2a, t3m, t3a, ftm, fta, fgm, fga, reb, rebOff, rebDef, ast, to, stl, blk }
}
```

**Implementación**: `components/game-center/box-score-tab.tsx` líneas 41-67

#### 4. Comparativa de Equipo (Barras)

**Componente**: `CompBar` (líneas 69-107)

**Métricas mostradas**:
- Rebotes totales
- % Tiro de campo
- Pérdidas (menor es mejor)
- Asistencias
- Robos
- Puntos en la pintura (estimado como `T2M × 2`)

**Lógica de color**:
```typescript
const isBetter = higherIsBetter ? myVal >= oppVal : myVal <= oppVal
// Si isBetter → verde, sino → rojo
```

---

## Pestaña 2: Four Factors de Dean Oliver

### Objetivo
Mostrar los 4 factores más predictivos del resultado de un partido.

### Cálculos

#### 1. eFG% (Eficiencia de Tiro)
```typescript
const myEfg = calcEfg(myAgg.fgm, myAgg.t3m, myAgg.fga)

function calcEfg(fgMade: number, t3Made: number, fgAtt: number): string {
  if (fgAtt === 0) return "0.0"
  return (((fgMade + 0.5 * t3Made) / fgAtt) * 100).toFixed(1)
}
```

**Interpretación**:
- Liga típica: 50-52%
- Elite: >55%

#### 2. TOV% (Turnover Percentage)
```typescript
const myTov = calcTovPct(myAgg.to, myAgg.fga, myAgg.fta)

function calcTovPct(turnovers: number, fgAtt: number, ftAtt: number): string {
  const poss = fgAtt + 0.44 * ftAtt + turnovers
  if (poss === 0) return "0.0"
  return ((turnovers / poss) * 100).toFixed(1)
}
```

**Nota**: Menor es mejor (no mayor).

**Interpretación**:
- Liga típica: 13-15%
- Elite: <12%

#### 3. ORB% (Offensive Rebound %)
```typescript
const myOrb = calcOrbPct(myAgg.rebOff, oppAgg.rebDef)

function calcOrbPct(orbOff: number, oppRebDef: number): string {
  const total = orbOff + oppRebDef
  if (total === 0) return "0.0"
  return ((orbOff / total) * 100).toFixed(1)
}
```

**Interpretación**:
- Liga típica: 25-30%
- Elite: >32%

#### 4. FT Rate (Free Throw Rate)
```typescript
const myFtRate = calcFtRate(myAgg.fta, myAgg.fga)

function calcFtRate(ftAtt: number, fgAtt: number): string {
  if (fgAtt === 0) return "0.0"
  return ((ftAtt / fgAtt) * 100).toFixed(1)
}
```

**Interpretación**:
- Mayor es mejor (más agresividad)
- Liga típica: 20-25%
- Elite: >30%

**Implementación**: `box-score-tab.tsx` líneas 109-150

**Componente visual**: `FourFactorCard` (líneas 152-180)

---

## Pestaña 3: Win Probability & Score Flow

### Objetivo
Visualizar la evolución del marcador durante el partido para identificar puntos de inflexión.

### Algoritmo de Score Flow

**1. Extracción de puntos de control**:
```typescript
const points: ScorePoint[] = [{ time: 0, diff: 0, quarter: 1 }]

for (const ev of pbp) {
  if (ev.home_score_partial == null || ev.away_score_partial == null) continue

  const myScore = isHome ? ev.home_score_partial : ev.away_score_partial
  const oppScore = isHome ? ev.away_score_partial : ev.home_score_partial
  const diff = myScore - oppScore

  // Parse time → elapsed minutes (0-40)
  let elapsed = (ev.quarter - 1) * 10
  if (ev.minute) {
    const parts = ev.minute.split(":")
    const mins = parseInt(parts[0] || "0")
    const secs = parseInt(parts[1] || "0")
    elapsed += 10 - mins - secs / 60
  }

  points.push({ time: Math.min(elapsed, 40), diff, quarter: ev.quarter })
}
```

**2. Deduplicación temporal**:
```typescript
// Eliminar puntos duplicados en el mismo momento
const deduped: ScorePoint[] = []
for (let i = 0; i < points.length; i++) {
  if (i < points.length - 1 && Math.abs(points[i].time - points[i + 1].time) < 0.01) continue
  deduped.push(points[i])
}
```

**3. Detección del punto de inflexión**:
```typescript
// Encontrar el último momento donde cambió el líder, antes de que se definiera el resultado final
let inflection: ScorePoint | null = null
const finalSign = Math.sign(finalDiff)
if (finalSign !== 0) {
  for (let i = deduped.length - 1; i >= 0; i--) {
    if (Math.sign(deduped[i].diff) !== finalSign && deduped[i].diff !== 0) {
      inflection = deduped[i + 1] ?? deduped[i]
      break
    }
  }
}
```

### Visualización SVG

**Características**:
- Eje X: 0-40 minutos (4 cuartos)
- Eje Y: Diferencia de puntos (±abs_max)
- Línea central punteada: diferencia 0
- Área verde (arriba): ventaja de nuestro equipo
- Área roja (abajo): desventaja
- Marcador amarillo: punto de inflexión

**Escala**:
```typescript
const absMax = Math.max(Math.abs(maxDiff), Math.abs(minDiff), 5)
const yScale = (diff: number) => PAD.top + chartH / 2 - (diff / absMax) * (chartH / 2)
const xScale = (t: number) => PAD.left + (t / 40) * chartW
```

**Estadísticas resumidas**:
- Max ventaja alcanzada
- Max desventaja alcanzada
- Número de cambios de líder

**Implementación**: `components/game-center/win-probability-tab.tsx` líneas 25-150

---

## Pestaña 4: Análisis de Rachas (Scoring Runs)

### Objetivo
Detectar momentos donde un equipo anotó 8+ puntos consecutivos sin respuesta.

### Algoritmo de Detección

**Constante**: MIN_RUN_POINTS = 8

```typescript
const detectedRuns: Run[] = []
const scoringEvents = pbp.filter(
  (ev) =>
    ev.action_type.includes("made") &&
    !ev.action_type.includes("missed") &&
    (ev.home_score_partial != null || ev.away_score_partial != null)
)

let currentTeamId: number | null = null
let runStartScore = 0
let currentScore = 0
let playersInRun = new Set<number>()

for (const ev of scoringEvents) {
  const homeScore = ev.home_score_partial
  const awayScore = ev.away_score_partial
  const scoringTeamId = ev.team_id
  
  // Determinar puntos: 2 o 3
  const pointsScored = ev.action_type.toLowerCase().includes("3pt_made") ? 3 : 2

  if (currentTeamId === null) {
    // Iniciar nueva racha
    currentTeamId = scoringTeamId
    currentScore = pointsScored
    playersInRun.clear()
    if (ev.player_id) playersInRun.add(ev.player_id)
  } else if (scoringTeamId === currentTeamId) {
    // Continuar racha
    currentScore += pointsScored
    if (ev.player_id) playersInRun.add(ev.player_id)
  } else {
    // Equipo diferente anotó: cerrar racha si cumple mínimo
    if (currentScore >= MIN_RUN_POINTS && currentTeamId) {
      detectedRuns.push({
        quarter: startQuarter,
        startTime: startMinute,
        endTime: ev.minute,
        scoringTeamId: currentTeamId,
        points: currentScore,
        playersInvolved: new Set(playersInRun)
      })
    }
    
    // Iniciar nueva racha con el nuevo equipo
    currentTeamId = scoringTeamId
    currentScore = pointsScored
    playersInRun.clear()
    if (ev.player_id) playersInRun.add(ev.player_id)
  }
}
```

**Información capturada**:
- Quarter donde comenzó
- Tiempo exacto (MM:SS)
- Duración de la racha
- Equipo que anotó
- Puntos totales de la racha
- Jugadores que participaron (IDs únicos)

**Implementación**: `components/game-center/scoring-runs-tab.tsx` líneas 31-119

---

## Pestaña 5: Play-by-Play Visual (Timeline)

### Objetivo
Mostrar cronología completa de eventos del partido con filtros interactivos.

### Clasificación de Eventos

**Función `classifyAction`**:
```typescript
function classifyAction(actionType: string): PbpFilter[] {
  const at = actionType.toLowerCase()
  const tags: PbpFilter[] = []
  
  if (at.includes("made") || at.includes("dunk")) 
    tags.push("baskets")
  if (at.includes("foul")) 
    tags.push("fouls")
  if (at.includes("sub_in") || at.includes("sub_out")) 
    tags.push("subs")
  if (at.includes("timeout")) 
    tags.push("timeouts")
  
  return tags
}
```

**Filtros disponibles**:
- `all`: Todos los eventos
- `baskets`: Tiros anotados (2pt, 3pt, dunk)
- `fouls`: Faltas cometidas
- `subs`: Cambios (sub_in / sub_out)
- `timeouts`: Tiempos muertos

**Visualización por evento**:
```typescript
{
  time: "Q{quarter} {minute}",
  icon: getActionIcon(actionType),  // 🏀, ❌, 🔄, ⚠️, 🛡️, etc.
  team: isMyTeamEvent ? myTeamName : oppTeamName,
  player: `#{jersey_number} {player_name}`,
  action: formatActionType(actionType),
  score: `{homeScore} - {awayScore}`
}
```

**Indicador visual**:
- Borde izquierdo primario: evento de nuestro equipo
- Borde izquierdo rojo: evento del rival
- Sin borde: evento neutral (timeout, etc.)

**Implementación**: `components/game-center/play-by-play-tab.tsx` líneas 80-240

---

## Pestaña 6: Shot Chart del Partido

### Objetivo
Visualizar todos los tiros del partido en la cancha FIBA (reglamentaria), con estadísticas de eficiencia segregadas por zona. Los datos ya vienen preprocesados desde el backend (transformación de coordenadas, vinculación PBP, clasificación de zonas).

### Datos de Entrada

**Tabla `shots`** (preprocesada por `repository.save_game_stats`):
- `x_coord`, `y_coord`: Coordenadas normalizadas a media cancha (post-plegado)
  - x ∈ [0, 100]: ancho (left/center/right)
  - y ∈ [0, 50]: profundidad desde línea de fondo
- `zone`: Clasificación de zona (`"paint"`, `"mid-range"`, `"3pt"`) — ya calculada en backend
- `made`: boolean (true = tiro anotado)
- `quarter`: número de cuarto
- `team_id`, `player_id`: Identificadores
- `pbp_id`, `action_type`: Vinculación a evento PBP (para validación)

### Clasificación de Tiros (Frontend - Lectura Directa)

El frontend simplemente **lee** la columna `zone` de la BD, previamente calculada por el backend:

```typescript
const isThree = (s: Shot) => s.zone === "3pt"
const isInPaint = (s: Shot) => s.zone === "paint"
const isMidRange = (s: Shot) => s.zone === "mid-range"

const threes = shots.filter(isThree)
const twos = shots.filter((s) => !isThree(s))  // paint + mid-range
```

**Fallback (si zona es null/undefined)**:
```typescript
// Distancia desde canasta (50, 5.75)
// Escala: 1 unidad = 0.15 metros (100 unidades = 15m, FIBA)
const distanceFromBasketM = Math.sqrt(
  ((shot.x_coord - 50) * 0.15)² + ((shot.y_coord - 5.75) * 0.15)²
)
const isThreeFallback = distanceFromBasketM > 6.75  // FIBA 3-pt line
```

### Cálculos de Eficiencia por Filtro

**Filtros disponibles**:
- `all`: Todos los tiros (ambos equipos)
- `home`: Solo tiros del equipo local
- `away`: Solo tiros del equipo visitante

**Para cada filtro**:

```typescript
const calcStats = (shotSet: Shot[]) => {
  if (shotSet.length === 0) return defaultEmptyStats
  
  // Separar por zona (ya categorizado en BD)
  const paintShots = shotSet.filter((s) => s.zone === "paint")
  const midRangeShots = shotSet.filter((s) => s.zone === "mid-range")
  const threeShots = shotSet.filter((s) => s.zone === "3pt")
  
  // Diferenciar made/missed
  const t2m = paintShots.filter((s) => s.made).length + midRangeShots.filter((s) => s.made).length
  const t2a = paintShots.length + midRangeShots.length
  const t3m = threeShots.filter((s) => s.made).length
  const t3a = threeShots.length
  const fgm = t2m + t3m
  const fga = t2a + t3a

  // FG% (Total shooting %)
  const fgPct = fga > 0 
    ? ((fgm / fga) * 100).toFixed(1) 
    : "0.0"

  // T2%
  const t2Pct = t2a > 0 
    ? ((t2m / t2a) * 100).toFixed(1) 
    : "0.0"

  // T3%
  const t3Pct = t3a > 0 
    ? ((t3m / t3a) * 100).toFixed(1) 
    : "0.0"

  // eFG% (Effective FG %)
  const efg = fga > 0 
    ? (((fgm + 0.5 * t3m) / fga) * 100).toFixed(1) 
    : "0.0"

  // PPS (Points Per Shot) = (2×T2M + 3×T3M) / FGA
  const totalPoints = t2m * 2 + t3m * 3
  const pps = fga > 0 
    ? (totalPoints / fga).toFixed(2) 
    : "0.00"

  return { fga, fgm, fgPct, t2m, t2a, t2Pct, t3m, t3a, t3Pct, efg, pps }
}
```

### Interpretación de PPS

```
PPS = 0.8 → 40% eFG% (muy bajo)
PPS = 1.0 → 50% eFG% (bajo)
PPS = 1.1 → 55% eFG% (promedio)
PPS = 1.2 → 60% eFG% (bueno)
PPS = 1.3 → 65% eFG% (muy bueno)
PPS ≥ 1.4 → 70% eFG% (elite)
```

### Visualización

**Componente reutilizable**: `FibaShotChart` (existente)
- Cancha FIBA geometricamente precisa (15m × 14.1m, viewBox="0 0 100 94")
- Puntos verdes: tiros anotados (`made = true`)
- Puntos rojos: tiros fallados (`made = false`)
- Tamaño consistente (~0.8 radio en SVG)

**Transformación de coordenadas BD → SVG**:
```typescript
// BD: x ∈ [0,100] (ancho), y ∈ [0,50] (profundidad), basket en (50, 5.75)
// SVG: viewBox="0 0 100 94" (FIBA 15m × 14.1m), basket en (50, 88.25)

toSvgX = (bdX: number) => bdX                    // Direct mapping [0,100] → [0,100]
toSvgY = (bdY: number) => 94 - (bdY * 1.88)     // Inverted + scaled: [0,50] → [94,0], factor 94/50=1.88
```

**Filtros de vista**:
```typescript
type ShotFilter = "all" | "home" | "away"

// home: shots.filter((s) => s.team_id === homeTeamId)
// away: shots.filter((s) => s.team_id === awayTeamId)
// all: todos los shots del partido
```

**Tabla de estadísticas**:
- Mostrada bajo el gráfico de tiros
- Comparativa lado a lado: Home vs Away
- Métricas: FG%, T2%, T3%, eFG%, PPS
- Color de fondo: Verde si mejor que rival, rojo si peor

**Implementación**: `components/game-center/game-shot-chart-tab.tsx` líneas 40-185

**Tabla de estadísticas**:
- FG%, T2%, T3%, eFG%, PPS mostrados para el filtro actual
- Comparativa PPS entre equipos en mini-card

**Implementación**: `components/game-center/game-shot-chart-tab.tsx` líneas 40-250

---

## Notas Generales


## Notas Generales

### Ubicación de Implementaciones

**Game Center** (menú sidebar, 4ª posición):
- Listado de partidos: `src/client/app/game-center/page.tsx`
- Detalle del partido: `src/client/app/game-center/[id]/page.tsx`
- Pestaña 1 (Box Score): `src/client/components/game-center/box-score-tab.tsx`
- Pestaña 2 (Win Probability): `src/client/components/game-center/win-probability-tab.tsx`
- Pestaña 3 (Scoring Runs): `src/client/components/game-center/scoring-runs-tab.tsx`
- Pestaña 4 (Play-by-Play): `src/client/components/game-center/play-by-play-tab.tsx`
- Pestaña 5 (Shot Chart): `src/client/components/game-center/game-shot-chart-tab.tsx`

**API Functions**: `src/client/lib/api.ts` líneas 1490-1530
- `getGameById(gameId)`
- `getGamePlayerStats(gameId)`
- `getGameTeamStats(gameId)`
- `getGamePlayByPlay(gameId)`

### Convenciones
- **PPP/RPP/APP**: Puntos/Rebotes/Asistencias Por Partido
- **+/−** (Plus-Minus): Diferencial de puntos cuando un jugador/quinteto está en pista
- **PF/PC**: Puntos A Favor / Puntos En Contra
- **eFG%**: Effective Field Goal Percentage (ajustado por triples)
- **TS%**: True Shooting Percentage (incluyendo tiros libres)
- **PPS**: Points Per Shot (puntos promedio por intento)
- **TOV%**: Turnover Percentage (por 100 posesiones)
- **ORB%**: Offensive Rebound Percentage

### Precisión de Datos
- Todos los cálculos dependen de la calidad del scraping del PBP
- Se filtran juegos con `status = 'PROCESSED'` para asegurar completitud
- Se requiere autenticación y `team_id` del usuario para filtrar datos
- Los marcadores parciales (`home_score_partial`, `away_score_partial`) son críticos para:
  - Cálculo de score flow (Win Probability tab)
  - Detección de rachas (Scoring Runs tab)
  - Estimación de puntos en pinta durante stints

### Performance
- Las consultas usan índices en `team_id`, `game_id`, `player_id`
- Se usa Supabase para queries optimizadas
- Las agregaciones se hacen en JavaScript en el cliente para flexibilidad
- Game Center precarga los 5 datasets en paralelo (`Promise.all`)

### Seguridad
- **Filtrado por `team_id`**: Todas las queries verifican que el usuario solo accede a datos de su equipo
- Game Center valida que el `game_id` pertenece a algún partido del equipo (/game-center/[id])
- Auth check via `useAuth()` hook en todas las páginas

### Limitaciones Conocidas

1. **Win Probability Tab**:
   - No es predicción real, es únicamente flujo de marcador
   - Asume que 4 cuartos = 40 minutos exactos
   - No ajusta por tiempo remanente

2. **Scoring Runs Tab**:
   - Detecta runs consecutivos; no agrupa rachas en el mismo cuarto separadas por cambio de balón
   - No diferencia calidad de posesiones
   - No contabiliza tiros libres como puntos en racha

3. **Shot Chart Tab**:
   - **Partidos procesados antes de Febrero 2026**: Pueden tener vinculaciones PBP-Shot incorrectas (cross-linking de tiros de 3pt con eventos PBP de 2pt y viceversa). Requieren **re-procesamiento** para corregir automáticamente.
   - **Smart matching**: Aunque el algoritmo actual prefiere coherencia geométrica, muy ocasionalmente puede fallar si el PBP tiene errores de entrada.
   - **Ventana de búsqueda**: ±3 eventos PBP. Si hay muchos eventos intermedios, puede no encontrar vinculación.
   - **Precisión de coordenadas**: Las coordenadas CSS de FEB no son 100% precisas; zonas muy exactas no son garantizadas.
   - No diferencia "assisted" vs "unassisted" (información no disponible en FEB)
   - No colorea por densidad (heatmap) — solo muestra puntos individuales

4. **Play-by-Play Tab**:
   - Ventana de búsqueda de assists es ±3 eventos (puede perder relaciones lejanas)
   - Algunos action_type pueden no estar mapeados correctamente si el scraper varía

5. **Pipeline General de Shots**:
   - Depende de la calidad del HTML/CSS de FEB (cambios en estructura requieren actualización del scraper)
   - Requiere datos completos de PBP para vinculación correcta
   - Si hay inyección de agua/cortes de servidor durante scraping, datos pueden estar incompletos

---

## Referencias

- **Four Factors**: Dean Oliver, "Basketball on Paper" (2004)
- **Plus-Minus**: Métrica estándar NBA/FIBA, derivada de `game.final_score - game.initial_score` para cada jugador
- **eFG%**: Métrica estándar introducida por John Hollinger
- **Flow Chart**: Inspirado en ESPN's Win Expectancy charts, pero usando diferencia de puntos bruta
- **Win Probability**: Las versiones NBA usan modelos ML; aquí es visualización pura de datos
- **Coordinate Transformation**: Algoritmo de plegado de cancha completa a media cancha, calibrado para geometría FIBA
- **Smart PBP-Shot Linking**: Algoritmo de vinculación inteligente que prioriza coherencia geométrica sobre matching greedy

---

**Última actualización**: Febrero 19, 2026  
**Versión**: 1.2  
**Cambios recientes**: 
- Implementación completa del pipeline de transformación de coordenadas de shots (plegado CSS → coordenadas BD)
- Smart PBP-shot linking con prioridad geométrica (evita cross-linking de 2pt ↔ 3pt)
- Clasificación multidimensional de zonas (zona PBP + geometría de línea de triple)
- Documentación extendida de todo el pipeline de shots (Análisis de Tiro)

