"use client"

import type { Game, StatsPlayerGame, StatsTeamGame } from "@/lib/types"

interface BoxScoreTabProps {
  game: Game
  playerStats: StatsPlayerGame[]
  teamStats: StatsTeamGame[]
  myTeamId: number
}

// ── Calculation helpers (per METODOLOGIA_CALCULOS.md) ──

function calcEfg(fgMade: number, t3Made: number, fgAtt: number): string {
  if (fgAtt === 0) return "0.0"
  return (((fgMade + 0.5 * t3Made) / fgAtt) * 100).toFixed(1)
}

function calcTs(points: number, fgAtt: number, ftAtt: number): string {
  const denom = 2 * (fgAtt + 0.44 * ftAtt)
  if (denom === 0) return "0.0"
  return ((points / denom) * 100).toFixed(1)
}

function calcTovPct(turnovers: number, fgAtt: number, ftAtt: number): string {
  const poss = fgAtt + 0.44 * ftAtt + turnovers
  if (poss === 0) return "0.0"
  return ((turnovers / poss) * 100).toFixed(1)
}

function calcOrbPct(orbOff: number, oppRebDef: number): string {
  const total = orbOff + oppRebDef
  if (total === 0) return "0.0"
  return ((orbOff / total) * 100).toFixed(1)
}

function calcFtRate(ftAtt: number, fgAtt: number): string {
  if (fgAtt === 0) return "0.0"
  return ((ftAtt / fgAtt) * 100).toFixed(1)
}

// ── Comparative bar component ──

function CompBar({
  label,
  myVal,
  oppVal,
  myName,
  oppName,
  higherIsBetter = true,
}: {
  label: string
  myVal: number
  oppVal: number
  myName: string
  oppName: string
  higherIsBetter?: boolean
}) {
  const max = Math.max(myVal, oppVal, 1)
  const myPct = (myVal / max) * 100
  const oppPct = (oppVal / max) * 100
  const myBetter = higherIsBetter ? myVal >= oppVal : myVal <= oppVal

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs font-medium">
        <span className={myBetter ? "text-emerald-400" : "text-red-400"}>
          {typeof myVal === "number" && myVal % 1 !== 0 ? myVal.toFixed(1) : myVal}
        </span>
        <span className="text-muted-foreground">{label}</span>
        <span className={!myBetter ? "text-emerald-400" : "text-red-400"}>
          {typeof oppVal === "number" && oppVal % 1 !== 0 ? oppVal.toFixed(1) : oppVal}
        </span>
      </div>
      <div className="flex items-center gap-1">
        {/* My team bar (right-aligned) */}
        <div className="flex h-2.5 flex-1 justify-end overflow-hidden rounded-l-full bg-secondary">
          <div
            className={`h-full rounded-l-full transition-all ${myBetter ? "bg-emerald-500" : "bg-red-500"}`}
            style={{ width: `${myPct}%` }}
          />
        </div>
        {/* Opponent bar (left-aligned) */}
        <div className="flex h-2.5 flex-1 overflow-hidden rounded-r-full bg-secondary">
          <div
            className={`h-full rounded-r-full transition-all ${!myBetter ? "bg-emerald-500" : "bg-red-500"}`}
            style={{ width: `${oppPct}%` }}
          />
        </div>
      </div>
    </div>
  )
}

// ── Four Factors visual ──

function FourFactorCard({
  label,
  myVal,
  oppVal,
  higherIsBetter,
  description,
}: {
  label: string
  myVal: string
  oppVal: string
  higherIsBetter: boolean
  description: string
}) {
  const myN = Number(myVal)
  const oppN = Number(oppVal)
  const isBetter = higherIsBetter ? myN >= oppN : myN <= oppN

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="mb-1 text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mb-0.5 text-[10px] text-muted-foreground/70">{description}</p>
      <div className="mt-3 flex items-end justify-between">
        <div className="text-center">
          <p className={`font-display text-xl font-bold ${isBetter ? "text-emerald-400" : "text-red-400"}`}>
            {myVal}%
          </p>
          <p className="text-[10px] text-muted-foreground">Local</p>
        </div>
        <span className="mb-1 text-xs text-muted-foreground">vs</span>
        <div className="text-center">
          <p className={`font-display text-xl font-bold ${!isBetter ? "text-emerald-400" : "text-red-400"}`}>
            {oppVal}%
          </p>
          <p className="text-[10px] text-muted-foreground">Rival</p>
        </div>
      </div>
    </div>
  )
}

export function BoxScoreTab({ game, playerStats, teamStats, myTeamId }: BoxScoreTabProps) {
  const isHome = game.home_team_id === myTeamId
  const myTeamName = isHome ? game.home_team?.name : game.away_team?.name
  const oppTeamName = isHome ? game.away_team?.name : game.home_team?.name
  const oppTeamId = isHome ? game.away_team_id : game.home_team_id

  // Player stats split
  const myPlayers = playerStats.filter((s) => s.team_id === myTeamId)
  const oppPlayers = playerStats.filter((s) => s.team_id === oppTeamId)

  // Team stats
  const myTeamStat = teamStats.find((s) => s.team_id === myTeamId)
  const oppTeamStat = teamStats.find((s) => s.team_id === oppTeamId)

  // ── Aggregated team totals from player stats (for eFG% and TS% at team level) ──
  const aggregateTeam = (players: StatsPlayerGame[]) => {
    const sum = (fn: (s: StatsPlayerGame) => number) =>
      players.reduce((a, s) => a + fn(s), 0)
    const pts = sum((s) => s.points ?? 0)
    const t2m = sum((s) => s.t2_made ?? 0)
    const t2a = sum((s) => s.t2_att ?? 0)
    const t3m = sum((s) => s.t3_made ?? 0)
    const t3a = sum((s) => s.t3_att ?? 0)
    const ftm = sum((s) => s.ft_made ?? 0)
    const fta = sum((s) => s.ft_att ?? 0)
    const fgm = t2m + t3m
    const fga = t2a + t3a
    const reb = sum((s) => s.reb_tot ?? 0)
    const rebOff = sum((s) => s.reb_off ?? 0)
    const rebDef = sum((s) => s.reb_def ?? 0)
    const ast = sum((s) => s.assists ?? 0)
    const to = sum((s) => s.turnovers ?? 0)
    const stl = sum((s) => s.steals ?? 0)
    const blk = sum((s) => s.blocks_for ?? 0)

    return { pts, t2m, t2a, t3m, t3a, ftm, fta, fgm, fga, reb, rebOff, rebDef, ast, to, stl, blk }
  }

  const myAgg = aggregateTeam(myPlayers)
  const oppAgg = aggregateTeam(oppPlayers)

  // Four Factors
  const myEfg = calcEfg(myAgg.fgm, myAgg.t3m, myAgg.fga)
  const oppEfg = calcEfg(oppAgg.fgm, oppAgg.t3m, oppAgg.fga)
  const myTov = calcTovPct(myAgg.to, myAgg.fga, myAgg.fta)
  const oppTov = calcTovPct(oppAgg.to, oppAgg.fga, oppAgg.fta)
  const myOrb = calcOrbPct(myAgg.rebOff, oppAgg.rebDef)
  const oppOrb = calcOrbPct(oppAgg.rebOff, myAgg.rebDef)
  const myFtRate = calcFtRate(myAgg.fta, myAgg.fga)
  const oppFtRate = calcFtRate(oppAgg.fta, oppAgg.fga)

  // FG% for comparison bars
  const myFgPct = myAgg.fga > 0 ? (myAgg.fgm / myAgg.fga) * 100 : 0
  const oppFgPct = oppAgg.fga > 0 ? (oppAgg.fgm / oppAgg.fga) * 100 : 0

  // Points in the paint estimate: 2pt made * 2 (rough estimate if no zone data)
  const myPaintPts = myAgg.t2m * 2
  const oppPaintPts = oppAgg.t2m * 2

  // ── Render ──
  const statColumns = [
    { key: "min", label: "MIN" },
    { key: "pts", label: "PTS" },
    { key: "reb", label: "REB" },
    { key: "ast", label: "AST" },
    { key: "to", label: "TO" },
    { key: "stl", label: "ST" },
    { key: "blk", label: "BLK" },
    { key: "pm", label: "+/-" },
    { key: "pir", label: "PIR" },
    { key: "efg", label: "eFG%" },
    { key: "ts", label: "TS%" },
  ]

  const getPlayerStatValue = (s: StatsPlayerGame, key: string) => {
    const fgm = (s.t2_made ?? 0) + (s.t3_made ?? 0)
    const fga = (s.t2_att ?? 0) + (s.t3_att ?? 0)
    const pts = s.points ?? 0
    const fta = s.ft_att ?? 0

    switch (key) {
      case "min": return s.minutes ?? "0:00"
      case "pts": return pts
      case "reb": return s.reb_tot ?? 0
      case "ast": return s.assists ?? 0
      case "to": return s.turnovers ?? 0
      case "stl": return s.steals ?? 0
      case "blk": return s.blocks_for ?? 0
      case "pm": {
        const v = s.plus_minus ?? 0
        return v > 0 ? `+${v}` : `${v}`
      }
      case "pir": return s.valoracion ?? 0
      case "efg": return calcEfg(fgm, s.t3_made ?? 0, fga)
      case "ts": return calcTs(pts, fga, fta)
      default: return "—"
    }
  }

  const renderPlayerTable = (players: StatsPlayerGame[], teamName: string) => {
    const starters = players.filter((p) => p.starter)
    const bench = players.filter((p) => !p.starter)

    return (
      <div className="rounded-xl border border-border bg-card">
        <div className="border-b border-border px-4 py-3">
          <h3 className="text-sm font-bold text-foreground">{teamName}</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-xs">
            <thead>
              <tr className="border-b border-border">
                <th className="sticky left-0 z-10 bg-card px-4 py-2.5 text-left font-semibold text-muted-foreground">
                  Jugador
                </th>
                {statColumns.map((c) => (
                  <th key={c.key} className="px-2.5 py-2.5 text-center font-semibold text-muted-foreground">
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {starters.length > 0 && (
                <tr>
                  <td colSpan={statColumns.length + 1} className="bg-secondary/40 px-4 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Titulares
                  </td>
                </tr>
              )}
              {starters.map((s) => (
                <tr key={s.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                  <td className="sticky left-0 z-10 bg-card px-4 py-2 font-medium text-foreground whitespace-nowrap">
                    <span className="mr-1.5 text-muted-foreground">#{s.player?.jersey_number ?? "?"}</span>
                    {s.player?.name ?? "Desconocido"}
                  </td>
                  {statColumns.map((c) => {
                    const val = getPlayerStatValue(s, c.key)
                    return (
                      <td key={c.key} className={`px-2.5 py-2 text-center tabular-nums ${
                        c.key === "pm"
                          ? Number(String(val).replace("+", "")) > 0
                            ? "text-emerald-400"
                            : Number(String(val).replace("+", "")) < 0
                            ? "text-red-400"
                            : "text-foreground"
                          : "text-foreground"
                      }`}>
                        {val}
                      </td>
                    )
                  })}
                </tr>
              ))}
              {bench.length > 0 && (
                <tr>
                  <td colSpan={statColumns.length + 1} className="bg-secondary/40 px-4 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Banquillo
                  </td>
                </tr>
              )}
              {bench.map((s) => (
                <tr key={s.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                  <td className="sticky left-0 z-10 bg-card px-4 py-2 font-medium text-foreground whitespace-nowrap">
                    <span className="mr-1.5 text-muted-foreground">#{s.player?.jersey_number ?? "?"}</span>
                    {s.player?.name ?? "Desconocido"}
                  </td>
                  {statColumns.map((c) => {
                    const val = getPlayerStatValue(s, c.key)
                    return (
                      <td key={c.key} className={`px-2.5 py-2 text-center tabular-nums ${
                        c.key === "pm"
                          ? Number(String(val).replace("+", "")) > 0
                            ? "text-emerald-400"
                            : Number(String(val).replace("+", "")) < 0
                            ? "text-red-400"
                            : "text-foreground"
                          : "text-foreground"
                      }`}>
                        {val}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* ── Box Score Tables ── */}
      {renderPlayerTable(myPlayers, myTeamName ?? "Mi Equipo")}
      {oppPlayers.length > 0 && renderPlayerTable(oppPlayers, oppTeamName ?? "Rival")}

      {/* ── Team Comparison (Comparative Bars) ── */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="mb-5 text-sm font-bold text-foreground">
          Comparativa de Equipo
        </h3>
        <div className="mb-4 flex items-center justify-between text-xs font-bold text-muted-foreground">
          <span className="text-primary">{myTeamName}</span>
          <span>{oppTeamName}</span>
        </div>
        <div className="space-y-4">
          <CompBar label="Rebotes Totales" myVal={myAgg.reb} oppVal={oppAgg.reb} myName={myTeamName ?? ""} oppName={oppTeamName ?? ""} />
          <CompBar label="Rebotes Ofensivos" myVal={myAgg.rebOff} oppVal={oppAgg.rebOff} myName={myTeamName ?? ""} oppName={oppTeamName ?? ""} />
          <CompBar label="Rebotes Defensivos" myVal={myAgg.rebDef} oppVal={oppAgg.rebDef} myName={myTeamName ?? ""} oppName={oppTeamName ?? ""} />
          <CompBar label="% Tiro de Campo" myVal={Number(myFgPct.toFixed(1))} oppVal={Number(oppFgPct.toFixed(1))} myName={myTeamName ?? ""} oppName={oppTeamName ?? ""} />
          <CompBar label="Pérdidas" myVal={myAgg.to} oppVal={oppAgg.to} myName={myTeamName ?? ""} oppName={oppTeamName ?? ""} higherIsBetter={false} />
          <CompBar label="Asistencias" myVal={myAgg.ast} oppVal={oppAgg.ast} myName={myTeamName ?? ""} oppName={oppTeamName ?? ""} />
          <CompBar label="Robos" myVal={myAgg.stl} oppVal={oppAgg.stl} myName={myTeamName ?? ""} oppName={oppTeamName ?? ""} />
          <CompBar label="Pts. en Pintura (est.)" myVal={myPaintPts} oppVal={oppPaintPts} myName={myTeamName ?? ""} oppName={oppTeamName ?? ""} />
        </div>
      </div>

      {/* ── Four Factors ── */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="mb-4 text-sm font-bold text-foreground">
          Four Factors (Dean Oliver)
        </h3>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <FourFactorCard
            label="eFG% — Eficiencia de Tiro"
            description="(FGM + 0.5×3PM) / FGA"
            myVal={myEfg}
            oppVal={oppEfg}
            higherIsBetter={true}
          />
          <FourFactorCard
            label="TOV% — Pérdidas"
            description="TO / Posesiones"
            myVal={myTov}
            oppVal={oppTov}
            higherIsBetter={false}
          />
          <FourFactorCard
            label="ORB% — Reb. Ofensivo"
            description="ORB / (ORB + Opp DRB)"
            myVal={myOrb}
            oppVal={oppOrb}
            higherIsBetter={true}
          />
          <FourFactorCard
            label="FT Rate — Tiros Libres"
            description="FTA / FGA"
            myVal={myFtRate}
            oppVal={oppFtRate}
            higherIsBetter={true}
          />
        </div>
      </div>
    </div>
  )
}
