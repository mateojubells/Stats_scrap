"use client"

import { usePathname } from "next/navigation"
import { AppSidebar } from "@/components/app-sidebar"
import { TopBar } from "@/components/top-bar"
import { AuthGuard } from "@/components/auth-guard"
import { HoopsAIChat } from "@/components/chatbot/hoops-ai-chat"

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const showFloatingChat = !pathname.startsWith("/chat")

  return (
    <AuthGuard>
      <div className="flex min-h-screen">
        <AppSidebar />
        <div className="ml-60 flex flex-1 flex-col">
          <TopBar />
          <main className="flex-1 overflow-y-auto p-6">{children}</main>
        </div>
      </div>
      {showFloatingChat && <HoopsAIChat />}
    </AuthGuard>
  )
}
