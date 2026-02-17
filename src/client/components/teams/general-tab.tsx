"use client"

import { useEffect, useState } from "react"
import {
  getTeamAdvancedStats,
  getLeagueBenchmark,
  getTeamLeague,
  getTeamGames,
} from "@/lib/api"
import {
  BarChart3,
  Target,
  Dumbbell,
  TrendingUp,
  Trophy,
  Activity,
} from "lucide-react"

interface BenchmarkMetric {
  label: string
  value: number
  leagueAvg: number
  percentile: number
  unit: string
  icon: React.ReactNode
  higherIsBetter: boolean
  description: string
}

interface GeneralTabProps {
  teamId: number
}

export function GeneralTab({ teamId }: GeneralTabProps) {
  const [metrics, setMetrics] = useState<BenchmarkMetric[]>([])
  const [record, setRecord] = useState({ w: 0, l: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [stats, league, games] = await Promise.all([
        getTeamAdvancedStats(teamId),
        getTeamLeague(teamId),
        getTeamGames(teamId),
      ])

      // W/L record
      let w = 0,
        l = 0
      for (const g of games) {
        const isHome = g.home_team_id === teamId
        const my = isHome ? g.home_score : g.away_score
        const opp = isHome ? g.away_score : g.home_score
        if (my != null && opp != null) {
          if (my > opp) w++
          else l++
        }
      }
      setRecord({ w, l })

      if (!stats) {
        setLoading(false)
        return
      }

      // Get all teams in same league for benchmarking
      const benchmark = await getLeagueBenchmark(league?.id)

      const computePercentile = (
        value: number,
        allValues: number[],
        higherIsBetter: boolean,
      ) => {
        if (allValues.length === 0) return 50
        
        // Contar equipos con peor estadística que nosotros
        // Si mayor es mejor: contar los que tienen menor valor
        // Si menor es mejor: contar los que tienen mayor valor
        const worse = allValues.filter(v => 
          higherIsBetter ? v < value : v > value
        ).length
        
        // Percentil = (nº equipos con peor estadística / total equipos) * 100
        return Math.round((worse / allValues.length) * 100)
      }

      const allPPG = benchmark.map((b) => b.ppg)
      const allRPG = benchmark.map((b) => b.rpg)
      const allAPG = benchmark.map((b) => b.apg)
      const allEFG = benchmark.map((b) => b.efg)
      const allSPG = benchmark.map((b) => b.spg)
      const allTPG = benchmark.map((b) => b.tpg)

      const leagueAvg = (arr: number[]) =>
        arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0

      setMetrics([
        {
          label: "PPG",
          value: Number(stats.ppg),
          leagueAvg: Number(leagueAvg(allPPG).toFixed(1)),
          percentile: computePercentile(Number(stats.ppg), allPPG, true),
          unit: "pts",
          icon: <Trophy className="h-4 w-4" />,
          higherIsBetter: true,
          description: "Puntos por partido - Promedio de puntos anotados por el equipo en cada partido",
        },
        {
          label: "RPG",
          value: Number(stats.rpg),
          leagueAvg: Number(leagueAvg(allRPG).toFixed(1)),
          percentile: computePercentile(Number(stats.rpg), allRPG, true),
          unit: "reb",
          icon: <Dumbbell className="h-4 w-4" />,
          higherIsBetter: true,
          description: "Rebotes por partido - Promedio de rebotes capturados (ofensivos + defensivos) por partido",
        },
        {
          label: "APG",
          value: Number(stats.apg),
          leagueAvg: Number(leagueAvg(allAPG).toFixed(1)),
          percentile: computePercentile(Number(stats.apg), allAPG, true),
          unit: "ast",
          icon: <Target className="h-4 w-4" />,
          higherIsBetter: true,
          description: "Asistencias por partido - Promedio de pases que resultan en canasta del compañero",
        },
        {
          label: "eFG%",
          value: Number(stats.efg),
          leagueAvg: Number(leagueAvg(allEFG).toFixed(1)),
          percentile: computePercentile(Number(stats.efg), allEFG, true),
          unit: "%",
          icon: <BarChart3 className="h-4 w-4" />,
          higherIsBetter: true,
          description: "Porcentaje efectivo de tiro - Mide la eficiencia de tiro ajustando el valor extra de los triples: (TC + 0.5 × T3) / Intentos",
        },
        {
          label: "SPG",
          value: Number(stats.spg),
          leagueAvg: Number(leagueAvg(allSPG).toFixed(1)),
          percentile: computePercentile(Number(stats.spg), allSPG, true),
          unit: "stl",
          icon: <Activity className="h-4 w-4" />,
          higherIsBetter: true,
          description: "Robos por partido - Promedio de recuperaciones defensivas forzando pérdidas del rival",
        },
        {
          label: "TOV",
          value: Number(stats.tpg),
          leagueAvg: Number(leagueAvg(allTPG).toFixed(1)),
          percentile: computePercentile(Number(stats.tpg), allTPG, false),
          unit: "to",
          icon: <TrendingUp className="h-4 w-4" />,
          higherIsBetter: false,
          description: "Pérdidas por partido - Promedio de balones perdidos. Menos es mejor",
        },
      ])

      setLoading(false)
    }
    load()
  }, [teamId])

  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-24 animate-pulse rounded-xl border border-border bg-card"
          />
        ))}
      </div>
    )
  }

  const getPercentileColor = (p: number) => {
    if (p >= 80) return "text-emerald-400"
    if (p >= 60) return "text-chart-3"
    if (p >= 40) return "text-chart-5"
    if (p >= 20) return "text-orange-400"
    return "text-destructive"
  }

  const getBarColor = (p: number) => {
    if (p >= 80) return "bg-emerald-500"
    if (p >= 60) return "bg-chart-3"
    if (p >= 40) return "bg-chart-5"
    if (p >= 20) return "bg-orange-500"
    return "bg-destructive"
  }

  return (
    <div className="space-y-6">
      {/* Record Card */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Récord
          </p>
          <p className="mt-2 font-display text-3xl font-bold text-foreground">
            {record.w}
            <span className="text-muted-foreground">-</span>
            {record.l}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {record.w + record.l > 0
              ? `${((record.w / (record.w + record.l)) * 100).toFixed(0)}% victorias`
              : "Sin partidos"}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Partidos
          </p>
          <p className="mt-2 font-display text-3xl font-bold text-foreground">
            {record.w + record.l}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Jugados</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            % Victorias
          </p>
          <p className="mt-2 font-display text-3xl font-bold text-foreground">
            {record.w + record.l > 0
              ? `${((record.w / (record.w + record.l)) * 100).toFixed(0)}%`
              : "—"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Porcentaje</p>
        </div>
      </div>

      {/* Bullet Charts / Benchmark */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h3 className="mb-1 font-display text-sm font-bold text-foreground">
          Benchmarking vs. Liga
        </h3>
        <p className="mb-5 text-xs text-muted-foreground">
          Comparativa de la media del equipo frente al percentil de la liga
        </p>

        <div className="space-y-5">
          {metrics.map((m) => (
            <div key={m.label} className="space-y-1.5" title={m.description}>
              {/* Label row */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground" title={m.description}>{m.icon}</span>
                  <span className="text-sm font-semibold text-foreground cursor-help" title={m.description}>
                    {m.label}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground" title="Promedio de todos los equipos de la liga">
                    Liga: {m.leagueAvg}
                  </span>
                  <span className="font-display text-sm font-bold text-foreground" title={`${m.value} ${m.unit}`}>
                    {m.value}
                  </span>
                  <span
                    className={`rounded-md px-2 py-0.5 text-xs font-bold cursor-help ${getPercentileColor(m.percentile)}`}
                    title={`Percentil ${m.percentile}: Mejor que el ${m.percentile}% de los equipos de la liga`}
                  >
                    P{m.percentile}
                  </span>
                </div>
              </div>

              {/* Bar */}
              <div className="relative h-3 w-full overflow-hidden rounded-full bg-secondary">
                {/* League avg marker */}
                <div
                  className="absolute top-0 h-full w-0.5 bg-muted-foreground/50 z-10"
                  style={{ left: `${(m.leagueAvg / (m.value * 1.5 || 1)) * 100}%` }}
                />
                {/* Team value bar */}
                <div
                  className={`h-full rounded-full transition-all duration-700 ${getBarColor(m.percentile)}`}
                  style={{ width: `${Math.min(m.percentile, 100)}%` }}
                />
              </div>

              {/* Scale */}
              <div className="flex justify-between text-[10px] text-muted-foreground/60">
                <span>0%</span>
                <span>25%</span>
                <span>50%</span>
                <span>75%</span>
                <span>100%</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
