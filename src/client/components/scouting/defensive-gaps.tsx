"use client"

import { useEffect, useState } from "react"
import { FibaShotChart } from "@/components/fiba-shot-chart"
import { getTeamShots } from "@/lib/api"
import type { Shot } from "@/lib/types"

interface Props {
  opponentTeamId: number
}

export function DefensiveGaps({ opponentTeamId }: Props) {
  const [shots, setShots] = useState<Shot[]>([])

  useEffect(() => {
    getTeamShots(opponentTeamId).then(setShots)
  }, [opponentTeamId])

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-base font-bold text-foreground">
          Mapa de Tiros Rival
        </h3>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Zonas donde el rival anota con mayor eficiencia.
      </p>
      <div className="mt-3">
        <FibaShotChart shots={shots} width={320} />
      </div>
    </div>
  )
}
