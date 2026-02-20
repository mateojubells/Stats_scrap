"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  Users,
  Eye,
  Settings,
  Calendar,
  Shield,
  Tv2,
  Sparkles,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useAuth } from "@/lib/auth-context"

const navItems = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Equipo", href: "/teams", icon: Shield },
  { label: "Plantilla", href: "/player", icon: Users },
  { label: "Game Center", href: "/game-center", icon: Tv2 },
  { label: "Scouting", href: "/scouting", icon: Eye },
  { label: "Calendario", href: "/calendar", icon: Calendar },
  { label: "HoopsAI Chat", href: "/chat", icon: Sparkles },
]

export function AppSidebar() {
  const pathname = usePathname()
  const { profile } = useAuth()

  const initials = profile?.display_name
    ? profile.display_name
        .split(" ")
        .map((w) => w[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "??"

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-60 flex-col bg-sidebar border-r border-sidebar-border">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
          <LayoutDashboard className="h-4 w-4 text-primary-foreground" />
        </div>
        <span className="font-display text-lg font-bold tracking-tight text-foreground">
          Hoops<span className="text-primary">IQ</span>
        </span>
      </div>

      <nav className="mt-2 flex flex-1 flex-col gap-1 px-3">
        {navItems.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href)
          return (
            <Link
              key={item.label}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-sidebar-foreground hover:bg-secondary",
              )}
            >
              <item.icon className="h-4.5 w-4.5" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="border-t border-sidebar-border px-3 py-3">
        <Link
          href="#"
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground hover:bg-secondary transition-colors"
        >
          <Settings className="h-4.5 w-4.5" />
          Settings
        </Link>
        <div className="mt-3 flex items-center gap-3 px-3 py-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-xs font-bold text-foreground">
            {initials}
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">
              {profile?.display_name ?? "Coach"}
            </p>
            <p className="text-xs text-muted-foreground">Entrenador</p>
          </div>
        </div>
      </div>
    </aside>
  )
}
