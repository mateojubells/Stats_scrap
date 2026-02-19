"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { DashboardLayout } from "@/components/dashboard-layout"
import { useAuth } from "@/lib/auth-context"
import { getTeamGames } from "@/lib/api"
import type { Game } from "@/lib/types"
import { Tv2, ChevronRight, MapPin, Calendar } from "lucide-react"

export default function GameCenterPage() {
  const { team } = useAuth()
  const [games, setGames] = useState<Game[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!team) return
    getTeamGames(team.id).then((g) => {
      setGames(g)
      setLoading(false)
    })
  }, [team])

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
          <Tv2 className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="font-display text-xl font-bold text-foreground">
            Game Center
          </h1>
          <p className="text-sm text-muted-foreground">
            Análisis detallado de partidos disputados
          </p>
        </div>
      </div>

      {/* Games List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : games.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card py-20">
          <Tv2 className="mb-3 h-10 w-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            No hay partidos disputados aún.
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {games.map((game) => {
            const isHome = game.home_team_id === team!.id
            const myScore = isHome ? game.home_score : game.away_score
            const oppScore = isHome ? game.away_score : game.home_score
            const won = (myScore ?? 0) > (oppScore ?? 0)
            const opponent = isHome ? game.away_team : game.home_team
            const dateStr = game.date
              ? new Date(game.date).toLocaleDateString("es-ES", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })
              : "—"

            return (
              <Link key={game.id} href={`/game-center/${game.id}`}>
                <div className="group flex items-center justify-between rounded-xl border border-border bg-card px-5 py-4 transition-colors hover:border-primary/40 hover:bg-secondary/50">
                  {/* Left: Date + Location */}
                  <div className="flex items-center gap-5">
                    <div className="flex flex-col items-center gap-0.5">
                      <span className="text-xs font-medium text-muted-foreground">
                        {game.jornada ? `J${game.jornada}` : "—"}
                      </span>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {dateStr}
                      </div>
                    </div>

                    {/* Teams + Score */}
                    <div className="flex items-center gap-4">
                      {/* Our Team */}
                      <div className="flex items-center gap-2">
                        {team?.logo_url ? (
                          <img
                            src={team.logo_url}
                            alt={team.name}
                            className="h-8 w-8 rounded-full object-cover"
                          />
                        ) : (
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary">
                            {team?.name?.substring(0, 3).toUpperCase()}
                          </div>
                        )}
                        <span className="text-sm font-semibold text-foreground">
                          {team?.name}
                        </span>
                      </div>

                      {/* Score */}
                      <div className="flex items-center gap-2">
                        <span
                          className={`font-display text-xl font-bold ${
                            won ? "text-emerald-400" : "text-red-400"
                          }`}
                        >
                          {myScore ?? 0}
                        </span>
                        <span className="text-sm text-muted-foreground">-</span>
                        <span
                          className={`font-display text-xl font-bold ${
                            !won ? "text-emerald-400" : "text-red-400"
                          }`}
                        >
                          {oppScore ?? 0}
                        </span>
                      </div>

                      {/* Opponent */}
                      <div className="flex items-center gap-2">
                        {opponent?.logo_url ? (
                          <img
                            src={opponent.logo_url}
                            alt={opponent.name}
                            className="h-8 w-8 rounded-full object-cover"
                          />
                        ) : (
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-xs font-bold text-muted-foreground">
                            {opponent?.name?.substring(0, 3).toUpperCase()}
                          </div>
                        )}
                        <span className="text-sm font-medium text-muted-foreground">
                          {opponent?.name ?? "TBD"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Result badge + arrow */}
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3" />
                      {isHome ? "Local" : "Visitante"}
                    </div>
                    <span
                      className={`rounded-md px-2.5 py-1 text-xs font-bold ${
                        won
                          ? "bg-emerald-500/15 text-emerald-400"
                          : "bg-red-500/15 text-red-400"
                      }`}
                    >
                      {won ? "W" : "L"}
                    </span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </DashboardLayout>
  )
}
