"use client"

import { DashboardLayout } from "@/components/dashboard-layout"
import { useAuth } from "@/lib/auth-context"
import { useRouter } from "next/navigation"
import { useEffect } from "react"

export default function TeamsPage() {
  const { team, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && team) {
      router.replace(`/teams/${team.id}`)
    }
  }, [team, loading, router])

  return (
    <DashboardLayout>
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    </DashboardLayout>
  )
}
