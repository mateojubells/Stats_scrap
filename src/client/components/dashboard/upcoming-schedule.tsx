"use client"

import { useAuth } from "@/lib/auth-context"
import { useEffect, useState } from "react"
import { getUpcomingGames } from "@/lib/api"
import type { Game } from "@/lib/types"
import Link from "next/link"
import { Calendar, Rocket } from "lucide-react"

export function UpcomingSchedule() {
  const { team } = useAuth()
  const [games, setGames] = useState<Game[]>([])

  useEffect(() => {
    if (!team) return
    getUpcomingGames(team.id, 5).then(setGames)
  }, [team])

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-base font-bold text-foreground">
          Próximos Partidos
        </h3>
        <Link
          href="/calendar"
          className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
        >
          <Calendar className="h-3 w-3" />
          Ver Completo
        </Link>
      </div>
      <div className="mt-3 flex flex-col gap-2">
        {games.map((g, idx) => {
          const isHome = g.home_team_id === team?.id
          const opp = isHome ? (g as any).away_team : (g as any).home_team
          const abbr = opp?.name?.substring(0, 3).toUpperCase() ?? "?"
          const dateParts = g.date
            ? new Date(g.date)
                .toLocaleDateString("es-ES", { day: "numeric", month: "short" })
                .split(" ")
            : ["?", "?"]
          const isNext = idx === 0
          const jornada = g.jornada ? `J${g.jornada}` : ""

          return (
            <div
              key={g.id}
              className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 ${
                isNext
                  ? "border-primary bg-primary/10"
                  : "border-border bg-secondary/30"
              }`}
            >
              <div className="text-center">
                <p className="text-[10px] font-semibold uppercase text-muted-foreground">
                  {dateParts[1] ?? ""}
                </p>
                <p className="font-display text-base font-bold text-foreground">
                  {dateParts[0] ?? "?"}
                </p>
              </div>
              <div className="flex h-7 items-center justify-center rounded px-2 text-xs font-bold bg-primary/15 text-primary">
                {abbr}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">
                  {isHome ? "vs " : "@ "}
                  {opp?.name ?? "?"}
                  {jornada && <span className="ml-2 text-xs text-muted-foreground">{jornada}</span>}
                </p>
                {g.date && (
                  <p className="text-xs text-muted-foreground">
                    {new Date(g.date).toLocaleTimeString("es-ES", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                )}
              </div>
              {isNext && (
                <Link
                  href={`/scouting?opponent=${isHome ? g.away_team_id : g.home_team_id}`}
                  className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  <Rocket className="h-3 w-3" />
                  Preparar
                </Link>
              )}
            </div>
          )
        })}
        {games.length === 0 && (
          <p className="py-4 text-center text-xs text-muted-foreground">
            Sin partidos pendientes
          </p>
        )}
      </div>
    </div>
  )
}
