"use client"

import { useEffect, useState } from "react"
import { AlertTriangle } from "lucide-react"
import { getOpponentPlayerStats, computePlayerAverages } from "@/lib/api"
import type { StatsPlayerGame, Player } from "@/lib/types"

interface Props {
  opponentTeamId: number
}

interface Threat {
  name: string
  position: string
  ppg: string
  rpg: string
  ast: string
  fgPct: string
  initials: string
}

export function KeyThreat({ opponentTeamId }: Props) {
  const [threat, setThreat] = useState<Threat | null>(null)

  useEffect(() => {
    getOpponentPlayerStats(opponentTeamId).then((stats) => {
      // Group stats by player
      const byPlayer = new Map<number, { player: Player; rows: StatsPlayerGame[] }>()
      for (const s of stats) {
        const p = (s as any).player as Player | undefined
        if (!p) continue
        if (!byPlayer.has(p.id)) byPlayer.set(p.id, { player: p, rows: [] })
        byPlayer.get(p.id)!.rows.push(s)
      }

      // Find the player with highest PPG
      let best: Threat | null = null
      let bestPpg = -1
      for (const { player, rows } of byPlayer.values()) {
        const avg = computePlayerAverages(rows)
        if (!avg) continue
        const ppg = parseFloat(avg.ppg)
        if (ppg > bestPpg) {
          bestPpg = ppg
          const initials = player.name
            .split(/\s+/)
            .map((w) => w[0])
            .join("")
            .toUpperCase()
            .slice(0, 2)
          best = {
            name: player.name,
            position: player.position ?? "—",
            ppg: avg.ppg,
            rpg: avg.rpg,
            ast: avg.apg,
            fgPct: `${avg.fgPct}%`,
            initials,
          }
        }
      }
      setThreat(best)
    })
  }, [opponentTeamId])

  if (!threat)
    return (
      <div className="rounded-xl border border-border bg-card p-5 text-center text-sm text-muted-foreground">
        Sin datos del rival.
      </div>
    )

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-accent" />
          <span className="text-xs font-bold uppercase tracking-widest text-accent">
            Amenaza Clave
          </span>
        </div>
        <span className="rounded-full border border-accent/50 bg-accent/10 px-2.5 py-0.5 text-[10px] font-bold text-accent">
          #1 Opción
        </span>
      </div>
      <div className="mt-4 flex items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-accent/50 bg-secondary text-lg font-bold text-accent">
          {threat.initials}
        </div>
        <div>
          <h3 className="font-display text-xl font-bold text-foreground">
            {threat.name}
          </h3>
          <p className="text-xs text-muted-foreground">{threat.position}</p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-4 gap-2">
        <div className="text-center">
          <p className="font-display text-2xl font-bold text-foreground">
            {threat.ppg}
          </p>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            PPG
          </p>
        </div>
        <div className="text-center">
          <p className="font-display text-2xl font-bold text-foreground">
            {threat.rpg}
          </p>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            RPG
          </p>
        </div>
        <div className="text-center">
          <p className="font-display text-2xl font-bold text-foreground">
            {threat.ast}
          </p>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            AST
          </p>
        </div>
        <div className="text-center">
          <p className="font-display text-2xl font-bold text-accent">
            {threat.fgPct}
          </p>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            FG%
          </p>
        </div>
      </div>
    </div>
  )
}
