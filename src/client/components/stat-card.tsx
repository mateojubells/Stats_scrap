import { TrendingUp, TrendingDown } from "lucide-react"

interface StatCardProps {
  label: string
  value: string
  change: string
  isPositive: boolean
  context: string
}

export function StatCard({ label, value, change, isPositive, context }: StatCardProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="font-display text-3xl font-bold text-foreground">
          {value}
        </span>
        <span
          className={`flex items-center gap-0.5 text-xs font-semibold ${
            isPositive ? "text-chart-3" : "text-destructive"
          }`}
        >
          {isPositive ? (
            <TrendingUp className="h-3 w-3" />
          ) : (
            <TrendingDown className="h-3 w-3" />
          )}
          {change}
        </span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{context}</p>
    </div>
  )
}
