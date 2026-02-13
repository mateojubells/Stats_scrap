"use client"

import { useAuth } from "@/lib/auth-context"
import { useEffect, useState } from "react"
import { getTopPlayersByEFF } from "@/lib/api"
import { Trophy } from "lucide-react"
import Link from "next/link"

interface PlayerRank {
  player: { id: number; name: string; jersey_number?: number; position?: string }
  gp: number
  eff: string
  ppg: string
  fgPct: string
}

export function PlayerOfWeek() {
  const { team } = useAuth()
  const [players, setPlayers] = useState<PlayerRank[]>([])

  useEffect(() => {
    if (!team) return
    getTopPlayersByEFF(team.id, 4).then(setPlayers)
  }, [team])

  if (players.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-5 text-center">
        <p className="text-sm text-muted-foreground">Sin datos de jugadores</p>
      </div>
    )
  }

  const mvp = players[0]
  const others = players.slice(1, 4)

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Trophy className="h-5 w-5 text-primary" />
        <h2 className="font-display text-lg font-bold text-foreground">
          MVP de la Temporada
        </h2>
      </div>

      {/* MVP Destacado */}
      <div className="mt-4 rounded-lg bg-primary/10 border border-primary/20 p-4">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-2xl font-bold text-primary-foreground">
            {mvp.player.jersey_number ?? "?"}
          </div>
          <div className="flex-1">
            <p className="text-xs font-semibold uppercase text-primary">
              #1 Valoración
            </p>
            <h3 className="font-display text-xl font-bold text-foreground">
              {mvp.player.name}
            </h3>
            <p className="text-xs text-muted-foreground">
              {mvp.player.position ?? "—"} • {mvp.gp} partidos
            </p>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-3">
          <div className="text-center">
            <p className="font-display text-2xl font-bold text-primary">
              {mvp.ppg}
            </p>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              PPG
            </p>
          </div>
          <div className="text-center">
            <p className="font-display text-2xl font-bold text-primary">
              {mvp.fgPct}%
            </p>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              FG%
            </p>
          </div>
          <div className="text-center">
            <p className="font-display text-2xl font-bold text-primary">
              {mvp.eff}
            </p>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              EFF
            </p>
          </div>
        </div>
        <Link
          href={`/player?id=${mvp.player.id}`}
          className="mt-3 block w-full rounded-lg bg-primary py-2 text-center text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Ver Análisis
        </Link>
      </div>

      {/* Top 2-4 */}
      {others.length > 0 && (
        <div className="mt-4 space-y-2">
          {others.map((p, idx) => (
            <div
              key={p.player.id}
              className="flex items-center justify-between rounded-lg bg-secondary/50 px-3 py-2"
            >
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-muted-foreground">
                  #{idx + 2}
                </span>
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-xs font-bold text-foreground">
                  {p.player.jersey_number ?? "?"}
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {p.player.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {p.gp} GP
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-foreground">{p.eff}</p>
                <p className="text-xs text-muted-foreground">EFF</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
