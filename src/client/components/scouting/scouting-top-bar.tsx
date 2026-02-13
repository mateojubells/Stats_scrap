"use client"

import { Download } from "lucide-react"
import type { Team } from "@/lib/types"

interface Props {
  opponents: Team[]
  opponentId: number | null
  onSelectOpponent: (id: number) => void
  opponentName: string
}

export function ScoutingTopBar({ opponents, opponentId, onSelectOpponent, opponentName }: Props) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-border bg-card px-6 py-4">
      <div className="flex items-center gap-3">
        <h1 className="font-display text-base font-bold uppercase tracking-wide text-foreground">
          Scouting: vs {opponentName || "—"}
        </h1>
        <select
          className="rounded-lg border border-border bg-secondary px-3 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          value={opponentId ?? ""}
          onChange={(e) => onSelectOpponent(Number(e.target.value))}
        >
          {opponents.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-2">
        {["Scouting", "Tiros", "Matchups"].map((tab, i) => (
          <button
            key={tab}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              i === 0
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-secondary"
            }`}
          >
            {tab}
          </button>
        ))}
        <button className="ml-2 flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground transition-colors hover:bg-accent/90">
          <Download className="h-4 w-4" />
          Exportar
        </button>
      </div>
    </div>
  )
}
