/* ─────────────────────────────────────────────────────────────
   HoopsAI — Gemini Engine (Server-side only)
   Translates natural language questions to SQL via Google Gemini
   ───────────────────────────────────────────────────────────── */

import { GoogleGenerativeAI } from "@google/generative-ai"

// ── Types ────────────────────────────────────────────────────

export interface GeminiSQLResponse {
  sql: string
  thought: string
  tactical_context: string
}

export interface HumanizedResponse {
  answer: string
  tactical_insight: string
}

// ── System prompt builder (compact for Gemini token limits) ────

function buildSystemPrompt(userTeamId: number, opponentTeamId: number | null): string {
  const allowedTeams = opponentTeamId ? `${userTeamId}, ${opponentTeamId}` : `${userTeamId}`
  
  return `Eres HoopsIQ Analyst. Traduce preguntas en SQL PostgreSQL para Supabase.

PRIVACIDAD: Solo teams ${allowedTeams}. Rechaza queries fuera de estos.

SOLO SELECT. Prohibido: INSERT, UPDATE, DELETE, DROP, TRUNCATE, ALTER, CREATE.

DDL (tablas y columnas clave):
- leagues: id, name, season_year, group_name
- teams: id, name, logo_url
- players: id, name, current_team_id, jersey_number
- games: id, date, home_team_id, away_team_id, home_score, away_score, status
- stats_player_games: id, game_id, player_id, team_id, minutes, points, t2_made, t2_att, t3_made, t3_att, ft_made, ft_att, reb_off, reb_def, reb_tot, assists, steals, turnovers, blocks_for, blocks_against, fouls_comm, fouls_rec, valoracion, plus_minus, starter
- stats_team_games: id, game_id, team_id, points, fg_made, fg_att, fg_pct, t2_made, t2_att, t2_pct, t3_made, t3_att, t3_pct, ft_made, ft_att, ft_pct, reb_off, reb_def, reb_tot, assists, steals, turnovers, blocks_for, blocks_against, fouls_comm, fouls_rec
- play_by_play: id, game_id, quarter, minute, team_id, player_id, action_type, home_score_partial, away_score_partial
- shots: id, game_id, player_id, team_id, x_coord, y_coord, made, quarter, zone

JOINS (Obligatorio):
- Individual: stats_player_games + players + games + teams
- Team: stats_team_games + teams + games
- Games: games.home_team_id/away_team_id → teams.id

FÓRMULAS:
- eFG%: (SUM(fg_made) + 0.5*SUM(t3_made)) / NULLIF(SUM(fg_att), 0)
- TS%: SUM(points) / NULLIF(2.0*(SUM(fg_att) + 0.44*SUM(ft_att)), 0)
- Plus/Minus On: stats_player_games.plus_minus
- Plus/Minus Off: margen - plus_minus

REGLAS SQL:
- Filtra team_id IN (${allowedTeams}) siempre
- NULLIF para divisiones por cero
- ROUND(..., 1) para porcentajes
- JOIN nombres, no solo IDs
- LIMIT resultados largos

RESPONDE JSON (sin markdown):
{ "sql": "...", "thought": "...", "tactical_context": "..." }

Sin SQL: { "sql": null, "thought": "...", "tactical_context": "..." }`
}

// ── Gemini client ────────────────────────────────────────────

function getGeminiClient() {
  const apiKey =
    process.env.GOOGLE_GEMINI_API_KEY?.replace(/^['\"]|['\"]$/g, "").trim() ||
    process.env.GEMINI_API_KEY?.replace(/^['\"]|['\"]$/g, "").trim()

  if (!apiKey) {
    throw new Error(
      "GOOGLE_GEMINI_API_KEY no está configurada. En Next.js debe estar en src/client/.env.local y debes reiniciar `pnpm dev`.",
    )
  }

  return new GoogleGenerativeAI(apiKey)
}

// ── Generate SQL from question ───────────────────────────────

export async function generateSQL(
  question: string,
  userTeamId: number,
  opponentTeamId: number | null,
): Promise<GeminiSQLResponse> {
  return generateHoopsQuery(question, userTeamId, opponentTeamId)
}

export async function generateHoopsQuery(
  question: string,
  userTeamId: number,
  opponentTeamId: number | null,
): Promise<GeminiSQLResponse> {
  const genAI = getGeminiClient()
  const systemPrompt = buildSystemPrompt(userTeamId, opponentTeamId)
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    systemInstruction: {
      role: "system",
      parts: [{ text: systemPrompt }],
    },
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 2048,
    },
  })

  const chat = model.startChat({
    history: [
      {
        role: "user",
        parts: [{ text: "Entiende tu rol y responde solo en JSON." }],
      },
      {
        role: "model",
        parts: [
          {
            text: JSON.stringify({
              sql: null,
              thought: "Entendido. Soy HoopsIQ Analyst y responderé siempre en formato JSON.",
              tactical_context: "Listo para analizar datos de baloncesto.",
            }),
          },
        ],
      },
    ],
  })

  const result = await chat.sendMessage(question)
  const text = result.response.text().trim()

  // Parse JSON response — remove potential markdown fences
  const cleanText = text
    .replace(/^\s*```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim()

  try {
    const parsed = JSON.parse(cleanText) as GeminiSQLResponse
    return parsed
  } catch {
    // If Gemini doesn't return valid JSON, wrap it
    return {
      sql: "",
      thought: "Error al procesar la respuesta del modelo",
      tactical_context: cleanText,
    }
  }
}

// ── Humanize raw data results ────────────────────────────────

export async function humanizeResults(
  question: string,
  sqlQuery: string,
  rawData: Record<string, unknown>[],
  thought: string,
  tacticalContext: string,
): Promise<string> {
  const genAI = getGeminiClient()
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash-preview-tts",
    generationConfig: {
      temperature: 0.4,
      maxOutputTokens: 2048,
    },
  })

  const prompt = `Eres HoopsIQ Analyst, un analista táctico de baloncesto.

El entrenador preguntó: "${question}"

Se ejecutó esta consulta SQL: ${sqlQuery}

Razonamiento previo: ${thought}
Contexto táctico: ${tacticalContext}

Los datos devueltos fueron:
${JSON.stringify(rawData, null, 2)}

INSTRUCCIONES:
1. Interpreta los datos en lenguaje natural para un entrenador.
2. Destaca hallazgos tácticos relevantes.
3. Si hay datos tabulares (más de 2 filas con columnas numéricas), incluye una sección con los datos clave.
4. Sé conciso pero informativo. Usa emoji relevantes (🏀, 📊, 🎯, ⚡, 🔥, 🛡️).
5. Si los datos están vacíos, indica que no hay datos suficientes.
6. Responde en español.

FORMATO DE RESPUESTA:
- Respuesta directa en texto plano con formato Markdown.
- Si incluyes tabla, usa formato Markdown: | Col1 | Col2 | ... |
- NO respondas en JSON, responde directamente con el análisis.`

  const result = await model.generateContent(prompt)
  return result.response.text()
}

// ── Validate SQL safety ──────────────────────────────────────

export function validateSQL(sql: string): { valid: boolean; error?: string } {
  const trimmed = sql.trim().toUpperCase()

  if (!trimmed.startsWith("SELECT")) {
    return { valid: false, error: "Solo se permiten consultas SELECT." }
  }

  const forbidden = /\b(INSERT|UPDATE|DELETE|DROP|TRUNCATE|ALTER|CREATE|GRANT|REVOKE|EXECUTE)\b/i
  if (forbidden.test(sql)) {
    return {
      valid: false,
      error: "La consulta contiene operaciones prohibidas. Solo SELECT es permitido.",
    }
  }

  return { valid: true }
}
