"use client"

import { useEffect, useState } from "react"
import { FibaShotChart } from "@/components/fiba-shot-chart"
import { getPlayerShotsTagged } from "@/lib/api"
import type { Shot, StatsPlayerGame, Game } from "@/lib/types"

type TaggedShot = Shot & { isAssisted: boolean }
import { Crosshair, Target, Zap } from "lucide-react"

type GameRow = StatsPlayerGame & { game: Game }

interface Props {
  playerId: number
  teamId: number
  filteredGames: GameRow[]
}

export function ShotChartTab({ playerId, teamId, filteredGames }: Props) {
  const [shots, setShots] = useState<TaggedShot[]>([])
  const [shotFilter, setShotFilter] = useState<"all" | "catch" | "pullup">(
    "all",
  )

  const gameIds = filteredGames.map((g) => g.game_id)

  useEffect(() => {
    getPlayerShotsTagged(playerId, teamId, gameIds.length > 0 ? gameIds : undefined).then(
      (data) => setShots(data as TaggedShot[]),
    )
  }, [playerId, teamId, JSON.stringify(gameIds)])

  // ─── Shot Calculations ───
  const allShots =
    shotFilter === "catch"
      ? shots.filter((s) => s.isAssisted && s.made)  // Canastas asistidas: solo METIDAS y ASISTIDAS
      : shotFilter === "pullup"
      ? shots.filter((s) => !s.isAssisted && s.made)  // Tras bote: solo METIDAS y NO asistidas
      : shots  // Todos: todos los tiros (metidos y fallados)

  // Clasificación de 3PT: lee directamente la columna zone de la BD
  // Valores posibles: "3pt", "paint", "mid-range"
  const isThree = (s: TaggedShot) => s.zone === "3pt"

  // Para el MAPA: usar el filtro actual
  const t3Shots = allShots.filter(isThree)
  const t2Shots = allShots.filter((s) => !isThree(s))
  const fgm = allShots.filter((s) => s.made).length
  const fga = allShots.length
  const t3m = t3Shots.filter((s) => s.made).length
  const t2m = t2Shots.filter((s) => s.made).length

  // Para MÉTRICAS: SIEMPRE usar TODOS los tiros (sin filtrar) para eFG%, TS%, PPS
  const allT3Shots = shots.filter(isThree)
  const allT2Shots = shots.filter((s) => !isThree(s))
  const totalFGM = shots.filter((s) => s.made).length
  const totalFGA = shots.length
  const totalT3M = allT3Shots.filter((s) => s.made).length
  const totalT2M = allT2Shots.filter((s) => s.made).length

  // Get FT data from box-score stats
  const totalFTM = filteredGames.reduce((a, g) => a + (g.ft_made ?? 0), 0)
  const totalFTA = filteredGames.reduce((a, g) => a + (g.ft_att ?? 0), 0)
  const boxScorePoints = filteredGames.reduce((a, g) => a + (g.points ?? 0), 0)

  // Puntos solo de tiros de cancha (sin tiros libres)
  const pointsFromShots = totalT2M * 2 + totalT3M * 3

  // eFG% = (FGM + 0.5 × 3PM) / FGA × 100 (sin tiros libres)
  const eFG = totalFGA > 0 ? ((totalFGM + 0.5 * totalT3M) / totalFGA) * 100 : 0

  // TS% = Puntos de tiros / (2 × FGA) × 100 (sin tiros libres)
  const tsDenom = 2 * totalFGA
  const tsPct = tsDenom > 0 ? (pointsFromShots / tsDenom) * 100 : 0

  // PPS = Puntos de tiros / FGA (solo puntos de cancha, sin tiros libres)
  const pps = totalFGA > 0 ? pointsFromShots / totalFGA : 0

  const displayedDots = allShots.map((s) => ({
    x: s.x_coord,
    y: s.y_coord,
    made: s.made,
  }))

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
      {/* ── Shot Chart ── */}
      <div className="lg:col-span-3 rounded-xl border border-border bg-card p-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              <h3 className="font-display text-base font-bold text-foreground">
                Mapa de Tiros
              </h3>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {fga} tiros — {fgm} aciertos (
              {fga > 0 ? ((fgm / fga) * 100).toFixed(1) : "0"}%)
              {shotFilter !== "all" && (
                <span className="text-muted-foreground/60"> · Filtrado por {shotFilter === "catch" ? "canastas asistidas" : "tiros tras bote"}</span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[#39ff14]" />
              <span className="text-xs text-muted-foreground">Acierto</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-destructive" />
              <span className="text-xs text-muted-foreground">Fallo</span>
            </div>
          </div>
        </div>

        {/* Shot filter buttons */}
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Filtro:
          </span>
          {(
            [
              { key: "all", label: "Todos" },
              { key: "catch", label: "Canastas Asistidas" },
              { key: "pullup", label: "Tras bote" },
            ] as const
          ).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setShotFilter(key)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                shotFilter === key
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="w-full overflow-hidden rounded-lg">
          <FibaShotChart shots={displayedDots} />
        </div>
      </div>

      {/* ── Efficiency Metrics ── */}
      <div className="lg:col-span-2 space-y-4">
        {/* eFG% */}
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <Crosshair className="h-4 w-4 text-emerald-400" />
            <div>
              <h4 className="text-sm font-bold text-foreground">eFG%</h4>
              <p className="text-[10px] text-muted-foreground">
                Effective Field Goal %
              </p>
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-display text-4xl font-bold text-foreground">
              {eFG.toFixed(1)}
            </span>
            <span className="text-lg text-muted-foreground">%</span>
          </div>
          <div className="mt-2 rounded-lg bg-secondary/50 px-3 py-2">
            <p className="text-[11px] text-muted-foreground font-mono">
              eFG% = (FGM + 0.5 × 3PM) / FGA × 100
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              = ({totalFGM} + 0.5 × {totalT3M}) / {totalFGA} × 100
            </p>
          </div>
        </div>

        {/* TS% */}
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="h-4 w-4 text-amber-400" />
            <div>
              <h4 className="text-sm font-bold text-foreground">TS%</h4>
              <p className="text-[10px] text-muted-foreground">
                True Shooting %
              </p>
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-display text-4xl font-bold text-foreground">
              {tsPct.toFixed(1)}
            </span>
            <span className="text-lg text-muted-foreground">%</span>
          </div>
          <div className="mt-2 rounded-lg bg-secondary/50 px-3 py-2">
            <p className="text-[11px] text-muted-foreground font-mono">
              TS% = PTS Tiros / (2 × FGA) × 100
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              = {pointsFromShots} / (2 × {totalFGA}) × 100
            </p>
          </div>
        </div>

        {/* PPS */}
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <Target className="h-4 w-4 text-blue-400" />
            <div>
              <h4 className="text-sm font-bold text-foreground">PPS</h4>
              <p className="text-[10px] text-muted-foreground">
                Points Per Shot
              </p>
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-display text-4xl font-bold text-foreground">
              {pps.toFixed(2)}
            </span>
          </div>
          <div className="mt-2 rounded-lg bg-secondary/50 px-3 py-2">
            <p className="text-[11px] text-muted-foreground font-mono">
              PPS = Puntos Tiros / FGA
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              = ({totalT2M} × 2 + {totalT3M} × 3) / {totalFGA}
            </p>
          </div>
        </div>

        {/* Shot breakdown */}
        <div className="rounded-xl border border-border bg-card p-5">
          <h4 className="text-sm font-bold text-foreground mb-3">
            Desglose de Tiro
          </h4>
          <div className="space-y-3">
            <ShotRow
              label="Tiros de 2"
              made={totalT2M}
              att={allT2Shots.length}
            />
            <ShotRow
              label="Tiros de 3"
              made={totalT3M}
              att={allT3Shots.length}
            />
          </div>
        </div>

        {/* Free Throws - Separate section */}
        <div className="rounded-xl border border-border bg-card p-5">
          <h4 className="text-sm font-bold text-foreground mb-3">
            Tiros Libres
          </h4>
          <ShotRow
            label="Tiros Libres"
            made={totalFTM}
            att={totalFTA}
          />
        </div>
      </div>
    </div>
  )
}

function ShotRow({
  label,
  made,
  att,
}: {
  label: string
  made: number
  att: number
}) {
  const pct = att > 0 ? (made / att) * 100 : 0
  return (
    <div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold text-foreground">
          {made}/{att} ({pct.toFixed(1)}%)
        </span>
      </div>
      <div className="mt-1 h-1.5 w-full rounded-full bg-secondary overflow-hidden">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
