"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard-layout"
import { useAuth } from "@/lib/auth-context"
import {
  getGameById,
  getGamePlayerStats,
  getGameTeamStats,
  getGamePlayByPlay,
  getGameShots,
} from "@/lib/api"
import type { Game, StatsPlayerGame, StatsTeamGame, PlayByPlay, Shot } from "@/lib/types"
import {
  ArrowLeft,
  ClipboardList,
  TrendingUp,
  Zap,
  ListOrdered,
  Target,
} from "lucide-react"

import { BoxScoreTab } from "@/components/game-center/box-score-tab"
import { WinProbabilityTab } from "@/components/game-center/win-probability-tab"
import { ScoringRunsTab } from "@/components/game-center/scoring-runs-tab"
import { PlayByPlayTab } from "@/components/game-center/play-by-play-tab"
import { GameShotChartTab } from "@/components/game-center/game-shot-chart-tab"

const tabs = [
  { key: "boxscore", label: "Resumen", icon: ClipboardList },
  { key: "winprob", label: "Win Probability", icon: TrendingUp },
  { key: "runs", label: "Rachas", icon: Zap },
  { key: "pbp", label: "Play-by-Play", icon: ListOrdered },
  { key: "shotchart", label: "Shot Chart", icon: Target },
] as const

type TabKey = (typeof tabs)[number]["key"]

export default function GameDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { team } = useAuth()
  const gameId = Number(params.id)

  const [game, setGame] = useState<Game | null>(null)
  const [playerStats, setPlayerStats] = useState<StatsPlayerGame[]>([])
  const [teamStats, setTeamStats] = useState<StatsTeamGame[]>([])
  const [pbp, setPbp] = useState<PlayByPlay[]>([])
  const [shots, setShots] = useState<Shot[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabKey>("boxscore")

  useEffect(() => {
    if (!gameId || !team) return
    setLoading(true)
    Promise.all([
      getGameById(gameId),
      getGamePlayerStats(gameId),
      getGameTeamStats(gameId),
      getGamePlayByPlay(gameId),
      getGameShots(gameId),
    ]).then(([g, ps, ts, pbpData, shotsData]) => {
      setGame(g)
      setPlayerStats(ps)
      setTeamStats(ts)
      setPbp(pbpData)
      setShots(shotsData)
      setLoading(false)
    })
  }, [gameId, team])

  if (loading || !game || !team) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-32">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      </DashboardLayout>
    )
  }

  const isHome = game.home_team_id === team.id
  const myTeam = isHome ? game.home_team : game.away_team
  const oppTeam = isHome ? game.away_team : game.home_team
  const myScore = isHome ? game.home_score : game.away_score
  const oppScore = isHome ? game.away_score : game.home_score
  const won = (myScore ?? 0) > (oppScore ?? 0)
  const dateStr = game.date
    ? new Date(game.date).toLocaleDateString("es-ES", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "—"

  return (
    <DashboardLayout>
      {/* Back button */}
      <button
        onClick={() => router.push("/game-center")}
        className="mb-4 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver a Game Center
      </button>

      {/* ── Game Header ── */}
      <div className="mb-6 rounded-xl border border-border bg-card p-6">
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
          {/* Our Team */}
          <div className="flex items-center gap-3">
            {myTeam?.logo_url ? (
              <img src={myTeam.logo_url} alt={myTeam.name} className="h-14 w-14 rounded-full object-cover" />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/20 text-lg font-bold text-primary">
                {myTeam?.name?.substring(0, 3).toUpperCase()}
              </div>
            )}
            <div className="text-left">
              <p className="font-display text-lg font-bold text-foreground">{myTeam?.name}</p>
              <p className="text-xs text-muted-foreground">{isHome ? "Local" : "Visitante"}</p>
            </div>
          </div>

          {/* Score */}
          <div className="flex flex-col items-center gap-1">
            <div className="flex items-center gap-4">
              <span className={`font-display text-4xl font-black ${won ? "text-emerald-400" : "text-red-400"}`}>
                {myScore ?? 0}
              </span>
              <span className="text-2xl text-muted-foreground">—</span>
              <span className={`font-display text-4xl font-black ${!won ? "text-emerald-400" : "text-red-400"}`}>
                {oppScore ?? 0}
              </span>
            </div>
            <span className={`rounded-md px-3 py-0.5 text-xs font-bold ${won ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"}`}>
              {won ? "VICTORIA" : "DERROTA"} · Finalizado
            </span>
            <span className="mt-1 text-xs capitalize text-muted-foreground">{dateStr}</span>
          </div>

          {/* Opponent */}
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="font-display text-lg font-bold text-foreground">{oppTeam?.name}</p>
              <p className="text-xs text-muted-foreground">{!isHome ? "Local" : "Visitante"}</p>
            </div>
            {oppTeam?.logo_url ? (
              <img src={oppTeam.logo_url} alt={oppTeam.name} className="h-14 w-14 rounded-full object-cover" />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-secondary text-lg font-bold text-muted-foreground">
                {oppTeam?.name?.substring(0, 3).toUpperCase()}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Tab Navigation ── */}
      <div className="mb-6 flex gap-1 overflow-x-auto rounded-xl border border-border bg-card p-1">
        {tabs.map((tab) => {
          const active = activeTab === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                active
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* ── Tab Content ── */}
      {activeTab === "boxscore" && (
        <BoxScoreTab
          game={game}
          playerStats={playerStats}
          teamStats={teamStats}
          myTeamId={team.id}
        />
      )}
      {activeTab === "winprob" && (
        <WinProbabilityTab
          game={game}
          pbp={pbp}
          myTeamId={team.id}
        />
      )}
      {activeTab === "runs" && (
        <ScoringRunsTab
          game={game}
          pbp={pbp}
          playerStats={playerStats}
          myTeamId={team.id}
        />
      )}
      {activeTab === "pbp" && (
        <PlayByPlayTab
          game={game}
          pbp={pbp}
          myTeamId={team.id}
        />
      )}
      {activeTab === "shotchart" && (
        <GameShotChartTab
          game={game}
          shots={shots}
          myTeamId={team.id}
        />
      )}
    </DashboardLayout>
  )
}
