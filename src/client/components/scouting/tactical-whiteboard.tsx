"use client"

import { useEffect, useState } from "react"
import { ClipboardList, Users, Clock3, ShieldAlert } from "lucide-react"
import { getTeamLineups } from "@/lib/api"
import type { Player } from "@/lib/types"

interface Props {
  myTeamId: number
  myTeamName: string
  opponentTeamId: number
  opponentName: string
}

interface TeamLineup {
  playerIds: number[]
  players: Player[]
  minutes: number
  ptsFor: number
  ptsAgainst: number
  netRating: number
  stints: number
  badges?: string[]
}

export function TacticalWhiteboard({ opponentTeamId, opponentName }: Props) {
  const [lineups, setLineups] = useState<TeamLineup[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    getTeamLineups(opponentTeamId).then((data) => {
      setLineups((data as TeamLineup[]).slice(0, 3))
      setLoading(false)
    })
  }, [opponentTeamId])

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-4 flex items-center gap-2">
        <ClipboardList className="h-4 w-4 text-primary" />
        <h3 className="font-display text-base font-bold text-foreground">
          Pizarra Táctica — Quintetos de Referencia ({opponentName})
        </h3>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-40 animate-pulse rounded-lg bg-secondary" />
          ))}
        </div>
      ) : lineups.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sin datos de quintetos del rival.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          {lineups.map((lineup, idx) => (
            <div key={idx} className="rounded-lg border border-border bg-secondary/25 p-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  <p className="text-sm font-bold text-foreground">Quinteto #{idx + 1}</p>
                </div>
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                  {lineup.minutes.toFixed(1)} min
                </span>
              </div>

              <div className="space-y-1.5">
                {lineup.players.map((player) => (
                  <div key={player.id} className="rounded-md bg-card px-2.5 py-1.5 text-xs text-foreground">
                    {player.name}
                  </div>
                ))}
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="rounded-md bg-card px-2 py-1.5">
                  <p className="text-[10px] text-muted-foreground">Net +/-</p>
                  <p className={`text-sm font-bold ${lineup.netRating >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {lineup.netRating >= 0 ? "+" : ""}
                    {lineup.netRating.toFixed(1)}
                  </p>
                </div>
                <div className="rounded-md bg-card px-2 py-1.5">
                  <p className="text-[10px] text-muted-foreground">Stints</p>
                  <p className="text-sm font-bold text-foreground">{lineup.stints}</p>
                </div>
              </div>

              <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock3 className="h-3 w-3" />
                  PF {lineup.ptsFor.toFixed(1)}
                </span>
                <span className="flex items-center gap-1">
                  <ShieldAlert className="h-3 w-3" />
                  PC {lineup.ptsAgainst.toFixed(1)}
                </span>
              </div>

              {!!lineup.badges?.length && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {lineup.badges.slice(0, 2).map((badge) => (
                    <span key={badge} className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground">
                      {badge}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
