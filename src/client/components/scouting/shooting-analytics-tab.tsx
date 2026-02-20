"use client"

import { useEffect, useState, useMemo } from "react"
import { Target, Crosshair, X, CheckCircle2, Flame, LayoutGrid } from "lucide-react"
import { getTeamShots, getOpponentPlayerStats, getTeamScoringBreakdown } from "@/lib/api"
import { FibaShotChart } from "@/components/fiba-shot-chart"
import type { Shot, StatsPlayerGame, Player } from "@/lib/types"

interface Props {
  opponentTeamId: number
  opponentName: string
}

type ShotMode = "todos" | "aciertos" | "fallos"
type ViewMode = "heatmap" | "dotmap"
type HeatmapFilter = "freq" | "accuracy" | "misses"

interface ZoneStat {
  label: string
  fgm: number
  fga: number
  pct: number
}

interface TopShooter {
  name: string
  initials: string
  attPerGame: number
  pct: string
  zone: string
}

interface FtShooter {
  name: string
  initials: string
  ftmPg: number
  ftaPg: number
  ftPct: number
}

// Classify 3pt shot into "corner" or "arc" based on x_coord
function is3ptCorner(x: number): boolean {
  return x < 15 || x > 85
}

export function ShootingAnalyticsTab({ opponentTeamId, opponentName }: Props) {
  const [shots, setShots] = useState<Shot[]>([])
  const [playerStats, setPlayerStats] = useState<StatsPlayerGame[]>([])
  const [mode, setMode] = useState<ShotMode>("todos")
  const [viewMode, setViewMode] = useState<ViewMode>("heatmap")
  const [heatmapFilter, setHeatmapFilter] = useState<HeatmapFilter>("freq")
  const [loading, setLoading] = useState(true)
  const [scoringBreakdown, setScoringBreakdown] = useState<{ offTurnover: number; fastbreak: number; secondChance: number; regular: number } | null>(null)

  useEffect(() => {
    Promise.all([
      getTeamShots(opponentTeamId),
      getOpponentPlayerStats(opponentTeamId),
      getTeamScoringBreakdown(opponentTeamId),
    ]).then(([s, ps, breakdown]) => {
      setShots(s)
      setPlayerStats(ps)
      setScoringBreakdown(breakdown)
      setLoading(false)
    })
  }, [opponentTeamId])

  /* ── Filtered shots for the shot chart ── */
  const chartShots = useMemo(() => {
    const base = mode === "aciertos" ? shots.filter((s) => s.made) :
                 mode === "fallos"   ? shots.filter((s) => !s.made) : shots
    return base.map((s) => ({
      x: s.x_coord,
      y: s.y_coord,
      made: s.made,
      zone: s.zone ?? undefined,
    }))
  }, [shots, mode])

  /* ── Zone stats ── */
  const zoneStats = useMemo((): ZoneStat[] => {
    const paint = shots.filter((s) => s.zone === "paint")
    const mid   = shots.filter((s) => s.zone === "mid-range")
    const arc3  = shots.filter((s) => s.zone === "3pt" && !is3ptCorner(s.x_coord))
    const cor3  = shots.filter((s) => s.zone === "3pt" && is3ptCorner(s.x_coord))

    const stat = (label: string, arr: Shot[]): ZoneStat => {
      const fgm = arr.filter((s) => s.made).length
      const fga = arr.length
      return { label, fgm, fga, pct: fga > 0 ? (fgm / fga) * 100 : 0 }
    }

    return [
      stat("Zona Pintura", paint),
      stat("Media Distancia", mid),
      stat("Triple – Arco (top)", arc3),
      stat("Triple – Esquina", cor3),
    ]
  }, [shots])

  /* ── Top shooter (by FGA per game) ── */
  const topShooters = useMemo((): TopShooter[] => {
    const byPlayer = new Map<number, { player: Player; rows: StatsPlayerGame[] }>()
    for (const s of playerStats) {
      const p = (s as any).player as Player | undefined
      if (!p) continue
      if (!byPlayer.has(p.id)) byPlayer.set(p.id, { player: p, rows: [] })
      byPlayer.get(p.id)!.rows.push(s)
    }

    return Array.from(byPlayer.values())
      .map(({ player, rows }) => {
        const n = rows.length
        const fgAtt = rows.reduce((a, r) => a + (r.t2_att ?? 0) + (r.t3_att ?? 0), 0)
        const fgMade = rows.reduce((a, r) => a + (r.t2_made ?? 0) + (r.t3_made ?? 0), 0)
        const t3Att = rows.reduce((a, r) => a + (r.t3_att ?? 0), 0)
        const attPg = fgAtt / n
        const pct = fgAtt > 0 ? ((fgMade / fgAtt) * 100).toFixed(1) : "0"
        const zone = t3Att / fgAtt > 0.5 ? "Especialista 3PT" : "Interior / Media"
        const initials = player.name
          .split(/\s+/)
          .map((w: string) => w[0])
          .join("")
          .toUpperCase()
          .slice(0, 2)
        return { name: player.name, initials, attPerGame: attPg, pct, zone }
      })
      .sort((a, b) => b.attPerGame - a.attPerGame)
      .slice(0, 5)
  }, [playerStats])

  /* ── FT Top 3 (relevant volume) ── */
  const topFtShooters = useMemo((): FtShooter[] => {
    const byPlayer = new Map<number, { player: Player; rows: StatsPlayerGame[] }>()
    for (const s of playerStats) {
      const p = (s as any).player as Player | undefined
      if (!p) continue
      if (!byPlayer.has(p.id)) byPlayer.set(p.id, { player: p, rows: [] })
      byPlayer.get(p.id)!.rows.push(s)
    }

    const ranking: FtShooter[] = []
    for (const { player, rows } of byPlayer.values()) {
      const n = rows.length
      const ftAtt = rows.reduce((a, r) => a + (r.ft_att ?? 0), 0)
      const ftMade = rows.reduce((a, r) => a + (r.ft_made ?? 0), 0)
      const ftaPg = ftAtt / n
      if (ftaPg < 1.5 || ftAtt < 10) continue
      const ftPct = ftAtt > 0 ? (ftMade / ftAtt) * 100 : 0
      const initials = player.name.split(/\s+/).map((w: string) => w[0]).join("").toUpperCase().slice(0, 2)
      ranking.push({
        name: player.name,
        initials,
        ftmPg: ftMade / n,
        ftaPg,
        ftPct,
      })
    }

    return ranking.sort((a, b) => b.ftPct - a.ftPct).slice(0, 3)
  }, [playerStats])

  const transitionDanger = useMemo(() => {
    if (!scoringBreakdown) return null
    const total =
      scoringBreakdown.offTurnover +
      scoringBreakdown.fastbreak +
      scoringBreakdown.secondChance +
      scoringBreakdown.regular
    // Transición Danger = (offTurnover + fastbreak) / total × 100
    const transitionPoints = scoringBreakdown.offTurnover + scoringBreakdown.fastbreak
    const pct = total > 0 ? (transitionPoints / total) * 100 : 0
    return {
      points: transitionPoints,
      pct,
      total,
      breakdown: {
        offTurnover: scoringBreakdown.offTurnover,
        fastbreak: scoringBreakdown.fastbreak,
      },
    }
  }, [scoringBreakdown])

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-6">
        <div className="h-80 animate-pulse rounded-xl bg-secondary" />
        <div className="flex flex-col gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-lg bg-secondary" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Top row: shot chart + zone table */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Shot Chart Card */}
        <div className="rounded-xl border border-border bg-card p-5">
          {/* Header: title + view mode switch */}
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              <h3 className="font-display text-base font-bold text-foreground">
                Mapa de Tiros — {opponentName}
              </h3>
            </div>
            {/* View mode toggle */}
            <div className="flex rounded-lg border border-border bg-secondary p-0.5 text-xs font-medium">
              <button
                onClick={() => setViewMode("heatmap")}
                className={`flex items-center gap-1 rounded-md px-2.5 py-1 transition-colors ${
                  viewMode === "heatmap"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Flame className="h-3 w-3" />
                Mapa Calor
              </button>
              <button
                onClick={() => setViewMode("dotmap")}
                className={`flex items-center gap-1 rounded-md px-2.5 py-1 transition-colors ${
                  viewMode === "dotmap"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <LayoutGrid className="h-3 w-3" />
                Mapa Puntos
              </button>
            </div>
          </div>

          {/* Sub-filter for the active view mode */}
          <div className="mb-3 flex gap-1">
            {viewMode === "heatmap" ? (
              <>
                {(
                  [
                    { key: "freq" as const, label: "Frecuencia" },
                    { key: "accuracy" as const, label: "Acierto" },
                    { key: "misses" as const, label: "Fallos" },
                  ] as { key: HeatmapFilter; label: string }[]
                ).map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setHeatmapFilter(key)}
                    className={`rounded-lg px-3 py-1 text-xs font-semibold transition-colors ${
                      heatmapFilter === key
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </>
            ) : (
              <>
                {(
                  [
                    { key: "todos" as const, label: "Todos", icon: Crosshair },
                    { key: "aciertos" as const, label: "Aciertos", icon: CheckCircle2 },
                    { key: "fallos" as const, label: "Fallos", icon: X },
                  ] as { key: ShotMode; label: string; icon: typeof Crosshair }[]
                ).map(({ key, label, icon: Icon }) => (
                  <button
                    key={key}
                    onClick={() => setMode(key)}
                    className={`flex items-center gap-1 rounded-lg px-3 py-1 text-xs font-semibold transition-colors ${
                      mode === key
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Icon className="h-3 w-3" />
                    {label}
                  </button>
                ))}
              </>
            )}
          </div>

          {/* Chart */}
          {viewMode === "heatmap" ? (
            <HeatmapCourt shots={shots} filter={heatmapFilter} />
          ) : (
            <FibaShotChart shots={chartShots} />
          )}

          <p className="mt-2 text-center text-xs text-muted-foreground">
            {viewMode === "heatmap"
              ? `${shots.length} tiros totales · ${heatmapFilter === "freq" ? "frecuencia de tiro" : heatmapFilter === "accuracy" ? "calor = acierto" : "zonas de fallos"}`
              : mode === "todos"
              ? `${shots.length} tiros totales`
              : mode === "aciertos"
              ? `${shots.filter((s) => s.made).length} tiros anotados`
              : `${shots.filter((s) => !s.made).length} tiros fallados`}
          </p>
        </div>

        {/* Zone stats table */}
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="mb-4 flex items-center gap-2">
            <Crosshair className="h-4 w-4 text-primary" />
            <h3 className="font-display text-base font-bold text-foreground">
              Eficiencia por Zona
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <th className="pb-3 text-left">Zona</th>
                  <th className="pb-3 text-center">FGM</th>
                  <th className="pb-3 text-center">FGA</th>
                  <th className="pb-3 text-center">FG%</th>
                  <th className="pb-3 text-right">Volumen</th>
                </tr>
              </thead>
              <tbody>
                {zoneStats.map((zone) => {
                  const isHot = zone.pct >= 50
                  const totalShots = shots.length
                  const vol = totalShots > 0 ? (zone.fga / totalShots) * 100 : 0
                  return (
                    <tr
                      key={zone.label}
                      className="border-b border-border/50 last:border-0"
                    >
                      <td className="py-3 font-medium text-foreground">
                        {zone.label}
                      </td>
                      <td className="py-3 text-center text-muted-foreground">
                        {zone.fgm}
                      </td>
                      <td className="py-3 text-center text-muted-foreground">
                        {zone.fga}
                      </td>
                      <td className="py-3 text-center">
                        <span
                          className={`rounded px-1.5 py-0.5 text-xs font-bold ${
                            isHot
                              ? "bg-red-950/60 text-red-400"
                              : "bg-green-950/60 text-green-400"
                          }`}
                        >
                          {zone.fga > 0 ? zone.pct.toFixed(1) : "—"}%
                        </span>
                      </td>
                      <td className="py-3 text-right">
                        <div className="ml-auto flex items-center justify-end gap-2">
                          <div className="h-1.5 w-20 overflow-hidden rounded-full bg-secondary">
                            <div
                              className="h-full rounded-full bg-primary/60"
                              style={{ width: `${Math.min(vol, 100)}%` }}
                            />
                          </div>
                          <span className="w-10 text-right text-xs text-muted-foreground">
                            {vol.toFixed(0)}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <p className="mt-3 text-xs text-muted-foreground">
            <span className="text-red-400">●</span> FG% ≥50% = zona caliente &nbsp;
            <span className="text-green-400">●</span> FG% &lt;50% = zona fría
          </p>
        </div>
      </div>

      {/* Bottom row: top shooters + FT ranking + transition */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Top shooters */}
        <div className="rounded-xl border border-border bg-card p-5 lg:col-span-1">
          <div className="mb-4 flex items-center gap-2">
            <Target className="h-4 w-4 text-accent" />
            <h3 className="font-display text-base font-bold text-foreground">
              Máximos Tiradores
            </h3>
          </div>
          {topShooters.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Sin datos de tiros del rival.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {topShooters.map((player) => (
                <div
                  key={player.name}
                  className="flex items-center gap-3 rounded-lg border border-border/50 p-3"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-accent/40 bg-accent/10 text-xs font-bold text-accent">
                    {player.initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {player.name}
                    </p>
                    <p className="text-xs text-muted-foreground">{player.zone}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-foreground">
                      {player.attPerGame.toFixed(1)}
                      <span className="ml-0.5 text-xs font-normal text-muted-foreground">FGA/g</span>
                    </p>
                    <p className="text-xs text-muted-foreground">{player.pct}% TC</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* FT Top 3 */}
        <div className="rounded-xl border border-border bg-card p-5 lg:col-span-1">
          <div className="mb-4 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-yellow-400" />
            <h3 className="font-display text-base font-bold text-foreground">
              Top 3 Tiradores de TL
            </h3>
          </div>
          <p className="mb-3 text-xs text-muted-foreground">Filtro: ≥1.5 TL intentados por partido y ≥10 intentos totales.</p>

          {topFtShooters.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin datos suficientes de tiros libres.</p>
          ) : (
            <div className="space-y-2">
              {topFtShooters.map((shooter, idx) => (
                <div key={shooter.name} className="flex items-center gap-3 rounded-lg border border-yellow-400/20 bg-yellow-400/5 p-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-yellow-400/40 bg-yellow-400/10 text-xs font-bold text-yellow-400">
                    {idx + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">{shooter.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {shooter.ftmPg.toFixed(1)} / {shooter.ftaPg.toFixed(1)} TL por partido
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-yellow-400">{shooter.ftPct.toFixed(1)}%</p>
                    <p className="text-[10px] text-muted-foreground">TL%</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

          {/* Transition danger */}
        <div className="rounded-xl border border-border bg-card p-5 lg:col-span-1">
          <div className="mb-4 flex items-center gap-2">
            <Flame className="h-4 w-4 text-red-400" />
            <h3 className="font-display text-base font-bold text-foreground">
              Análisis de Transición
            </h3>
          </div>

          {!transitionDanger ? (
            <p className="text-sm text-muted-foreground">Sin datos de transición disponibles.</p>
          ) : (
            <>
              <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Puntos en Transición (Total)</p>
                <p className="mt-1 text-3xl font-bold text-red-400">{transitionDanger.points}</p>
                <p className="text-xs text-muted-foreground">{transitionDanger.pct.toFixed(1)}% del scoring categorizado</p>
              </div>
              <div className="mt-3 space-y-2 rounded-lg bg-secondary/40 p-3">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Tras pérdida rival:</span>
                  <span className="font-semibold text-foreground">{transitionDanger.breakdown?.offTurnover ?? 0} pts</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Contraataque rápido:</span>
                  <span className="font-semibold text-foreground">{transitionDanger.breakdown?.fastbreak ?? 0} pts</span>
                </div>
              </div>
              <div className="mt-3 rounded-lg bg-secondary/40 p-3">
                <p className="text-xs text-muted-foreground">
                  Riesgo en balance defensivo: rival castiga pérdidas con alta eficiencia en transición.
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════
   HEATMAP COURT — Gaussian density overlay (identical logic to
   ShotAnalyticsTab in teams, adapted for scouting filters)
   ═══════════════════════════════════════════════════════════════════ */

function HeatmapCourt({ shots, filter }: { shots: Shot[]; filter: HeatmapFilter }) {
  const BASKET = { x: 50, y: 88.25 }
  const PAINT = { left: 33.67, right: 66.33, top: 57, bottom: 94 }
  const THREE_PT = { cornerX_L: 10, cornerX_R: 90, connectY: 75, arcRadius: 39 }
  const FREE_THROW = { center: { x: 50, y: 57 }, radius: 12 }
  const RESTRICTED = { center: { x: 50, y: 88.25 }, radius: 8.33 }
  const BACKBOARD = { left: 44, right: 56, y: 91 }
  const RIM_RADIUS = 2

  const toSvgX = (dx: number) => dx
  const toSvgY = (dy: number) => 94 - dy * 1.88

  const GRID_W = 50
  const GRID_H = 47

  const heatmap = useMemo(() => {
    const attGrid: number[][] = Array.from({ length: GRID_H }, () => Array(GRID_W).fill(0))
    const madeGrid: number[][] = Array.from({ length: GRID_H }, () => Array(GRID_W).fill(0))

    // For "misses" filter, only process missed shots for density; for others use all
    const sourceShotsForDensity = filter === "misses" ? shots.filter((s) => !s.made) : shots
    const SIGMA = 2.5

    for (const shot of sourceShotsForDensity) {
      const sx = toSvgX(shot.x_coord)
      const sy = toSvgY(shot.y_coord)
      const gx = Math.round((sx / 100) * (GRID_W - 1))
      const gy = Math.round((sy / 94) * (GRID_H - 1))
      const r = Math.ceil(SIGMA * 2)
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const nx = gx + dx
          const ny = gy + dy
          if (nx < 0 || nx >= GRID_W || ny < 0 || ny >= GRID_H) continue
          const weight = Math.exp(-(dx * dx + dy * dy) / (2 * SIGMA * SIGMA))
          attGrid[ny][nx] += weight
          if (shot.made) madeGrid[ny][nx] += weight
        }
      }
    }

    let maxAtt = 0
    for (let y = 0; y < GRID_H; y++)
      for (let x = 0; x < GRID_W; x++)
        if (attGrid[y][x] > maxAtt) maxAtt = attGrid[y][x]

    const cellW = 100 / GRID_W
    const cellH = 94 / GRID_H
    const cells: { x: number; y: number; w: number; h: number; color: string; opacity: number }[] = []

    for (let gy = 0; gy < GRID_H; gy++) {
      for (let gx = 0; gx < GRID_W; gx++) {
        if (attGrid[gy][gx] < 0.1) continue
        const intensity = attGrid[gy][gx] / (maxAtt || 1)

        let r: number, g: number, b: number

        if (filter === "freq" || filter === "misses") {
          // Monochromatic: low density = blue, high density = orange/red
          if (intensity >= 0.5) {
            const t = (intensity - 0.5) * 2
            r = 255
            g = Math.round(165 * (1 - t * 0.5))
            b = 0
          } else {
            const t = intensity * 2
            r = Math.round(50 + 205 * t)
            g = Math.round(100 + 65 * t)
            b = Math.round(255 * (1 - t))
          }
        } else {
          // Accuracy mode: blue = cold (low %), red = hot (high %)
          const accuracy = attGrid[gy][gx] > 0.5 ? madeGrid[gy][gx] / attGrid[gy][gx] : 0.5
          if (accuracy >= 0.5) {
            const t = (accuracy - 0.5) * 2
            r = 255
            g = Math.round(255 * (1 - t * 0.7))
            b = Math.round(50 * (1 - t))
          } else {
            const t = accuracy * 2
            r = Math.round(50 * t)
            g = Math.round(100 + 155 * t)
            b = Math.round(255 * (1 - t * 0.5))
          }
        }

        cells.push({
          x: gx * cellW,
          y: gy * cellH,
          w: cellW + 0.2,
          h: cellH + 0.2,
          color: `rgb(${r},${g},${b})`,
          opacity: Math.min(intensity * 0.7 + 0.05, 0.75),
        })
      }
    }
    return cells
  }, [shots, filter])

  const freeThrowArcPath = () => {
    const { x, y } = FREE_THROW.center
    const r = FREE_THROW.radius
    return `M ${x - r} ${y} A ${r} ${r} 0 0 1 ${x + r} ${y}`
  }
  const restrictedAreaPath = () => {
    const { x, y } = RESTRICTED.center
    const r = RESTRICTED.radius
    return `M ${x - r} ${y} A ${r} ${r} 0 0 0 ${x + r} ${y}`
  }

  // Legend labels per filter
  const legendLeft = filter === "freq" ? "Poco" : filter === "accuracy" ? "Frío" : "Pocos Fallos"
  const legendRight = filter === "freq" ? "Mucho" : filter === "accuracy" ? "Caliente" : "Muchos Fallos"

  return (
    <div className="w-full aspect-[15/14]">
      <svg viewBox="0 0 100 94" className="w-full h-full" preserveAspectRatio="xMidYMid meet">
        <rect x="0" y="0" width="100" height="94" fill="#0a1018" />

        {/* Heatmap cells */}
        {heatmap.map((cell, idx) => (
          <rect
            key={idx}
            x={cell.x}
            y={cell.y}
            width={cell.w}
            height={cell.h}
            fill={cell.color}
            opacity={cell.opacity}
            rx={0.5}
          />
        ))}

        {/* Court lines */}
        <g stroke="rgba(255,255,255,0.35)" strokeWidth="0.5" fill="none">
          <rect x="0" y="0" width="100" height="94" />
        </g>
        <g stroke="rgba(255,255,255,0.3)" strokeWidth="0.4" fill="none">
          <rect
            x={PAINT.left}
            y={PAINT.top}
            width={PAINT.right - PAINT.left}
            height={PAINT.bottom - PAINT.top}
          />
          <path d={freeThrowArcPath()} />
        </g>
        <g stroke="rgba(255,255,255,0.6)" strokeWidth="0.55" fill="none">
          <path d={`M ${THREE_PT.cornerX_L} ${THREE_PT.connectY} A ${THREE_PT.arcRadius} ${THREE_PT.arcRadius} 0 0 1 ${THREE_PT.cornerX_R} ${THREE_PT.connectY}`} />
          <line x1={THREE_PT.cornerX_L} y1={THREE_PT.connectY} x2={THREE_PT.cornerX_L} y2="94" />
          <line x1={THREE_PT.cornerX_R} y1={THREE_PT.connectY} x2={THREE_PT.cornerX_R} y2="94" />
        </g>
        <line x1={BACKBOARD.left} y1={BACKBOARD.y} x2={BACKBOARD.right} y2={BACKBOARD.y} stroke="rgba(255,255,255,0.6)" strokeWidth="0.8" strokeLinecap="round" />
        <circle cx={BASKET.x} cy={BASKET.y} r={RIM_RADIUS} stroke="rgba(255,160,40,0.95)" strokeWidth="0.6" fill="none" />
        <path d={restrictedAreaPath()} stroke="rgba(255,255,255,0.3)" strokeWidth="0.4" fill="none" />
        <path d="M 38 0 A 12 12 0 0 1 62 0" stroke="rgba(255,255,255,0.3)" strokeWidth="0.4" fill="none" />

        {/* Legend */}
        <defs>
          <linearGradient id={`heatLegendScouting-${filter}`} x1="0" x2="1" y1="0" y2="0">
            {filter === "accuracy" ? (
              <>
                <stop offset="0%" stopColor="rgb(50,100,255)" />
                <stop offset="50%" stopColor="rgb(50,255,128)" />
                <stop offset="100%" stopColor="rgb(255,80,50)" />
              </>
            ) : (
              <>
                <stop offset="0%" stopColor="rgb(50,100,255)" />
                <stop offset="50%" stopColor="rgb(255,165,50)" />
                <stop offset="100%" stopColor="rgb(255,60,0)" />
              </>
            )}
          </linearGradient>
        </defs>
        <rect x="5" y="2" width="30" height="2" fill={`url(#heatLegendScouting-${filter})`} rx="1" opacity="0.85" />
        <text x="5" y="6.5" fontSize="2" fill="rgba(255,255,255,0.55)">{legendLeft}</text>
        <text x="30" y="6.5" fontSize="2" fill="rgba(255,255,255,0.55)" textAnchor="end">{legendRight}</text>
      </svg>
    </div>
  )
}

