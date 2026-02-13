"use client"

import { useEffect, useState } from "react"
import { getPlayerGameLog, computePlayerAverages } from "@/lib/api"
import type { Player } from "@/lib/types"

interface Props {
  playerId: number
  teamId: number
  player: Player
}

export function PlayerHeader({ playerId, teamId, player }: Props) {
  const [avg, setAvg] = useState<ReturnType<typeof computePlayerAverages>>(null)

  useEffect(() => {
    getPlayerGameLog(playerId, teamId).then((rows) =>
      setAvg(computePlayerAverages(rows)),
    )
  }, [playerId, teamId])

  const initials = player.name
    .split(/[\s,]+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)

  const statCards = avg
    ? [
        { key: "PTS", value: avg.ppg },
        { key: "REB", value: avg.rpg },
        { key: "AST", value: avg.apg },
        { key: "FG%", value: `${avg.fgPct}%` },
      ]
    : []

  return (
    <div className="flex items-center gap-6 rounded-xl border border-border bg-card p-6">
      <div className="relative">
        <div className="flex h-24 w-24 items-center justify-center rounded-full border-2 border-border bg-secondary text-2xl font-bold text-muted-foreground">
          {initials}
        </div>
        <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded bg-primary px-2 py-0.5 text-xs font-bold text-primary-foreground">
          #{player.jersey_number ?? "?"}
        </span>
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-3">
          <h1 className="font-display text-2xl font-bold text-foreground">
            {player.name}
          </h1>
          <span className="rounded-full bg-chart-3/15 px-3 py-0.5 text-xs font-semibold text-chart-3">
            {avg ? `${avg.gp} partidos` : "…"}
          </span>
        </div>
      </div>
      <div className="grid grid-cols-4 gap-3">
        {statCards.map((s) => (
          <div
            key={s.key}
            className="rounded-lg border border-border bg-secondary/50 px-5 py-3 text-center"
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
  )
}
