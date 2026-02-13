"use client"

import { useEffect, useState } from "react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { ScoutingTopBar } from "@/components/scouting/scouting-top-bar"
import { MatchupHeader } from "@/components/scouting/matchup-header"
import { StatComparison } from "@/components/scouting/stat-comparison"
import { KeyThreat } from "@/components/scouting/key-threat"
import { DefensiveGaps } from "@/components/scouting/defensive-gaps"
import { MatchHistory } from "@/components/scouting/match-history"
import { useAuth } from "@/lib/auth-context"
import { getTeamGames, getAllTeams } from "@/lib/api"
import type { Team } from "@/lib/types"

export default function ScoutingPage() {
  const { team } = useAuth()
  const [opponents, setOpponents] = useState<Team[]>([])
  const [opponentId, setOpponentId] = useState<number | null>(null)

  // Build a list of teams the user's team has played against
  useEffect(() => {
    if (!team) return
    ;(async () => {
      const games = await getTeamGames(team.id)
      const oppIds = new Set<number>()
      games.forEach((g) => {
        if (g.home_team_id === team.id) oppIds.add(g.away_team_id)
        else oppIds.add(g.home_team_id)
      })
      const all = await getAllTeams()
      const filtered = all.filter((t) => oppIds.has(t.id))
      setOpponents(filtered)
      if (filtered.length > 0 && !opponentId) setOpponentId(filtered[0].id)
    })()
  }, [team])

  const selectedOpp = opponents.find((o) => o.id === opponentId) ?? null

  return (
    <DashboardLayout>
      <ScoutingTopBar
        opponents={opponents}
        opponentId={opponentId}
        onSelectOpponent={setOpponentId}
        opponentName={selectedOpp?.name ?? ""}
      />

      {team && selectedOpp && (
        <>
          <div className="mt-6 grid grid-cols-3 gap-6">
            <div className="col-span-2 flex flex-col gap-6">
              <MatchupHeader myTeam={team} opponent={selectedOpp} />
              <StatComparison myTeamId={team.id} opponentTeamId={selectedOpp.id} myName={team.name} oppName={selectedOpp.name} />
            </div>
            <div className="flex flex-col gap-6">
              <KeyThreat opponentTeamId={selectedOpp.id} />
              <DefensiveGaps opponentTeamId={selectedOpp.id} />
            </div>
          </div>

          <div className="mt-6">
            <MatchHistory myTeamId={team.id} opponentTeamId={selectedOpp.id} />
          </div>
        </>
      )}
    </DashboardLayout>
  )
}
