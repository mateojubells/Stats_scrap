/* ─────────────────────────────────────────────────────────────
   Supabase Data API — all queries scoped by team_id
   ───────────────────────────────────────────────────────────── */

import { supabase } from "./supabase"
import type {
  Game,
  Player,
  Shot,
  StatsPlayerGame,
  StatsTeamGame,
  Team,
  League,
} from "./types"

// ══════════════════════════════════════════════════════════════
// TEAM INFO
// ══════════════════════════════════════════════════════════════

export async function getTeam(teamId: number): Promise<Team | null> {
  const { data } = await supabase
    .from("teams")
    .select("*")
    .eq("id", teamId)
    .single()
  return data
}

export async function getAllTeams(): Promise<Team[]> {
  const { data } = await supabase.from("teams").select("*").order("name")
  return data ?? []
}

// ══════════════════════════════════════════════════════════════
// PLAYERS  (scoped to team)
// ══════════════════════════════════════════════════════════════

export async function getTeamPlayers(teamId: number): Promise<Player[]> {
  const { data } = await supabase
    .from("players")
    .select("*")
    .eq("current_team_id", teamId)
    .order("name")
  return data ?? []
}

// ══════════════════════════════════════════════════════════════
// GAMES  (home OR away involves team)
// ══════════════════════════════════════════════════════════════

export async function getTeamGames(teamId: number): Promise<Game[]> {
  const { data } = await supabase
    .from("games")
    .select("*, home_team:teams!games_home_team_id_fkey(*), away_team:teams!games_away_team_id_fkey(*)")
    .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
    .eq("status", "PROCESSED")
    .order("date", { ascending: false })
  return data ?? []
}

export async function getUpcomingGames(teamId: number, limit = 3): Promise<Game[]> {
  const today = new Date().toISOString()
  const { data } = await supabase
    .from("games")
    .select("*, home_team:teams!games_home_team_id_fkey(*), away_team:teams!games_away_team_id_fkey(*)")
    .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
    .eq("status", "SCHEDULED")
    .gte("date", today)
    .order("date", { ascending: true })
    .limit(limit)
  return data ?? []
}

// ══════════════════════════════════════════════════════════════
// PLAYER STATS  (season averages & per-game)
// ══════════════════════════════════════════════════════════════

export async function getPlayerSeasonStats(
  teamId: number,
): Promise<StatsPlayerGame[]> {
  const { data } = await supabase
    .from("stats_player_games")
    .select("*, player:players(*), game:games(*)")
    .eq("team_id", teamId)
  return data ?? []
}

export async function getPlayerGameLog(
  playerId: number,
  teamId: number,
): Promise<(StatsPlayerGame & { game: Game })[]> {
  const { data } = await supabase
    .from("stats_player_games")
    .select("*, game:games(*, home_team:teams!games_home_team_id_fkey(*), away_team:teams!games_away_team_id_fkey(*))")
    .eq("player_id", playerId)
    .eq("team_id", teamId)
    .order("id", { ascending: false })
    .limit(20)
  return (data ?? []) as any
}

// ══════════════════════════════════════════════════════════════
// TEAM AGGREGATED STATS  (averages across games)
// ══════════════════════════════════════════════════════════════

export async function getTeamSeasonAverages(teamId: number) {
  const { data } = await supabase
    .from("stats_team_games")
    .select("*")
    .eq("team_id", teamId)

  if (!data || data.length === 0) return null

  const n = data.length
  const sum = (key: keyof StatsTeamGame) =>
    data.reduce((a, r) => a + ((r[key] as number) || 0), 0)

  return {
    gamesPlayed: n,
    ppg: ((sum("fg_made") * 2 + sum("t3_made") + sum("ft_made")) / n).toFixed(1),
    rpg: (sum("reb_tot") / n).toFixed(1),
    apg: (sum("assists") / n).toFixed(1),
    fgPct: sum("fg_att") > 0 ? ((sum("fg_made") / sum("fg_att")) * 100).toFixed(1) : "0",
    t3Pct: sum("t3_att") > 0 ? ((sum("t3_made") / sum("t3_att")) * 100).toFixed(1) : "0",
    ftPct: sum("ft_att") > 0 ? ((sum("ft_made") / sum("ft_att")) * 100).toFixed(1) : "0",
    spg: (sum("steals") / n).toFixed(1),
    tpg: (sum("turnovers") / n).toFixed(1),
    bpg: (sum("blocks_for") / n).toFixed(1),
  }
}

// ══════════════════════════════════════════════════════════════
// SHOTS  (for shot charts)
// ══════════════════════════════════════════════════════════════

export async function getTeamShots(teamId: number): Promise<Shot[]> {
  const { data } = await supabase
    .from("shots")
    .select("*")
    .eq("team_id", teamId)
  return data ?? []
}

export async function getPlayerShots(playerId: number): Promise<Shot[]> {
  const { data } = await supabase
    .from("shots")
    .select("*")
    .eq("player_id", playerId)
  return data ?? []
}

export async function getGameShots(gameId: number): Promise<Shot[]> {
  const { data } = await supabase
    .from("shots")
    .select("*")
    .eq("game_id", gameId)
  return data ?? []
}

// ══════════════════════════════════════════════════════════════
// SCOUTING  (opponent data for a specific game)
// ══════════════════════════════════════════════════════════════

export async function getOpponentStats(opponentTeamId: number) {
  return getTeamSeasonAverages(opponentTeamId)
}

export async function getOpponentPlayers(opponentTeamId: number) {
  return getTeamPlayers(opponentTeamId)
}

export async function getOpponentPlayerStats(opponentTeamId: number) {
  return getPlayerSeasonStats(opponentTeamId)
}

export async function getHeadToHead(
  myTeamId: number,
  opponentTeamId: number,
): Promise<Game[]> {
  const { data } = await supabase
    .from("games")
    .select("*, home_team:teams!games_home_team_id_fkey(*), away_team:teams!games_away_team_id_fkey(*)")
    .or(
      `and(home_team_id.eq.${myTeamId},away_team_id.eq.${opponentTeamId}),and(home_team_id.eq.${opponentTeamId},away_team_id.eq.${myTeamId})`,
    )
    .eq("status", "PROCESSED")
    .order("date", { ascending: false })
    .limit(5)
  return data ?? []
}

// ══════════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════════

/** Compute per-game average for a single player from raw stat rows */
export function computePlayerAverages(stats: StatsPlayerGame[]) {
  if (stats.length === 0) return null
  const n = stats.length
  const sum = (fn: (s: StatsPlayerGame) => number) =>
    stats.reduce((a, s) => a + fn(s), 0)

  return {
    gp: n,
    ppg: (sum((s) => s.points ?? 0) / n).toFixed(1),
    rpg: (sum((s) => s.reb_tot ?? 0) / n).toFixed(1),
    apg: (sum((s) => s.assists ?? 0) / n).toFixed(1),
    spg: (sum((s) => s.steals ?? 0) / n).toFixed(1),
    bpg: (sum((s) => s.blocks_for ?? 0) / n).toFixed(1),
    tpg: (sum((s) => s.turnovers ?? 0) / n).toFixed(1),
    fgPct:
      sum((s) => (s.t2_att ?? 0) + (s.t3_att ?? 0)) > 0
        ? (
            (sum((s) => (s.t2_made ?? 0) + (s.t3_made ?? 0)) /
              sum((s) => (s.t2_att ?? 0) + (s.t3_att ?? 0))) *
            100
          ).toFixed(1)
        : "0",
    t3Pct:
      sum((s) => s.t3_att ?? 0) > 0
        ? ((sum((s) => s.t3_made ?? 0) / sum((s) => s.t3_att ?? 0)) * 100).toFixed(1)
        : "0",
    ftPct:
      sum((s) => s.ft_att ?? 0) > 0
        ? ((sum((s) => s.ft_made ?? 0) / sum((s) => s.ft_att ?? 0)) * 100).toFixed(1)
        : "0",
    val: (sum((s) => s.valoracion ?? 0) / n).toFixed(1),
  }
}

/** Best player by PPG from a list of stat rows */
export function findTopScorer(stats: StatsPlayerGame[]) {
  const byPlayer = new Map<number, StatsPlayerGame[]>()
  for (const s of stats) {
    const arr = byPlayer.get(s.player_id) ?? []
    arr.push(s)
    byPlayer.set(s.player_id, arr)
  }

  let best: { player: Player; avg: ReturnType<typeof computePlayerAverages> } | null = null
  for (const [, rows] of byPlayer) {
    const avg = computePlayerAverages(rows)
    if (!avg) continue
    if (!best || Number(avg.ppg) > Number(best.avg!.ppg)) {
      best = { player: rows[0].player!, avg }
    }
  }
  return best
}

// ══════════════════════════════════════════════════════════════
// DASHBOARD AVANZADO
// ══════════════════════════════════════════════════════════════

/** Stats de equipo incluyendo eFG% y EFF */
export async function getTeamAdvancedStats(teamId: number) {
  const { data } = await supabase
    .from("stats_team_games")
    .select("*")
    .eq("team_id", teamId)

  if (!data || data.length === 0) return null

  const n = data.length
  const sum = (key: keyof StatsTeamGame) =>
    data.reduce((a, r) => a + ((r[key] as number) || 0), 0)

  const fgMade = sum("fg_made")
  const fgAtt = sum("fg_att")
  const t3Made = sum("t3_made")
  const ppg = ((fgMade * 2 + t3Made + sum("ft_made")) / n).toFixed(1)
  const efg = fgAtt > 0 ? (((fgMade + 0.5 * t3Made) / fgAtt) * 100).toFixed(1) : "0"
  
  // EFF = (Puntos + Reb + Ast + Stl + Blk) - (FGA - FGM + FTA - FTM + TO)
  const pts = fgMade * 2 + t3Made + sum("ft_made")
  const fgMissed = sum("fg_att") - fgMade
  const ftMissed = sum("ft_att") - sum("ft_made")
  const eff = ((pts + sum("reb_tot") + sum("assists") + sum("steals") + sum("blocks_for")) - (fgMissed + ftMissed + sum("turnovers"))) / n

  return {
    gamesPlayed: n,
    ppg,
    rpg: (sum("reb_tot") / n).toFixed(1),
    apg: (sum("assists") / n).toFixed(1),
    efg,
    eff: eff.toFixed(1),
    fgPct: fgAtt > 0 ? ((fgMade / fgAtt) * 100).toFixed(1) : "0",
    t3Pct: sum("t3_att") > 0 ? ((t3Made / sum("t3_att")) * 100).toFixed(1) : "0",
    ftPct: sum("ft_att") > 0 ? ((sum("ft_made") / sum("ft_att")) * 100).toFixed(1) : "0",
    spg: (sum("steals") / n).toFixed(1),
    tpg: (sum("turnovers") / n).toFixed(1),
    bpg: (sum("blocks_for") / n).toFixed(1),
  }
}

/** Stats de los últimos N partidos (para tendencias) */
export async function getTeamRecentStats(teamId: number, lastN = 3) {
  const { data } = await supabase
    .from("stats_team_games")
    .select("*")
    .eq("team_id", teamId)
    .order("id", { ascending: false })
    .limit(lastN)

  if (!data || data.length === 0) return null

  const n = data.length
  const sum = (key: keyof StatsTeamGame) =>
    data.reduce((a, r) => a + ((r[key] as number) || 0), 0)

  const fgMade = sum("fg_made")
  const fgAtt = sum("fg_att")
  const t3Made = sum("t3_made")
  const ppg = ((fgMade * 2 + t3Made + sum("ft_made")) / n).toFixed(1)
  const efg = fgAtt > 0 ? (((fgMade + 0.5 * t3Made) / fgAtt) * 100).toFixed(1) : "0"
  
  const pts = fgMade * 2 + t3Made + sum("ft_made")
  const fgMissed = sum("fg_att") - fgMade
  const ftMissed = sum("ft_att") - sum("ft_made")
  const eff = ((pts + sum("reb_tot") + sum("assists") + sum("steals") + sum("blocks_for")) - (fgMissed + ftMissed + sum("turnovers"))) / n

  return {
    ppg,
    rpg: (sum("reb_tot") / n).toFixed(1),
    efg,
    eff: eff.toFixed(1),
  }
}

/** Top jugadores por EFF (valoración) */
export async function getTopPlayersByEFF(teamId: number, limit = 4) {
  const stats = await getPlayerSeasonStats(teamId)
  
  // Agrupar por jugador
  const byPlayer = new Map<number, { player: Player; rows: StatsPlayerGame[] }>()
  for (const s of stats) {
    const p = (s as any).player as Player | undefined
    if (!p) continue
    if (!byPlayer.has(p.id)) byPlayer.set(p.id, { player: p, rows: [] })
    byPlayer.get(p.id)!.rows.push(s)
  }

  // Calcular EFF promedio
  const ranked = Array.from(byPlayer.values()).map(({ player, rows }) => {
    const n = rows.length
    const avgVal = rows.reduce((a, r) => a + (r.valoracion ?? 0), 0) / n
    const avgPpg = rows.reduce((a, r) => a + (r.points ?? 0), 0) / n
    const fgMade = rows.reduce((a, r) => a + ((r.t2_made ?? 0) + (r.t3_made ?? 0)), 0)
    const fgAtt = rows.reduce((a, r) => a + ((r.t2_att ?? 0) + (r.t3_att ?? 0)), 0)
    const fgPct = fgAtt > 0 ? ((fgMade / fgAtt) * 100).toFixed(1) : "0"

    return {
      player,
      gp: n,
      eff: avgVal.toFixed(1),
      ppg: avgPpg.toFixed(1),
      fgPct,
    }
  })

  ranked.sort((a, b) => Number(b.eff) - Number(a.eff))
  return ranked.slice(0, limit)
}

