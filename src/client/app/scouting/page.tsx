"use client"

import { useEffect, useState } from "react"
import {
  Calendar,
  MapPin,
  BarChart3,
  Target,
  FileSearch,
  Users,
} from "lucide-react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { MatchupHeader } from "@/components/scouting/matchup-header"
import { StatComparison } from "@/components/scouting/stat-comparison"
import { FourFactorsComparison } from "@/components/scouting/four-factors-comparison"
import { ShootingAnalyticsTab } from "@/components/scouting/shooting-analytics-tab"
import { IndividualReportsTab } from "@/components/scouting/individual-reports-tab"
import { SynergiesTab } from "@/components/scouting/synergies-tab"
import { MatchHistory } from "@/components/scouting/match-history"
import { useAuth } from "@/lib/auth-context"
import { getNextGame } from "@/lib/api"
import type { Game, Team } from "@/lib/types"

type TabKey = "estrategia" | "tiro" | "sinergias" | "informes"

const tabs = [
  { key: "estrategia" as TabKey, label: "Estrategia Global", icon: BarChart3 },
  { key: "tiro" as TabKey, label: "Análisis de Tiro", icon: Target },
  { key: "sinergias" as TabKey, label: "Sinergias y Tendencias", icon: Users },
  { key: "informes" as TabKey, label: "Informes Individuales", icon: FileSearch },
]

export default function ScoutingPage() {
  const { team } = useAuth()
  const [nextGame, setNextGame] = useState<Game | null | undefined>(undefined) // undefined = loading
  const [activeTab, setActiveTab] = useState<TabKey>("estrategia")

  useEffect(() => {
    if (!team) return
    getNextGame(team.id).then((g) => setNextGame(g ?? null))
  }, [team])

  // Determine teams from the next game
  const myTeam = team as Team | null
  const isHome = nextGame?.home_team_id === team?.id
  const opponent = nextGame
    ? (isHome ? (nextGame as any).away_team : (nextGame as any).home_team) as Team | null
    : null

  const gameDate = nextGame?.date
    ? new Date(nextGame.date).toLocaleDateString("es-ES", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null

  const gameTime = nextGame?.date
    ? new Date(nextGame.date).toLocaleTimeString("es-ES", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : null

  return (
    <DashboardLayout>


      {/* ── Loading state ── */}
      {nextGame === undefined && (
        <div className="flex items-center justify-center py-32">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      )}

      {/* ── Empty state: no upcoming game ── */}
      {nextGame === null && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card py-24">
          <Calendar className="mb-4 h-12 w-12 text-muted-foreground/50" />
          <h2 className="font-display text-lg font-semibold text-foreground">
            No hay partidos próximos programados
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Cuando se registre el siguiente partido aparecerá aquí el informe de scouting.
          </p>
        </div>
      )}

      {/* ── Main scouting content ── */}
      {nextGame && myTeam && opponent && (
        <>
          {/* Game date/location banner */}
          <div className="mb-4 flex flex-wrap items-center gap-4 rounded-xl border border-primary/20 bg-primary/5 px-5 py-3">
            <div className="flex items-center gap-2 text-sm text-foreground">
              <Calendar className="h-4 w-4 text-primary" />
              <span className="font-semibold capitalize">{gameDate}</span>
              {gameTime && (
                <span className="text-muted-foreground">· {gameTime}</span>
              )}
            </div>
            {nextGame.jornada && (
              <div className="flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-0.5 text-xs font-semibold text-primary">
                Jornada {nextGame.jornada}
              </div>
            )}
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3" />
              {isHome ? "Casa" : "Visitante"}
            </div>
          </div>

          {/* Matchup header */}
          <MatchupHeader myTeam={myTeam} opponent={opponent} />

          {/* Tab navigation */}
          <div className="mt-6 flex gap-1 rounded-xl border border-border bg-card p-1">
            {tabs.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${
                  activeTab === key
                    ? "bg-primary text-primary-foreground shadow"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="mt-6">
            {activeTab === "estrategia" && (
              <div className="flex flex-col gap-6">
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                  <StatComparison
                    myTeamId={myTeam.id}
                    opponentTeamId={opponent.id}
                    myName={myTeam.name}
                    oppName={opponent.name}
                  />
                  <FourFactorsComparison
                    myTeamId={myTeam.id}
                    opponentTeamId={opponent.id}
                    myName={myTeam.name}
                    oppName={opponent.name}
                  />
                </div>
                <MatchHistory myTeamId={myTeam.id} opponentTeamId={opponent.id} />
              </div>
            )}

            {activeTab === "tiro" && (
              <ShootingAnalyticsTab
                opponentTeamId={opponent.id}
                opponentName={opponent.name}
              />
            )}

            {activeTab === "sinergias" && (
              <SynergiesTab
                opponentTeamId={opponent.id}
                opponentName={opponent.name}
                myTeamId={myTeam.id}
                myTeamName={myTeam.name}
              />
            )}

            {activeTab === "informes" && (
              <IndividualReportsTab
                opponentTeamId={opponent.id}
                opponentName={opponent.name}
              />
            )}
          </div>
        </>
      )}
    </DashboardLayout>
  )
}
