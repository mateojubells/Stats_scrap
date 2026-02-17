"use client"

import { useEffect, useState } from "react"
import { getTeamPlayers, getPlayerSeasonStats, computePlayerAverages } from "@/lib/api"
import type { Player, StatsPlayerGame } from "@/lib/types"
import { User, ArrowRight, Hash, BarChart2 } from "lucide-react"
import Link from "next/link"

interface PlayerWithStats extends Player {
  ppg?: string
  rpg?: string
  apg?: string
  gp?: number
}

interface RosterTabProps {
  teamId: number
}

export function RosterTab({ teamId }: RosterTabProps) {
  const [players, setPlayers] = useState<PlayerWithStats[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [roster, stats] = await Promise.all([
        getTeamPlayers(teamId),
        getPlayerSeasonStats(teamId),
      ])

      // Group stats by player for averages
      const statsByPlayer = new Map<number, StatsPlayerGame[]>()
      for (const s of stats) {
        if (!statsByPlayer.has(s.player_id)) statsByPlayer.set(s.player_id, [])
        statsByPlayer.get(s.player_id)!.push(s)
      }

      const enriched: PlayerWithStats[] = roster.map((p) => {
        const pStats = statsByPlayer.get(p.id)
        const avg = pStats ? computePlayerAverages(pStats) : null
        return {
          ...p,
          ppg: avg?.ppg ?? "—",
          rpg: avg?.rpg ?? "—",
          apg: avg?.apg ?? "—",
          gp: avg?.gp ?? 0,
        }
      })

      // Sort: by jersey number if available
      enriched.sort((a, b) => {
        if (a.jersey_number != null && b.jersey_number != null)
          return a.jersey_number - b.jersey_number
        if (a.jersey_number != null) return -1
        if (b.jersey_number != null) return 1
        return a.name.localeCompare(b.name)
      })

      setPlayers(enriched)
      setLoading(false)
    }
    load()
  }, [teamId])

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="h-48 animate-pulse rounded-xl border border-border bg-card"
          />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display text-sm font-bold text-foreground">
            Plantilla
          </h3>
          <p className="text-xs text-muted-foreground">
            {players.length} jugadores
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {players.map((player) => (
          <div
            key={player.id}
            className="group relative rounded-xl border border-border bg-card p-5 transition-all hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5"
          >
            {/* Avatar / Icon */}
            <div className="flex items-start justify-between">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-secondary">
                <User className="h-7 w-7 text-muted-foreground" />
              </div>
              {player.jersey_number != null && (
                <div className="flex items-center gap-1 rounded-lg bg-primary/10 px-2.5 py-1">
                  <Hash className="h-3 w-3 text-primary" />
                  <span className="font-display text-sm font-bold text-primary">
                    {player.jersey_number}
                  </span>
                </div>
              )}
            </div>

            {/* Name */}
            <h4 className="mt-3 font-display text-sm font-bold text-foreground">
              {player.name}
            </h4>
            <p className="text-xs text-muted-foreground">
              {player.gp
                ? `${player.gp} partidos jugados`
                : "Sin datos"}
            </p>

            {/* Mini Stats */}
            <div className="mt-3 flex gap-4">
              <div title="Puntos por partido - Promedio de puntos anotados">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground cursor-help">
                  PPG
                </p>
                <p className="font-display text-sm font-bold text-foreground">
                  {player.ppg}
                </p>
              </div>
              <div title="Rebotes por partido - Promedio de rebotes capturados">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground cursor-help">
                  RPG
                </p>
                <p className="font-display text-sm font-bold text-foreground">
                  {player.rpg}
                </p>
              </div>
              <div title="Asistencias por partido - Promedio de pases que resultan en canasta">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground cursor-help">
                  APG
                </p>
                <p className="font-display text-sm font-bold text-foreground">
                  {player.apg}
                </p>
              </div>
            </div>

            {/* Link to player profile */}
            <Link
              href={`/player?id=${player.id}`}
              className="mt-4 flex items-center gap-1.5 text-xs font-semibold text-primary transition-colors hover:text-primary/80"
            >
              <BarChart2 className="h-3 w-3" />
              Ver perfil completo
              <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        ))}
      </div>

      {players.length === 0 && (
        <div className="flex h-48 items-center justify-center rounded-xl border border-border bg-card">
          <p className="text-sm text-muted-foreground">
            No hay jugadores registrados en este equipo
          </p>
        </div>
      )}
    </div>
  )
}
