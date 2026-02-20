"use client"

import { useMemo } from "react"
import type { Game, PlayByPlay, StatsPlayerGame } from "@/lib/types"
import { Zap } from "lucide-react"

interface ScoringRunsTabProps {
  game: Game
  pbp: PlayByPlay[]
  playerStats: StatsPlayerGame[]
  myTeamId: number
}

interface ScoringRun {
  teamId: number
  teamName: string
  points: number                // total de la racha (ej. 12)
  startScore: string            // marcador al iniciar la racha "45-38"
  endScore: string              // marcador al terminar la racha "57-38"
  quarter: number
  startMinute: string | null
  endMinute: string | null
  events: RunEvent[]
}

interface RunEvent {
  playerId: number | null
  playerName: string
  actionType: string
  value: number
  minute: string | null
}

const QUARTER_MINUTES = 10

function elapsedMinutes(quarter: number, minute: string | null): number {
  const base = (quarter - 1) * QUARTER_MINUTES
  if (!minute) return base
  const parts = minute.split(":")
  const m = parseInt(parts[0] || "0", 10)
  const s = parseInt(parts[1] || "0", 10)
  return base + (QUARTER_MINUTES - m - s / 60)
}

/**
 * Detect scoring runs from Play-by-Play data.
 *
 * A run = consecutive points scored by ONE team while the OTHER scores 0.
 * Only runs with >= MIN_RUN_POINTS are returned.
 */
function detectScoringRuns(
  pbp: PlayByPlay[],
  game: Game,
  playerMap: Map<number, string>,
  minRunPoints = 8,
): ScoringRun[] {
  const homeName = game.home_team?.name ?? "Local"
  const awayName = game.away_team?.name ?? "Visitante"
  const homeId = game.home_team_id
  const awayId = game.away_team_id

  const teamName = (id: number | null) => {
    if (id === homeId) return homeName
    if (id === awayId) return awayName
    return "?"
  }

  // Filter to scoring events only and enforce chronological order
  const scoringEvents = pbp
    .filter(
      (ev) =>
        ev.action_value > 0 &&
        ev.action_type?.includes("made") &&
        (ev.team_id === homeId || ev.team_id === awayId),
    )
    .sort((a, b) => {
      if (a.id != null && b.id != null && a.id !== b.id) return a.id - b.id
      return elapsedMinutes(a.quarter, a.minute) - elapsedMinutes(b.quarter, b.minute)
    })

  if (scoringEvents.length === 0) return []

  const runs: ScoringRun[] = []

  let currentTeamId: number | null = null
  let runPoints = 0
  let runEvents: RunEvent[] = []
  let runStartHomeScore = 0
  let runStartAwayScore = 0
  let homeScore = 0
  let awayScore = 0
  let runStartQuarter = 1
  let runStartMinute: string | null = null
  let runEndMinute: string | null = null

  const flushRun = () => {
    if (currentTeamId != null && runPoints >= minRunPoints) {
      runs.push({
        teamId: currentTeamId,
        teamName: teamName(currentTeamId),
        points: runPoints,
        startScore: `${runStartHomeScore}-${runStartAwayScore}`,
        endScore: `${homeScore}-${awayScore}`,
        quarter: runStartQuarter,
        startMinute: runStartMinute,
        endMinute: runEndMinute,
        events: [...runEvents],
      })
    }
  }

  for (const ev of scoringEvents) {
    const scoringTeamId = ev.team_id!

    const prevHome = homeScore
    const prevAway = awayScore

    if (ev.home_score_partial != null || ev.away_score_partial != null) {
      homeScore = ev.home_score_partial ?? (scoringTeamId === homeId ? prevHome + ev.action_value : prevHome)
      awayScore = ev.away_score_partial ?? (scoringTeamId === awayId ? prevAway + ev.action_value : prevAway)
    } else {
      if (scoringTeamId === homeId) homeScore += ev.action_value
      if (scoringTeamId === awayId) awayScore += ev.action_value
    }

    if (scoringTeamId !== currentTeamId) {
      // Rival scored: cortar racha actual inmediatamente
      flushRun()

      // Start new run
      currentTeamId = scoringTeamId
      runPoints = 0
      runEvents = []
      runStartHomeScore = prevHome
      runStartAwayScore = prevAway
      runStartQuarter = ev.quarter
      runStartMinute = ev.minute
    }

    runPoints += ev.action_value
    runEndMinute = ev.minute
    runEvents.push({
      playerId: ev.player_id,
      playerName: ev.player_id ? (playerMap.get(ev.player_id) ?? `#${ev.player_id}`) : "—",
      actionType: ev.action_type,
      value: ev.action_value,
      minute: ev.minute,
    })
  }

  // Flush last run
  flushRun()

  // Sort by points descending
  runs.sort((a, b) => b.points - a.points)

  return runs
}

function formatAction(action: string): string {
  if (action.includes("3pt")) return "Triple"
  if (action.includes("2pt")) return "Doble"
  if (action.includes("ft")) return "TL"
  if (action.includes("dunk")) return "Mate"
  return action
}

export function ScoringRunsTab({ game, pbp, playerStats, myTeamId }: ScoringRunsTabProps) {
  // Build player name map from stats
  const playerMap = useMemo(() => {
    const map = new Map<number, string>()
    for (const s of playerStats) {
      if (s.player) map.set(s.player_id, s.player.name)
    }
    return map
  }, [playerStats])

  const runs = useMemo(() => detectScoringRuns(pbp, game, playerMap), [pbp, game, playerMap])

  const isMyTeam = (teamId: number) => teamId === myTeamId

  if (runs.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center">
        <Zap className="mx-auto mb-3 h-12 w-12 text-muted-foreground/40" />
        <p className="text-muted-foreground">No se detectaron rachas de 8+ puntos en este partido.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-xl border border-border bg-card p-4">
        <h3 className="mb-1 font-display text-lg font-bold text-foreground flex items-center gap-2">
          <Zap className="h-5 w-5 text-amber-400" />
          Rachas de Puntos (Scoring Runs)
        </h3>
        <p className="text-sm text-muted-foreground">
          Secuencias de puntos anotados por un equipo mientras el rival anota 0. Mínimo 8 puntos.
        </p>
      </div>

      {/* Runs list */}
      <div className="space-y-3">
        {runs.map((run, idx) => (
          <div
            key={idx}
            className={`rounded-xl border p-4 transition-colors ${
              isMyTeam(run.teamId)
                ? "border-emerald-500/30 bg-emerald-500/5"
                : "border-red-500/30 bg-red-500/5"
            }`}
          >
            {/* Run header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <span
                  className={`flex h-10 w-16 items-center justify-center rounded-lg text-lg font-black font-display ${
                    isMyTeam(run.teamId)
                      ? "bg-emerald-500/20 text-emerald-400"
                      : "bg-red-500/20 text-red-400"
                  }`}
                >
                  {run.points}-0
                </span>
                <div>
                  <p className="font-semibold text-foreground">{run.teamName}</p>
                  <p className="text-xs text-muted-foreground">
                    Q{run.quarter} · {run.startMinute ?? "—"} → {run.endMinute ?? "—"}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Marcador</p>
                <p className="text-sm font-mono text-foreground">
                  {run.startScore} → {run.endScore}
                </p>
              </div>
            </div>

            {/* Run events */}
            <div className="flex flex-wrap gap-2">
              {run.events.map((ev, j) => (
                <div
                  key={j}
                  className="flex items-center gap-1.5 rounded-md bg-secondary/50 px-2.5 py-1 text-xs"
                >
                  <span className="font-medium text-foreground">{ev.playerName}</span>
                  <span className="text-muted-foreground">·</span>
                  <span className="text-muted-foreground">{formatAction(ev.actionType)}</span>
                  <span className={`font-bold ${isMyTeam(run.teamId) ? "text-emerald-400" : "text-red-400"}`}>
                    +{ev.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
