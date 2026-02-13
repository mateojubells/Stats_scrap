"use client"

import { DashboardLayout } from "@/components/dashboard-layout"
import { PlayerHeader } from "@/components/player/player-header"
import { PlayerShotChart } from "@/components/player/shot-chart"
import { SkillAnalysis } from "@/components/player/skill-analysis"
import { GameLog } from "@/components/player/game-log"
import { useAuth } from "@/lib/auth-context"
import { useSearchParams } from "next/navigation"
import { Suspense, useEffect, useState } from "react"
import { getTeamPlayers } from "@/lib/api"
import type { Player } from "@/lib/types"

function PlayerContent() {
  const { team } = useAuth()
  const searchParams = useSearchParams()
  const paramId = searchParams.get("id")

  const [players, setPlayers] = useState<Player[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(
    paramId ? Number(paramId) : null,
  )

  useEffect(() => {
    if (!team) return
    getTeamPlayers(team.id).then((p) => {
      setPlayers(p)
      if (!selectedId && p.length > 0) setSelectedId(p[0].id)
    })
  }, [team])

  const player = players.find((p) => p.id === selectedId) ?? null

  return (
    <DashboardLayout>
      {/* Player selector */}
      <div className="mb-4 flex items-center gap-3">
        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Jugador
        </label>
        <select
          className="rounded-lg border border-border bg-secondary px-4 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          value={selectedId ?? ""}
          onChange={(e) => setSelectedId(Number(e.target.value))}
        >
          {players.map((p) => (
            <option key={p.id} value={p.id}>
              #{p.jersey_number ?? "?"} {p.name}
            </option>
          ))}
        </select>
      </div>

      {player && (
        <>
          <PlayerHeader playerId={player.id} teamId={team!.id} player={player} />

          <div className="mt-6 grid grid-cols-5 gap-6">
            <div className="col-span-3">
              <PlayerShotChart playerId={player.id} />
            </div>
            <div className="col-span-2">
              <SkillAnalysis playerId={player.id} teamId={team!.id} />
            </div>
          </div>

          <div className="mt-6">
            <GameLog playerId={player.id} teamId={team!.id} />
          </div>
        </>
      )}
    </DashboardLayout>
  )
}

export default function PlayerPage() {
  return (
    <Suspense>
      <PlayerContent />
    </Suspense>
  )
}
