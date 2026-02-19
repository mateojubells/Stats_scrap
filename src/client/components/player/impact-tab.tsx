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
  ReferenceLine,
} from "recharts"
import { Activity, Gauge, ArrowUpDown } from "lucide-react"
import { getSinglePlayerOnOff } from "@/lib/api"
import type { StatsPlayerGame, Game } from "@/lib/types"

type GameRow = StatsPlayerGame & { game: Game }

interface Props {
  playerId: number
  teamId: number
  filteredGames: GameRow[]
}

interface OnOffData {
  gp: number
  avgMinutes: string
  onCourtPM: string
  offCourtPM: string
  netDiff: string
  usgPct: string
  totalOnPM: number
  totalOffPM: number
}

export function ImpactTab({ playerId, teamId, filteredGames }: Props) {
  const [data, setData] = useState<OnOffData | null>(null)
  const [loading, setLoading] = useState(true)

  const gameIds = filteredGames.map((g) => g.game_id)

  useEffect(() => {
    setLoading(true)
    getSinglePlayerOnOff(
      playerId,
      teamId,
      gameIds.length > 0 ? gameIds : undefined,
    ).then((d) => {
      setData(d)
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

  if (!data) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        No hay datos disponibles
      </div>
    )
  }

  const onPM = Number(data.onCourtPM)
  const offPM = Number(data.offCourtPM)
  const netDiff = Number(data.netDiff)
  const usg = Number(data.usgPct)

  const barData = [
    { label: "En Pista", value: onPM },
    { label: "Fuera", value: offPM },
  ]

  const netData = [{ label: "Diferencial Neto", value: netDiff }]

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {/* ── On/Off Court ── */}
      <div className="lg:col-span-2 rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 mb-5">
          <ArrowUpDown className="h-4 w-4 text-primary" />
          <div>
            <h3 className="font-display text-base font-bold text-foreground">
              Impacto On/Off Court
            </h3>
            <p className="text-xs text-muted-foreground">
              +/− promedio por partido · {data.gp} partidos · {data.avgMinutes}{" "}
              min/g
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6">
          {/* On/Off bars */}
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} layout="vertical" barCategoryGap="30%">
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(255,255,255,0.06)"
                  horizontal={false}
                />
                <XAxis
                  type="number"
                  tick={{ fill: "hsl(215,15%,55%)", fontSize: 11 }}
                  axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
                />
                <YAxis
                  dataKey="label"
                  type="category"
                  tick={{ fill: "hsl(215,15%,55%)", fontSize: 12, fontWeight: 600 }}
                  axisLine={false}
                  tickLine={false}
                  width={70}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(220,20%,14%)",
                    border: "1px solid hsl(220,15%,22%)",
                    borderRadius: 10,
                    fontSize: 12,
                  }}
                />
                <ReferenceLine x={0} stroke="rgba(255,255,255,0.2)" />
                <Bar dataKey="value" radius={[0, 6, 6, 0]} maxBarSize={36}>
                  {barData.map((entry, idx) => (
                    <Cell
                      key={idx}
                      fill={
                        entry.value >= 0
                          ? "hsl(142, 71%, 45%)"
                          : "hsl(0, 84%, 60%)"
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Explanation cards */}
          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-secondary/30 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                En Pista +/−
              </p>
              <span
                className={`font-display text-3xl font-bold ${
                  onPM >= 0 ? "text-emerald-400" : "text-red-400"
                }`}
              >
                {onPM >= 0 ? "+" : ""}
                {data.onCourtPM}
              </span>
              <p className="mt-2 text-[11px] text-muted-foreground">
                Diferencial de puntos mientras el jugador está en cancha.
              </p>
            </div>
            <div className="rounded-lg border border-border bg-secondary/30 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                Fuera de Pista +/−
              </p>
              <span
                className={`font-display text-3xl font-bold ${
                  offPM >= 0 ? "text-emerald-400" : "text-red-400"
                }`}
              >
                {offPM >= 0 ? "+" : ""}
                {data.offCourtPM}
              </span>
              <p className="mt-2 text-[11px] text-muted-foreground">
                offPM = gameMargin − onPM
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Right column: USG + Net Diff ── */}
      <div className="space-y-4">
        {/* Net differential */}
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <Activity className="h-4 w-4 text-primary" />
            <h4 className="text-sm font-bold text-foreground">
              Diferencial Neto
            </h4>
          </div>
          <div className="flex items-center justify-center py-4">
            <div
              className={`rounded-2xl border-2 px-8 py-5 text-center ${
                netDiff >= 0
                  ? "border-emerald-500/30 bg-emerald-500/10"
                  : "border-red-500/30 bg-red-500/10"
              }`}
            >
              <span
                className={`font-display text-5xl font-bold ${
                  netDiff >= 0 ? "text-emerald-400" : "text-red-400"
                }`}
              >
                {netDiff >= 0 ? "+" : ""}
                {data.netDiff}
              </span>
            </div>
          </div>
          <p className="text-center text-xs text-muted-foreground">
            El equipo es{" "}
            <span className="font-semibold text-foreground">
              {Math.abs(netDiff).toFixed(1)} pts
            </span>{" "}
            {netDiff >= 0 ? "mejor" : "peor"} con él en pista
          </p>
        </div>

        {/* Usage Rate */}
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <Gauge className="h-4 w-4 text-amber-400" />
            <div>
              <h4 className="text-sm font-bold text-foreground">USG%</h4>
              <p className="text-[10px] text-muted-foreground">Usage Rate</p>
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-display text-4xl font-bold text-foreground">
              {data.usgPct}
            </span>
            <span className="text-lg text-muted-foreground">%</span>
          </div>
          {/* Visual gauge */}
          <div className="mt-3 h-3 w-full rounded-full bg-secondary overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all"
              style={{ width: `${Math.min(usg, 100)}%` }}
            />
          </div>
          <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
            <span>0%</span>
            <span>Role Player</span>
            <span>Protagonista</span>
          </div>
          <div className="mt-3 rounded-lg bg-secondary/50 px-3 py-2">
            <p className="text-[11px] text-muted-foreground font-mono">
              USG% = Posesiones jugador / Posesiones equipo × 100
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
