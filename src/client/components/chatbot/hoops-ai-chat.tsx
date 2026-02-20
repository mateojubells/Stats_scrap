"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import {
  MessageCircle,
  X,
  Send,
  Loader2,
  ChevronDown,
  Sparkles,
  Database,
  Bot,
  User,
  RotateCcw,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { useAuth } from "@/lib/auth-context"
import { supabase } from "@/lib/supabase"

// ── Types ────────────────────────────────────────────────────

interface ChatMessage {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: Date
  data?: Record<string, unknown>[] | null
  sql?: string
  thought?: string
  type?: "conversational" | "data" | "error"
  isLoading?: boolean
}

// ── Suggested questions ──────────────────────────────────────

const SUGGESTED_QUESTIONS = [
  { label: "🏀 Máximo anotador", question: "¿Quién es el máximo anotador de mi equipo?" },
  { label: "🎯 eFG% rival", question: "¿Cuál es el eFG% del próximo rival?" },
  { label: "📊 Promedios equipo", question: "Dame los promedios de mi equipo esta temporada" },
  { label: "⚡ Mejor quinteto", question: "¿Quién tiene mejor valoración en mi equipo?" },
  { label: "🛡️ Bajas rivales", question: "¿Qué jugadores del rival podrían ser baja?" },
  { label: "🔥 Últimos partidos", question: "¿Cómo fueron los últimos 5 partidos de mi equipo?" },
]

// ── Data table renderer ──────────────────────────────────────

function DataTable({ data }: { data: Record<string, unknown>[] }) {
  if (!data || data.length === 0) return null

  const columns = Object.keys(data[0])
  if (columns.length === 0) return null

  // Format header for display
  const formatHeader = (key: string) =>
    key
      .replace(/_/g, " ")
      .replace(/\b\w/g, (l) => l.toUpperCase())

  // Format cell value
  const formatCell = (value: unknown): string => {
    if (value === null || value === undefined) return "—"
    if (typeof value === "number") {
      return Number.isInteger(value) ? value.toString() : value.toFixed(1)
    }
    if (typeof value === "boolean") return value ? "✓" : "✗"
    return String(value)
  }

  return (
    <div className="my-3 overflow-x-auto rounded-lg border border-border/50">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border/50 bg-muted/30">
            {columns.map((col) => (
              <th
                key={col}
                className="whitespace-nowrap px-3 py-2 text-left font-semibold text-muted-foreground"
              >
                {formatHeader(col)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.slice(0, 20).map((row, i) => (
            <tr
              key={i}
              className={cn(
                "border-b border-border/20 transition-colors hover:bg-muted/20",
                i % 2 === 0 && "bg-muted/5",
              )}
            >
              {columns.map((col) => (
                <td key={col} className="whitespace-nowrap px-3 py-1.5">
                  {formatCell(row[col])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {data.length > 20 && (
        <div className="border-t border-border/30 px-3 py-1.5 text-center text-xs text-muted-foreground">
          Mostrando 20 de {data.length} filas
        </div>
      )}
    </div>
  )
}

// ── Markdown-ish renderer (basic) ────────────────────────────

function MarkdownContent({ content }: { content: string }) {
  // Simple markdown rendering for chat messages
  const lines = content.split("\n")
  const elements: React.ReactNode[] = []
  let tableLines: string[] = []
  let inTable = false

  const flushTable = () => {
    if (tableLines.length < 2) {
      tableLines.forEach((l, i) =>
        elements.push(
          <p key={`tl-${elements.length}-${i}`} className="text-sm">
            {l}
          </p>,
        ),
      )
      tableLines = []
      return
    }

    const headerLine = tableLines[0]
    const dataLines = tableLines.slice(2) // skip separator
    const headers = headerLine
      .split("|")
      .map((h) => h.trim())
      .filter(Boolean)

    elements.push(
      <div key={`table-${elements.length}`} className="my-2 overflow-x-auto rounded-lg border border-border/50">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border/50 bg-muted/30">
              {headers.map((h, i) => (
                <th key={i} className="whitespace-nowrap px-3 py-2 text-left font-semibold text-muted-foreground">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dataLines.map((line, ri) => {
              const cells = line.split("|").map((c) => c.trim()).filter(Boolean)
              return (
                <tr key={ri} className={cn("border-b border-border/20", ri % 2 === 0 && "bg-muted/5")}>
                  {cells.map((c, ci) => (
                    <td key={ci} className="whitespace-nowrap px-3 py-1.5">
                      {c}
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>,
    )
    tableLines = []
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Detect table lines
    if (line.trim().startsWith("|") && line.trim().endsWith("|")) {
      if (!inTable) inTable = true
      tableLines.push(line)
      continue
    } else if (inTable) {
      inTable = false
      flushTable()
    }

    // Headers
    if (line.startsWith("### ")) {
      elements.push(
        <h4 key={i} className="mt-3 mb-1 text-sm font-bold text-foreground">
          {line.slice(4)}
        </h4>,
      )
    } else if (line.startsWith("## ")) {
      elements.push(
        <h3 key={i} className="mt-3 mb-1 text-base font-bold text-foreground">
          {line.slice(3)}
        </h3>,
      )
    } else if (line.startsWith("# ")) {
      elements.push(
        <h2 key={i} className="mt-3 mb-1 text-lg font-bold text-foreground">
          {line.slice(2)}
        </h2>,
      )
    }
    // Bold
    else if (line.startsWith("**") && line.endsWith("**")) {
      elements.push(
        <p key={i} className="mt-2 text-sm font-semibold">
          {line.slice(2, -2)}
        </p>,
      )
    }
    // List items
    else if (line.startsWith("- ") || line.startsWith("* ")) {
      elements.push(
        <li key={i} className="ml-4 list-disc text-sm text-muted-foreground">
          <span
            dangerouslySetInnerHTML={{
              __html: line
                .slice(2)
                .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
                .replace(/`(.*?)`/g, '<code class="rounded bg-muted px-1 py-0.5 text-xs">$1</code>'),
            }}
          />
        </li>,
      )
    }
    // Empty line
    else if (line.trim() === "") {
      elements.push(<div key={i} className="h-1" />)
    }
    // Regular paragraph
    else {
      elements.push(
        <p key={i} className="text-sm leading-relaxed text-muted-foreground">
          <span
            dangerouslySetInnerHTML={{
              __html: line
                .replace(/\*\*(.*?)\*\*/g, "<strong class='text-foreground'>$1</strong>")
                .replace(/`(.*?)`/g, '<code class="rounded bg-muted px-1 py-0.5 text-xs">$1</code>'),
            }}
          />
        </p>,
      )
    }
  }

  // Flush any remaining table
  if (inTable) flushTable()

  return <div className="space-y-0.5">{elements}</div>
}

// ── Main component ───────────────────────────────────────────

export function HoopsAIChat() {
  const { session, team } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [showSql, setShowSql] = useState<string | null>(null)

  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isLoading || !session) return

      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: text.trim(),
        timestamp: new Date(),
      }

      const loadingMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "",
        timestamp: new Date(),
        isLoading: true,
      }

      setMessages((prev) => [...prev, userMsg, loadingMsg])
      setInput("")
      setIsLoading(true)

      try {
        const {
          data: { session: currentSession },
        } = await supabase.auth.getSession()

        const res = await fetch("/api/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${currentSession?.access_token}`,
          },
          body: JSON.stringify({ question: text.trim() }),
        })

        const data = await res.json()

        const assistantMsg: ChatMessage = {
          id: loadingMsg.id,
          role: "assistant",
          content: data.answer || "No pude procesar tu pregunta.",
          timestamp: new Date(),
          data: data.data,
          sql: data.sql,
          thought: data.thought,
          type: data.type,
        }

        setMessages((prev) =>
          prev.map((m) => (m.id === loadingMsg.id ? assistantMsg : m)),
        )
      } catch {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === loadingMsg.id
              ? {
                  ...m,
                  content:
                    "⚠️ Error de conexión. Verifica tu conexión a internet e intenta de nuevo.",
                  isLoading: false,
                  type: "error" as const,
                }
              : m,
          ),
        )
      } finally {
        setIsLoading(false)
      }
    },
    [isLoading, session],
  )

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    sendMessage(input)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  const clearChat = () => {
    setMessages([])
    setShowSql(null)
  }

  if (!session || !team) return null

  return (
    <>
      {/* ── Floating toggle button ── */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full shadow-2xl transition-all duration-300 hover:scale-110",
          isOpen
            ? "bg-destructive text-destructive-foreground rotate-90"
            : "bg-gradient-to-br from-orange-500 to-amber-600 text-white",
        )}
        aria-label={isOpen ? "Cerrar HoopsAI" : "Abrir HoopsAI"}
      >
        {isOpen ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </button>

      {/* ── Chat window ── */}
      <div
        className={cn(
          "fixed bottom-24 right-6 z-50 flex flex-col overflow-hidden rounded-2xl border border-border/50 bg-background shadow-2xl transition-all duration-300",
          isOpen
            ? "h-[600px] w-[420px] scale-100 opacity-100"
            : "pointer-events-none h-0 w-0 scale-90 opacity-0",
        )}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between border-b border-border/50 bg-gradient-to-r from-orange-500/10 to-amber-500/10 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-amber-600">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold">HoopsAI</h3>
              <p className="text-xs text-muted-foreground">
                Analista táctico · {team.name}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {messages.length > 0 && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={clearChat}
                title="Limpiar chat"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setIsOpen(false)}
            >
              <ChevronDown className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* ── Messages area ── */}
        <ScrollArea className="flex-1">
          <div ref={scrollRef} className="flex flex-col gap-4 p-4">
            {messages.length === 0 && (
              <div className="flex flex-col items-center gap-4 py-8">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500/20 to-amber-500/20">
                  <Bot className="h-8 w-8 text-orange-500" />
                </div>
                <div className="text-center">
                  <h4 className="text-sm font-semibold">¡Hola, Coach! 🏀</h4>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Soy tu analista de datos. Pregúntame sobre tu equipo o el
                    próximo rival.
                  </p>
                </div>

                {/* Suggested questions */}
                <div className="grid w-full grid-cols-2 gap-2">
                  {SUGGESTED_QUESTIONS.map((sq) => (
                    <button
                      key={sq.label}
                      onClick={() => sendMessage(sq.question)}
                      className="rounded-lg border border-border/50 px-3 py-2 text-left text-xs transition-colors hover:border-orange-500/50 hover:bg-orange-500/5"
                    >
                      <span className="font-medium">{sq.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  "flex gap-2",
                  msg.role === "user" ? "flex-row-reverse" : "flex-row",
                )}
              >
                {/* Avatar */}
                <div
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                    msg.role === "user"
                      ? "bg-primary"
                      : "bg-gradient-to-br from-orange-500 to-amber-600",
                  )}
                >
                  {msg.role === "user" ? (
                    <User className="h-3.5 w-3.5 text-primary-foreground" />
                  ) : (
                    <Bot className="h-3.5 w-3.5 text-white" />
                  )}
                </div>

                {/* Bubble */}
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-4 py-2.5",
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted/50",
                  )}
                >
                  {msg.isLoading ? (
                    <div className="flex items-center gap-2 py-1">
                      <Loader2 className="h-4 w-4 animate-spin text-orange-500" />
                      <span className="text-xs text-muted-foreground">
                        Analizando datos...
                      </span>
                    </div>
                  ) : msg.role === "user" ? (
                    <p className="text-sm">{msg.content}</p>
                  ) : (
                    <div>
                      <MarkdownContent content={msg.content} />

                      {/* Data table if available */}
                      {msg.data && msg.data.length > 0 && (
                        <DataTable data={msg.data} />
                      )}

                      {/* SQL toggle */}
                      {msg.sql && (
                        <div className="mt-2 border-t border-border/30 pt-2">
                          <button
                            onClick={() =>
                              setShowSql(showSql === msg.id ? null : msg.id)
                            }
                            className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
                          >
                            <Database className="h-3 w-3" />
                            {showSql === msg.id ? "Ocultar SQL" : "Ver SQL"}
                          </button>
                          {showSql === msg.id && (
                            <pre className="mt-1.5 overflow-x-auto rounded-md bg-zinc-900 p-2 text-[10px] leading-relaxed text-green-400">
                              {msg.sql}
                            </pre>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        {/* ── Input area ── */}
        <form
          onSubmit={handleSubmit}
          className="border-t border-border/50 p-3"
        >
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Pregunta sobre tu equipo..."
              rows={1}
              className="flex-1 resize-none rounded-xl border border-border/50 bg-muted/30 px-4 py-2.5 text-sm placeholder:text-muted-foreground/50 focus:border-orange-500/50 focus:outline-none focus:ring-1 focus:ring-orange-500/30"
              style={{ maxHeight: "100px" }}
              disabled={isLoading}
            />
            <Button
              type="submit"
              size="icon"
              disabled={isLoading || !input.trim()}
              className="h-10 w-10 shrink-0 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 transition-all hover:from-orange-600 hover:to-amber-700 disabled:opacity-50"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
          <p className="mt-1.5 text-center text-[10px] text-muted-foreground/50">
            HoopsAI puede cometer errores. Verifica los datos importantes.
          </p>
        </form>
      </div>
    </>
  )
}
