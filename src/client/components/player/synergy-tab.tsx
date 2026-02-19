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
} from "recharts"
import { Users, ArrowRight, GitBranch } from "lucide-react"
import { getPlayerSynergyData } from "@/lib/api"
import type { Player, StatsPlayerGame, Game } from "@/lib/types"

type GameRow = StatsPlayerGame & { game: Game }

interface Props {
  playerId: number
  teamId: number
  filteredGames: GameRow[]
}

interface SynergyData {
  partners: { player: Player; avgPM: number; games: number }[]
  assistsGiven: { player: Player; count: number }[]
  assistsReceived: { player: Player; count: number }[]
}

export function SynergyTab({ playerId, teamId, filteredGames }: Props) {
  const [data, setData] = useState<SynergyData | null>(null)
  const [loading, setLoading] = useState(true)

  const gameIds = filteredGames.map((g) => g.game_id)

  useEffect(() => {
    console.log(`[SynergyTab] Iniciando carga - Jugador: ${playerId}, Equipo: ${teamId}, Juegos: ${gameIds.length}`)
    setLoading(true)
    getPlayerSynergyData(
      playerId,
      teamId,
      gameIds.length > 0 ? gameIds : undefined,
    ).then((d) => {
      console.log(`[SynergyTab] Datos recibidos:`, d)
      setData(d)
      setLoading(false)
    }).catch(err => {
      console.error(`[SynergyTab] ❌ Error:`, err)
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
        No hay datos de sinergia disponibles
      </div>
    )
  }

  const top3Partners = data.partners.slice(0, 3)

  const getInitials = (name: string) =>
    name
      .split(/[\s,]+/)
      .filter(Boolean)
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* ── Best Partners Table ── */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 mb-5">
          <Users className="h-4 w-4 text-primary" />
          <div>
            <h3 className="font-display text-base font-bold text-foreground">
              Mejores Socios
            </h3>
            <p className="text-xs text-muted-foreground">
              Top 3 compañeros por Plus-Minus compartido
            </p>
          </div>
        </div>

        {top3Partners.length > 0 ? (
          <div className="space-y-3">
            {top3Partners.map((partner, idx) => (
              <div
                key={partner.player.id}
                className="flex items-center gap-4 rounded-lg border border-border bg-secondary/30 p-4"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20 text-sm font-bold text-primary">
                  {idx + 1}
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-xs font-bold text-muted-foreground">
                  {getInitials(partner.player.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">
                    {partner.player.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    #{partner.player.jersey_number ?? "?"} ·{" "}
                    {partner.games} partidos juntos
                  </p>
                </div>
                <div className="text-right">
                  <span
                    className={`font-display text-xl font-bold ${
                      partner.avgPM >= 0
                        ? "text-emerald-400"
                        : "text-red-400"
                    }`}
                  >
                    {partner.avgPM >= 0 ? "+" : ""}
                    {partner.avgPM.toFixed(1)}
                  </span>
                  <p className="text-[10px] text-muted-foreground">+/− avg</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
            Sin datos de socios disponibles
          </div>
        )}

        {/* Additional partners */}
        {data.partners.length > 3 && (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="pb-2 text-left font-semibold">Jugador</th>
                  <th className="pb-2 text-center font-semibold">GP</th>
                  <th className="pb-2 text-right font-semibold">+/−</th>
                </tr>
              </thead>
              <tbody>
                {data.partners.slice(3).map((p) => (
                  <tr
                    key={p.player.id}
                    className="border-b border-border/50 last:border-0"
                  >
                    <td className="py-2 text-foreground">
                      {p.player.name}
                    </td>
                    <td className="py-2 text-center text-muted-foreground">
                      {p.games}
                    </td>
                    <td
                      className={`py-2 text-right font-semibold ${
                        p.avgPM >= 0 ? "text-emerald-400" : "text-red-400"
                      }`}
                    >
                      {p.avgPM >= 0 ? "+" : ""}
                      {p.avgPM.toFixed(1)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Assist Network ── */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 mb-5">
          <GitBranch className="h-4 w-4 text-primary" />
          <div>
            <h3 className="font-display text-base font-bold text-foreground">
              Red de Asistencias
            </h3>
            <p className="text-xs text-muted-foreground">
              Conexiones de asistencias del jugador
            </p>
          </div>
        </div>

        <div className="space-y-6">
          {/* Assists Given */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-emerald-400 mb-3">
              <ArrowRight className="mr-1 inline h-3 w-3" />
              Top 5: Asistencias dadas
            </h4>
            <p className="text-[10px] text-muted-foreground mb-3">
              5 personas a las que más ha asistido
            </p>
            {data.assistsGiven.length > 0 ? (
              <div className="space-y-2">
                {data.assistsGiven.map((entry) => (
                  <div
                    key={entry.player.id}
                    className="flex items-center gap-3"
                  >
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-secondary text-[10px] font-bold text-muted-foreground">
                      {getInitials(entry.player.name)}
                    </div>
                    <span className="flex-1 text-xs text-foreground truncate">
                      {entry.player.name}
                    </span>
                    <div className="flex items-center gap-2">
                      <div className="h-2 rounded-full bg-emerald-500/30 overflow-hidden" style={{ width: 80 }}>
                        <div
                          className="h-full rounded-full bg-emerald-500"
                          style={{
                            width: `${
                              data.assistsGiven.length > 0
                                ? (entry.count / data.assistsGiven[0].count) *
                                  100
                                : 0
                            }%`,
                          }}
                        />
                      </div>
                      <span className="text-xs font-bold text-emerald-400 w-6 text-right">
                        {entry.count}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Sin datos</p>
            )}
          </div>

          <div className="border-t border-border" />

          {/* Assists Received */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-blue-400 mb-3">
              <ArrowRight className="mr-1 inline h-3 w-3 rotate-180" />
              Top 5: Asistencias recibidas
            </h4>
            <p className="text-[10px] text-muted-foreground mb-3">
              5 personas de las que más ha recibido asistencias
            </p>
            {data.assistsReceived.length > 0 ? (
              <div className="space-y-2">
                {data.assistsReceived.map((entry) => (
                  <div
                    key={entry.player.id}
                    className="flex items-center gap-3"
                  >
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-secondary text-[10px] font-bold text-muted-foreground">
                      {getInitials(entry.player.name)}
                    </div>
                    <span className="flex-1 text-xs text-foreground truncate">
                      {entry.player.name}
                    </span>
                    <div className="flex items-center gap-2">
                      <div className="h-2 rounded-full bg-blue-500/30 overflow-hidden" style={{ width: 80 }}>
                        <div
                          className="h-full rounded-full bg-blue-500"
                          style={{
                            width: `${
                              data.assistsReceived.length > 0
                                ? (entry.count /
                                    data.assistsReceived[0].count) *
                                  100
                                : 0
                            }%`,
                          }}
                        />
                      </div>
                      <span className="text-xs font-bold text-blue-400 w-6 text-right">
                        {entry.count}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Sin datos</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
