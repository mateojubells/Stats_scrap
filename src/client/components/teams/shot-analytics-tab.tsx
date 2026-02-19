"use client"

import { useEffect, useState, useMemo } from "react"
import { getTeamShotsByQuarter } from "@/lib/api"
import type { Shot } from "@/lib/types"
import { Crosshair, Flame, TrendingUp, Percent } from "lucide-react"

interface ShotAnalyticsTabProps {
  teamId: number
}

export function ShotAnalyticsTab({ teamId }: ShotAnalyticsTabProps) {
  const [shots, setShots] = useState<Shot[]>([])
  const [quarter, setQuarter] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    getTeamShotsByQuarter(teamId, quarter ?? undefined).then((s) => {
      setShots(s)
      setLoading(false)
    })
  }, [teamId, quarter])

  const stats = useMemo(() => {
    if (shots.length === 0)
      return {
        fgm: 0,
        fga: 0,
        fgPct: 0,
        t3m: 0,
        t3a: 0,
        t3Pct: 0,
        t2m: 0,
        t2a: 0,
        t2Pct: 0,
        efg: 0,
        pps: 0,
        totalPts: 0,
      }

    const fga = shots.length
    const fgm = shots.filter((s) => s.made).length

    // Clasificación de 3PT: lee directamente la columna zone de la BD
    // Valores posibles: "3pt", "paint", "mid-range"
    const isThree = (s: Shot) => s.zone === "3pt"

    const threes = shots.filter(isThree)
    const twos = shots.filter((s) => !isThree(s))

    const t3a = threes.length
    const t3m = threes.filter((s) => s.made).length
    const t2a = twos.length
    const t2m = twos.filter((s) => s.made).length

    const totalPts = t2m * 2 + t3m * 3
    const efg = fga > 0 ? ((fgm + 0.5 * t3m) / fga) * 100 : 0
    const pps = fga > 0 ? totalPts / fga : 0

    return {
      fgm,
      fga,
      fgPct: fga > 0 ? (fgm / fga) * 100 : 0,
      t3m,
      t3a,
      t3Pct: t3a > 0 ? (t3m / t3a) * 100 : 0,
      t2m,
      t2a,
      t2Pct: t2a > 0 ? (t2m / t2a) * 100 : 0,
      efg,
      pps,
      totalPts,
    }
  }, [shots])

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
      {/* Left: Heatmap Court */}
      <div className="lg:col-span-3">
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-display text-sm font-bold text-foreground">
              Mapa de Calor de Tiros
            </h3>
            {/* Quarter Filter */}
            <div className="flex gap-1">
              <button
                onClick={() => setQuarter(null)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  quarter === null
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-muted-foreground hover:text-foreground"
                }`}
              >
                Todos
              </button>
              {[1, 2, 3, 4].map((q) => (
                <button
                  key={q}
                  onClick={() => setQuarter(q)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                    quarter === q
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Q{q}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="flex aspect-[15/14] items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : (
            <HeatmapCourt shots={shots} />
          )}
        </div>
      </div>

      {/* Right: Efficiency Metrics */}
      <div className="flex flex-col gap-4 lg:col-span-2">
        {/* eFG% Card */}
        <div className="rounded-xl border border-border bg-card p-5" title="Porcentaje Efectivo de Tiro - Mide la eficiencia considerando que los triples valen más">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Crosshair className="h-4 w-4" />
            <span className="text-xs font-semibold uppercase tracking-wider cursor-help">
              eFG%
            </span>
          </div>
          <p className="mt-2 font-display text-3xl font-bold text-foreground">
            {stats.efg.toFixed(1)}%
          </p>
          <p className="mt-2 text-xs text-muted-foreground font-mono">
            eFG% = (FGM + 0.5 × 3PM) / FGA
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            ({stats.fgm} + 0.5 × {stats.t3m}) / {stats.fga}
          </p>
        </div>

        {/* PPS Card */}
        <div className="rounded-xl border border-border bg-card p-5" title="Puntos Por Tiro - Promedio de puntos conseguidos por cada intento de tiro">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Flame className="h-4 w-4" />
            <span className="text-xs font-semibold uppercase tracking-wider cursor-help">
              PPS (Puntos Por Tiro)
            </span>
          </div>
          <p className="mt-2 font-display text-3xl font-bold text-foreground">
            {stats.pps.toFixed(2)}
          </p>
          <p className="mt-2 text-xs text-muted-foreground font-mono">
            PPS = Puntos Totales / Tiros Intentados
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {stats.totalPts} / {stats.fga}
          </p>
        </div>

        {/* Shooting Splits */}
        <div className="rounded-xl border border-border bg-card p-5" title="Distribución de porcentajes de acierto según tipo de tiro">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Percent className="h-4 w-4" />
            <span className="text-xs font-semibold uppercase tracking-wider cursor-help">
              Porcentajes de Tiro
            </span>
          </div>
          <div className="mt-4 space-y-3">
            {/* 2PT */}
            <div title="Tiros de 2 puntos - Porcentaje de acierto en tiros de campo dentro del arco">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground cursor-help">2PT</span>
                <span className="font-semibold text-foreground">
                  {stats.t2Pct.toFixed(1)}%
                </span>
              </div>
              <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-500"
                  style={{ width: `${stats.t2Pct}%` }}
                />
              </div>
              <p className="mt-0.5 text-[10px] text-muted-foreground">
                {stats.t2m}/{stats.t2a}
              </p>
            </div>

            {/* 3PT */}
            <div title="Tiros de 3 puntos - Porcentaje de acierto desde más allá del arco">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground cursor-help">3PT</span>
                <span className="font-semibold text-foreground">
                  {stats.t3Pct.toFixed(1)}%
                </span>
              </div>
              <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-chart-2 transition-all duration-500"
                  style={{ width: `${stats.t3Pct}%` }}
                />
              </div>
              <p className="mt-0.5 text-[10px] text-muted-foreground">
                {stats.t3m}/{stats.t3a}
              </p>
            </div>

            {/* FG Total */}
            <div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">FG Total</span>
                <span className="font-semibold text-foreground">
                  {stats.fgPct.toFixed(1)}%
                </span>
              </div>
              <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-chart-3 transition-all duration-500"
                  style={{ width: `${stats.fgPct}%` }}
                />
              </div>
              <p className="mt-0.5 text-[10px] text-muted-foreground">
                {stats.fgm}/{stats.fga}
              </p>
            </div>
          </div>
        </div>

        {/* Quarter context */}
        {quarter && (
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <span className="text-xs font-semibold text-primary">
                Q{quarter} Analysis
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Mostrando datos filtrados del{" "}
              {quarter === 1
                ? "primer"
                : quarter === 2
                  ? "segundo"
                  : quarter === 3
                    ? "tercer"
                    : "cuarto"}{" "}
              cuarto ({shots.length} tiros)
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════
   HEATMAP COURT COMPONENT (SVG with gaussian density overlay)
   ═══════════════════════════════════════════════════════════════════ */

function HeatmapCourt({ shots }: { shots: Shot[] }) {
  // FIBA court constants
  const BASKET = { x: 50, y: 88.25 }
  const PAINT = { left: 33.67, right: 66.33, top: 57, bottom: 94 }
  const THREE_PT = {
    arcCenter: { x: 55, y: 57 },
    arcRadius: 39,
    cornerX_L: 10,
    cornerX_R: 90,
    cornerY_top: 60,
    connectY: 75,
  }
  const FREE_THROW = { center: { x: 50, y: 57 }, radius: 12 }
  const RESTRICTED = { center: { x: 50, y: 88.25 }, radius: 8.33 }
  const BACKBOARD = { left: 44, right: 56, y: 91 }
  const RIM_RADIUS = 2

  const toSvgX = (dataX: number) => dataX
  const toSvgY = (dataY: number) => 94 - dataY * 1.88

  // Build heatmap grid
  const GRID_W = 50
  const GRID_H = 47
  const heatmap = useMemo(() => {
    const grid: number[][] = Array.from({ length: GRID_H }, () =>
      Array(GRID_W).fill(0),
    )
    const madeGrid: number[][] = Array.from({ length: GRID_H }, () =>
      Array(GRID_W).fill(0),
    )
    const attGrid: number[][] = Array.from({ length: GRID_H }, () =>
      Array(GRID_W).fill(0),
    )

    const SIGMA = 2.5

    for (const shot of shots) {
      const sx = toSvgX(shot.x_coord)
      const sy = toSvgY(shot.y_coord)

      // Map to grid
      const gx = Math.round((sx / 100) * (GRID_W - 1))
      const gy = Math.round((sy / 94) * (GRID_H - 1))

      // Gaussian spread
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

    // Accuracy-weighted heatmap: red where hot (high accuracy), blue where cold
    let maxAtt = 0
    for (let y = 0; y < GRID_H; y++)
      for (let x = 0; x < GRID_W; x++)
        if (attGrid[y][x] > maxAtt) maxAtt = attGrid[y][x]

    const cells: {
      x: number
      y: number
      w: number
      h: number
      color: string
      opacity: number
    }[] = []

    const cellW = 100 / GRID_W
    const cellH = 94 / GRID_H

    for (let gy = 0; gy < GRID_H; gy++) {
      for (let gx = 0; gx < GRID_W; gx++) {
        if (attGrid[gy][gx] < 0.1) continue

        const intensity = attGrid[gy][gx] / (maxAtt || 1)
        const accuracy =
          attGrid[gy][gx] > 0.5
            ? madeGrid[gy][gx] / attGrid[gy][gx]
            : 0.5

        // Color: blue (cold/low accuracy) → red (hot/high accuracy)
        let r: number, g: number, b: number
        if (accuracy >= 0.5) {
          // Green to red (50% → 100%)
          const t = (accuracy - 0.5) * 2
          r = Math.round(255)
          g = Math.round(255 * (1 - t * 0.7))
          b = Math.round(50 * (1 - t))
        } else {
          // Blue to green (0% → 50%)
          const t = accuracy * 2
          r = Math.round(50 * t)
          g = Math.round(100 + 155 * t)
          b = Math.round(255 * (1 - t * 0.5))
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
  }, [shots])

  const threePtArcPath = () => {
    const { x: cx, y: cy } = THREE_PT.arcCenter
    const r = THREE_PT.arcRadius
    return `M ${THREE_PT.cornerX_L} ${THREE_PT.cornerY_top} A ${r} ${r} 0 0 1 ${THREE_PT.cornerX_R} ${THREE_PT.cornerY_top}`
  }

  const connectorArcPath = () => {
    const r = (THREE_PT.cornerX_R - THREE_PT.cornerX_L) / 2
    return `M ${THREE_PT.cornerX_L} ${THREE_PT.connectY} A ${r} ${r} 0 0 1 ${THREE_PT.cornerX_R} ${THREE_PT.connectY}`
  }

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

  const centerCirclePath = () => {
    const r = 12
    return `M ${50 - r} 0 A ${r} ${r} 0 0 1 ${50 + r} 0`
  }

  return (
    <div className="w-full aspect-[15/14]">
      <svg
        viewBox="0 0 100 94"
        className="w-full h-full"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Background */}
        <rect x="0" y="0" width="100" height="94" fill="#0a1018" />

        {/* Heatmap overlay */}
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
        <g stroke="rgba(255,255,255,0.4)" strokeWidth="0.5" fill="none">
          <rect x="0" y="0" width="100" height="94" />
        </g>
        <g stroke="rgba(255,255,255,0.35)" strokeWidth="0.45" fill="none">
          <rect
            x={PAINT.left}
            y={PAINT.top}
            width={PAINT.right - PAINT.left}
            height={PAINT.bottom - PAINT.top}
          />
          <path d={freeThrowArcPath()} />
        </g>
        <g stroke="rgba(255,255,255,0.65)" strokeWidth="0.6" fill="none">
          <path d={connectorArcPath()} />
          <line
            x1={THREE_PT.cornerX_L}
            y1={THREE_PT.connectY}
            x2={THREE_PT.cornerX_L}
            y2="94"
          />
          <line
            x1={THREE_PT.cornerX_R}
            y1={THREE_PT.connectY}
            x2={THREE_PT.cornerX_R}
            y2="94"
          />
        </g>
        <g>
          <line
            x1={BACKBOARD.left}
            y1={BACKBOARD.y}
            x2={BACKBOARD.right}
            y2={BACKBOARD.y}
            stroke="rgba(255,255,255,0.6)"
            strokeWidth="0.8"
            strokeLinecap="round"
          />
          <circle
            cx={BASKET.x}
            cy={BASKET.y}
            r={RIM_RADIUS}
            stroke="rgba(255,160,40,0.95)"
            strokeWidth="0.6"
            fill="none"
          />
          <path
            d={restrictedAreaPath()}
            stroke="rgba(255,255,255,0.3)"
            strokeWidth="0.4"
            fill="none"
          />
        </g>
        <path
          d={centerCirclePath()}
          stroke="rgba(255,255,255,0.35)"
          strokeWidth="0.4"
          fill="none"
        />

        {/* Legend */}
        <defs>
          <linearGradient id="heatLegend" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="rgb(50,100,255)" />
            <stop offset="50%" stopColor="rgb(50,255,128)" />
            <stop offset="100%" stopColor="rgb(255,80,50)" />
          </linearGradient>
        </defs>
        <rect x="5" y="2" width="30" height="2" fill="url(#heatLegend)" rx="1" opacity="0.8" />
        <text x="5" y="6.5" fontSize="2" fill="rgba(255,255,255,0.5)">Frío</text>
        <text x="30" y="6.5" fontSize="2" fill="rgba(255,255,255,0.5)">Caliente</text>
      </svg>
    </div>
  )
}
