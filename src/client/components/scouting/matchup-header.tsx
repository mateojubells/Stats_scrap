"use client"

import { useEffect, useState } from "react"
import { getTeamSeasonAverages, getTeamGames } from "@/lib/api"
import type { Team } from "@/lib/types"

interface Props {
  myTeam: Team
  opponent: Team
}

function abbr(name: string) {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 3)
}

export function MatchupHeader({ myTeam, opponent }: Props) {
  const [myRecord, setMyRecord] = useState("")
  const [oppRecord, setOppRecord] = useState("")

  useEffect(() => {
    async function loadRecord(teamId: number, setter: (v: string) => void) {
      const games = await getTeamGames(teamId)
      let w = 0, l = 0
      games.forEach((g) => {
        const isHome = g.home_team_id === teamId
        const my = isHome ? g.home_score : g.away_score
        const opp = isHome ? g.away_score : g.home_score
        if ((my ?? 0) > (opp ?? 0)) w++; else l++
      })
      setter(`${w}-${l}`)
    }
    loadRecord(myTeam.id, setMyRecord)
    loadRecord(opponent.id, setOppRecord)
  }, [myTeam.id, opponent.id])

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="flex items-center justify-between">
        {/* My Team */}
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-primary text-lg font-bold text-primary">
            {abbr(myTeam.name)}
          </div>
          <div>
            <p className="text-xs font-semibold uppercase text-muted-foreground">
              Mi Equipo
            </p>
            <h2 className="font-display text-2xl font-bold text-foreground">
              {myTeam.name}
            </h2>
            <p className="text-xs text-muted-foreground">{myRecord}</p>
          </div>
        </div>

        {/* VS */}
        <div className="text-center">
          <p className="font-display text-2xl font-bold text-muted-foreground">
            VS
          </p>
        </div>

        {/* Opponent */}
        <div className="flex flex-row-reverse items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-accent text-lg font-bold text-accent">
            {abbr(opponent.name)}
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold uppercase text-muted-foreground">
              Rival
            </p>
            <h2 className="font-display text-2xl font-bold text-foreground">
              {opponent.name}
            </h2>
            <p className="text-xs text-muted-foreground">{oppRecord}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
