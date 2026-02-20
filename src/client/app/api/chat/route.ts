/* ─────────────────────────────────────────────────────────────
   HoopsAI Chat — API Route (POST /api/chat)
   Receives a user question, generates SQL via Gemini,
   executes it against Supabase, and returns humanized results.
   ───────────────────────────────────────────────────────────── */

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { generateSQL, humanizeResults, validateSQL } from "@/lib/gemini"

function normalizeSQLForRPC(sql: string): string {
  return sql
    .trim()
    .replace(/[;\s]+$/g, "")
}

// Server-side Supabase client using service role for RPC calls
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getServerSupabase(accessToken: string): any {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    },
  )
}

// ── Get next game to determine opponent ──────────────────────

async function getNextOpponentId(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  teamId: number,
): Promise<number | null> {
  const today = new Date().toISOString()
  const { data } = await supabase
    .from("games")
    .select("home_team_id, away_team_id")
    .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
    .eq("status", "SCHEDULED")
    .gte("date", today)
    .order("date", { ascending: true })
    .limit(1)
    .maybeSingle()

  if (!data) return null
  const row = data as { home_team_id: number; away_team_id: number }
  return row.home_team_id === teamId ? row.away_team_id : row.home_team_id
}

// ── Main handler ─────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    // 1. Extract and validate auth
    const authHeader = req.headers.get("authorization")
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "No autorizado. Inicia sesión para usar HoopsAI." },
        { status: 401 },
      )
    }
    const accessToken = authHeader.slice(7)

    // 2. Parse request body
    const body = await req.json()
    const { question } = body as { question: string }

    if (!question?.trim()) {
      return NextResponse.json(
        { error: "La pregunta no puede estar vacía." },
        { status: 400 },
      )
    }

    // 3. Initialize Supabase with user's token
    const supabase = getServerSupabase(accessToken)

    // 4. Get user profile to determine team_id
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: "Sesión inválida. Vuelve a iniciar sesión." },
        { status: 401 },
      )
    }

    const { data: profile } = await supabase
      .from("users")
      .select("team_id")
      .eq("id", user.id)
      .single()

    if (!profile?.team_id) {
      return NextResponse.json(
        { error: "No tienes un equipo asignado. Configura tu perfil primero." },
        { status: 400 },
      )
    }

    const userTeamId = profile.team_id

    // 5. Get opponent from next scheduled game
    const opponentTeamId = await getNextOpponentId(supabase, userTeamId)

    // 6. Call Gemini to generate SQL
    const geminiResponse = await generateSQL(question, userTeamId, opponentTeamId)

    // 7. If no SQL needed (conversational response)
    if (!geminiResponse.sql) {
      return NextResponse.json({
        type: "conversational",
        answer: geminiResponse.tactical_context,
        thought: geminiResponse.thought,
        data: null,
      })
    }

    const normalizedSql = normalizeSQLForRPC(geminiResponse.sql)

    // 8. Validate SQL safety
    const validation = validateSQL(normalizedSql)
    if (!validation.valid) {
      return NextResponse.json({
        type: "error",
        answer: `🛡️ Consulta bloqueada: ${validation.error}`,
        thought: geminiResponse.thought,
        data: null,
      })
    }

    // 9. Execute SQL via RPC
    const { data: queryResult, error: rpcError } = await supabase.rpc(
      "execute_coach_query",
      { sql_query: normalizedSql },
    )

    if (rpcError) {
      console.error("RPC Error:", rpcError)
      return NextResponse.json({
        type: "error",
        answer: `❌ Error al ejecutar la consulta: ${rpcError.message}. Intenta reformular tu pregunta.`,
        thought: geminiResponse.thought,
        sql: normalizedSql,
        data: null,
      })
    }

    // 10. Parse results
    const rows: Record<string, unknown>[] = Array.isArray(queryResult)
      ? queryResult
      : queryResult
        ? [queryResult]
        : []

    // 11. Humanize the results with a second Gemini call
    let humanAnswer: string
    try {
      humanAnswer = await humanizeResults(
        question,
        normalizedSql,
        rows,
        geminiResponse.thought,
        geminiResponse.tactical_context,
      )
    } catch (humanizeError) {
      console.error("Humanize error:", humanizeError)
      // Fallback: return raw data with thought context
      humanAnswer = rows.length > 0
        ? `📊 **Resultados encontrados** (${rows.length} filas)\n\n${geminiResponse.tactical_context}`
        : `No se encontraron datos para tu consulta. ${geminiResponse.tactical_context}`
    }

    // 12. Return complete response
    return NextResponse.json({
      type: "data",
      answer: humanAnswer,
      thought: geminiResponse.thought,
      tactical_context: geminiResponse.tactical_context,
      sql: normalizedSql,
      data: rows,
    })
  } catch (error) {
    console.error("Chat API Error:", error)
    const message =
      error instanceof Error ? error.message : "Error interno del servidor"
    return NextResponse.json(
      {
        type: "error",
        answer: `⚠️ Error inesperado: ${message}`,
        data: null,
      },
      { status: 500 },
    )
  }
}
