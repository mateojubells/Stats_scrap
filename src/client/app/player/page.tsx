"use client"

import { DashboardLayout } from "@/components/dashboard-layout"
import { PlayerHeader } from "@/components/player/player-header"
import { GeneralTrends } from "@/components/player/general-trends"
import { ShotChartTab } from "@/components/player/shot-chart-tab"
import { ImpactTab } from "@/components/player/impact-tab"
import { SynergyTab } from "@/components/player/synergy-tab"
import { ClutchTab } from "@/components/player/clutch-tab"
import { useAuth } from "@/lib/auth-context"
import { useSearchParams } from "next/navigation"
import { Suspense, useEffect, useState } from "react"
import { getTeamPlayers, getPlayerFullGameLog } from "@/lib/api"
import type { Player, StatsPlayerGame, Game } from "@/lib/types"
import {
  TrendingUp,
  Target,
  ArrowUpDown,
  Users,
  Flame,
} from "lucide-react"

type GameRow = StatsPlayerGame & { game: Game }

const tabs = [
  { key: "general", label: "General & Trends", icon: TrendingUp },
  { key: "shots", label: "Shot Chart", icon: Target },
  { key: "impact", label: "Impacto On/Off", icon: ArrowUpDown },
  { key: "synergy", label: "Synergy", icon: Users },
  { key: "clutch", label: "Clutch", icon: Flame },
] as const

type TabKey = (typeof tabs)[number]["key"]

function PlayerContent() {
  const { team } = useAuth()
  const searchParams = useSearchParams()
  const paramId = searchParams.get("id")

  const [players, setPlayers] = useState<Player[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(
    paramId ? Number(paramId) : null,
  )
  const [activeTab, setActiveTab] = useState<TabKey>("general")
  const [gameFilter, setGameFilter] = useState<"5" | "10" | "all">("all")
  const [allGames, setAllGames] = useState<GameRow[]>([])
  const [loadingGames, setLoadingGames] = useState(false)

  // Load players
  useEffect(() => {
    if (!team) return
    getTeamPlayers(team.id).then((p) => {
      setPlayers(p)
      if (!selectedId && p.length > 0) setSelectedId(p[0].id)
    })
  }, [team])

  // Load game log when player changes
  useEffect(() => {
    if (!team || !selectedId) return
    setLoadingGames(true)
    getPlayerFullGameLog(selectedId, team.id).then((rows) => {
      setAllGames(rows)
      setLoadingGames(false)
    })
  }, [selectedId, team])

  const player = players.find((p) => p.id === selectedId) ?? null

  const filteredGames =
    gameFilter === "all"
      ? allGames
      : allGames.slice(-Number(gameFilter))

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
          onChange={(e) => {
            setSelectedId(Number(e.target.value))
            setActiveTab("general")
          }}
        >
          {players.map((p) => (
            <option key={p.id} value={p.id}>
              #{p.jersey_number ?? "?"} {p.name}
            </option>
          ))}
        </select>
      </div>

      {player && !loadingGames && (
        <>
          {/* Header */}
          <PlayerHeader
            playerId={player.id}
            teamId={team!.id}
            player={player}
            gameFilter={gameFilter}
            onGameFilterChange={setGameFilter}
            allGames={allGames}
          />

          {/* Horizontal Tab Navigation */}
          <div className="mt-6 border-b border-border">
            <nav className="-mb-px flex gap-1 overflow-x-auto">
              {tabs.map((tab) => {
                const Icon = tab.icon
                const isActive = activeTab === tab.key
                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-semibold transition-colors ${
                      isActive
                        ? "border-primary text-primary"
                        : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {tab.label}
                  </button>
                )
              })}
            </nav>
          </div>

          {/* Tab Content */}
          <div className="mt-6">
            {activeTab === "general" && (
              <GeneralTrends
                playerId={player.id}
                teamId={team!.id}
                filteredGames={filteredGames}
              />
            )}
            {activeTab === "shots" && (
              <ShotChartTab
                playerId={player.id}
                teamId={team!.id}
                filteredGames={filteredGames}
              />
            )}
            {activeTab === "impact" && (
              <ImpactTab
                playerId={player.id}
                teamId={team!.id}
                filteredGames={filteredGames}
              />
            )}
            {activeTab === "synergy" && (
              <SynergyTab
                playerId={player.id}
                teamId={team!.id}
                filteredGames={filteredGames}
              />
            )}
            {activeTab === "clutch" && (
              <ClutchTab
                playerId={player.id}
                teamId={team!.id}
                filteredGames={filteredGames}
              />
            )}
          </div>
        </>
      )}

      {loadingGames && (
        <div className="mt-12 flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
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
