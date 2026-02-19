"use client"

import { useMemo, useState } from "react"
import type { Game, Shot } from "@/lib/types"
import { FibaShotChart } from "@/components/fiba-shot-chart"
import { Target } from "lucide-react"

interface GameShotChartTabProps {
  game: Game
  shots: Shot[]
  myTeamId: number
}

// ══════════════════════════════════════════════════════════════════════════
// ZONE CLASSIFICATION — 3 zonas unificadas: "3pt", "paint", "mid-range"
//
// La zona se determina en el backend (repository.save_game_stats) usando:
//   1. action_type del PBP vinculado (3pt_made/3pt_missed → "3pt")
//   2. Coordenadas normalizadas (paint vs mid-range)
// El frontend lee directamente la columna `zone` de la BD.
//
// Clasificación por zona (para fallback visual):
//   Paint:  X ∈ [33.46, 66.28], Y ∈ [0, 19.94]
//   3pt:    zona === "3pt"
//   Mid-range: todo lo demás
// ══════════════════════════════════════════════════════════════════════════

/** Returns true when zone is "3pt" */
function isThree(s: Shot): boolean {
  return s.zone === "3pt"
}

/** Returns true when zone is "paint" */
function isInPaint(s: Shot): boolean {
  return s.zone === "paint"
}

/** Returns true when zone is "mid-range" */
function isMidRange(s: Shot): boolean {
  return s.zone === "mid-range"
}

export function GameShotChartTab({ game, shots, myTeamId }: GameShotChartTabProps) {
  const homeId = game.home_team_id
  const awayId = game.away_team_id
  const homeName = game.home_team?.name ?? "Local"
  const awayName = game.away_team?.name ?? "Visitante"

  type Filter = "all" | "home" | "away"
  const [filter, setFilter] = useState<Filter>("all")

  const filtered = useMemo(() => {
    if (filter === "home") return shots.filter((s) => s.team_id === homeId)
    if (filter === "away") return shots.filter((s) => s.team_id === awayId)
    return shots
  }, [shots, filter, homeId, awayId])

  const shotDots = useMemo(
    () =>
      filtered.map((s) => ({
        x: s.x_coord,
        y: s.y_coord,
        made: s.made,
        x_data: s.x_coord,
        y_data: s.y_coord,
        zone: s.zone ?? undefined,
      })),
    [filtered],
  )

  // Stats summary
  const made = filtered.filter((s) => s.made).length
  const total = filtered.length
  const pct = total > 0 ? ((made / total) * 100).toFixed(1) : "0"

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="mb-1 font-display text-lg font-bold text-foreground flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              Shot Chart del Partido
            </h3>
            <p className="text-sm text-muted-foreground">
              {made}/{total} tiros convertidos ({pct}%)
            </p>
          </div>

          {/* Team filter */}
          <div className="flex gap-1 rounded-lg border border-border bg-secondary/30 p-1">
              {(
                [
                  { key: "all", label: "Todos" },
                  { key: "home", label: homeName },
                  { key: "away", label: awayName },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => setFilter(opt.key)}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    filter === opt.key
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
          </div>
        </div>
      </div>

      {/* Main content: shot map + stats side by side */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start">

          {/* Shot Chart — 90% of original max-w-4xl (896px) → ~806px */}
          <div className="w-full lg:max-w-[806px] lg:flex-shrink-0">
            <FibaShotChart shots={shotDots} className="w-full" />
          </div>

          {/* Stats panel — grows to fill remaining space */}
          <div className="flex flex-col gap-3 lg:flex-1 lg:min-w-[180px]">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Porcentajes por zona
            </p>
            <ZoneStat label="Pintura" shots={filtered} zoneFn={isInPaint} />
            <ZoneStat label="Media distancia" shots={filtered} zoneFn={isMidRange} />
            <ZoneStat label="Triple" shots={filtered} zoneFn={isThree} />


          </div>
        </div>
      </div>
    </div>
  )
}

// ── Zone classification helpers ──
// Las funciones isThree, isInPaint, isMidRange están definidas arriba
// usando directamente la columna zone de la BD ("3pt", "paint", "mid-range")

function ZoneStat({
  label,
  shots,
  zoneFn,
}: {
  label: string
  shots: Shot[]
  zoneFn: (s: Shot) => boolean
}) {
  const zoneShots = shots.filter(zoneFn)
  
  const made = zoneShots.filter((s) => s.made).length
  const total = zoneShots.length
  const pct = total > 0 ? ((made / total) * 100).toFixed(1) : "—"
  const pctNum = total > 0 ? (made / total) * 100 : 0

  return (
    <div className="rounded-lg border border-border bg-card/50 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground truncate">{label}</p>
        <p className="font-display text-lg font-bold text-foreground shrink-0">
          {pct}{total > 0 ? "%" : ""}
        </p>
      </div>
      <p className="text-xs text-muted-foreground/60">
        {made}/{total} tiros
      </p>
      {/* Mini progress bar */}
      {total > 0 && (
        <div className="mt-1.5 h-1 w-full rounded-full bg-secondary">
          <div
            className="h-1 rounded-full bg-primary transition-all"
            style={{ width: `${pctNum}%` }}
          />
        </div>
      )}
    </div>
  )
}
