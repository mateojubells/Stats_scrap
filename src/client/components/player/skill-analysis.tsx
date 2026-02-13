"use client"

import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
} from "recharts"
import { useEffect, useState } from "react"
import { getPlayerGameLog, computePlayerAverages, getTeamSeasonAverages } from "@/lib/api"

interface Props {
  playerId: number
  teamId: number
}

export function SkillAnalysis({ playerId, teamId }: Props) {
  const [data, setData] = useState<
    { subject: string; player: number; teamAvg: number }[]
  >([])

  useEffect(() => {
    async function load() {
      const [rows, teamAvg] = await Promise.all([
        getPlayerGameLog(playerId, teamId),
        getTeamSeasonAverages(teamId),
      ])
      const avg = computePlayerAverages(rows)
      if (!avg || !teamAvg) return

      // Normalise to 0-100 scale for radar (clamp max to sensible upper bounds)
      const norm = (val: string, max: number) =>
        Math.min(100, (Number(val) / max) * 100)

      setData([
        {
          subject: "Anotación",
          player: norm(avg.ppg, 35),
          teamAvg: norm(teamAvg.ppg, 35),
        },
        {
          subject: "Rebotes",
          player: norm(avg.rpg, 15),
          teamAvg: norm(teamAvg.rpg, 15),
        },
        {
          subject: "Asistencias",
          player: norm(avg.apg, 12),
          teamAvg: norm(teamAvg.apg, 12),
        },
        {
          subject: "Robos",
          player: norm(avg.spg, 4),
          teamAvg: norm(teamAvg.spg, 4),
        },
        {
          subject: "Eficiencia",
          player: norm(avg.val, 30),
          teamAvg: 50,
        },
      ])
    }
    load()
  }, [playerId, teamId])

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div>
        <h2 className="font-display text-lg font-bold text-foreground">
          Análisis de Habilidades
        </h2>
        <p className="text-xs text-muted-foreground">
          Comparación vs media del equipo
        </p>
      </div>
      <div className="mt-2 h-72">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
            <PolarGrid
              stroke="rgba(255,255,255,0.1)"
              gridType="polygon"
            />
            <PolarAngleAxis
              dataKey="subject"
              tick={{
                fill: "hsl(215, 15%, 55%)",
                fontSize: 12,
                fontWeight: 600,
              }}
            />
            <PolarRadiusAxis
              angle={90}
              domain={[0, 100]}
              tick={false}
              axisLine={false}
            />
            <Radar
              name="Equipo"
              dataKey="teamAvg"
              stroke="rgba(255,255,255,0.25)"
              fill="rgba(255,255,255,0.05)"
              strokeDasharray="4 4"
            />
            <Radar
              name="Jugador"
              dataKey="player"
              stroke="hsl(217, 91%, 60%)"
              fill="hsl(217, 91%, 60%)"
              fillOpacity={0.2}
              strokeWidth={2}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 flex items-center justify-center gap-6">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-primary" />
          <span className="text-xs text-muted-foreground">Jugador</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full border border-muted-foreground/50" />
          <span className="text-xs text-muted-foreground">Media equipo</span>
        </div>
      </div>
    </div>
  )
}
