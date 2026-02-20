"use client"

import { DashboardLayout } from "@/components/dashboard-layout"
import { StatCard } from "@/components/stat-card"
import { ShotDistribution } from "@/components/dashboard/shot-distribution"
import { PlayerOfWeek } from "@/components/dashboard/player-of-week"
import { UpcomingSchedule } from "@/components/dashboard/upcoming-schedule"
import { RecentGames } from "@/components/dashboard/recent-games"
import { useAuth } from "@/lib/auth-context"
import { useEffect, useState } from "react"
import { getTeamAdvancedStats, getTeamRecentStats } from "@/lib/api"

export default function DashboardPage() {
  const { team } = useAuth()
  const [stats, setStats] = useState<
    { label: string; value: string; change: string; isPositive: boolean; context: string }[]
  >([])

  useEffect(() => {
    if (!team) return
    async function load() {
      const [season, recent] = await Promise.all([
        getTeamAdvancedStats(team!.id),
        getTeamRecentStats(team!.id, 3),
      ])
      
      if (!season) {
        setStats([])
        return
      }

      // Calcular tendencias: comparar últimos 3 vs temporada completa
      const calcTrend = (recentVal: string, seasonVal: string) => {
        const r = Number(recentVal)
        const s = Number(seasonVal)
        if (s === 0) return { change: "0%", isPositive: true }
        const diff = ((r - s) / s) * 100
        return {
          change: `${diff > 0 ? "+" : ""}${diff.toFixed(1)}%`,
          isPositive: diff >= 0,
        }
      }

      const ppgTrend = recent ? calcTrend(recent.ppg, season.ppg) : { change: "—", isPositive: true }
      const efgTrend = recent ? calcTrend(recent.efg, season.efg) : { change: "—", isPositive: true }
      const rpgTrend = recent ? calcTrend(recent.rpg, season.rpg) : { change: "—", isPositive: true }
      const effTrend = recent ? calcTrend(recent.eff, season.eff) : { change: "—", isPositive: true }

      setStats([
        {
          label: "PPG",
          value: season.ppg ?? "0.0",
          change: ppgTrend.change,
          isPositive: ppgTrend.isPositive,
          context: `Últimos 3: ${recent?.ppg ?? "—"}`,
        },
        {
          label: "eFG%",
          value: `${season.efg}%`,
          change: efgTrend.change,
          isPositive: efgTrend.isPositive,
          context: `Últimos 3: ${recent?.efg ?? "—"}%`,
        },
        {
          label: "RPG",
          value: season.rpg,
          change: rpgTrend.change,
          isPositive: rpgTrend.isPositive,
          context: `Últimos 3: ${recent?.rpg ?? "—"}`,
        },
        {
          label: "EFF",
          value: season.eff,
          change: effTrend.change,
          isPositive: effTrend.isPositive,
          context: `Valoración media`,
        },
      ])
    }
    load()
  }, [team])

  return (
    <DashboardLayout>
      {/* Stat Cards */}
      <div className="grid grid-cols-4 gap-4">
        {stats.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </div>

      {/* Main Content */}
      <div className="mt-6 grid grid-cols-5 gap-6">
        {/* Shot Distribution - spans 3 columns */}
        <div className="col-span-3">
          <ShotDistribution />
        </div>

        {/* Right Sidebar */}
        <div className="col-span-2 flex flex-col gap-6">
          <PlayerOfWeek />
          <UpcomingSchedule />
        </div>
      </div>

      {/* Recent Games Table */}
      <div className="mt-6">
        <RecentGames />
      </div>
    </DashboardLayout>
  )
}
