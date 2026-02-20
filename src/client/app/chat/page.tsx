"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  Bot,
  Database,
  Loader2,
  RotateCcw,
  Send,
  Sparkles,
  User,
} from "lucide-react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { useAuth } from "@/lib/auth-context"
import { supabase } from "@/lib/supabase"

interface ChatMessage {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: Date
  data?: Record<string, unknown>[] | null
  sql?: string
  type?: "conversational" | "data" | "error"
  isLoading?: boolean
}

const SUGGESTED_QUESTIONS = [
  "¿Quién es el máximo anotador de mi equipo?",
  "¿Cuál es el eFG% del próximo rival?",
  "Dame los promedios de mi equipo esta temporada",
  "¿Cómo fueron los últimos 5 partidos de mi equipo?",
]

function DataTable({ data }: { data: Record<string, unknown>[] }) {
  if (!data?.length) return null

  const columns = Object.keys(data[0])
  if (!columns.length) return null

  const formatHeader = (value: string) =>
    value
      .replace(/_/g, " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase())

  const formatCell = (value: unknown): string => {
    if (value === null || value === undefined) return "—"
    if (typeof value === "number") {
      return Number.isInteger(value) ? value.toString() : value.toFixed(1)
    }
    if (typeof value === "boolean") return value ? "✓" : "✗"
    return String(value)
  }

  return (
    <div className="mt-3 overflow-x-auto rounded-lg border border-border/60">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border/50 bg-muted/30">
            {columns.map((column) => (
              <th
                key={column}
                className="whitespace-nowrap px-3 py-2 text-left font-semibold text-muted-foreground"
              >
                {formatHeader(column)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.slice(0, 25).map((row, rowIndex) => (
            <tr
              key={rowIndex}
              className={cn(
                "border-b border-border/20",
                rowIndex % 2 === 0 && "bg-muted/5",
              )}
            >
              {columns.map((column) => (
                <td key={column} className="whitespace-nowrap px-3 py-1.5">
                  {formatCell(row[column])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {data.length > 25 && (
        <div className="border-t border-border/30 px-3 py-1.5 text-center text-xs text-muted-foreground">
          Mostrando 25 de {data.length} filas
        </div>
      )}
    </div>
  )
}

function MarkdownContent({ content }: { content: string }) {
  const lines = useMemo(() => content.split("\n"), [content])

  return (
    <div className="space-y-1">
      {lines.map((line, index) => {
        if (!line.trim()) return <div key={index} className="h-1" />

        if (line.startsWith("### ")) {
          return (
            <h4 key={index} className="mt-2 text-sm font-semibold text-foreground">
              {line.slice(4)}
            </h4>
          )
        }

        if (line.startsWith("## ")) {
          return (
            <h3 key={index} className="mt-2 text-base font-semibold text-foreground">
              {line.slice(3)}
            </h3>
          )
        }

        if (line.startsWith("- ") || line.startsWith("* ")) {
          return (
            <li key={index} className="ml-4 list-disc text-sm text-muted-foreground">
              <span
                dangerouslySetInnerHTML={{
                  __html: line
                    .slice(2)
                    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
                    .replace(
                      /`(.*?)`/g,
                      '<code class="rounded bg-muted px-1 py-0.5 text-xs">$1</code>',
                    ),
                }}
              />
            </li>
          )
        }

        return (
          <p key={index} className="text-sm leading-relaxed text-muted-foreground">
            <span
              dangerouslySetInnerHTML={{
                __html: line
                  .replace(/\*\*(.*?)\*\*/g, "<strong class='text-foreground'>$1</strong>")
                  .replace(
                    /`(.*?)`/g,
                    '<code class="rounded bg-muted px-1 py-0.5 text-xs">$1</code>',
                  ),
              }}
            />
          </p>
        )
      })}
    </div>
  )
}

export default function ChatPage() {
  const { session, team } = useAuth()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [showSql, setShowSql] = useState<string | null>(null)

  const listBottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    listBottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const sendMessage = useCallback(
    async (text: string) => {
      const question = text.trim()
      if (!question || isLoading || !session) return

      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: question,
        timestamp: new Date(),
      }

      const loadingId = crypto.randomUUID()
      const loadingMsg: ChatMessage = {
        id: loadingId,
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
          body: JSON.stringify({ question }),
        })

        const data = await res.json()

        const assistantMsg: ChatMessage = {
          id: loadingId,
          role: "assistant",
          content: data.answer || "No pude procesar tu pregunta.",
          timestamp: new Date(),
          data: data.data,
          sql: data.sql,
          type: data.type,
        }

        setMessages((prev) =>
          prev.map((msg) => (msg.id === loadingId ? assistantMsg : msg)),
        )
      } catch {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === loadingId
              ? {
                  ...msg,
                  content:
                    "⚠️ Error de conexión. Revisa tu sesión y vuelve a intentarlo.",
                  type: "error",
                  isLoading: false,
                }
              : msg,
          ),
        )
      } finally {
        setIsLoading(false)
      }
    },
    [isLoading, session],
  )

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    sendMessage(input)
  }

  const onInputKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  const clearChat = () => {
    setMessages([])
    setShowSql(null)
  }

  return (
    <DashboardLayout>
      <section className="mx-auto flex h-[calc(100vh-112px)] max-w-5xl flex-col rounded-2xl border border-border bg-card">
        <header className="flex items-center justify-between border-b border-border/60 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-amber-600">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-semibold text-foreground">HoopsAI Chat</h1>
              <p className="text-xs text-muted-foreground">
                Conversación táctica completa{team ? ` · ${team.name}` : ""}
              </p>
            </div>
          </div>

          <Button variant="outline" size="sm" onClick={clearChat} disabled={!messages.length}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Limpiar
          </Button>
        </header>

        <ScrollArea className="flex-1 px-4 py-4">
          <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 pb-6">
            {messages.length === 0 && (
              <div className="rounded-xl border border-border/60 bg-muted/20 p-5">
                <h2 className="text-sm font-semibold text-foreground">Empieza una conversación</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Haz preguntas de rendimiento, tendencias, rivales y contexto táctico.
                </p>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {SUGGESTED_QUESTIONS.map((question) => (
                    <button
                      key={question}
                      onClick={() => sendMessage(question)}
                      className="rounded-lg border border-border/60 bg-background px-3 py-2 text-left text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                    >
                      {question}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg) => (
              <article
                key={msg.id}
                className={cn(
                  "flex gap-3",
                  msg.role === "user" ? "justify-end" : "justify-start",
                )}
              >
                {msg.role === "assistant" && (
                  <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-amber-600">
                    <Bot className="h-4 w-4 text-white" />
                  </div>
                )}

                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-4 py-3",
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "border border-border/50 bg-muted/25",
                  )}
                >
                  {msg.isLoading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin text-orange-500" />
                      Analizando datos...
                    </div>
                  ) : msg.role === "user" ? (
                    <p className="text-sm leading-relaxed">{msg.content}</p>
                  ) : (
                    <>
                      <MarkdownContent content={msg.content} />

                      {msg.data && msg.data.length > 0 && <DataTable data={msg.data} />}

                      {msg.sql && (
                        <div className="mt-3 border-t border-border/40 pt-2">
                          <button
                            onClick={() => setShowSql(showSql === msg.id ? null : msg.id)}
                            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                          >
                            <Database className="h-3.5 w-3.5" />
                            {showSql === msg.id ? "Ocultar SQL" : "Ver SQL"}
                          </button>
                          {showSql === msg.id && (
                            <pre className="mt-1.5 overflow-x-auto rounded-md bg-zinc-900 p-2 text-[11px] text-green-400">
                              {msg.sql}
                            </pre>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>

                {msg.role === "user" && (
                  <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary">
                    <User className="h-4 w-4 text-primary-foreground" />
                  </div>
                )}
              </article>
            ))}
            <div ref={listBottomRef} />
          </div>
        </ScrollArea>

        <form onSubmit={onSubmit} className="border-t border-border/60 bg-background p-4">
          <div className="mx-auto flex w-full max-w-4xl items-end gap-3">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onInputKeyDown}
              placeholder="Escribe tu pregunta táctica..."
              className="min-h-[52px] resize-none"
              disabled={isLoading || !session}
            />
            <Button
              type="submit"
              size="icon"
              disabled={isLoading || !input.trim() || !session}
              className="h-11 w-11 shrink-0"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
          <p className="mx-auto mt-2 w-full max-w-4xl text-xs text-muted-foreground">
            HoopsAI puede cometer errores. Verifica los datos críticos antes de tomar decisiones.
          </p>
        </form>
      </section>
    </DashboardLayout>
  )
}
