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
Visualizar la distribución espacial de los tiros y calcular eficiencias de tiro.

### Fuente de Datos
- **Tabla**: `shots`
- **Campos clave**: `x`, `y`, `zone`, `made`, `team_id`, `player_id`, `quarter`, `game_id`

### Clasificación de Tiros

```typescript
// Identificar si un tiro es de 3 puntos:
isThree = (shot) => {
  // 1. Por zona (si contiene "3" o "three")
  if (shot.zone?.includes("3") || shot.zone?.toLowerCase().includes("three"))
    return true
  
  // 2. Por distancia desde el aro (>6.75m en FIBA)
  const distance = Math.sqrt(shot.x² + shot.y²)
  return distance > 6.75
}

twos = shots.filter((s) => !isThree(s))
threes = shots.filter(isThree)
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
- **Tamaño**: Puede variar según frecuencia en zona

**Filtros**:
- Por cuarto (Q1, Q2, Q3, Q4, o Todos)
- Las coordenadas X/Y se escalan a la cancha FIBA reglamentaria

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

## Notas Generales

### Convenciones
- **PPP/RPP/APP**: Puntos/Rebotes/Asistencias Por Partido
- **+/−** (Plus-Minus): Diferencial de puntos cuando un jugador/quinteto está en pista
- **PF/PC**: Puntos A Favor / Puntos En Contra

### Precisión de Datos
- Todos los cálculos dependen de la calidad del scraping del PBP
- Se filtran juegos con `status = 'PROCESSED'` para asegurar completitud
- Se requiere autenticación y `team_id` del usuario para filtrar datos

### Performance
- Las consultas usan índices en `team_id`, `game_id`, `player_id`
- Se usa Supabase para queries optimizadas
- Las agregaciones se hacen en JavaScript en el cliente para flexibilidad

### Seguridad
- **Filtrado por `team_id`**: Todas las queries verifican que el usuario solo accede a datos de su equipo
- Auth check en páginas `/teams/[id]`: redirige si `urlTeamId !== userTeamId`

---

## Referencias

- **Four Factors**: Dean Oliver, "Basketball on Paper" (2004)
- **Plus-Minus**: Métrica estándar NBA/FIBA
- **eFG%**: Métrica estándar introducida por John Hollinger

---

**Última actualización**: Febrero 2026  
**Versión**: 1.0
