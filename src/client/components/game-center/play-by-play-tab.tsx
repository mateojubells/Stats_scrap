"use client"

import { useMemo, useState } from "react"
import type { Game, PlayByPlay } from "@/lib/types"
import {
  ListOrdered,
  CircleDot,
  AlertTriangle,
  ArrowLeftRight,
  Timer,
  Filter,
} from "lucide-react"

interface PlayByPlayTabProps {
  game: Game
  pbp: PlayByPlay[]
  myTeamId: number
}

type PbpFilter = "all" | "baskets" | "fouls" | "subs" | "timeouts"

const filterOptions: { key: PbpFilter; label: string; icon: typeof CircleDot }[] = [
  { key: "all", label: "Todos", icon: ListOrdered },
  { key: "baskets", label: "Canastas", icon: CircleDot },
  { key: "fouls", label: "Faltas", icon: AlertTriangle },
  { key: "subs", label: "Cambios", icon: ArrowLeftRight },
  { key: "timeouts", label: "Tiempos Muertos", icon: Timer },
]

function classifyAction(actionType: string): PbpFilter[] {
  const at = actionType.toLowerCase()
  const tags: PbpFilter[] = []
  if (at.includes("made") || at.includes("dunk")) tags.push("baskets")
  if (at.includes("foul")) tags.push("fouls")
  if (at.includes("sub_in") || at.includes("sub_out")) tags.push("subs")
  if (at.includes("timeout")) tags.push("timeouts")
  return tags
}

function getActionIcon(actionType: string) {
  const at = actionType.toLowerCase()
  if (at.includes("3pt_made")) return "🏀"
  if (at.includes("2pt_made") || at.includes("dunk_made")) return "🏀"
  if (at.includes("ft_made")) return "🎯"
  if (at.includes("missed") || at.includes("miss")) return "❌"
  if (at.includes("assist")) return "🤝"
  if (at.includes("rebound") || at.includes("reb")) return "🔄"
  if (at.includes("steal")) return "🔥"
  if (at.includes("block")) return "🛡️"
  if (at.includes("turnover")) return "⚠️"
  if (at.includes("foul")) return "🟡"
  if (at.includes("sub_in")) return "➡️"
  if (at.includes("sub_out")) return "⬅️"
  if (at.includes("timeout")) return "⏱️"
  return "📋"
}

function formatActionType(actionType: string): string {
  return actionType
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

export function PlayByPlayTab({ game, pbp, myTeamId }: PlayByPlayTabProps) {
  const isHome = game.home_team_id === myTeamId
  const myTeamName = (isHome ? game.home_team?.name : game.away_team?.name) ?? "Mi Equipo"
  const oppTeamName = (isHome ? game.away_team?.name : game.home_team?.name) ?? "Rival"

  const [filter, setFilter] = useState<PbpFilter>("all")
  const [quarterFilter, setQuarterFilter] = useState<number | null>(null)

  const orderedPbp = useMemo(() => {
    const elapsed = (quarter: number, minute: string | null) => {
      const [mRaw, sRaw] = (minute ?? "0:00").split(":")
      const m = Number.parseInt(mRaw || "0", 10)
      const s = Number.parseInt(sRaw || "0", 10)
      return (quarter - 1) * 600 + (600 - (m * 60 + s))
    }

    return [...pbp].sort((a, b) => {
      if (a.id != null && b.id != null && a.id !== b.id) return a.id - b.id
      return elapsed(a.quarter, a.minute) - elapsed(b.quarter, b.minute)
    })
  }, [pbp])

  const filteredPbp = useMemo(() => {
    let events = orderedPbp

    // Quarter filter
    if (quarterFilter) {
      events = events.filter((ev) => ev.quarter === quarterFilter)
    }

    // Type filter
    if (filter !== "all") {
      events = events.filter((ev) => classifyAction(ev.action_type).includes(filter))
    }

    return events
  }, [orderedPbp, filter, quarterFilter])

  // Find unique quarters in the PBP data
  const quarters = useMemo(() => {
    const qs = new Set(orderedPbp.map((ev) => ev.quarter))
    return Array.from(qs).sort((a, b) => a - b)
  }, [orderedPbp])

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="mb-4 flex items-center gap-2">
          <ListOrdered className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-bold text-foreground">Play-by-Play</h3>
          <span className="text-xs text-muted-foreground">
            ({filteredPbp.length} eventos)
          </span>
        </div>

        {/* Filters */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          {filterOptions.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setFilter(opt.key)}
              className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                filter === opt.key
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
              }`}
            >
              <opt.icon className="h-3 w-3" />
              {opt.label}
            </button>
          ))}

          <div className="ml-auto flex items-center gap-1">
            <button
              onClick={() => setQuarterFilter(null)}
              className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                quarterFilter === null
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
              }`}
            >
              Todos
            </button>
            {quarters.map((q) => (
              <button
                key={q}
                onClick={() => setQuarterFilter(q)}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  quarterFilter === q
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-muted-foreground hover:text-foreground"
                }`}
              >
                Q{q}
              </button>
            ))}
          </div>
        </div>

        {/* Timeline */}
        <div className="max-h-[600px] overflow-y-auto rounded-lg">
          {filteredPbp.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              No hay eventos para este filtro.
            </div>
          ) : (
            <div className="space-y-0">
              {filteredPbp.map((ev, idx) => {
                const isMyTeamEvent = ev.team_id === myTeamId
                const isNeutral = ev.team_id == null
                const playerName = (ev as any).player?.name ?? ""
                const jersey = (ev as any).player?.jersey_number
                const homeScore = ev.home_score_partial ?? ""
                const awayScore = ev.away_score_partial ?? ""
                const scoreDisplay = homeScore !== "" ? `${homeScore} - ${awayScore}` : ""

                return (
                  <div
                    key={ev.id ?? idx}
                    className={`flex items-center gap-3 border-b border-border/30 px-3 py-2 text-xs transition-colors hover:bg-secondary/30 ${
                      isNeutral
                        ? ""
                        : isMyTeamEvent
                        ? "border-l-2 border-l-primary"
                        : "border-l-2 border-l-red-500/60"
                    }`}
                  >
                    {/* Time */}
                    <div className="flex w-16 flex-shrink-0 items-center gap-1 text-muted-foreground tabular-nums">
                      <span className="font-medium">Q{ev.quarter}</span>
                      <span>{ev.minute ?? "—"}</span>
                    </div>

                    {/* Icon */}
                    <span className="w-5 text-center text-sm">
                      {getActionIcon(ev.action_type)}
                    </span>

                    {/* Content */}
                    <div className="flex-1">
                      <span
                        className={`font-medium ${
                          isNeutral
                            ? "text-muted-foreground"
                            : isMyTeamEvent
                            ? "text-primary"
                            : "text-red-400"
                        }`}
                      >
                        {isNeutral
                          ? ""
                          : isMyTeamEvent
                          ? myTeamName
                          : oppTeamName}
                      </span>
                      {playerName && (
                        <span className="ml-1.5 text-foreground">
                          {jersey != null && (
                            <span className="mr-1 text-muted-foreground">#{jersey}</span>
                          )}
                          {playerName}
                        </span>
                      )}
                      <span className="ml-1.5 text-muted-foreground">
                        — {formatActionType(ev.action_type)}
                      </span>
                    </div>

                    {/* Score */}
                    {scoreDisplay && (
                      <span className="flex-shrink-0 rounded bg-secondary px-2 py-0.5 text-xs font-bold tabular-nums text-foreground">
                        {scoreDisplay}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
