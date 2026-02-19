"use client"

import { useEffect, useState } from "react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Legend,
} from "recharts"
import { Clock, Flame, BarChart3 } from "lucide-react"
import { getGamesPBP } from "@/lib/api"
import type { StatsPlayerGame, Game, PlayByPlay } from "@/lib/types"

type GameRow = StatsPlayerGame & { game: Game }

interface Props {
  playerId: number
  teamId: number
  filteredGames: GameRow[]
}

interface ClutchStats {
  clutchPoints: number
  clutchFGM: number
  clutchFGA: number
  clutchFGPct: number
  clutchEvents: number
  clutchGames: number
}

interface QuarterData {
  quarter: string
  points: number
  fgm: number
  fga: number
  pct: number
}

export function ClutchTab({ playerId, teamId, filteredGames }: Props) {
  const [clutch, setClutch] = useState<ClutchStats | null>(null)
  const [quarterData, setQuarterData] = useState<QuarterData[]>([])
  const [loading, setLoading] = useState(true)

  const gameIds = filteredGames.map((g) => g.game_id)

  useEffect(() => {
    if (gameIds.length === 0) {
      setLoading(false)
      return
    }

    setLoading(true)
    getGamesPBP(gameIds).then((allPbp) => {
      // ── CLUTCH ANALYSIS ──
      // Clutch = last 2 min of Q4, score difference < 5 pts
      const clutchEvents: PlayByPlay[] = []
      const clutchGameSet = new Set<number>()

      for (const ev of allPbp) {
        if (ev.quarter !== 4) continue
        if (ev.player_id !== playerId) continue

        // Parse minute: "MM:SS" — clutch is <2:00 remaining
        const minute = ev.minute
        if (!minute) continue
        const parts = minute.split(":")
        const mins = parseInt(parts[0] || "0")
        if (mins >= 2) continue // Not in clutch time

        // Check score difference
        const scoreDiff = Math.abs(
          (ev.home_score_partial ?? 0) - (ev.away_score_partial ?? 0),
        )
        if (scoreDiff >= 5) continue

        clutchEvents.push(ev)
        clutchGameSet.add(ev.game_id)
      }

      let clutchPoints = 0
      let clutchFGM = 0
      let clutchFGA = 0

      for (const ev of clutchEvents) {
        if (
          ev.action_type?.includes("made") ||
          ev.action_type?.includes("missed")
        ) {
          clutchFGA++
          if (ev.action_type?.includes("made")) {
            clutchFGM++
            clutchPoints += ev.action_value || 0
          }
        }
        if (ev.action_type === "ft_made") {
          clutchPoints += 1
        }
      }

      setClutch({
        clutchPoints,
        clutchFGM,
        clutchFGA,
        clutchFGPct: clutchFGA > 0 ? (clutchFGM / clutchFGA) * 100 : 0,
        clutchEvents: clutchEvents.length,
        clutchGames: clutchGameSet.size,
      })

      // ── QUARTER BREAKDOWN ──
      // Use PBP to count scoring events per quarter for this player
      const qStats = new Map<
        number,
        { points: number; fgm: number; fga: number }
      >()
      for (let q = 1; q <= 4; q++) {
        qStats.set(q, { points: 0, fgm: 0, fga: 0 })
      }

      for (const ev of allPbp) {
        if (ev.player_id !== playerId) continue
        const q = ev.quarter
        if (q < 1 || q > 4) continue
        const qs = qStats.get(q)
        if (!qs) continue

        if (
          ev.action_type?.includes("made") ||
          ev.action_type?.includes("missed")
        ) {
          qs.fga++
          if (ev.action_type?.includes("made")) {
            qs.fgm++
            qs.points += ev.action_value || 0
          }
        }
        if (ev.action_type === "ft_made") {
          qs.points += 1
        }
      }

      const qData: QuarterData[] = Array.from(qStats.entries()).map(
        ([q, s]) => ({
          quarter: `Q${q}`,
          points: s.points,
          fgm: s.fgm,
          fga: s.fga,
          pct: s.fga > 0 ? (s.fgm / s.fga) * 100 : 0,
        }),
      )

      setQuarterData(qData)
      setLoading(false)
    })
  }, [playerId, teamId, JSON.stringify(gameIds)])

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  const q1 = quarterData.find((q) => q.quarter === "Q1")
  const q4 = quarterData.find((q) => q.quarter === "Q4")

  const barColors = [
    "hsl(210, 80%, 55%)",
    "hsl(190, 80%, 50%)",
    "hsl(30, 90%, 55%)",
    "hsl(0, 80%, 55%)",
  ]

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* ── Clutch Stats ── */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 mb-5">
          <Flame className="h-4 w-4 text-orange-400" />
          <div>
            <h3 className="font-display text-base font-bold text-foreground">
              Clutch Performance
            </h3>
            <p className="text-xs text-muted-foreground">
              Últimos 2 min del Q4 · Diferencia {"<"} 5 pts
            </p>
          </div>
        </div>

        {clutch && clutch.clutchEvents > 0 ? (
          <div className="space-y-5">
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg border border-border bg-secondary/30 p-3 text-center">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  PTS
                </p>
                <span className="mt-1 block font-display text-2xl font-bold text-orange-400">
                  {clutch.clutchPoints}
                </span>
              </div>
              <div className="rounded-lg border border-border bg-secondary/30 p-3 text-center">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  FG%
                </p>
                <span className="mt-1 block font-display text-2xl font-bold text-foreground">
                  {clutch.clutchFGPct.toFixed(0)}%
                </span>
              </div>
              <div className="rounded-lg border border-border bg-secondary/30 p-3 text-center">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Partidos
                </p>
                <span className="mt-1 block font-display text-2xl font-bold text-foreground">
                  {clutch.clutchGames}
                </span>
              </div>
            </div>

            <div className="rounded-lg bg-secondary/50 p-4">
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="text-muted-foreground">Tiros en clutch</span>
                <span className="font-semibold text-foreground">
                  {clutch.clutchFGM}/{clutch.clutchFGA}
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-orange-500 to-red-500"
                  style={{
                    width: `${clutch.clutchFGPct}%`,
                  }}
                />
              </div>
            </div>

            <div className="rounded-lg border border-orange-500/20 bg-orange-500/5 p-3">
              <p className="text-xs text-muted-foreground">
                <span className="font-semibold text-orange-400">
                  {clutch.clutchEvents}
                </span>{" "}
                acciones registradas en situaciones clutch a lo largo de{" "}
                <span className="font-semibold text-foreground">
                  {clutch.clutchGames}
                </span>{" "}
                partidos.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex h-40 items-center justify-center">
            <div className="text-center">
              <Clock className="mx-auto h-8 w-8 text-muted-foreground/30" />
              <p className="mt-2 text-sm text-muted-foreground">
                Sin acciones clutch registradas
              </p>
              <p className="text-xs text-muted-foreground/60">
                Se necesitan partidos apretados para generar datos
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ── Quarter Breakdown ── */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 mb-5">
          <BarChart3 className="h-4 w-4 text-primary" />
          <div>
            <h3 className="font-display text-base font-bold text-foreground">
              Rendimiento por Cuartos
            </h3>
            <p className="text-xs text-muted-foreground">
              Puntos y eficacia por cuarto
            </p>
          </div>
        </div>

        {quarterData.length > 0 ? (
          <>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={quarterData} barCategoryGap="20%">
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="rgba(255,255,255,0.06)"
                  />
                  <XAxis
                    dataKey="quarter"
                    tick={{
                      fill: "hsl(215,15%,55%)",
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                    axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
                  />
                  <YAxis
                    tick={{ fill: "hsl(215,15%,55%)", fontSize: 11 }}
                    axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(220,20%,14%)",
                      border: "1px solid hsl(220,15%,22%)",
                      borderRadius: 10,
                      fontSize: 12,
                    }}
                    formatter={(value: any, name: string) => [
                      value,
                      name === "points" ? "Puntos" : name,
                    ]}
                  />
                  <Bar
                    dataKey="points"
                    name="Puntos"
                    radius={[6, 6, 0, 0]}
                    maxBarSize={50}
                  >
                    {quarterData.map((_, idx) => (
                      <Cell
                        key={idx}
                        fill={barColors[idx % barColors.length]}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Q1 vs Q4 comparison */}
            {q1 && q4 && (
              <div className="mt-4 rounded-lg border border-border bg-secondary/30 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                  Comparativa Q1 vs Q4
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <p className="text-[10px] font-semibold text-blue-400 mb-1">
                      Q1 — Inicio
                    </p>
                    <span className="font-display text-xl font-bold text-foreground">
                      {q1.points} pts
                    </span>
                    <p className="text-[10px] text-muted-foreground">
                      {q1.fgm}/{q1.fga} ({q1.pct.toFixed(0)}%)
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] font-semibold text-red-400 mb-1">
                      Q4 — Cierre
                    </p>
                    <span className="font-display text-xl font-bold text-foreground">
                      {q4.points} pts
                    </span>
                    <p className="text-[10px] text-muted-foreground">
                      {q4.fgm}/{q4.fga} ({q4.pct.toFixed(0)}%)
                    </p>
                  </div>
                </div>
                <div className="mt-3 text-center">
                  <span
                    className={`text-xs font-semibold ${
                      q4.points >= q1.points
                        ? "text-emerald-400"
                        : "text-amber-400"
                    }`}
                  >
                    {q4.points >= q1.points
                      ? `↑ +${q4.points - q1.points} pts más en Q4`
                      : `↓ ${q1.points - q4.points} pts menos en Q4`}
                  </span>
                </div>
              </div>
            )}

            {/* Per-quarter detail */}
            <div className="mt-3 grid grid-cols-4 gap-2">
              {quarterData.map((q, idx) => (
                <div
                  key={q.quarter}
                  className="rounded-lg bg-secondary/50 p-2 text-center"
                >
                  <p
                    className="text-[10px] font-bold"
                    style={{ color: barColors[idx] }}
                  >
                    {q.quarter}
                  </p>
                  <p className="text-xs font-semibold text-foreground">
                    {q.pct.toFixed(0)}% FG
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {q.fgm}/{q.fga}
                  </p>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
            Sin datos de cuartos disponibles
          </div>
        )}
      </div>
    </div>
  )
}
