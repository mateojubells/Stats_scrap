"use client"

import { useEffect, useState } from "react"
import { BarChart3 } from "lucide-react"
import { getTeamSeasonAverages } from "@/lib/api"

interface Props {
  myTeamId: number
  opponentTeamId: number
  myName: string
  oppName: string
}

interface Row {
  label: string
  myTeam: number
  opponent: number
  max: number
  isPct?: boolean
  lowerBetter?: boolean
}

export function StatComparison({ myTeamId, opponentTeamId, myName, oppName }: Props) {
  const [rows, setRows] = useState<Row[]>([])

  useEffect(() => {
    ;(async () => {
      const [my, opp] = await Promise.all([
        getTeamSeasonAverages(myTeamId),
        getTeamSeasonAverages(opponentTeamId),
      ])
      if (!my || !opp) return

      const build = (
        label: string,
        a: string,
        b: string,
        isPct = false,
        lowerBetter = false,
      ): Row => {
        const av = parseFloat(a) || 0
        const bv = parseFloat(b) || 0
        return {
          label,
          myTeam: av,
          opponent: bv,
          max: Math.max(av, bv, 1) * 1.1,
          isPct,
          lowerBetter,
        }
      }

      setRows([
        build("PUNTOS", my.ppg, opp.ppg),
        build("REBOTES", my.rpg, opp.rpg),
        build("ASISTENCIAS", my.apg, opp.apg),
        build("% TIRO DE CAMPO", my.fgPct, opp.fgPct, true),
        build("% TRIPLES", my.t3Pct, opp.t3Pct, true),
        build("% TIROS LIBRES", my.ftPct, opp.ftPct, true),
        build("ROBOS", my.spg, opp.spg),
        build("TAPONES", my.bpg, opp.bpg),
        build("PÉRDIDAS", my.tpg, opp.tpg, false, true),
      ])
    })()
  }, [myTeamId, opponentTeamId])

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-2">
        <BarChart3 className="h-4 w-4 text-muted-foreground" />
        <h2 className="font-display text-lg font-bold text-foreground">
          Comparación Estadística
        </h2>
      </div>
      <div className="mt-2 flex items-center justify-end gap-4">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-primary" />
          <span className="text-xs text-muted-foreground">{myName}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-accent" />
          <span className="text-xs text-muted-foreground">{oppName}</span>
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-6">
        {rows.map((stat) => {
          const myPct = (stat.myTeam / stat.max) * 100
          const oppPct = (stat.opponent / stat.max) * 100
          const myWins = stat.lowerBetter
            ? stat.myTeam < stat.opponent
            : stat.myTeam >= stat.opponent

          return (
            <div key={stat.label}>
              <p className="mb-2 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {stat.label}
              </p>
              <div className="flex items-center gap-4">
                <span
                  className={`w-20 text-sm font-bold ${
                    myWins ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  {stat.isPct ? `${stat.myTeam}%` : stat.myTeam}
                </span>
                <div className="relative flex-1 h-3 rounded-full bg-secondary overflow-hidden">
                  <div
                    className="absolute left-0 top-0 h-full rounded-full bg-primary transition-all"
                    style={{ width: `${myPct}%` }}
                  />
                  <div
                    className="absolute left-0 top-0 h-full rounded-full bg-accent transition-all"
                    style={{ width: `${oppPct}%`, opacity: 0.7 }}
                  />
                </div>
                <span
                  className={`w-20 text-right text-sm font-bold ${
                    !myWins ? "text-accent" : "text-muted-foreground"
                  }`}
                >
                  {stat.isPct ? `${stat.opponent}%` : stat.opponent}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
