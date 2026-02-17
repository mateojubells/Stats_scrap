"use client"

import { DashboardLayout } from "@/components/dashboard-layout"
import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { getTeam } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import type { Team } from "@/lib/types"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Shield, ArrowLeft, ShieldAlert } from "lucide-react"
import Link from "next/link"

import { GeneralTab } from "@/components/teams/general-tab"
import { ShotAnalyticsTab } from "@/components/teams/shot-analytics-tab"
import { LineupTab } from "@/components/teams/lineup-tab"
import { AdvancedStatsTab } from "@/components/teams/advanced-stats-tab"
import { RosterTab } from "@/components/teams/roster-tab"

export default function TeamDetailPage() {
  const params = useParams()
  const urlTeamId = Number(params.id)
  const { team: authTeam, loading: authLoading } = useAuth()
  const [team, setTeam] = useState<Team | null>(null)
  const [loading, setLoading] = useState(true)

  // Security: always use the user's own team_id, ignore URL param for data
  const teamId = authTeam?.id ?? urlTeamId

  useEffect(() => {
    if (authLoading) return
    if (!authTeam) { setLoading(false); return }
    getTeam(authTeam.id).then((t) => {
      setTeam(t)
      setLoading(false)
    })
  }, [authTeam, authLoading])

  if (loading || authLoading) {
    return (
      <DashboardLayout>
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      </DashboardLayout>
    )
  }

  // Security gate — deny access to other teams
  if (authTeam && urlTeamId !== authTeam.id) {
    return (
      <DashboardLayout>
        <div className="flex h-64 flex-col items-center justify-center gap-3">
          <ShieldAlert className="h-10 w-10 text-destructive" />
          <p className="font-display text-lg font-bold text-destructive">
            Acceso denegado
          </p>
          <p className="text-sm text-muted-foreground">
            Solo puedes ver los datos de tu propio equipo.
          </p>
          <Link
            href={`/teams/${authTeam.id}`}
            className="mt-2 text-sm text-primary hover:underline"
          >
            Ir a mi equipo
          </Link>
        </div>
      </DashboardLayout>
    )
  }

  if (!team) {
    return (
      <DashboardLayout>
        <div className="flex h-64 flex-col items-center justify-center gap-3">
          <p className="text-muted-foreground">Equipo no encontrado</p>
          <Link href="/teams" className="text-sm text-primary hover:underline">
            Volver a equipos
          </Link>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="mb-6 flex items-center gap-4">

        <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-secondary">
          {team.logo_url ? (
            <img
              src={team.logo_url}
              alt={team.name}
              className="h-10 w-10 object-contain"
            />
          ) : (
            <Shield className="h-7 w-7 text-primary" />
          )}
        </div>
        <div>
          <h1 className="font-display text-xl font-bold text-foreground">
            {team.name}
          </h1>
          <p className="text-xs text-muted-foreground">
            Análisis del equipo · {team.feb_id ?? `ID ${team.id}`}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="general" className="w-full">
        <TabsList className="mb-6 w-full justify-start gap-1 rounded-xl bg-secondary/50 p-1">
          <TabsTrigger
            value="general"
            className="rounded-lg px-4 py-2 text-xs font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            General
          </TabsTrigger>
          <TabsTrigger
            value="shots"
            className="rounded-lg px-4 py-2 text-xs font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            Análisis de Tiro
          </TabsTrigger>
          <TabsTrigger
            value="lineups"
            className="rounded-lg px-4 py-2 text-xs font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            Quintetos
          </TabsTrigger>
          <TabsTrigger
            value="advanced"
            className="rounded-lg px-4 py-2 text-xs font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            Estadísticas Avanzadas
          </TabsTrigger>
          <TabsTrigger
            value="roster"
            className="rounded-lg px-4 py-2 text-xs font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            Plantilla
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <GeneralTab teamId={teamId} />
        </TabsContent>

        <TabsContent value="shots">
          <ShotAnalyticsTab teamId={teamId} />
        </TabsContent>

        <TabsContent value="lineups">
          <LineupTab teamId={teamId} />
        </TabsContent>

        <TabsContent value="advanced">
          <AdvancedStatsTab teamId={teamId} />
        </TabsContent>

        <TabsContent value="roster">
          <RosterTab teamId={teamId} />
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  )
}
