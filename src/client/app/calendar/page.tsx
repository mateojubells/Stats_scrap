"use client"

import { useEffect, useState } from "react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { useAuth } from "@/lib/auth-context"
import { getTeamGames, getUpcomingGames } from "@/lib/api"
import type { Game } from "@/lib/types"
import { Calendar as CalendarIcon, MapPin } from "lucide-react"

export default function CalendarPage() {
  const { team } = useAuth()
  const [upcoming, setUpcoming] = useState<Game[]>([])
  const [past, setPast] = useState<Game[]>([])

  useEffect(() => {
    if (!team) return
    Promise.all([
      getUpcomingGames(team.id, 50),
      getTeamGames(team.id),
    ]).then(([u, all]) => {
      setUpcoming(u)
      setPast(all.slice(0, 20))
    })
  }, [team])

  const renderGame = (g: Game, isPast: boolean) => {
    const isHome = g.home_team_id === team?.id
    const opp = isHome ? (g as any).away_team : (g as any).home_team
    const myScore = isHome ? g.home_score : g.away_score
    const oppScore = isHome ? g.away_score : g.home_score
    const won = myScore != null && oppScore != null && myScore > oppScore

    return (
      <div
        key={g.id}
        className="flex items-center gap-4 rounded-lg border border-border bg-card p-4"
      >
        <div className="text-center">
          <p className="text-xs font-semibold uppercase text-muted-foreground">
            {g.date
              ? new Date(g.date).toLocaleDateString("es-ES", { month: "short" })
              : "?"}
          </p>
          <p className="font-display text-2xl font-bold text-foreground">
            {g.date
              ? new Date(g.date).toLocaleDateString("es-ES", { day: "numeric" })
              : "?"}
          </p>
        </div>

        <div className="flex-1">
          <div className="flex items-center gap-2">
            <MapPin className="h-3 w-3 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">
              {isHome ? "vs " : "@ "}
              <span className="font-bold">{opp?.name ?? "?"}</span>
            </p>
          </div>
          {g.date && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              {new Date(g.date).toLocaleTimeString("es-ES", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          )}
        </div>

        {isPast && myScore != null ? (
          <div className="text-right">
            <p
              className={`text-lg font-bold ${
                won ? "text-chart-3" : "text-destructive"
              }`}
            >
              {won ? "V" : "D"}
            </p>
            <p className="text-sm font-semibold text-foreground">
              {myScore}-{oppScore}
            </p>
          </div>
        ) : (
          <div className="rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary">
            Pendiente
          </div>
        )}
      </div>
    )
  }

  return (
    <DashboardLayout>
      <div className="flex items-center gap-3">
        <CalendarIcon className="h-6 w-6 text-primary" />
        <h1 className="font-display text-2xl font-bold text-foreground">
          Calendario Completo
        </h1>
      </div>

      {/* Próximos Partidos */}
      <div className="mt-6">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-muted-foreground">
          Próximos Partidos
        </h2>
        {upcoming.length > 0 ? (
          <div className="grid gap-3">
            {upcoming.map((g) => renderGame(g, false))}
          </div>
        ) : (
          <p className="rounded-lg border border-border bg-card p-6 text-center text-sm text-muted-foreground">
            No hay partidos pendientes
          </p>
        )}
      </div>

      {/* Partidos Pasados */}
      <div className="mt-8">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-muted-foreground">
          Últimos Partidos
        </h2>
        {past.length > 0 ? (
          <div className="grid gap-3">
            {past.map((g) => renderGame(g, true))}
          </div>
        ) : (
          <p className="rounded-lg border border-border bg-card p-6 text-center text-sm text-muted-foreground">
            No hay partidos jugados
          </p>
        )}
      </div>
    </DashboardLayout>
  )
}
