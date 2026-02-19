"use client"

import { useMemo } from "react"
import type { Game, PlayByPlay } from "@/lib/types"
import { TrendingUp } from "lucide-react"

interface WinProbabilityTabProps {
  game: Game
  pbp: PlayByPlay[]
  myTeamId: number
}

// ── FIBA game has 4 quarters × 10 min = 40 min total ──
const QUARTER_MINUTES = 10
const TOTAL_QUARTERS = 4
const TOTAL_MINUTES = QUARTER_MINUTES * TOTAL_QUARTERS // 40

/**
 * Parse a PBP event's time into total elapsed minutes from the start.
 * quarter ∈ [1,4], minute is "MM:SS" countdown within the quarter.
 */
function elapsedMinutes(quarter: number, minute: string | null): number {
  const base = (quarter - 1) * QUARTER_MINUTES
  if (!minute) return base
  const parts = minute.split(":")
  const m = parseInt(parts[0] || "0", 10)
  const s = parseInt(parts[1] || "0", 10)
  return base + (QUARTER_MINUTES - m - s / 60)
}

interface ScoreFlowPoint {
  elapsed: number
  homeScore: number
  awayScore: number
  diff: number // home − away
}

// ── Insert intersection points where Home and Away lines cross ──
function buildAugmentedData(data: ScoreFlowPoint[]): ScoreFlowPoint[] {
  if (data.length < 2) return data
  const result: ScoreFlowPoint[] = []
  for (let i = 0; i < data.length; i++) {
    result.push(data[i])
    if (i < data.length - 1) {
      const a = data[i]
      const b = data[i + 1]
      const diffA = a.homeScore - a.awayScore
      const diffB = b.homeScore - b.awayScore
      if ((diffA > 0 && diffB < 0) || (diffA < 0 && diffB > 0)) {
        // Linear interpolation to find crossing point
        const t = Math.abs(diffA) / (Math.abs(diffA) + Math.abs(diffB))
        const elapsed = a.elapsed + t * (b.elapsed - a.elapsed)
        const homeScore = a.homeScore + t * (b.homeScore - a.homeScore)
        const awayScore = a.awayScore + t * (b.awayScore - a.awayScore)
        result.push({ elapsed, homeScore, awayScore, diff: 0 })
      }
    }
  }
  return result
}

// ── Build shaded fill areas between the two score lines ──
function buildShadeAreas(
  aug: ScoreFlowPoint[],
  xScale: (v: number) => number,
  yScale: (v: number) => number,
): { points: string; color: "green" | "red" }[] {
  const areas: { points: string; color: "green" | "red" }[] = []
  if (aug.length < 2) return areas

  // Find indices where lines cross (ties / intersection inserts)
  const crossIndices: number[] = [0]
  for (let i = 1; i < aug.length; i++) {
    if (Math.abs(aug[i].homeScore - aug[i].awayScore) < 0.001) {
      crossIndices.push(i)
    }
  }
  crossIndices.push(aug.length - 1)

  // De-duplicate & sort
  const unique = [...new Set(crossIndices)].sort((a, b) => a - b)

  for (let k = 0; k < unique.length - 1; k++) {
    const start = unique[k]
    const end = unique[k + 1]
    const seg = aug.slice(start, end + 1)
    if (seg.length < 2) continue

    // Determine which team leads in this segment using mid-point
    const mid = seg[Math.floor(seg.length / 2)]
    const homeLead = mid.homeScore >= mid.awayScore

    // Build polygon: trace UPPER line forward, then LOWER line backward
    const forwardPts = seg.map((d) => {
      const upper = homeLead ? d.homeScore : d.awayScore
      return `${xScale(d.elapsed).toFixed(2)},${yScale(upper).toFixed(2)}`
    })
    const backwardPts = [...seg].reverse().map((d) => {
      const lower = homeLead ? d.awayScore : d.homeScore
      return `${xScale(d.elapsed).toFixed(2)},${yScale(lower).toFixed(2)}`
    })

    areas.push({
      points: [...forwardPts, ...backwardPts].join(" "),
      color: homeLead ? "green" : "red",
    })
  }

  return areas
}

export function WinProbabilityTab({ game, pbp, myTeamId }: WinProbabilityTabProps) {
  const homeName = game.home_team?.name ?? "Local"
  const awayName = game.away_team?.name ?? "Visitante"

  // ── Build score-flow data from PBP events ──
  const data = useMemo<ScoreFlowPoint[]>(() => {
    if (!pbp || pbp.length === 0) return []

    const points: ScoreFlowPoint[] = [{ elapsed: 0, homeScore: 0, awayScore: 0, diff: 0 }]
    let lastHome = 0
    let lastAway = 0

    for (const ev of pbp) {
      if (ev.home_score_partial != null) lastHome = ev.home_score_partial
      if (ev.away_score_partial != null) lastAway = ev.away_score_partial
      if (ev.action_value > 0 && ev.action_type?.includes("made")) {
        const elapsed = elapsedMinutes(ev.quarter, ev.minute)
        points.push({ elapsed, homeScore: lastHome, awayScore: lastAway, diff: lastHome - lastAway })
      }
    }

    const finalHome = game.home_score ?? lastHome
    const finalAway = game.away_score ?? lastAway
    points.push({ elapsed: TOTAL_MINUTES, homeScore: finalHome, awayScore: finalAway, diff: finalHome - finalAway })

    return points
  }, [pbp, game])

  // ── SVG constants ──
  const SVG_W = 900
  const SVG_H = 400
  const PAD = { top: 30, right: 40, bottom: 50, left: 60 }
  const plotW = SVG_W - PAD.left - PAD.right
  const plotH = SVG_H - PAD.top - PAD.bottom

  // ── Scales ──
  const maxScore = useMemo(() => {
    if (data.length === 0) return 20
    const m = Math.max(...data.map((d) => Math.max(d.homeScore, d.awayScore)))
    return Math.max(Math.ceil(m / 10) * 10 + 5, 20)
  }, [data])

  const xScale = (elapsed: number) => PAD.left + (elapsed / TOTAL_MINUTES) * plotW
  const yScale = (score: number) => PAD.top + plotH - (score / maxScore) * plotH

  // Augmented data (with intersection points) for proper shading
  const augmented = useMemo(() => buildAugmentedData(data), [data])

  // Build shaded background areas between the two lines
  const shadeAreas = useMemo(
    () => buildShadeAreas(augmented, xScale, yScale),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [augmented, maxScore],
  )

  // Build the two line paths
  const homePath = useMemo(
    () => data.map((d, i) => `${i === 0 ? "M" : "L"} ${xScale(d.elapsed).toFixed(1)} ${yScale(d.homeScore).toFixed(1)}`).join(" "),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, maxScore],
  )
  const awayPath = useMemo(
    () => data.map((d, i) => `${i === 0 ? "M" : "L"} ${xScale(d.elapsed).toFixed(1)} ${yScale(d.awayScore).toFixed(1)}`).join(" "),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, maxScore],
  )

  // Quarter tick marks
  const quarterTicks = Array.from({ length: TOTAL_QUARTERS + 1 }, (_, i) => i * QUARTER_MINUTES)

  // Y-axis ticks
  const yTicks = useMemo(() => {
    const step = maxScore <= 60 ? 10 : maxScore <= 100 ? 20 : 25
    const ticks: number[] = []
    for (let v = 0; v <= maxScore; v += step) ticks.push(v)
    return ticks
  }, [maxScore])

  if (data.length <= 1) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center">
        <TrendingUp className="mx-auto mb-3 h-12 w-12 text-muted-foreground/40" />
        <p className="text-muted-foreground">No hay datos de Play-by-Play para generar el gráfico.</p>
      </div>
    )
  }

  const finalPt = data[data.length - 1]

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-xl border border-border bg-card p-4">
        <h3 className="mb-1 font-display text-lg font-bold text-foreground flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          Evolución de Puntuación
        </h3>
        <p className="text-sm text-muted-foreground">
          Puntos acumulados a lo largo del partido.&nbsp;
          <span className="text-emerald-400 font-medium">{homeName} (Local)</span>
          &nbsp;vs&nbsp;
          <span className="text-red-400 font-medium">{awayName} (Visitante)</span>
        </p>
      </div>

      {/* Chart */}
      <div className="rounded-xl border border-border bg-card p-4 overflow-x-auto">
        <svg
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          className="w-full h-auto min-w-[600px]"
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            <linearGradient id="shade-green" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#22c55e" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#22c55e" stopOpacity="0.08" />
            </linearGradient>
            <linearGradient id="shade-red" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#ef4444" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#ef4444" stopOpacity="0.08" />
            </linearGradient>
          </defs>

          {/* Grid: horizontal score lines */}
          <g stroke="rgba(255,255,255,0.06)" strokeWidth="1">
            {yTicks.map((t) => (
              <line key={`hgrid-${t}`} x1={PAD.left} x2={PAD.left + plotW} y1={yScale(t)} y2={yScale(t)} />
            ))}
            {quarterTicks.map((t) => (
              <line key={`vgrid-${t}`} x1={xScale(t)} x2={xScale(t)} y1={PAD.top} y2={PAD.top + plotH} />
            ))}
          </g>

          {/* Shaded areas between the two score lines */}
          {shadeAreas.map((area, idx) => (
            <polygon
              key={`shade-${idx}`}
              points={area.points}
              fill={area.color === "green" ? "url(#shade-green)" : "url(#shade-red)"}
            />
          ))}

          {/* Away line (drawn first so Home sits on top) */}
          <path
            d={awayPath}
            fill="none"
            stroke="#ef4444"
            strokeWidth="2.5"
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {/* Home line */}
          <path
            d={homePath}
            fill="none"
            stroke="#22c55e"
            strokeWidth="2.5"
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {/* Quarter separator lines */}
          <g stroke="rgba(255,255,255,0.18)" strokeWidth="1" strokeDasharray="4,3">
            {quarterTicks.slice(1, -1).map((t) => (
              <line key={`qsep-${t}`} x1={xScale(t)} x2={xScale(t)} y1={PAD.top} y2={PAD.top + plotH} />
            ))}
          </g>

          {/* Score dots at quarter boundaries */}
          {quarterTicks.map((t) => {
            const pt = data.reduce((prev, cur) =>
              Math.abs(cur.elapsed - t) < Math.abs(prev.elapsed - t) ? cur : prev,
            )
            if (!pt) return null
            return (
              <g key={`qdot-${t}`}>
                <circle cx={xScale(t)} cy={yScale(pt.homeScore)} r="4" fill="#22c55e" stroke="rgba(255,255,255,0.7)" strokeWidth="1" />
                <circle cx={xScale(t)} cy={yScale(pt.awayScore)} r="4" fill="#ef4444" stroke="rgba(255,255,255,0.7)" strokeWidth="1" />
                {/* Score label above higher dot */}
                <text
                  x={xScale(t)}
                  y={yScale(Math.max(pt.homeScore, pt.awayScore)) - 8}
                  textAnchor="middle"
                  fill="rgba(255,255,255,0.75)"
                  fontSize="10"
                  fontWeight="bold"
                  fontFamily="sans-serif"
                >
                  {pt.homeScore}–{pt.awayScore}
                </text>
              </g>
            )
          })}

          {/* Final score dots */}
          <circle cx={xScale(finalPt.elapsed)} cy={yScale(finalPt.homeScore)} r="5" fill="#22c55e" stroke="white" strokeWidth="1.5" />
          <circle cx={xScale(finalPt.elapsed)} cy={yScale(finalPt.awayScore)} r="5" fill="#ef4444" stroke="white" strokeWidth="1.5" />

          {/* X-axis labels */}
          {quarterTicks.map((t, i) => (
            <text
              key={`xlabel-${t}`}
              x={xScale(t)}
              y={SVG_H - 10}
              textAnchor="middle"
              fill="rgba(255,255,255,0.5)"
              fontSize="12"
              fontFamily="sans-serif"
            >
              {t === 0 ? "Inicio" : t === TOTAL_MINUTES ? "Final" : `Q${i}`}
            </text>
          ))}

          {/* Y-axis labels */}
          {yTicks.map((t) => (
            <text
              key={`ylabel-${t}`}
              x={PAD.left - 10}
              y={yScale(t) + 4}
              textAnchor="end"
              fill="rgba(255,255,255,0.5)"
              fontSize="11"
              fontFamily="sans-serif"
            >
              {t}
            </text>
          ))}

          {/* Axis title — X */}
          <text x={SVG_W / 2} y={SVG_H} textAnchor="middle" fill="rgba(255,255,255,0.35)" fontSize="12" fontFamily="sans-serif">
            Tiempo de partido (minutos)
          </text>

          {/* Axis title — Y */}
          <text
            x={16}
            y={PAD.top + plotH / 2}
            textAnchor="middle"
            fill="rgba(255,255,255,0.35)"
            fontSize="12"
            fontFamily="sans-serif"
            transform={`rotate(-90, 16, ${PAD.top + plotH / 2})`}
          >
            Puntos
          </text>

          {/* Legend */}
          <rect x={SVG_W - PAD.right - 120} y={PAD.top + 4} width="10" height="10" rx="2" fill="#22c55e" opacity="0.85" />
          <text x={SVG_W - PAD.right - 106} y={PAD.top + 13} fill="rgba(255,255,255,0.7)" fontSize="11" fontFamily="sans-serif">
            {homeName} (Local)
          </text>
          <rect x={SVG_W - PAD.right - 120} y={PAD.top + 20} width="10" height="10" rx="2" fill="#ef4444" opacity="0.85" />
          <text x={SVG_W - PAD.right - 106} y={PAD.top + 29} fill="rgba(255,255,255,0.7)" fontSize="11" fontFamily="sans-serif">
            {awayName} (Visitante)
          </text>
        </svg>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatMini label="Mayor ventaja Local" value={`+${Math.max(0, ...data.map((d) => d.diff))}`} color="emerald" />
        <StatMini label="Mayor ventaja Visitante" value={`${Math.min(0, ...data.map((d) => d.diff))}`} color="red" />
        <StatMini label="Cambios de líder" value={String(countLeadChanges(data))} color="amber" />
        <StatMini label="Empates" value={String(data.filter((d) => d.diff === 0).length)} color="blue" />
      </div>
    </div>
  )
}

// ── Helpers ──

function countLeadChanges(data: ScoreFlowPoint[]): number {
  let changes = 0
  let prevSign = 0
  for (const d of data) {
    const sign = d.diff > 0 ? 1 : d.diff < 0 ? -1 : 0
    if (sign !== 0 && prevSign !== 0 && sign !== prevSign) changes++
    if (sign !== 0) prevSign = sign
  }
  return changes
}

function StatMini({ label, value, color }: { label: string; value: string; color: string }) {
  const colorMap: Record<string, string> = {
    emerald: "text-emerald-400",
    red: "text-red-400",
    amber: "text-amber-400",
    blue: "text-blue-400",
  }
  return (
    <div className="rounded-lg border border-border bg-card/50 p-3 text-center">
      <p className={`font-display text-xl font-bold ${colorMap[color] ?? "text-foreground"}`}>{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  )
}
