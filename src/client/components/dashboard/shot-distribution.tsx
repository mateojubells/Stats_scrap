"use client"

import { FibaShotChart } from "@/components/fiba-shot-chart"
import { useAuth } from "@/lib/auth-context"
import { useEffect, useState } from "react"
import { getTeamShots } from "@/lib/api"
import type { Shot } from "@/lib/types"

export function ShotDistribution() {
  const { team } = useAuth()
  const [shots, setShots] = useState<Shot[]>([])

  useEffect(() => {
    if (!team) return
    getTeamShots(team.id).then(setShots)
  }, [team])

  const dots = shots.map((s) => ({
    x: s.x_coord,
    y: s.y_coord,
    made: s.made,
  }))

  const made = shots.filter((s) => s.made).length
  const total = shots.length
  const pct = total > 0 ? ((made / total) * 100).toFixed(1) : "0"

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="font-display text-lg font-bold text-foreground">
            Mapa de Tiros
          </h2>
          <p className="text-xs text-muted-foreground">
            {total} tiros — {pct}% acierto
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#39ff14]" />
            <span className="text-xs text-muted-foreground">Acierto</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-destructive" />
            <span className="text-xs text-muted-foreground">Fallo</span>
          </div>
        </div>
      </div>
      <div className="mt-4 w-full overflow-hidden rounded-lg">
        <FibaShotChart shots={dots} width={480} height={448} />
      </div>
    </div>
  )
}
