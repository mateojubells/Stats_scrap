"use client"

import { useAuth } from "@/lib/auth-context"
import { useEffect, useState } from "react"
import { getTeamGames } from "@/lib/api"
import type { Game } from "@/lib/types"
import { BarChart3, ArrowRight } from "lucide-react"
import Link from "next/link"

interface Row {
  status: "WIN" | "LOSS"
  date: string
  opponent: string
  opponentAbbr: string
  result: string
  rebounds: string
  assists: string
}

export function RecentGames() {
  const { team } = useAuth()
  const [rows, setRows] = useState<Row[]>([])

  useEffect(() => {
    if (!team) return
    getTeamGames(team.id).then((games) => {
      setRows(
        games.slice(0, 8).map((g) => {
          const isHome = g.home_team_id === team.id
          const myScore = isHome ? g.home_score : g.away_score
          const oppScore = isHome ? g.away_score : g.home_score
          const won = (myScore ?? 0) > (oppScore ?? 0)
          const opp = isHome ? g.away_team : g.home_team
          return {
            status: won ? "WIN" : "LOSS",
            date: g.date
              ? new Date(g.date).toLocaleDateString("es-ES", {
                  day: "numeric",
                  month: "short",
                })
              : "-",
            opponent: `${isHome ? "vs" : "@"} ${opp?.name ?? "?"}`,
            opponentAbbr: opp?.name?.substring(0, 3).toUpperCase() ?? "?",
            result: `${myScore ?? "?"} - ${oppScore ?? "?"}`,
            rebounds: "-",
            assists: "-",
          }
        }),
      )
    })
  }, [team])

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-bold text-foreground">
          Últimos Partidos
        </h2>
        <Link href="/calendar" className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
          Ver calendario
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <th className="pb-3 text-left">Estado</th>
              <th className="pb-3 text-left">Fecha</th>
              <th className="pb-3 text-left">Rival</th>
              <th className="pb-3 text-left">Resultado</th>
              <th className="pb-3 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((game, i) => (
              <tr key={i} className="border-b border-border/50 last:border-0">
                <td className="py-3">
                  <span
                    className={`inline-block rounded px-2 py-0.5 text-xs font-bold ${
                      game.status === "WIN"
                        ? "bg-chart-3/15 text-chart-3"
                        : "bg-destructive/15 text-destructive"
                    }`}
                  >
                    {game.status === "WIN" ? "V" : "D"}
                  </span>
                </td>
                <td className="py-3 text-muted-foreground">{game.date}</td>
                <td className="py-3">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-5 items-center rounded px-1.5 text-[10px] font-bold bg-primary/15 text-primary">
                      {game.opponentAbbr}
                    </span>
                    <span className="font-medium text-foreground">
                      {game.opponent}
                    </span>
                  </div>
                </td>
                <td className="py-3 font-semibold text-foreground">
                  {game.result}
                </td>
                <td className="py-3 text-center">
                  <button className="text-muted-foreground hover:text-foreground transition-colors">
                    <BarChart3 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No hay partidos procesados aún.
          </p>
        )}
      </div>
    </div>
  )
}
