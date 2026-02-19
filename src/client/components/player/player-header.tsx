"use client"

import { computePlayerAverages } from "@/lib/api"
import type { Player, StatsPlayerGame, Game } from "@/lib/types"
import { Hash, Trophy } from "lucide-react"

type GameRow = StatsPlayerGame & { game: Game }

interface Props {
  playerId: number
  teamId: number
  player: Player
  gameFilter: "5" | "10" | "all"
  onGameFilterChange: (filter: "5" | "10" | "all") => void
  allGames: GameRow[]
}

export function PlayerHeader({
  playerId,
  teamId,
  player,
  gameFilter,
  onGameFilterChange,
  allGames,
}: Props) {
  const filteredGames =
    gameFilter === "all"
      ? allGames
      : allGames.slice(-Number(gameFilter))

  const avg = computePlayerAverages(filteredGames)

  const initials = player.name
    .split(/[\s,]+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)

  const statCards = avg
    ? [
        { key: "PPG", value: avg.ppg, accent: true },
        { key: "RPG", value: avg.rpg, accent: false },
        { key: "APG", value: avg.apg, accent: false },
        { key: "PIR", value: avg.val, accent: true },
      ]
    : []

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="flex items-center gap-6">
        {/* Avatar */}
        <div className="relative shrink-0">
          <div className="flex h-24 w-24 items-center justify-center rounded-full border-2 border-primary/30 bg-secondary overflow-hidden">
            <span className="text-2xl font-bold leading-none text-muted-foreground select-none">
              {initials}
            </span>
          </div>
          <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-primary px-2.5 py-0.5 text-xs font-bold text-primary-foreground whitespace-nowrap">
            <Hash className="mr-0.5 inline h-3 w-3" />
            {player.jersey_number ?? "?"}
          </span>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <h1 className="font-display text-2xl font-bold text-foreground truncate">
              {player.name}
            </h1>
            <span className="shrink-0 rounded-full bg-chart-3/15 px-3 py-0.5 text-xs font-semibold text-chart-3">
              <Trophy className="mr-1 inline h-3 w-3" />
              {avg ? `${avg.gp} partidos` : "…"}
            </span>
          </div>
          {/* Game filter buttons */}
          <div className="mt-3 flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Muestra:
            </span>
            {(["5", "10", "all"] as const).map((f) => (
              <button
                key={f}
                onClick={() => onGameFilterChange(f)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  gameFilter === f
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-muted-foreground hover:text-foreground"
                }`}
              >
                {f === "all" ? "Todos" : `Últimos ${f}`}
              </button>
            ))}
          </div>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-4 gap-3 shrink-0">
          {statCards.map((s) => (
            <div
              key={s.key}
              className={`rounded-lg border px-5 py-3 text-center ${
                s.accent
                  ? "border-primary/30 bg-primary/5"
                  : "border-border bg-secondary/50"
              }`}
            >
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {s.key}
              </p>
              <span className="mt-1 block font-display text-2xl font-bold text-foreground">
                {s.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
