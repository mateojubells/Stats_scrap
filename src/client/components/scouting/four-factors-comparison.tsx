"use client"

import { useEffect, useState } from "react"
import { Activity } from "lucide-react"
import { getTeamFourFactors } from "@/lib/api"

interface Props {
  myTeamId: number
  opponentTeamId: number
  myName: string
  oppName: string
}

interface Factor {
  label: string
  description: string
  myVal: number
  oppVal: number
  lowerBetter: boolean
}

function FactorBar({
  factor,
  myName,
  oppName,
}: {
  factor: Factor
  myName: string
  oppName: string
}) {
  const max = Math.max(factor.myVal, factor.oppVal, 1) * 1.15
  const myPct = (factor.myVal / max) * 100
  const oppPct = (factor.oppVal / max) * 100

  const myWins = factor.lowerBetter
    ? factor.myVal <= factor.oppVal
    : factor.myVal >= factor.oppVal

  return (
    <div className="rounded-lg border border-border bg-secondary/30 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-sm font-bold text-foreground">{factor.label}</p>
          <p className="text-xs text-muted-foreground">{factor.description}</p>
        </div>
        <span className="text-xs text-muted-foreground">
          {factor.lowerBetter ? "↓ Menor es mejor" : "↑ Mayor es mejor"}
        </span>
      </div>

      {/* My team bar */}
      <div className="mb-2">
        <div className="mb-1 flex items-center justify-between text-xs">
          <span className="font-medium text-primary">{myName}</span>
          <span
            className={`font-bold ${myWins ? "text-green-400" : "text-red-400"}`}
          >
            {factor.myVal.toFixed(1)}%
          </span>
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-secondary">
          <div
            className={`h-full rounded-full transition-all ${myWins ? "bg-primary" : "bg-primary/40"}`}
            style={{ width: `${myPct}%` }}
          />
        </div>
      </div>

      {/* Opponent bar */}
      <div>
        <div className="mb-1 flex items-center justify-between text-xs">
          <span className="font-medium text-accent">{oppName}</span>
          <span
            className={`font-bold ${!myWins ? "text-green-400" : "text-red-400"}`}
          >
            {factor.oppVal.toFixed(1)}%
          </span>
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-secondary">
          <div
            className={`h-full rounded-full transition-all ${!myWins ? "bg-accent" : "bg-accent/40"}`}
            style={{ width: `${oppPct}%` }}
          />
        </div>
      </div>
    </div>
  )
}

export function FourFactorsComparison({
  myTeamId,
  opponentTeamId,
  myName,
  oppName,
}: Props) {
  const [factors, setFactors] = useState<Factor[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    ;(async () => {
      const [myFF, oppFF] = await Promise.all([
        getTeamFourFactors(myTeamId),
        getTeamFourFactors(opponentTeamId),
      ])

      if (!myFF || !oppFF) {
        setLoading(false)
        return
      }

      setFactors([
        {
          label: "eFG%",
          description: "Eficiencia de Tiro (Effective Field Goal %)",
          myVal: myFF.efg,
          oppVal: oppFF.efg,
          lowerBetter: false,
        },
        {
          label: "TOV%",
          description: "Porcentaje de Pérdidas por Posesión",
          myVal: myFF.tovPct,
          oppVal: oppFF.tovPct,
          lowerBetter: true,
        },
        {
          label: "ORB%",
          description: "Rebote Ofensivo (Mediana por partido)",
          myVal: myFF.orbPct,
          oppVal: oppFF.orbPct,
          lowerBetter: false,
        },
        {
          label: "FT Rate",
          description: "Tiros Libres Intentados / Tiros de Campo Intentados",
          myVal: myFF.ftRate,
          oppVal: oppFF.ftRate,
          lowerBetter: false,
        },
      ])
      setLoading(false)
    })()
  }, [myTeamId, opponentTeamId])

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="h-6 w-40 animate-pulse rounded bg-secondary" />
        <div className="mt-4 grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-28 animate-pulse rounded-lg bg-secondary"
            />
          ))}
        </div>
      </div>
    )
  }

  if (factors.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-5 text-center text-sm text-muted-foreground">
        Sin datos suficientes para calcular los Four Factors.
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-4 flex items-center gap-2">
        <Activity className="h-4 w-4 text-primary" />
        <h2 className="font-display text-lg font-bold text-foreground">
          Four Factors (Dean Oliver)
        </h2>
      </div>

      {/* Legend */}
      <div className="mb-4 flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-primary" />
          <span className="text-xs text-muted-foreground">{myName}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-accent" />
          <span className="text-xs text-muted-foreground">{oppName}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {factors.map((factor) => (
          <FactorBar
            key={factor.label}
            factor={factor}
            myName={myName}
            oppName={oppName}
          />
        ))}
      </div>
    </div>
  )
}
