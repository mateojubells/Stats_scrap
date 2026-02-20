"use client"

import { useEffect, useState, useMemo } from "react"
import {
  ArrowRight,
  TrendingUp,
  Flame,
  AlertTriangle,
  Shield,
  Activity,
  Users,
  Handshake,
} from "lucide-react"
import {
  getOpponentPlayerStats,
  getTeamAssistPairs,
  getTeamBestPlusMinus,
} from "@/lib/api"
import { TacticalWhiteboard } from "./tactical-whiteboard"
import type { Player, StatsPlayerGame } from "@/lib/types"

interface Props {
  opponentTeamId: number
  opponentName: string
  myTeamId: number
  myTeamName: string
}

interface AssistDuo {
  assister: Player
  scorer: Player
  count: number
}

interface PlusMinusDuo {
  playerA: Player
  playerB: Player
  avgSharedPM: number
  games: number
}

interface PlayerCard {
  name: string
  initials: string
  statLine: string
  subStat: string
  trend?: number
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((w: string) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

function avg(arr: number[]) {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0
}

function buildProfiles(stats: StatsPlayerGame[]) {
  const byPlayer = new Map<number, { player: Player; rows: StatsPlayerGame[] }>()
  for (const s of stats) {
    const p = (s as any).player as Player | undefined
    if (!p) continue
    if (!byPlayer.has(p.id)) byPlayer.set(p.id, { player: p, rows: [] })
    byPlayer.get(p.id)!.rows.push(s)
  }
  return byPlayer
}

function PlayerCardUI({
  player,
  color,
}: {
  player: PlayerCard
  color: "red" | "orange" | "blue" | "purple"
}) {
  const palette = {
    red: {
      border: "border-red-500/20",
      bg: "bg-red-500/5",
      circle: "border-red-500/40 bg-red-500/10 text-red-400",
    },
    orange: {
      border: "border-orange-500/20",
      bg: "bg-orange-500/5",
      circle: "border-orange-500/40 bg-orange-500/10 text-orange-400",
    },
    blue: {
      border: "border-blue-500/20",
      bg: "bg-blue-500/5",
      circle: "border-blue-500/40 bg-blue-500/10 text-blue-400",
    },
    purple: {
      border: "border-purple-500/20",
      bg: "bg-purple-500/5",
      circle: "border-purple-500/40 bg-purple-500/10 text-purple-400",
    },
  }
  const c = palette[color]
  return (
    <div className={`flex items-center gap-3 rounded-lg border ${c.border} ${c.bg} p-3`}>
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 ${c.circle} text-sm font-bold`}
      >
        {player.initials}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-foreground">{player.name}</p>
        <p className="text-xs text-muted-foreground">{player.subStat}</p>
      </div>
      <div className="text-right">
        <p className="text-sm font-bold text-foreground">{player.statLine}</p>
        {player.trend !== undefined && (
          <p
            className={`text-xs font-semibold ${player.trend >= 0 ? "text-green-400" : "text-red-400"}`}
          >
            {player.trend >= 0 ? "↑" : "↓"} últimos 3
          </p>
        )}
      </div>
    </div>
  )
}

export function SynergiesTab({
  opponentTeamId,
  opponentName,
  myTeamId,
  myTeamName,
}: Props) {
  const [allStats, setAllStats] = useState<StatsPlayerGame[]>([])
  const [assistDuos, setAssistDuos] = useState<AssistDuo[]>([])
  const [pmDuos, setPmDuos] = useState<PlusMinusDuo[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      getOpponentPlayerStats(opponentTeamId),
      getTeamAssistPairs(opponentTeamId),
      getTeamBestPlusMinus(opponentTeamId),
    ]).then(([stats, assists, pm]) => {
      setAllStats(stats)
      setAssistDuos(assists as AssistDuo[])
      setPmDuos(pm as PlusMinusDuo[])
      setLoading(false)
    })
  }, [opponentTeamId])

  /* ── Hot Players (Últimos 3 partidos vs temporada) ── */
  const hotPlayers = useMemo((): PlayerCard[] => {
    const profiles = buildProfiles(allStats)
    return Array.from(profiles.values())
      .map(({ player, rows }) => {
        const sorted = [...rows].sort((a, b) => (b.game_id ?? 0) - (a.game_id ?? 0))
        const last3 = sorted.slice(0, 3)
        const last3ppg = avg(last3.map((r) => r.points ?? 0))
        const seasonPpg = avg(rows.map((r) => r.points ?? 0))
        const trend = last3ppg - seasonPpg
        return {
          name: player.name,
          initials: initials(player.name),
          statLine: `${last3ppg.toFixed(1)} PPG`,
          subStat: `Temporada: ${seasonPpg.toFixed(1)} PPG · ${rows.length} PJ`,
          trend,
          _last3ppg: last3ppg,
        }
      })
      .filter((p) => p._last3ppg > 0)
      .sort((a, b) => b._last3ppg - a._last3ppg)
      .slice(0, 3)
      .map(({ _last3ppg: _, ...rest }) => rest)
  }, [allStats])

  /* ── Foul Drawers ── */
  const foulDrawers = useMemo((): PlayerCard[] => {
    const profiles = buildProfiles(allStats)
    return Array.from(profiles.values())
      .map(({ player, rows }) => {
        const n = rows.length
        const foulsPg = avg(rows.map((r) => r.fouls_rec ?? 0))
        const ftaPg = avg(rows.map((r) => r.ft_att ?? 0))
        return {
          name: player.name,
          initials: initials(player.name),
          statLine: `${foulsPg.toFixed(1)} faltas rec/g`,
          subStat: `${ftaPg.toFixed(1)} TL intentados/g · ${n} PJ`,
          _foulsPg: foulsPg,
        }
      })
      .filter((p) => p._foulsPg > 0)
      .sort((a, b) => b._foulsPg - a._foulsPg)
      .slice(0, 3)
      .map(({ _foulsPg: _, ...rest }) => rest)
  }, [allStats])

  /* ── Defensive Stoppers ── */
  const defensiveStoppers = useMemo((): PlayerCard[] => {
    const profiles = buildProfiles(allStats)
    return Array.from(profiles.values())
      .map(({ player, rows }) => {
        const stlPg = avg(rows.map((r) => r.steals ?? 0))
        const blkPg = avg(rows.map((r) => r.blocks_for ?? 0))
        const combo = stlPg + blkPg
        return {
          name: player.name,
          initials: initials(player.name),
          statLine: `${combo.toFixed(1)} STL+BLK/g`,
          subStat: `${stlPg.toFixed(1)} robos · ${blkPg.toFixed(1)} tapones por partido`,
          _combo: combo,
        }
      })
      .filter((p) => p._combo > 0)
      .sort((a, b) => b._combo - a._combo)
      .slice(0, 3)
      .map(({ _combo: _, ...rest }) => rest)
  }, [allStats])

  /* ── High Usage ── */
  const highUsage = useMemo((): PlayerCard[] => {
    const profiles = buildProfiles(allStats)
    return Array.from(profiles.values())
      .map(({ player, rows }) => {
        const fgaPg = avg(rows.map((r) => (r.t2_att ?? 0) + (r.t3_att ?? 0)))
        const astPg = avg(rows.map((r) => r.assists ?? 0))
        const usage = fgaPg + astPg * 0.5
        return {
          name: player.name,
          initials: initials(player.name),
          statLine: `${fgaPg.toFixed(1)} FGA/g`,
          subStat: `${astPg.toFixed(1)} AST/g · uso proxy ${usage.toFixed(1)}`,
          _usage: usage,
        }
      })
      .filter((p) => p._usage > 0)
      .sort((a, b) => b._usage - a._usage)
      .slice(0, 3)
      .map(({ _usage: _, ...rest }) => rest)
  }, [allStats])

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="h-40 animate-pulse rounded-xl bg-secondary" />
        ))}
      </div>
    )
  }

  const empty = (label: string) => (
    <p className="text-sm text-muted-foreground">Sin datos de {label}.</p>
  )

  const topAssistDuo = assistDuos[0] ?? null
  const topPmDuo = pmDuos[0] ?? null

  return (
    <div className="flex flex-col gap-6">
      {/* ══ SECTION 1: Duos ══ */}
      <div>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-muted-foreground">
          <Handshake className="h-4 w-4" />
          Relaciones entre Jugadores
        </h2>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Assist Connection */}
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="mb-3 flex items-center gap-2">
              <ArrowRight className="h-4 w-4 text-green-400" />
              <h3 className="font-display text-base font-bold text-foreground">
                Conexión de Asistencias
              </h3>
              <span className="rounded-full bg-green-400/10 px-2 py-0.5 text-xs font-medium text-green-400">
                Top pareja
              </span>
            </div>

            {!topAssistDuo ? (
              empty("asistencias en el rival")
            ) : (
              <>
                <div className="flex items-center gap-3 rounded-lg border border-green-500/20 bg-green-500/5 p-4">
                  {/* Assister */}
                  <div className="flex flex-col items-center gap-1">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-green-400/40 bg-green-400/10 text-sm font-bold text-green-400">
                      {initials(topAssistDuo.assister.name)}
                    </div>
                    <p className="text-center text-[10px] text-muted-foreground">
                      {topAssistDuo.assister.name}
                    </p>
                  </div>

                  {/* Arrow + count */}
                  <div className="flex flex-1 flex-col items-center">
                    <div className="flex items-center gap-2">
                      <div className="h-px w-6 bg-green-400/40" />
                      <span className="rounded-full bg-green-400/20 px-2.5 py-1 text-sm font-bold text-green-400">
                        {topAssistDuo.count} AST
                      </span>
                      <div className="h-px w-6 bg-green-400/40" />
                    </div>
                    <ArrowRight className="mt-1 h-4 w-4 text-green-400/60" />
                  </div>

                  {/* Scorer */}
                  <div className="flex flex-col items-center gap-1">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-primary/40 bg-primary/10 text-sm font-bold text-primary">
                      {initials(topAssistDuo.scorer.name)}
                    </div>
                    <p className="text-center text-[10px] text-muted-foreground">
                      {topAssistDuo.scorer.name}
                    </p>
                  </div>
                </div>

                <p className="mt-3 text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">
                    {topAssistDuo.assister.name}
                  </span>{" "}
                  asistió{" "}
                  <span className="font-semibold text-green-400">
                    {topAssistDuo.count} veces
                  </span>{" "}
                  a{" "}
                  <span className="font-semibold text-foreground">
                    {topAssistDuo.scorer.name}
                  </span>
                  . Pareja de peligro en ataque.
                </p>

                {/* Secondary duos */}
                {assistDuos.length > 1 && (
                  <div className="mt-3 space-y-1">
                    {assistDuos.slice(1, 4).map((duo, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between rounded-md bg-secondary/40 px-3 py-1.5 text-xs"
                      >
                        <span className="text-muted-foreground">
                          {duo.assister.name} → {duo.scorer.name}
                        </span>
                        <span className="font-semibold text-foreground">
                          {duo.count} AST
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Impacto +/- Compartido */}
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="mb-3 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-blue-400" />
              <h3 className="font-display text-base font-bold text-foreground">
                Impacto Compartido (+/−)
              </h3>
              <span className="rounded-full bg-blue-400/10 px-2 py-0.5 text-xs font-medium text-blue-400">
                Mejor dupla
              </span>
            </div>

            {!topPmDuo ? (
              empty("plus/minus compartido")
            ) : (
              <>
                <div className="flex items-center gap-4 rounded-lg border border-blue-500/20 bg-blue-500/5 p-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-blue-400/40 bg-blue-400/10 text-sm font-bold text-blue-400">
                    {initials(topPmDuo.playerA.name)}
                  </div>
                  <div className="flex flex-1 flex-col items-center">
                    <div className="flex items-center gap-1">
                      <Users className="h-3 w-3 text-blue-400/60" />
                      <span className="text-lg font-bold text-blue-400">
                        {topPmDuo.avgSharedPM > 0 ? "+" : ""}
                        {topPmDuo.avgSharedPM}
                      </span>
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      +/− promedio ({topPmDuo.games} PJ juntos)
                    </span>
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-blue-400/40 bg-blue-400/10 text-sm font-bold text-blue-400">
                    {initials(topPmDuo.playerB.name)}
                  </div>
                </div>

                <p className="mt-3 text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">
                    {topPmDuo.playerA.name}
                  </span>{" "}
                  +{" "}
                  <span className="font-semibold text-foreground">
                    {topPmDuo.playerB.name}
                  </span>
                  : diferencial medio de{" "}
                  <span
                    className={`font-bold ${topPmDuo.avgSharedPM >= 0 ? "text-blue-400" : "text-red-400"}`}
                  >
                    {topPmDuo.avgSharedPM > 0 ? "+" : ""}
                    {topPmDuo.avgSharedPM}
                  </span>{" "}
                  por partido.
                </p>

                {pmDuos.length > 1 && (
                  <div className="mt-3 space-y-1">
                    {pmDuos.slice(1, 4).map((duo, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between rounded-md bg-secondary/40 px-3 py-1.5 text-xs"
                      >
                        <span className="text-muted-foreground">
                          {duo.playerA.name} + {duo.playerB.name}
                        </span>
                        <span
                          className={`font-semibold ${duo.avgSharedPM >= 0 ? "text-blue-400" : "text-red-400"}`}
                        >
                          {duo.avgSharedPM > 0 ? "+" : ""}
                          {duo.avgSharedPM} +/−
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* ══ SECTION 2: Tendencias Individuales ══ */}
      <div>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-muted-foreground">
          <Activity className="h-4 w-4" />
          Tendencias Individuales
        </h2>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Hot Players */}
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="mb-4 flex items-center gap-2">
              <Flame className="h-4 w-4 text-red-400" />
              <h3 className="font-display text-base font-bold text-foreground">
                Jugadores en Racha
              </h3>
              <span className="rounded-full bg-red-400/10 px-2 py-0.5 text-xs font-medium text-red-400">
                Últimos 3 partidos
              </span>
            </div>
            {hotPlayers.length === 0
              ? empty("jugadores en racha")
              : hotPlayers.map((p) => (
                  <div key={p.name} className="mb-2">
                    <PlayerCardUI player={p} color="red" />
                  </div>
                ))}
          </div>

          {/* Foul Drawers */}
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="mb-4 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-400" />
              <h3 className="font-display text-base font-bold text-foreground">
                Provocadores de Faltas
              </h3>
              <span className="rounded-full bg-orange-400/10 px-2 py-0.5 text-xs font-medium text-orange-400">
                Peligro de bonus
              </span>
            </div>
            {foulDrawers.length === 0
              ? empty("faltas recibidas")
              : foulDrawers.map((p) => (
                  <div key={p.name} className="mb-2">
                    <PlayerCardUI player={p} color="orange" />
                  </div>
                ))}
          </div>

          {/* Defensive Stoppers */}
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="mb-4 flex items-center gap-2">
              <Shield className="h-4 w-4 text-blue-400" />
              <h3 className="font-display text-base font-bold text-foreground">
                Defensores Destacados
              </h3>
              <span className="rounded-full bg-blue-400/10 px-2 py-0.5 text-xs font-medium text-blue-400">
                Robos + Tapones
              </span>
            </div>
            {defensiveStoppers.length === 0
              ? empty("defensores")
              : defensiveStoppers.map((p) => (
                  <div key={p.name} className="mb-2">
                    <PlayerCardUI player={p} color="blue" />
                  </div>
                ))}
          </div>

          {/* High Usage */}
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="mb-4 flex items-center gap-2">
              <Activity className="h-4 w-4 text-purple-400" />
              <h3 className="font-display text-base font-bold text-foreground">
                Alto Uso de Balón
              </h3>
              <span className="rounded-full bg-purple-400/10 px-2 py-0.5 text-xs font-medium text-purple-400">
                FGA + Asistencias
              </span>
            </div>
            {highUsage.length === 0
              ? empty("jugadores de alto uso")
              : highUsage.map((p) => (
                  <div key={p.name} className="mb-2">
                    <PlayerCardUI player={p} color="purple" />
                  </div>
                ))}
          </div>
        </div>
      </div>

      {/* ══ SECTION 3: Pizarra Táctica ══ */}
      <TacticalWhiteboard
        myTeamId={myTeamId}
        myTeamName={myTeamName}
        opponentTeamId={opponentTeamId}
        opponentName={opponentName}
      />
    </div>
  )
}
