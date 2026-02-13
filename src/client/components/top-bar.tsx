"use client"

import { Bell, Search, LogOut } from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { useEffect, useState } from "react"
import { getUpcomingGames, getTeamGames } from "@/lib/api"
import type { Game } from "@/lib/types"

export function TopBar() {
  const { team, profile, signOut } = useAuth()
  const [record, setRecord] = useState({ w: 0, l: 0 })
  const [nextGame, setNextGame] = useState<Game | null>(null)

  useEffect(() => {
    if (!team) return
    // Compute W/L record
    getTeamGames(team.id).then((games) => {
      let w = 0,
        l = 0
      for (const g of games) {
        const isHome = g.home_team_id === team.id
        const myScore = isHome ? g.home_score : g.away_score
        const oppScore = isHome ? g.away_score : g.home_score
        if (myScore != null && oppScore != null) {
          if (myScore > oppScore) w++
          else l++
        }
      }
      setRecord({ w, l })
    })
    // Next game
    getUpcomingGames(team.id, 1).then((g) => setNextGame(g[0] ?? null))
  }, [team])

  const abbr = team?.name?.substring(0, 3).toUpperCase() ?? "---"
  const opponentName = nextGame
    ? nextGame.home_team_id === team?.id
      ? nextGame.away_team?.name ?? "TBD"
      : nextGame.home_team?.name ?? "TBD"
    : null

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background/80 px-6 backdrop-blur-sm">
      <div className="flex items-center gap-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
          {abbr}
        </div>
        <div>
          <h1 className="font-display text-base font-bold text-foreground">
            {team?.name ?? "Cargando…"}
          </h1>
          <p className="text-xs text-muted-foreground">
            Record:{" "}
            <span className="font-semibold text-foreground">
              {record.w}-{record.l}
            </span>
          </p>
        </div>
        {nextGame && opponentName && (
          <div className="ml-4 flex items-center gap-2 rounded-full border border-primary/50 bg-primary/10 px-3 py-1.5">
            <span className="text-xs font-semibold text-primary">
              Próximo partido
            </span>
            <span className="text-xs text-muted-foreground">vs</span>
            <span className="text-sm font-semibold text-foreground">
              {opponentName}
            </span>
            {nextGame.date && (
              <span className="ml-1 rounded bg-accent/20 px-2 py-0.5 font-mono text-xs font-bold text-accent">
                {new Date(nextGame.date).toLocaleDateString("es-ES", {
                  day: "numeric",
                  month: "short",
                })}
              </span>
            )}
          </div>
        )}
      </div>
      <div className="flex items-center gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar jugador, stat, partido..."
            className="h-9 w-64 rounded-full border border-border bg-secondary pl-9 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <span className="text-xs text-muted-foreground">
          {profile?.display_name}
        </span>
        <button
          onClick={signOut}
          title="Cerrar sesión"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-muted-foreground hover:bg-secondary transition-colors"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  )
}
