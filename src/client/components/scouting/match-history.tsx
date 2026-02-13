"use client"

import { useEffect, useState } from "react"
import { ArrowRight } from "lucide-react"
import { getHeadToHead } from "@/lib/api"
import type { Game } from "@/lib/types"

interface Props {
  myTeamId: number
  opponentTeamId: number
}

interface Row {
  date: string
  home: string
  away: string
  score: string
  isWin: boolean
  topPerformer: string
}

export function MatchHistory({ myTeamId, opponentTeamId }: Props) {
  const [rows, setRows] = useState<Row[]>([])

  useEffect(() => {
    getHeadToHead(myTeamId, opponentTeamId).then((games) => {
      setRows(
        games.map((g) => {
          const isHome = g.home_team_id === myTeamId
          const myScore = isHome ? g.home_score : g.away_score
          const oppScore = isHome ? g.away_score : g.home_score
          const won = (myScore ?? 0) > (oppScore ?? 0)

          return {
            date: g.date
              ? new Date(g.date).toLocaleDateString("es-ES", {
                  day: "numeric",
                  month: "short",
                })
              : "-",
            home: (g as any).home_team?.name ?? "?",
            away: (g as any).away_team?.name ?? "?",
            score: `${g.home_score ?? "?"}-${g.away_score ?? "?"}`,
            isWin: won,
            topPerformer: "", // can be extended later
          }
        }),
      )
    })
  }, [myTeamId, opponentTeamId])

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-bold text-foreground">
          Historial de Enfrentamientos
        </h2>
        <button className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
          Ver todos
          <ArrowRight className="h-3 w-3" />
        </button>
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <th className="pb-3 text-left">Fecha</th>
              <th className="pb-3 text-left">Partido</th>
              <th className="pb-3 text-center">Marcador</th>
              <th className="pb-3 text-center">Resultado</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((match, i) => (
              <tr
                key={i}
                className="border-b border-border/50 last:border-0"
              >
                <td className="py-3 text-muted-foreground">{match.date}</td>
                <td className="py-3">
                  <span className="font-medium text-foreground">
                    {match.home}
                  </span>
                  <span className="mx-2 text-muted-foreground">vs</span>
                  <span className="font-medium text-foreground">
                    {match.away}
                  </span>
                </td>
                <td className="py-3 text-center font-semibold text-foreground">
                  {match.score}
                </td>
                <td className="py-3 text-center">
                  <span
                    className={`inline-block rounded px-2 py-0.5 text-xs font-bold ${
                      match.isWin
                        ? "bg-chart-3/15 text-chart-3"
                        : "bg-destructive/15 text-destructive"
                    }`}
                  >
                    {match.isWin ? "V" : "D"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No hay enfrentamientos registrados.
          </p>
        )}
      </div>
    </div>
  )
}
