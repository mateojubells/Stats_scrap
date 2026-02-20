"use client"

import { useMemo } from "react"
import type { Game, PlayByPlay } from "@/lib/types"
import { TrendingUp } from "lucide-react"
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

interface WinProbabilityTabProps {
  game: Game
  pbp: PlayByPlay[]
  myTeamId: number
}

const QUARTER_MINUTES = 10
const TOTAL_MINUTES = QUARTER_MINUTES * 4

function elapsedMinutes(quarter: number, minute: string | null): number {
  const base = (quarter - 1) * QUARTER_MINUTES
  if (!minute) return base
  const [mRaw, sRaw] = minute.split(":")
  const m = Number.parseInt(mRaw || "0", 10)
  const s = Number.parseInt(sRaw || "0", 10)
  return base + (QUARTER_MINUTES - m - s / 60)
}

interface ScorePoint {
  elapsed: number
  quarter: number
  minute: string | null
  homeScore: number
  awayScore: number
}

function buildScoreEvolutionData(game: Game, pbp: PlayByPlay[]): ScorePoint[] {
  if (!pbp || pbp.length === 0) return []

  const homeId = game.home_team_id
  const awayId = game.away_team_id
  const ordered = [...pbp].sort((a, b) => {
    const ea = elapsedMinutes(a.quarter, a.minute)
    const eb = elapsedMinutes(b.quarter, b.minute)
    if (ea !== eb) return ea - eb
    if (a.id != null && b.id != null && a.id !== b.id) return a.id - b.id
    return 0
  })

  const points: ScorePoint[] = [
    { elapsed: 0, quarter: 1, minute: "10:00", homeScore: 0, awayScore: 0 },
  ]

  let homeScore = 0
  let awayScore = 0

  for (const ev of ordered) {
    const isMadeBasket = ev.action_value > 0 && ev.action_type?.includes("made")
    if (!isMadeBasket) continue

    if (ev.home_score_partial != null || ev.away_score_partial != null) {
      homeScore = ev.home_score_partial ?? (ev.team_id === homeId ? homeScore + ev.action_value : homeScore)
      awayScore = ev.away_score_partial ?? (ev.team_id === awayId ? awayScore + ev.action_value : awayScore)
    } else {
      if (ev.team_id === homeId) homeScore += ev.action_value
      else if (ev.team_id === awayId) awayScore += ev.action_value
      else continue
    }

    points.push({
      elapsed: elapsedMinutes(ev.quarter, ev.minute),
      quarter: ev.quarter,
      minute: ev.minute,
      homeScore,
      awayScore,
    })
  }

  if (points.length === 1) return []

  const finalHome = game.home_score ?? homeScore
  const finalAway = game.away_score ?? awayScore
  const last = points[points.length - 1]

  if (
    last.elapsed !== TOTAL_MINUTES ||
    last.homeScore !== finalHome ||
    last.awayScore !== finalAway
  ) {
    points.push({
      elapsed: TOTAL_MINUTES,
      quarter: 4,
      minute: "00:00",
      homeScore: finalHome,
      awayScore: finalAway,
    })
  }

  const collapsed: ScorePoint[] = []
  for (const point of points) {
    const last = collapsed[collapsed.length - 1]
    if (last && last.elapsed === point.elapsed) {
      last.homeScore = point.homeScore
      last.awayScore = point.awayScore
      last.quarter = point.quarter
      last.minute = point.minute
      continue
    }
    collapsed.push({ ...point })
  }

  return collapsed
}

export function WinProbabilityTab({ game, pbp, myTeamId }: WinProbabilityTabProps) {
  const homeName = game.home_team?.name ?? "Local"
  const awayName = game.away_team?.name ?? "Visitante"
  void myTeamId

  const data = useMemo(() => buildScoreEvolutionData(game, pbp), [game, pbp])

  const maxScore = useMemo(() => {
    if (data.length === 0) return 10
    const m = Math.max(...data.map((d) => Math.max(d.homeScore, d.awayScore)))
    return Math.max(10, Math.ceil(m / 10) * 10)
  }, [data])

  const diffSeries = useMemo(
    () => data.map((d) => d.homeScore - d.awayScore),
    [data],
  )

  if (data.length <= 1) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center">
        <TrendingUp className="mx-auto mb-3 h-12 w-12 text-muted-foreground/40" />
        <p className="text-muted-foreground">No hay datos de Play-by-Play para generar el gráfico.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-4">
        <h3 className="mb-1 font-display text-lg font-bold text-foreground flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          Evolución de Puntuación
        </h3>
        <p className="text-sm text-muted-foreground">
          Progresión cronológica de puntos acumulados por equipo.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <div className="h-[360px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 6 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="elapsed"
                type="number"
                domain={[0, TOTAL_MINUTES]}
                ticks={[0, 10, 20, 30, 40]}
                tickFormatter={(v) => {
                  if (v === 0) return "Q1"
                  if (v === 10) return "Q2"
                  if (v === 20) return "Q3"
                  if (v === 30) return "Q4"
                  return "Final"
                }}
              />
              <YAxis domain={[0, maxScore]} />
              <Tooltip
                formatter={(value: number, name) => [String(value), String(name)]}
                labelFormatter={(_, payload) => {
                  const point = payload?.[0]?.payload as ScorePoint | undefined
                  if (!point) return ""
                  return `Q${point.quarter} ${point.minute ?? "—"}`
                }}
                contentStyle={{ color: "#000", backgroundColor: "#fff", border: "1px solid #ccc" }}
              />
              <Legend />

              <Line
                type="linear"
                dataKey="homeScore"
                name={homeName}
                stroke="hsl(var(--chart-1))"
                strokeWidth={2.5}
                dot={false}
                isAnimationActive={false}
              />
              <Line
                type="linear"
                dataKey="awayScore"
                name={awayName}
                stroke="hsl(var(--chart-2))"
                strokeWidth={2.5}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatMini label="Mayor ventaja Local" value={`+${Math.max(0, ...diffSeries)}`} color="emerald" />
        <StatMini label="Mayor ventaja Visitante" value={`${Math.min(0, ...diffSeries)}`} color="red" />
        <StatMini label="Cambios de líder" value={String(countLeadChanges(diffSeries))} color="amber" />
        <StatMini label="Empates" value={String(diffSeries.filter((d) => d === 0).length)} color="blue" />
      </div>
    </div>
  )
}

function countLeadChanges(diffSeries: number[]): number {
  let changes = 0
  let prevSign = 0
  for (const d of diffSeries) {
    const sign = d > 0 ? 1 : d < 0 ? -1 : 0
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
