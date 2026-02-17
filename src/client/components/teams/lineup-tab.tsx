"use client"

import { useEffect, useState } from "react"
import { getTeamLineups, getPlayerOnOffImpact } from "@/lib/api"
import type { Player } from "@/lib/types"
import { Users, Clock, TrendingUp, TrendingDown, Minus, Shield, Target, Zap, Trophy, Heart } from "lucide-react"

interface LineupData {
  playerIds: number[]
  players: Player[]
  minutes: number
  ptsFor: number
  ptsAgainst: number
  stints: number
  netRating: number
  badges?: string[]
}

interface OnOffData {
  player: Player
  gp: number
  avgMinutes: string
  avgPts: string
  onCourtPlusMinus: string
  offCourtPlusMinus: string
}

interface LineupTabProps {
  teamId: number
}

export function LineupTab({ teamId }: LineupTabProps) {
  const [lineups, setLineups] = useState<LineupData[]>([])
  const [onOff, setOnOff] = useState<OnOffData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [lineupsData, onOffData] = await Promise.all([
        getTeamLineups(teamId),
        getPlayerOnOffImpact(teamId),
      ])
      setLineups(lineupsData as LineupData[])
      setOnOff(onOffData as OnOffData[])
      setLoading(false)
    }
    load()
  }, [teamId])

  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-32 animate-pulse rounded-xl border border-border bg-card"
          />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Lineup Table */}
      <div className="rounded-xl border border-border bg-card">
        <div className="border-b border-border p-5">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            <h3 className="font-display text-sm font-bold text-foreground">
              Mejores Quintetos
            </h3>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Combinaciones de 5 jugadores con más minutos juntos en pista
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-5 py-3 text-left">#</th>
                <th className="px-5 py-3 text-left">Quinteto</th>
                <th className="px-5 py-3 text-right cursor-help" title="Minutos jugados juntos por este quinteto">Min</th>
                <th className="px-5 py-3 text-right cursor-help" title="Puntos a Favor - Puntos anotados mientras este quinteto estaba en pista">PF</th>
                <th className="px-5 py-3 text-right cursor-help" title="Puntos en Contra - Puntos recibidos mientras este quinteto estaba en pista">PC</th>
                <th className="px-5 py-3 text-right cursor-help" title="Rating Neto - Diferencia entre puntos a favor y en contra (PF - PC)">Net +/−</th>
              </tr>
            </thead>
            <tbody>
              {lineups.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-5 py-8 text-center text-muted-foreground"
                  >
                    No hay datos de quintetos disponibles. Se requieren datos de
                    sustituciones en el PBP.
                  </td>
                </tr>
              ) : (
                lineups.map((lineup, idx) => {
                  const net = lineup.netRating
                  return (
                    <tr
                      key={idx}
                      className="border-b border-border/50 transition-colors hover:bg-secondary/30"
                    >
                      <td className="px-5 py-3 text-muted-foreground">
                        {idx + 1}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex flex-col gap-2">
                          <div className="flex flex-wrap gap-1">
                            {lineup.players.map((p) => (
                              <span
                                key={p.id}
                                className="rounded-md bg-secondary px-2 py-0.5 text-xs font-medium text-foreground"
                              >
                                {p.jersey_number
                                  ? `#${p.jersey_number} `
                                  : ""}
                                {p.name.split(" ").slice(-1)[0]}
                              </span>
                            ))}
                          </div>
                          {/* Badges */}
                          {lineup.badges && lineup.badges.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {lineup.badges.map((badge, i) => (
                                <span
                                  key={i}
                                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${getBadgeStyle(badge)}`}
                                  title={getBadgeDescription(badge)}
                                >
                                  {getBadgeIcon(badge)}
                                  {badge}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3 text-right font-mono text-foreground">
                        {lineup.minutes.toFixed(1)}
                      </td>
                      <td className="px-5 py-3 text-right font-mono text-foreground">
                        {lineup.ptsFor}
                      </td>
                      <td className="px-5 py-3 text-right font-mono text-foreground">
                        {lineup.ptsAgainst}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <span
                          className={`inline-flex items-center gap-1 font-mono font-semibold ${
                            net > 0
                              ? "text-emerald-400"
                              : net < 0
                                ? "text-destructive"
                                : "text-muted-foreground"
                          }`}
                        >
                          {net > 0 ? (
                            <TrendingUp className="h-3 w-3" />
                          ) : net < 0 ? (
                            <TrendingDown className="h-3 w-3" />
                          ) : (
                            <Minus className="h-3 w-3" />
                          )}
                          {net > 0 ? "+" : ""}
                          {net}
                        </span>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* On/Off Impact */}
      <div className="rounded-xl border border-border bg-card">
        <div className="border-b border-border p-5">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            <h3 className="font-display text-sm font-bold text-foreground">
              Impacto On/Off Court
            </h3>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Rendimiento del equipo con cada jugador en pista vs. en el banquillo. Un valor positivo indica que el equipo juega mejor con ese jugador en cancha.
          </p>
        </div>

        <div className="p-5">
          <div className="space-y-3">
            {onOff.slice(0, 10).map((item) => {
              const onVal = Number(item.onCourtPlusMinus)
              const offVal = Number(item.offCourtPlusMinus)
              const diff = onVal - offVal

              // Normalize for visual bar
              const maxAbsDiff = Math.max(
                ...onOff.map((o) =>
                  Math.abs(
                    Number(o.onCourtPlusMinus) -
                      Number(o.offCourtPlusMinus),
                  ),
                ),
                1,
              )
              const barWidth = Math.abs(diff) / maxAbsDiff
              const isPositive = diff >= 0

              return (
                <div
                  key={item.player.id}
                  className="flex items-center gap-4 rounded-lg p-2 transition-colors hover:bg-secondary/30"
                >
                  {/* Player info */}
                  <div className="flex w-44 shrink-0 items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-xs font-bold text-foreground">
                      {item.player.jersey_number ?? "?"}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        {item.player.name}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {item.avgMinutes} min · {item.avgPts} pts
                      </p>
                    </div>
                  </div>

                  {/* Visual bar */}
                  <div className="flex flex-1 items-center gap-2">
                    {/* Off court half */}
                    <div className="flex w-1/2 justify-end">
                      {!isPositive && (
                        <div
                          className="h-5 rounded-l-sm bg-destructive/60 transition-all duration-500"
                          style={{
                            width: `${barWidth * 100}%`,
                          }}
                        />
                      )}
                    </div>
                    {/* Center line */}
                    <div className="h-8 w-px bg-border" />
                    {/* On court half */}
                    <div className="flex w-1/2">
                      {isPositive && (
                        <div
                          className="h-5 rounded-r-sm bg-emerald-500/60 transition-all duration-500"
                          style={{
                            width: `${barWidth * 100}%`,
                          }}
                        />
                      )}
                    </div>
                  </div>

                  {/* Values */}
                  <div className="flex w-32 shrink-0 items-center gap-3 text-xs font-mono">
                    <span
                      className={
                        onVal >= 0 ? "text-emerald-400" : "text-destructive"
                      }
                      title={`Plus/Minus cuando el jugador está EN pista: ${item.onCourtPlusMinus} puntos de diferencia promedio`}
                    >
                      ON: {onVal > 0 ? "+" : ""}
                      {item.onCourtPlusMinus}
                    </span>
                    <span
                      className={
                        offVal >= 0 ? "text-emerald-400" : "text-destructive"
                      }
                      title={`Plus/Minus cuando el jugador está FUERA (en banquillo): ${item.offCourtPlusMinus} puntos de diferencia promedio`}
                    >
                      OFF: {offVal > 0 ? "+" : ""}
                      {item.offCourtPlusMinus}
                    </span>
                  </div>
                </div>
              )
            })}

            {onOff.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No hay datos de impacto disponibles
              </p>
            )}
          </div>

          {/* Legend */}
          <div className="mt-4 flex items-center justify-center gap-6 text-[10px] text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <div className="h-3 w-3 rounded-sm bg-destructive/60" />
              <span>Equipo peor con él en pista</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-3 w-3 rounded-sm bg-emerald-500/60" />
              <span>Equipo mejor con él en pista</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Badge Helper Functions ── */

function getBadgeStyle(badge: string): string {
  switch (badge) {
    case "Quinteto de Gala":
      return "bg-amber-500/20 text-amber-400 border border-amber-500/30"
    case "Muro Defensivo":
      return "bg-blue-500/20 text-blue-400 border border-blue-500/30"
    case "Francotiradores":
      return "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
    case "Dominio":
      return "bg-purple-500/20 text-purple-400 border border-purple-500/30"
    case "Química":
      return "bg-pink-500/20 text-pink-400 border border-pink-500/30"
    default:
      return "bg-secondary text-muted-foreground"
  }
}

function getBadgeIcon(badge: string) {
  const iconClass = "h-3 w-3"
  switch (badge) {
    case "Quinteto de Gala":
      return <Trophy className={iconClass} />
    case "Muro Defensivo":
      return <Shield className={iconClass} />
    case "Francotiradores":
      return <Target className={iconClass} />
    case "Dominio":
      return <Zap className={iconClass} />
    case "Química":
      return <Heart className={iconClass} />
    default:
      return null
  }
}

function getBadgeDescription(badge: string): string {
  switch (badge) {
    case "Quinteto de Gala":
      return "Este quinteto ha jugado más minutos juntos que cualquier otro"
    case "Muro Defensivo":
      return "Este quinteto tiene el menor ratio de puntos recibidos por minuto"
    case "Francotiradores":
      return "Este quinteto tiene el mayor ratio de puntos anotados por minuto"
    case "Dominio":
      return "Este quinteto tiene el mejor diferencial neto (Net Rating)"
    case "Química":
      return "Este quinteto ha jugado juntos en más partidos/stints diferentes"
    default:
      return ""
  }
}
