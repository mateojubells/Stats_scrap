"use client"

import { useEffect, useState } from "react"
import {
  getTeamFourFactors,
  getTeamScoringBreakdown,
  getLeagueBenchmark,
  getTeamLeague,
} from "@/lib/api"
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts"
import { Hexagon, PieChartIcon } from "lucide-react"

interface AdvancedStatsTabProps {
  teamId: number
}

interface FourFactors {
  efg: number
  tovPct: number
  orbPct: number
  ftRate: number
}

interface ScoringBreakdown {
  offTurnover: number
  fastbreak: number
  secondChance: number
  regular: number
}

export function AdvancedStatsTab({ teamId }: AdvancedStatsTabProps) {
  const [fourFactors, setFourFactors] = useState<FourFactors | null>(null)
  const [leagueAvg, setLeagueAvg] = useState<FourFactors | null>(null)
  const [scoring, setScoring] = useState<ScoringBreakdown | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [ff, breakdown, league] = await Promise.all([
        getTeamFourFactors(teamId),
        getTeamScoringBreakdown(teamId),
        getTeamLeague(teamId),
      ])

      setFourFactors(ff)
      setScoring(breakdown)

      // Get league averages for radar comparison
      if (league) {
        const benchmark = await getLeagueBenchmark(league.id)
        if (benchmark.length > 0) {
          const avg = {
            efg:
              benchmark.reduce((a, b) => a + b.efg, 0) / benchmark.length,
            tovPct:
              benchmark.reduce((a, b) => a + b.tovPct, 0) /
              benchmark.length,
            orbPct:
              benchmark.reduce((a, b) => a + b.orbPct, 0) /
              benchmark.length,
            ftRate:
              benchmark.reduce((a, b) => a + b.ftRate, 0) /
              benchmark.length,
          }
          setLeagueAvg({
            efg: Number(avg.efg.toFixed(1)),
            tovPct: Number(avg.tovPct.toFixed(1)),
            orbPct: Number(avg.orbPct.toFixed(1)),
            ftRate: Number(avg.ftRate.toFixed(1)),
          })
        }
      }

      setLoading(false)
    }
    load()
  }, [teamId])

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="h-96 animate-pulse rounded-xl border border-border bg-card" />
        <div className="h-96 animate-pulse rounded-xl border border-border bg-card" />
      </div>
    )
  }

  // Radar data — normalize to 0-100 scale for visual display
  const radarData = fourFactors
    ? [
        {
          factor: "eFG%",
          team: fourFactors.efg,
          league: leagueAvg?.efg ?? 50,
          fullMark: 80,
        },
        {
          factor: "TOV%",
          // Invert: lower is better for turnovers
          team: Math.max(0, 30 - fourFactors.tovPct),
          league: Math.max(0, 30 - (leagueAvg?.tovPct ?? 15)),
          fullMark: 30,
        },
        {
          factor: "ORB%",
          team: fourFactors.orbPct,
          league: leagueAvg?.orbPct ?? 10,
          fullMark: 20,
        },
        {
          factor: "FT Rate",
          team: fourFactors.ftRate,
          league: leagueAvg?.ftRate ?? 25,
          fullMark: 50,
        },
      ]
    : []

  // Pie chart data
  const pieData = scoring
    ? [
        { name: "Juego regular", value: scoring.regular, color: "hsl(217, 91%, 60%)" },
        {
          name: "Tras pérdida rival",
          value: scoring.offTurnover,
          color: "hsl(142, 71%, 45%)",
        },
        {
          name: "2ª oportunidad",
          value: scoring.secondChance,
          color: "hsl(25, 95%, 55%)",
        },
        { name: "Contraataque", value: scoring.fastbreak, color: "hsl(48, 96%, 53%)" },
      ].filter((d) => d.value > 0)
    : []

  const totalPts = pieData.reduce((a, b) => a + b.value, 0)

  const getScoreTypeDescription = (name: string) => {
    switch (name) {
      case "Juego regular":
        return "Puntos anotados en ataque posicional normal (medio campo)"
      case "Tras pérdida rival":
        return "Puntos conseguidos inmediatamente después de robar el balón al rival"
      case "2ª oportunidad":
        return "Puntos anotados tras capturar un rebote ofensivo"
      case "Contraataque":
        return "Puntos en transición rápida antes de que la defensa se coloque"
      default:
        return ""
    }
  }

  return (
    <div className="space-y-6">
      {/* Four Factors Formulas */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="mb-4 font-display text-sm font-bold text-foreground">
          Four Factors de Dean Oliver
        </h3>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {fourFactors && (
            <>
              <FactorCard
                label="eFG%"
                value={`${fourFactors.efg}%`}
                formula="(FGM + 0.5 × 3PM) / FGA"
                leagueAvg={leagueAvg?.efg ?? 0}
                higherIsBetter={true}
                teamVal={fourFactors.efg}
                description="Porcentaje Efectivo de Tiro - Mide la eficiencia considerando que los triples valen más. Mayor es mejor."
              />
              <FactorCard
                label="TOV%"
                value={`${fourFactors.tovPct}%`}
                formula="TO / (FGA + 0.44×FTA + TO)"
                leagueAvg={leagueAvg?.tovPct ?? 0}
                higherIsBetter={false}
                teamVal={fourFactors.tovPct}
                description="Porcentaje de Pérdidas - Proporción de posesiones que terminan en pérdida. Menor es mejor."
              />
              <FactorCard
                label="ORB per game"
                value={`${fourFactors.orbPct}`}
                formula="Reb. ofensivos capturados"
                leagueAvg={leagueAvg?.orbPct ?? 0}
                higherIsBetter={true}
                teamVal={fourFactors.orbPct}
                description="Rebotes Ofensivos por partido - Más rebotes ofensivos dan segundas oportunidades de anotar. Mayor es mejor."
              />
              <FactorCard
                label="FT Rate"
                value={`${fourFactors.ftRate}%`}
                formula="FTA / FGA"
                leagueAvg={leagueAvg?.ftRate ?? 0}
                higherIsBetter={true}
                teamVal={fourFactors.ftRate}
                description="Ratio de Tiros Libres - Cuántos tiros libres se obtienen respecto a tiros de campo. Mayor es mejor."
              />
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Radar Chart */}
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="mb-4 flex items-center gap-2">
            <Hexagon className="h-4 w-4 text-primary" />
            <h3 className="font-display text-sm font-bold text-foreground">
              Radar: Four Factors
            </h3>
          </div>

          {radarData.length > 0 ? (
            <div className="flex h-80 items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="70%">
                  <PolarGrid
                    stroke="rgba(255,255,255,0.1)"
                    strokeDasharray="3 3"
                  />
                  <PolarAngleAxis
                    dataKey="factor"
                    tick={{
                      fill: "hsl(215, 15%, 55%)",
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  />
                  <PolarRadiusAxis
                    tick={false}
                    axisLine={false}
                  />
                  <Radar
                    name="Liga"
                    dataKey="league"
                    stroke="hsl(215, 15%, 45%)"
                    fill="hsl(215, 15%, 45%)"
                    fillOpacity={0.15}
                    strokeWidth={1.5}
                    strokeDasharray="4 4"
                  />
                  <Radar
                    name="Equipo"
                    dataKey="team"
                    stroke="hsl(217, 91%, 60%)"
                    fill="hsl(217, 91%, 60%)"
                    fillOpacity={0.25}
                    strokeWidth={2}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(220, 25%, 13%)",
                      border: "1px solid hsl(220, 20%, 20%)",
                      borderRadius: "8px",
                      color: "hsl(210, 20%, 95%)",
                      fontSize: "12px",
                    }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: "11px", color: "hsl(215,15%,55%)" }}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex h-80 items-center justify-center text-sm text-muted-foreground">
              Sin datos disponibles
            </div>
          )}
        </div>

        {/* Pie Chart: Scoring Breakdown */}
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="mb-4 flex items-center gap-2">
            <PieChartIcon className="h-4 w-4 text-chart-2" />
            <h3 className="font-display text-sm font-bold text-foreground">
              Origen de los Puntos
            </h3>
          </div>

          {pieData.length > 0 ? (
            <div className="flex h-80 items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="45%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={3}
                    dataKey="value"
                    label={({ name, value }) =>
                      `${((value / totalPts) * 100).toFixed(0)}%`
                    }
                    labelLine={{ stroke: "rgba(255,255,255,0.3)" }}
                  >
                    {pieData.map((entry, index) => (
                      <Cell
                        key={index}
                        fill={entry.color}
                        stroke="transparent"
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(220, 25%, 13%)",
                      border: "1px solid hsl(220, 20%, 20%)",
                      borderRadius: "8px",
                      color: "hsl(210, 20%, 95%)",
                      fontSize: "12px",
                    }}
                    formatter={(value: number) => [
                      `${value} pts (${((value / totalPts) * 100).toFixed(1)}%)`,
                      "",
                    ]}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: "11px" }}
                    formatter={(value: string) => (
                      <span style={{ color: "hsl(215,15%,55%)" }}>{value}</span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex h-80 items-center justify-center text-sm text-muted-foreground">
              Sin datos de PBP disponibles
            </div>
          )}

          {/* Breakdown list */}
          {pieData.length > 0 && (
            <div className="mt-2 space-y-2">
              {pieData.map((d) => (
                <div 
                  key={d.name} 
                  className="flex items-center justify-between text-xs cursor-help"
                  title={getScoreTypeDescription(d.name)}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: d.color }}
                    />
                    <span className="text-muted-foreground">{d.name}</span>
                  </div>
                  <span className="font-mono font-semibold text-foreground" title={`${d.value} puntos (${((d.value / totalPts) * 100).toFixed(1)}% del total)`}>
                    {d.value} pts
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ── Factor Card Sub-component ── */
function FactorCard({
  label,
  value,
  formula,
  leagueAvg,
  higherIsBetter,
  teamVal,
  description,
}: {
  label: string
  value: string
  formula: string
  leagueAvg: number
  higherIsBetter: boolean
  teamVal: number
  description?: string
}) {
  const isBetter = higherIsBetter
    ? teamVal > leagueAvg
    : teamVal < leagueAvg
  const diff = teamVal - leagueAvg

  return (
    <div
      className={`rounded-lg border border-border p-4 border-l-4 cursor-help ${
        isBetter
          ? "border-l-emerald-500 bg-emerald-500/5"
          : "border-l-destructive bg-destructive/5"
      }`}
      title={description}
    >
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 font-display text-2xl font-bold text-foreground" title={`Valor del equipo: ${value}`}>
        {value}
      </p>
      <div className="mt-2 flex items-center gap-1">
        <span
          className={`text-xs font-semibold ${isBetter ? "text-emerald-400" : "text-destructive"}`}
          title={`Diferencia con la media de la liga (${leagueAvg.toFixed(1)})`}
        >
          {diff > 0 ? "+" : ""}
          {diff.toFixed(1)} vs liga
        </span>
      </div>
      <p className="mt-2 text-[10px] font-mono text-muted-foreground/70" title={description}>
        {formula}
      </p>
    </div>
  )
}
