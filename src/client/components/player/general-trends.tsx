"use client"

import { useEffect, useState } from "react"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  BarChart,
  Bar,
  ReferenceLine,
  Cell,
} from "recharts"
import { TrendingUp, BarChart3, TableProperties } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import {
  computePlayerAverages,
  getLeaguePlayerBenchmarks,
} from "@/lib/api"
import type { StatsPlayerGame, Game } from "@/lib/types"

type GameRow = StatsPlayerGame & { game: Game }

interface Props {
  playerId: number
  teamId: number
  filteredGames: GameRow[]
}

/* ─── Bullet Chart Component ─── */
function BulletChart({
  label,
  value,
  leagueAvg,
  max,
  unit,
}: {
  label: string
  value: number
  leagueAvg: number
  max: number
  unit?: string
}) {
  const pctValue = Math.min((value / max) * 100, 100)
  const pctAvg = Math.min((leagueAvg / max) * 100, 100)
  const isAbove = value >= leagueAvg

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground">
          {label}
        </span>
        <span className="text-xs font-bold text-foreground">
          {value.toFixed(1)}
          {unit}
        </span>
      </div>
      <div className="relative h-6 w-full rounded-md bg-secondary overflow-hidden">
        {/* Player bar */}
        <div
          className={`absolute left-0 top-0 h-full rounded-md transition-all ${
            isAbove ? "bg-emerald-500/70" : "bg-amber-500/70"
          }`}
          style={{ width: `${pctValue}%` }}
        />
        {/* League avg marker */}
        <div
          className="absolute top-0 h-full w-0.5 bg-white/80"
          style={{ left: `${pctAvg}%` }}
        />
        <div
          className="absolute -top-5 text-[10px] font-semibold text-muted-foreground whitespace-nowrap"
          style={{ left: `${Math.max(2, pctAvg - 4)}%` }}
        >
          Liga: {leagueAvg.toFixed(1)}
        </div>
      </div>
    </div>
  )
}

export function GeneralTrends({ playerId, teamId, filteredGames }: Props) {
  const [benchmarks, setBenchmarks] = useState<{
    ppg: number
    rpg: number
    apg: number
    val: number
  } | null>(null)
  const [showPerGame, setShowPerGame] = useState(true)

  useEffect(() => {
    getLeaguePlayerBenchmarks(teamId).then(({ all }) => {
      if (all.length === 0) return
      const n = all.length
      setBenchmarks({
        ppg: all.reduce((a, p) => a + p.ppg, 0) / n,
        rpg: all.reduce((a, p) => a + p.rpg, 0) / n,
        apg: all.reduce((a, p) => a + p.apg, 0) / n,
        val: all.reduce((a, p) => a + p.val, 0) / n,
      })
    })
  }, [teamId])

  // ─── Trend data ───
  const trendData = filteredGames.map((s, idx) => {
    const g = s.game
    const dateStr = g.date
      ? new Date(g.date).toLocaleDateString("es-ES", {
          day: "numeric",
          month: "short",
        })
      : `J${idx + 1}`

    return {
      name: dateStr,
      PIR: s.valoracion ?? 0,
      PTS: s.points ?? 0,
    }
  })

  const avg = computePlayerAverages(filteredGames)

  return (
    <>
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
      {/* ── Performance Chart ── */}
      <div className="lg:col-span-3 rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="h-4 w-4 text-primary" />
          <h3 className="font-display text-base font-bold text-foreground">
            Rendimiento por Partido
          </h3>
        </div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trendData}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(255,255,255,0.06)"
              />
              <XAxis
                dataKey="name"
                tick={{ fill: "hsl(215,15%,55%)", fontSize: 11 }}
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
                labelStyle={{ color: "hsl(215,15%,70%)" }}
              />
              <Legend
                verticalAlign="top"
                height={36}
                formatter={(value) => (
                  <span className="text-xs font-semibold text-muted-foreground">
                    {value}
                  </span>
                )}
              />
              <Line
                type="monotone"
                dataKey="PIR"
                stroke="hsl(262, 83%, 58%)"
                strokeWidth={2.5}
                dot={{ fill: "hsl(262, 83%, 58%)", r: 3 }}
                activeDot={{ r: 5 }}
              />
              <Line
                type="monotone"
                dataKey="PTS"
                stroke="hsl(142, 71%, 45%)"
                strokeWidth={2.5}
                dot={{ fill: "hsl(142, 71%, 45%)", r: 3 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Benchmarking ── */}
      <div className="lg:col-span-2 rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 mb-6">
          <BarChart3 className="h-4 w-4 text-primary" />
          <h3 className="font-display text-base font-bold text-foreground">
            Benchmarking vs Liga
          </h3>
        </div>
        {avg && benchmarks ? (
          <div className="space-y-7">
            <BulletChart
              label="Puntos (PPG)"
              value={Number(avg.ppg)}
              leagueAvg={benchmarks.ppg}
              max={Math.max(30, Number(avg.ppg) * 1.5, benchmarks.ppg * 1.5)}
            />
            <BulletChart
              label="Rebotes (RPG)"
              value={Number(avg.rpg)}
              leagueAvg={benchmarks.rpg}
              max={Math.max(15, Number(avg.rpg) * 1.5, benchmarks.rpg * 1.5)}
            />
            <BulletChart
              label="Asistencias (APG)"
              value={Number(avg.apg)}
              leagueAvg={benchmarks.apg}
              max={Math.max(10, Number(avg.apg) * 1.5, benchmarks.apg * 1.5)}
            />
            <BulletChart
              label="Valoración (PIR)"
              value={Number(avg.val)}
              leagueAvg={benchmarks.val}
              max={Math.max(25, Number(avg.val) * 1.5, benchmarks.val * 1.5)}
            />
          </div>
        ) : (
          <div className="flex h-48 items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        )}
        <div className="mt-5 flex items-center gap-4 text-[10px] text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Por encima de la media
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-amber-500" />
            Por debajo de la media
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-0.5 w-3 bg-white/80" />
            Media de la liga
          </div>
        </div>
      </div>
    </div>

    {/* ── Basic Stats Table ── */}
    {filteredGames.length > 0 && (
      <div className="mt-6 rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <TableProperties className="h-4 w-4 text-primary" />
            <h3 className="font-display text-base font-bold text-foreground">
              Estadísticas Básicas
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs font-semibold ${!showPerGame ? "text-primary" : "text-muted-foreground"}`}>
              Acumulado
            </span>
            <Switch
              checked={showPerGame}
              onCheckedChange={setShowPerGame}
            />
            <span className={`text-xs font-semibold ${showPerGame ? "text-primary" : "text-muted-foreground"}`}>
              Per Game
            </span>
          </div>
        </div>

        <StatsTable games={filteredGames} perGame={showPerGame} />
      </div>
    )}
  </>
  )
}

/* ─── Basic Stats Table (NBA/FIBA style) ─── */
function parseMinutes(min: string | null): number {
  if (!min) return 0
  const parts = min.split(":")
  return parseInt(parts[0] || "0") + parseInt(parts[1] || "0") / 60
}

function StatsTable({ games, perGame }: { games: GameRow[]; perGame: boolean }) {
  const n = games.length
  if (n === 0) return null

  const sum = (fn: (s: GameRow) => number) => games.reduce((a, s) => a + fn(s), 0)

  const totMin = sum((s) => parseMinutes(s.minutes))
  const totPts = sum((s) => s.points ?? 0)
  const totReb = sum((s) => s.reb_tot ?? 0)
  const totAst = sum((s) => s.assists ?? 0)
  const totStl = sum((s) => s.steals ?? 0)
  const totBlk = sum((s) => s.blocks_for ?? 0)
  const totTov = sum((s) => s.turnovers ?? 0)
  const totFgm = sum((s) => (s.t2_made ?? 0) + (s.t3_made ?? 0))
  const totFga = sum((s) => (s.t2_att ?? 0) + (s.t3_att ?? 0))
  const tot3m = sum((s) => s.t3_made ?? 0)
  const tot3a = sum((s) => s.t3_att ?? 0)
  const totFtm = sum((s) => s.ft_made ?? 0)
  const totFta = sum((s) => s.ft_att ?? 0)

  const fgPct = totFga > 0 ? ((totFgm / totFga) * 100).toFixed(1) : "0.0"
  const t3Pct = tot3a > 0 ? ((tot3m / tot3a) * 100).toFixed(1) : "0.0"
  const ftPct = totFta > 0 ? ((totFtm / totFta) * 100).toFixed(1) : "0.0"

  const d = perGame ? n : 1
  const fmt = (v: number) => perGame ? (v / d).toFixed(1) : String(v)
  const fmtMin = (v: number) =>
    perGame
      ? (v / d).toFixed(1)
      : `${Math.floor(v)}:${String(Math.round((v % 1) * 60)).padStart(2, "0")}`

  const columns: { label: string; value: string; highlight?: boolean }[] = [
    { label: "GP", value: String(n) },
    { label: "MIN", value: fmtMin(totMin) },
    { label: "PTS", value: fmt(totPts), highlight: true },
    { label: "REB", value: fmt(totReb) },
    { label: "AST", value: fmt(totAst) },
    { label: "STL", value: fmt(totStl) },
    { label: "BLK", value: fmt(totBlk) },
    { label: "TOV", value: fmt(totTov) },
    { label: "FG%", value: `${fgPct}%` },
    { label: "3P%", value: `${t3Pct}%` },
    { label: "FT%", value: `${ftPct}%` },
  ]

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[600px] text-xs">
        <thead>
          <tr className="border-b border-border">
            {columns.map((c) => (
              <th
                key={c.label}
                className="px-3 py-2.5 text-center font-semibold uppercase tracking-wider text-muted-foreground"
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-border/50">
            {columns.map((c) => (
              <td
                key={c.label}
                className={`px-3 py-3 text-center tabular-nums font-semibold ${
                  c.highlight
                    ? "text-primary font-bold text-base"
                    : "text-foreground"
                }`}
              >
                {c.value}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  )
}
