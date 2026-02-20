"use client"

import { useEffect, useMemo, useState } from "react"
import {
  ChevronDown,
  User,
  Target,
  TrendingUp,
  TableProperties,
  Shield,
  GitBranch,
  AlertTriangle,
} from "lucide-react"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts"
import {
  getOpponentPlayerStats,
  getTeamShots,
  getPlayerSynergyData,
} from "@/lib/api"
import { FibaShotChart } from "@/components/fiba-shot-chart"
import type { Shot, StatsPlayerGame, Player } from "@/lib/types"

interface Props {
  opponentTeamId: number
  opponentName: string
}

interface PlayerProfile {
  player: Player
  rows: StatsPlayerGame[]
  totalMin: number
  ppg: number
  rpg: number
  apg: number
  spg: number
  bpg: number
  tpg: number
  fgPct: number
  t3Pct: number
  ftPct: number
  gp: number
}

interface SynergyData {
  partners: { player: Player; avgPM: number; games: number }[]
  assistsGiven: { player: Player; count: number }[]
  assistsReceived: { player: Player; count: number }[]
}

interface ZoneEfgRow {
  key: "paint" | "mid-range" | "3pt"
  label: string
  attempts: number
  made: number
  efg: number
}

function parseMinutes(min: string | null): number {
  if (!min) return 0
  const parts = min.split(":")
  return parseInt(parts[0] || "0") + parseInt(parts[1] || "0") / 60
}

function buildProfiles(stats: StatsPlayerGame[]): PlayerProfile[] {
  const byPlayer = new Map<number, { player: Player; rows: StatsPlayerGame[] }>()

  for (const row of stats) {
    const player = (row as any).player as Player | undefined
    if (!player) continue
    if (!byPlayer.has(player.id)) byPlayer.set(player.id, { player, rows: [] })
    byPlayer.get(player.id)!.rows.push(row)
  }

  return Array.from(byPlayer.values()).map(({ player, rows }) => {
    const n = rows.length
    const sum = (fn: (s: StatsPlayerGame) => number) => rows.reduce((a, s) => a + fn(s), 0)

    const fgm = sum((s) => (s.t2_made ?? 0) + (s.t3_made ?? 0))
    const fga = sum((s) => (s.t2_att ?? 0) + (s.t3_att ?? 0))
    const t3m = sum((s) => s.t3_made ?? 0)
    const t3a = sum((s) => s.t3_att ?? 0)
    const ftm = sum((s) => s.ft_made ?? 0)
    const fta = sum((s) => s.ft_att ?? 0)

    return {
      player,
      rows,
      totalMin: sum((s) => parseMinutes(s.minutes)),
      ppg: sum((s) => s.points ?? 0) / n,
      rpg: sum((s) => s.reb_tot ?? 0) / n,
      apg: sum((s) => s.assists ?? 0) / n,
      spg: sum((s) => s.steals ?? 0) / n,
      bpg: sum((s) => s.blocks_for ?? 0) / n,
      tpg: sum((s) => s.turnovers ?? 0) / n,
      fgPct: fga > 0 ? (fgm / fga) * 100 : 0,
      t3Pct: t3a > 0 ? (t3m / t3a) * 100 : 0,
      ftPct: fta > 0 ? (ftm / fta) * 100 : 0,
      gp: n,
    }
  })
}

function zoneRowsForPlayer(shots: Shot[]): ZoneEfgRow[] {
  const zones: Array<{ key: "paint" | "mid-range" | "3pt"; label: string }> = [
    { key: "paint", label: "Pintura" },
    { key: "mid-range", label: "Media" },
    { key: "3pt", label: "Triple" },
  ]

  return zones.map(({ key, label }) => {
    const zoneShots = shots.filter((s) => s.zone === key)
    const attempts = zoneShots.length
    const made = zoneShots.filter((s) => s.made).length
    const weightedMade = zoneShots.reduce((acc, s) => {
      if (!s.made) return acc
      return acc + (key === "3pt" ? 1.5 : 1)
    }, 0)

    return {
      key,
      label,
      attempts,
      made,
      efg: attempts > 0 ? (weightedMade / attempts) * 100 : 0,
    }
  })
}

function BasicStatsTable({ rows }: { rows: StatsPlayerGame[] }) {
  const n = rows.length
  if (n === 0) return null

  const sum = (fn: (s: StatsPlayerGame) => number) => rows.reduce((a, s) => a + fn(s), 0)

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

  const columns = [
    { label: "GP", value: String(n) },
    { label: "MIN", value: (totMin / n).toFixed(1) },
    { label: "PTS", value: (totPts / n).toFixed(1), highlight: true },
    { label: "REB", value: (totReb / n).toFixed(1) },
    { label: "AST", value: (totAst / n).toFixed(1) },
    { label: "STL", value: (totStl / n).toFixed(1) },
    { label: "BLK", value: (totBlk / n).toFixed(1) },
    { label: "TOV", value: (totTov / n).toFixed(1) },
    { label: "%FG", value: `${fgPct}%` },
    { label: "%3P", value: `${t3Pct}%` },
    { label: "%FT", value: `${ftPct}%` },
  ]

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[680px] text-xs">
        <thead>
          <tr className="border-b border-border">
            {columns.map((column) => (
              <th
                key={column.label}
                className="px-3 py-2.5 text-center font-semibold uppercase tracking-wider text-muted-foreground"
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            {columns.map((column) => (
              <td
                key={column.label}
                className={`px-3 py-3 text-center tabular-nums font-semibold ${
                  column.highlight ? "text-primary text-base font-bold" : "text-foreground"
                }`}
              >
                {column.value}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  )
}

export function IndividualReportsTab({ opponentTeamId, opponentName }: Props) {
  const [allStats, setAllStats] = useState<StatsPlayerGame[]>([])
  const [allShots, setAllShots] = useState<Shot[]>([])
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)

  const [synergyByPlayer, setSynergyByPlayer] = useState<Record<number, SynergyData | null>>({})
  const [loadingSynergy, setLoadingSynergy] = useState(false)

  useEffect(() => {
    Promise.all([getOpponentPlayerStats(opponentTeamId), getTeamShots(opponentTeamId)]).then(
      ([stats, shots]) => {
        setAllStats(stats)
        setAllShots(shots)
        setLoading(false)
      },
    )
  }, [opponentTeamId])

  const profiles = useMemo(() => {
    return buildProfiles(allStats).sort((a, b) => b.totalMin - a.totalMin)
  }, [allStats])

  useEffect(() => {
    if (profiles.length > 0 && selectedPlayerId === null) {
      setSelectedPlayerId(profiles[0].player.id)
    }
  }, [profiles, selectedPlayerId])

  const selected = useMemo(
    () => profiles.find((p) => p.player.id === selectedPlayerId) ?? null,
    [profiles, selectedPlayerId],
  )

  const uniqueRecentGameIds = useMemo(() => {
    const gameMap = new Map<number, string>()
    for (const row of allStats) {
      const date = ((row as any).game?.date as string | null) ?? ""
      if (!gameMap.has(row.game_id)) gameMap.set(row.game_id, date)
    }
    return Array.from(gameMap.entries())
      .sort((a, b) => {
        if (a[1] && b[1]) return new Date(b[1]).getTime() - new Date(a[1]).getTime()
        return b[0] - a[0]
      })
      .slice(0, 3)
      .map(([id]) => id)
  }, [allStats])

  const inactivePlayerIds = useMemo(() => {
    const recentSet = new Set(uniqueRecentGameIds)
    const ids = new Set<number>()
    for (const profile of profiles) {
      const playedRecent = profile.rows.some((row) => recentSet.has(row.game_id))
      if (!playedRecent) ids.add(profile.player.id)
    }
    return ids
  }, [profiles, uniqueRecentGameIds])

  useEffect(() => {
    if (!selected) return
    if (synergyByPlayer[selected.player.id] !== undefined) return

    const gameIds = selected.rows.map((r) => r.game_id)
    setLoadingSynergy(true)

    getPlayerSynergyData(selected.player.id, opponentTeamId, gameIds).then((data) => {
      setSynergyByPlayer((prev) => ({ ...prev, [selected.player.id]: (data ?? null) as SynergyData | null }))
      setLoadingSynergy(false)
    })
  }, [selected, opponentTeamId, synergyByPlayer])

  const playerShots = useMemo(
    () => allShots.filter((shot) => shot.player_id === selectedPlayerId),
    [allShots, selectedPlayerId],
  )

  const chartShots = useMemo(
    () =>
      playerShots.map((shot) => ({
        x: shot.x_coord,
        y: shot.y_coord,
        made: shot.made,
        zone: shot.zone ?? undefined,
      })),
    [playerShots],
  )

  const zoneRows = useMemo(() => zoneRowsForPlayer(playerShots), [playerShots])

  const trendRows = useMemo(() => {
    if (!selected) return []

    return [...selected.rows]
      .sort((a, b) => {
        const da = ((a as any).game?.date as string | null) ?? ""
        const db = ((b as any).game?.date as string | null) ?? ""
        if (da && db) return new Date(da).getTime() - new Date(db).getTime()
        return a.game_id - b.game_id
      })
      .map((row, idx) => {
        const date = ((row as any).game?.date as string | null) ?? null
        return {
          name: date
            ? new Date(date).toLocaleDateString("es-ES", { day: "numeric", month: "short" })
            : `J${idx + 1}`,
          PTS: row.points ?? 0,
          PIR: row.valoracion ?? 0,
        }
      })
  }, [selected])

  const selectedSynergy = selected ? synergyByPlayer[selected.player.id] ?? null : null

  const defensiveSummary = useMemo(() => {
    if (!selected) return null

    const sorted = [...selected.rows].sort((a, b) => b.game_id - a.game_id)
    const last3 = sorted.slice(0, 3)

    const avg = (rows: StatsPlayerGame[], getter: (r: StatsPlayerGame) => number) => {
      if (rows.length === 0) return 0
      return rows.reduce((acc, row) => acc + getter(row), 0) / rows.length
    }

    const seasonFouls = avg(selected.rows, (r) => r.fouls_comm ?? 0)
    const seasonBlocks = avg(selected.rows, (r) => r.blocks_for ?? 0)
    const recentFouls = avg(last3, (r) => r.fouls_comm ?? 0)
    const recentBlocks = avg(last3, (r) => r.blocks_for ?? 0)

    return {
      seasonFouls,
      seasonBlocks,
      recentFouls,
      recentBlocks,
      foulsDelta: recentFouls - seasonFouls,
      blocksDelta: recentBlocks - seasonBlocks,
    }
  }, [selected])

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="h-80 animate-pulse rounded-xl bg-secondary" />
        <div className="h-80 animate-pulse rounded-xl bg-secondary lg:col-span-2" />
      </div>
    )
  }

  if (profiles.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card py-24">
        <User className="mb-3 h-10 w-10 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">Sin datos de jugadores para {opponentName}.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="relative">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center justify-between rounded-xl border border-border bg-card px-4 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-secondary/60"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
              {selected?.player.name
                .split(/\s+/)
                .map((word) => word[0])
                .join("")
                .toUpperCase()
                .slice(0, 2) ?? "??"}
            </div>
            <div className="text-left">
              <p className="text-sm font-bold text-foreground">{selected?.player.name ?? "Seleccionar jugador"}</p>
              <p className="text-xs text-muted-foreground">
                {selected
                  ? `${selected.ppg.toFixed(1)} PPG · ${selected.rpg.toFixed(1)} RPG · ${selected.apg.toFixed(1)} APG`
                  : "Elige un jugador del rival"}
              </p>
            </div>
          </div>
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
        </button>

        {open && (
          <div className="absolute z-20 mt-1 w-full rounded-xl border border-border bg-card shadow-xl">
            <div className="max-h-72 overflow-y-auto p-1">
              {profiles.map((profile) => {
                const inactive = inactivePlayerIds.has(profile.player.id)
                return (
                  <button
                    key={profile.player.id}
                    onClick={() => {
                      setSelectedPlayerId(profile.player.id)
                      setOpen(false)
                    }}
                    className={`flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-secondary ${
                      profile.player.id === selectedPlayerId ? "bg-primary/10" : ""
                    }`}
                  >
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary text-[10px] font-bold text-foreground">
                      {profile.player.name
                        .split(/\s+/)
                        .map((word) => word[0])
                        .join("")
                        .toUpperCase()
                        .slice(0, 2)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground">{profile.player.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {profile.ppg.toFixed(1)} PPG · {profile.rpg.toFixed(1)} REB · {profile.apg.toFixed(1)} AST · {profile.gp} PJ
                      </p>
                      {inactive && (
                        <p className="mt-1 text-[11px] font-semibold text-amber-400">
                          ⚠️ Posible Baja (3 partidos inactivo)
                        </p>
                      )}
                    </div>
                    {profile.player.id === selectedPlayerId && <div className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" />}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {selected && (
        <>
          {inactivePlayerIds.has(selected.player.id) && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
              <div className="flex items-center gap-2 text-amber-400">
                <AlertTriangle className="h-4 w-4" />
                <p className="text-sm font-semibold">⚠️ Posible Baja (3 partidos inactivo)</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
            <div className="rounded-xl border border-border bg-card p-5 lg:col-span-3">
              <div className="mb-4 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                <h3 className="font-display text-base font-bold text-foreground">Rendimiento por Partido</h3>
              </div>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendRows}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="name" tick={{ fill: "hsl(215,15%,55%)", fontSize: 11 }} axisLine={{ stroke: "rgba(255,255,255,0.1)" }} />
                    <YAxis tick={{ fill: "hsl(215,15%,55%)", fontSize: 11 }} axisLine={{ stroke: "rgba(255,255,255,0.1)" }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(220,20%,14%)",
                        border: "1px solid hsl(220,15%,22%)",
                        borderRadius: 10,
                        fontSize: 12,
                      }}
                    />
                    <Legend
                      verticalAlign="top"
                      height={34}
                      formatter={(value) => (
                        <span className="text-xs font-semibold text-muted-foreground">{value}</span>
                      )}
                    />
                    <Line type="monotone" dataKey="PIR" stroke="hsl(262, 83%, 58%)" strokeWidth={2.5} dot={{ fill: "hsl(262, 83%, 58%)", r: 3 }} />
                    <Line type="monotone" dataKey="PTS" stroke="hsl(142, 71%, 45%)" strokeWidth={2.5} dot={{ fill: "hsl(142, 71%, 45%)", r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-5 lg:col-span-2">
              <div className="mb-4 flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" />
                <h3 className="font-display text-base font-bold text-foreground">Tendencia Defensiva</h3>
              </div>

              {defensiveSummary && (
                <div className="space-y-3">
                  <div className="rounded-lg bg-secondary/40 px-3 py-2">
                    <p className="text-xs text-muted-foreground">Faltas Cometidas</p>
                    <p className="text-lg font-bold text-foreground">{defensiveSummary.recentFouls.toFixed(1)}</p>
                    <p className={`text-xs ${defensiveSummary.foulsDelta > 0 ? "text-red-400" : "text-emerald-400"}`}>
                      Δ {defensiveSummary.foulsDelta >= 0 ? "+" : ""}
                      {defensiveSummary.foulsDelta.toFixed(1)} vs temporada
                    </p>
                  </div>

                  <div className="rounded-lg bg-secondary/40 px-3 py-2">
                    <p className="text-xs text-muted-foreground">Tapones</p>
                    <p className="text-lg font-bold text-foreground">{defensiveSummary.recentBlocks.toFixed(1)}</p>
                    <p className={`text-xs ${defensiveSummary.blocksDelta >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      Δ {defensiveSummary.blocksDelta >= 0 ? "+" : ""}
                      {defensiveSummary.blocksDelta.toFixed(1)} vs temporada
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <div className="mb-4 flex items-center gap-2">
              <TableProperties className="h-4 w-4 text-primary" />
              <h3 className="font-display text-base font-bold text-foreground">Tabla de Estadísticas Básicas</h3>
            </div>
            <BasicStatsTable rows={selected.rows} />
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <div className="mb-4 flex items-center gap-2">
              <GitBranch className="h-4 w-4 text-primary" />
              <h3 className="font-display text-base font-bold text-foreground">Mejores Socios (Synergy)</h3>
            </div>

            {loadingSynergy ? (
              <div className="h-28 animate-pulse rounded-lg bg-secondary" />
            ) : !selectedSynergy ? (
              <p className="text-sm text-muted-foreground">Sin datos de sinergia disponibles.</p>
            ) : (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Conexiones de asistencias</p>
                  {(selectedSynergy.assistsGiven ?? []).slice(0, 5).map((entry) => (
                    <div key={entry.player.id} className="flex items-center justify-between rounded-lg bg-secondary/35 px-3 py-2">
                      <span className="text-sm text-foreground">{entry.player.name}</span>
                      <span className="text-sm font-bold text-primary">{entry.count} AST</span>
                    </div>
                  ))}
                  {(selectedSynergy.assistsGiven ?? []).length === 0 && (
                    <p className="text-xs text-muted-foreground">Sin asistencias dadas detectables.</p>
                  )}
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">+/- compartido</p>
                  {(selectedSynergy.partners ?? []).slice(0, 5).map((entry) => (
                    <div key={entry.player.id} className="flex items-center justify-between rounded-lg bg-secondary/35 px-3 py-2">
                      <div>
                        <p className="text-sm text-foreground">{entry.player.name}</p>
                        <p className="text-[11px] text-muted-foreground">{entry.games} partidos juntos</p>
                      </div>
                      <span className={`text-sm font-bold ${entry.avgPM >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                        {entry.avgPM >= 0 ? "+" : ""}
                        {entry.avgPM.toFixed(1)}
                      </span>
                    </div>
                  ))}
                  {(selectedSynergy.partners ?? []).length === 0 && (
                    <p className="text-xs text-muted-foreground">Sin socios con muestra suficiente.</p>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-6">
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="mb-3 flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" />
                <h3 className="font-display text-base font-bold text-foreground">Shot Chart Individual</h3>
                <span className="ml-auto text-xs text-muted-foreground">{playerShots.length} tiros</span>
              </div>

              {playerShots.length === 0 ? (
                <div className="flex aspect-[15/14] items-center justify-center rounded-lg border border-border bg-secondary/20">
                  <p className="text-xs text-muted-foreground">Sin datos de tiro</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
                  <div className="lg:col-span-8">
                    <div className="mx-auto w-full max-w-[760px]">
                      <FibaShotChart shots={chartShots} className="w-full" />
                    </div>
                  </div>

                  <div className="lg:col-span-4">
                    <div className="rounded-lg border border-border bg-secondary/20 p-4">
                      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">eFG% por Zona</p>
                      <div className="space-y-3">
                        {zoneRows.map((zone) => (
                          <div key={zone.key} className="rounded-md bg-secondary/40 px-3 py-3">
                            <div className="flex items-center justify-between text-sm">
                              <span className="font-medium text-foreground">{zone.label}</span>
                              <span className="text-base font-bold text-foreground">{zone.efg.toFixed(1)}%</span>
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground">{zone.made}/{zone.attempts} · FGA {zone.attempts}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
