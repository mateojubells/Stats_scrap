"use client"

import { useEffect, useState } from "react"
import { getPlayerGameLog } from "@/lib/api"
import type { StatsPlayerGame, Game } from "@/lib/types"
import { ArrowRight } from "lucide-react"

interface Props {
  playerId: number
  teamId: number
}

interface Row {
  date: string
  opponent: string
  result: string
  isWin: boolean
  min: string
  pts: number
  reb: number
  ast: number
  stl: number
  blk: number
  tov: number
  pf: number
}

export function GameLog({ playerId, teamId }: Props) {
  const [rows, setRows] = useState<Row[]>([])

  useEffect(() => {
    getPlayerGameLog(playerId, teamId).then((stats) => {
      setRows(
        stats.map((s: any) => {
          const g: Game = s.game
          const isHome = g.home_team_id === teamId
          const myScore = isHome ? g.home_score : g.away_score
          const oppScore = isHome ? g.away_score : g.home_score
          const opp = isHome ? g.away_team : g.home_team
          const won = (myScore ?? 0) > (oppScore ?? 0)

          return {
            date: g.date
              ? new Date(g.date).toLocaleDateString("es-ES", {
                  day: "numeric",
                  month: "short",
                })
              : "-",
            opponent: `${isHome ? "vs" : "@"} ${opp?.name ?? "?"}`,
            result: `${won ? "V" : "D"} ${myScore ?? "?"}-${oppScore ?? "?"}`,
            isWin: won,
            min: s.minutes ?? "-",
            pts: s.points ?? 0,
            reb: s.reb_tot ?? 0,
            ast: s.assists ?? 0,
            stl: s.steals ?? 0,
            blk: s.blocks_for ?? 0,
            tov: s.turnovers ?? 0,
            pf: s.fouls_comm ?? 0,
          }
        }),
      )
    })
  }, [playerId, teamId])

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-bold text-foreground">
          Historial de Partidos
        </h2>
        <button className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
          Ver todo
          <ArrowRight className="h-3 w-3" />
        </button>
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <th className="pb-3 text-left">Fecha</th>
              <th className="pb-3 text-left">Rival</th>
              <th className="pb-3 text-left">Resultado</th>
              <th className="pb-3 text-center">MIN</th>
              <th className="pb-3 text-center font-bold text-primary">PTS</th>
              <th className="pb-3 text-center">REB</th>
              <th className="pb-3 text-center">AST</th>
              <th className="pb-3 text-center">STL</th>
              <th className="pb-3 text-center">BLK</th>
              <th className="pb-3 text-center">TOV</th>
              <th className="pb-3 text-center">PF</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((game, i) => (
              <tr
                key={i}
                className="border-b border-border/50 last:border-0"
              >
                <td className="py-3 text-muted-foreground">{game.date}</td>
                <td className="py-3 text-primary">{game.opponent}</td>
                <td className="py-3">
                  <span
                    className={`font-semibold ${
                      game.isWin ? "text-chart-3" : "text-destructive"
                    }`}
                  >
                    {game.result}
                  </span>
                </td>
                <td className="py-3 text-center text-muted-foreground">
                  {game.min}
                </td>
                <td className="py-3 text-center font-bold text-primary">
                  {game.pts}
                </td>
                <td className="py-3 text-center text-muted-foreground">
                  {game.reb}
                </td>
                <td className="py-3 text-center text-muted-foreground">
                  {game.ast}
                </td>
                <td className="py-3 text-center text-muted-foreground">
                  {game.stl}
                </td>
                <td className="py-3 text-center text-muted-foreground">
                  {game.blk}
                </td>
                <td className="py-3 text-center text-muted-foreground">
                  {game.tov}
                </td>
                <td className="py-3 text-center text-muted-foreground">
                  {game.pf}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Sin partidos registrados para este jugador.
          </p>
        )}
      </div>
    </div>
  )
}
