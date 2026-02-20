/* ─────────────────────────────────────────────────────────────
   Supabase Data API — all queries scoped by team_id
   ───────────────────────────────────────────────────────────── */

import { supabase } from "./supabase"
import type {
  Game,
  Player,
  PlayByPlay,
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

  const totalPoints = sum("points")
  const computedPoints = sum("t2_made") * 2 + sum("t3_made") * 3 + sum("ft_made")
  const safeTotalPoints = totalPoints > 0 ? totalPoints : computedPoints

  return {
    gamesPlayed: n,
    ppg: (safeTotalPoints / n).toFixed(1),
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
// GAME CENTER  (single-game queries by gameId)
// ══════════════════════════════════════════════════════════════

export async function getGameById(gameId: number): Promise<Game | null> {
  const { data } = await supabase
    .from("games")
    .select("*, home_team:teams!games_home_team_id_fkey(*), away_team:teams!games_away_team_id_fkey(*)")
    .eq("id", gameId)
    .single()
  return data
}

export async function getGamePlayerStats(gameId: number): Promise<StatsPlayerGame[]> {
  const { data } = await supabase
    .from("stats_player_games")
    .select("*, player:players(*)")
    .eq("game_id", gameId)
  return data ?? []
}

export async function getGameTeamStats(gameId: number): Promise<StatsTeamGame[]> {
  const { data } = await supabase
    .from("stats_team_games")
    .select("*")
    .eq("game_id", gameId)
  return data ?? []
}

export async function getGamePlayByPlay(gameId: number): Promise<PlayByPlay[]> {
  const { data } = await supabase
    .from("play_by_play")
    .select("*")
    .eq("game_id", gameId)
    .order("id", { ascending: true })
  return (data ?? []) as PlayByPlay[]
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

/** Top assist duos from a team's PBP data (assister → scorer pairs). */
export async function getTeamAssistPairs(
  teamId: number,
): Promise<{ assister: Player; scorer: Player; count: number }[]> {
  const { data: games } = await supabase
    .from("games")
    .select("id")
    .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
    .eq("status", "PROCESSED")
  if (!games || games.length === 0) return []

  const gameIds = games.map((g) => g.id)

  // Fetch PBP in batches to avoid row limit
  let allPbp: { id: number; game_id: number; action_type: string; player_id: number | null }[] = []
  const batchSize = 5
  for (let i = 0; i < gameIds.length; i += batchSize) {
    const { data } = await supabase
      .from("play_by_play")
      .select("id, game_id, action_type, player_id")
      .in("game_id", gameIds.slice(i, i + batchSize))
      .eq("team_id", teamId)
      .order("id", { ascending: true })
    allPbp = allPbp.concat((data ?? []) as typeof allPbp)
  }

  // Group by game
  const byGame = new Map<number, typeof allPbp>()
  for (const ev of allPbp) {
    if (!byGame.has(ev.game_id)) byGame.set(ev.game_id, [])
    byGame.get(ev.game_id)!.push(ev)
  }

  const pairCounts = new Map<string, { aidId: number; scorerId: number; count: number }>()
  for (const [, events] of byGame) {
    for (let i = 0; i < events.length; i++) {
      const ev = events[i]
      if (ev.action_type !== "assist" || !ev.player_id) continue
      // Search forward up to 6 events for the basket
      for (let j = i + 1; j < Math.min(i + 6, events.length); j++) {
        const next = events[j]
        if (
          next.action_type?.includes("made") &&
          !next.action_type.includes("ft_") &&
          next.player_id &&
          next.player_id !== ev.player_id
        ) {
          const key = `${ev.player_id}→${next.player_id}`
          const cur = pairCounts.get(key) ?? { aidId: ev.player_id, scorerId: next.player_id, count: 0 }
          cur.count++
          pairCounts.set(key, cur)
          break
        }
        if (next.action_type?.includes("missed") || next.action_type?.includes("turnover")) break
      }
    }
  }

  const sorted = Array.from(pairCounts.values()).sort((a, b) => b.count - a.count).slice(0, 10)
  if (sorted.length === 0) return []

  const playerIds = [...new Set(sorted.flatMap((p) => [p.aidId, p.scorerId]))]
  const { data: players } = await supabase.from("players").select("*").in("id", playerIds)
  const pm = new Map<number, Player>((players ?? []).map((p: Player) => [p.id, p]))

  return sorted
    .filter((p) => pm.has(p.aidId) && pm.has(p.scorerId))
    .map((p) => ({ assister: pm.get(p.aidId)!, scorer: pm.get(p.scorerId)!, count: p.count }))
}

/** Best shared +/- pairs for a team (players who are best together).
 *  Approximates shared +/- as (pmA + pmB) / 2 per game, averaged across games they played together.
 */
export async function getTeamBestPlusMinus(
  teamId: number,
): Promise<{ playerA: Player; playerB: Player; avgSharedPM: number; games: number }[]> {
  const stats = await getPlayerSeasonStats(teamId)
  const byGame = new Map<number, StatsPlayerGame[]>()
  for (const s of stats) {
    if (!byGame.has(s.game_id)) byGame.set(s.game_id, [])
    byGame.get(s.game_id)!.push(s)
  }

  const pairPM = new Map<string, { idA: number; idB: number; total: number; games: number }>()
  for (const [, gameStats] of byGame) {
    for (let i = 0; i < gameStats.length; i++) {
      for (let j = i + 1; j < gameStats.length; j++) {
        const a = gameStats[i]
        const b = gameStats[j]
        const shared = ((a.plus_minus ?? 0) + (b.plus_minus ?? 0)) / 2
        const [idA, idB] = a.player_id < b.player_id ? [a.player_id, b.player_id] : [b.player_id, a.player_id]
        const key = `${idA}-${idB}`
        const cur = pairPM.get(key) ?? { idA, idB, total: 0, games: 0 }
        cur.total += shared
        cur.games++
        pairPM.set(key, cur)
      }
    }
  }

  const sorted = Array.from(pairPM.values())
    .filter((p) => p.games >= 3)
    .map((p) => ({ ...p, avg: p.total / p.games }))
    .sort((a, b) => b.avg - a.avg)
    .slice(0, 10)
  if (sorted.length === 0) return []

  const playerIds = [...new Set(sorted.flatMap((p) => [p.idA, p.idB]))]
  const { data: players } = await supabase.from("players").select("*").in("id", playerIds)
  const pm = new Map<number, Player>((players ?? []).map((p: Player) => [p.id, p]))

  return sorted
    .filter((p) => pm.has(p.idA) && pm.has(p.idB))
    .map((p) => ({
      playerA: pm.get(p.idA)!,
      playerB: pm.get(p.idB)!,
      avgSharedPM: Number(p.avg.toFixed(1)),
      games: p.games,
    }))
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
  const fgAtt = sum("fg_att")   // GARANTIZADO: suma de INTENTADOS (made + missed)
  const t3Made = sum("t3_made")
  const ftMade = sum("ft_made")
  const ftAtt = sum("ft_att")
  
  // PPG: priorizar puntos de tabla; fallback por tiros anotados para robustez
  const totalPoints = sum("points")
  const computedPoints = sum("t2_made") * 2 + t3Made * 3 + ftMade
  const safeTotalPoints = totalPoints > 0 ? totalPoints : computedPoints
  
  // eFG% = (FGM + 0.5 * 3PM) / FGA
  // CRÍTICO: FGA es el denominador correcto (total intentados, no solo anotados)
  const efg = fgAtt > 0 ? (((fgMade + 0.5 * t3Made) / fgAtt) * 100).toFixed(1) : "0"
  
  // EFF = (Puntos + Reb + Ast + Stl + Blk) - (FGA - FGM + FTA - FTM + TO)
  // FG Missed = FGA - FGM (correctamente calculado)
  const fgMissed = fgAtt - fgMade
  const ftMissed = ftAtt - ftMade
  const eff = ((safeTotalPoints + sum("reb_tot") + sum("assists") + sum("steals") + sum("blocks_for")) - (fgMissed + ftMissed + sum("turnovers"))) / n

  return {
    gamesPlayed: n,
    ppg: (safeTotalPoints / n).toFixed(1),
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
  const fgAtt = sum("fg_att")   // GARANTIZADO: suma de INTENTADOS
  const t3Made = sum("t3_made")
  const ftMade = sum("ft_made")
  const ftAtt = sum("ft_att")
  
  const totalPoints = sum("points")
  const computedPoints = sum("t2_made") * 2 + t3Made * 3 + ftMade
  const safeTotalPoints = totalPoints > 0 ? totalPoints : computedPoints
  const ppg = (safeTotalPoints / n).toFixed(1)
  
  // eFG% = (FGM + 0.5 * 3PM) / FGA
  const efg = fgAtt > 0 ? (((fgMade + 0.5 * t3Made) / fgAtt) * 100).toFixed(1) : "0"
  
  const fgMissed = fgAtt - fgMade
  const ftMissed = ftAtt - ftMade
  const eff = ((safeTotalPoints + sum("reb_tot") + sum("assists") + sum("steals") + sum("blocks_for")) - (fgMissed + ftMissed + sum("turnovers"))) / n

  return {
    ppg,
    rpg: (sum("reb_tot") / n).toFixed(1),
    efg,
    eff: eff.toFixed(1),
  }
}

// ══════════════════════════════════════════════════════════════
// LEAGUE BENCHMARKING (for Teams section)
// ══════════════════════════════════════════════════════════════

/** Get all teams in a league with their season averages for percentile benchmarking */
export async function getLeagueBenchmark(leagueId?: number) {
  // Get all games with their team stats
  let query = supabase
    .from("stats_team_games")
    .select("*, team:teams(*), game:games(*)")

  const { data } = await query
  if (!data || data.length === 0) return []

  // Optionally filter by league
  const filtered = leagueId
    ? data.filter((d: any) => d.game?.league_id === leagueId)
    : data

  // Group by team
  const byTeam = new Map<number, { team: Team; rows: StatsTeamGame[] }>()
  for (const row of filtered) {
    const t = (row as any).team as Team
    if (!t) continue
    if (!byTeam.has(t.id)) byTeam.set(t.id, { team: t, rows: [] })
    byTeam.get(t.id)!.rows.push(row)
  }

  return Array.from(byTeam.values()).map(({ team, rows }) => {
    const n = rows.length
    const sum = (key: keyof StatsTeamGame) =>
      rows.reduce((a, r) => a + ((r[key] as number) || 0), 0)

    const fgMade = sum("fg_made")
    const fgAtt = sum("fg_att")   // GARANTIZADO: suma de INTENTADOS
    const t3Made = sum("t3_made")
    const t3Att = sum("t3_att")
    const ftMade = sum("ft_made")
    const ftAtt = sum("ft_att")
    const totalPoints = sum("points")

    const ppg = totalPoints / n
    const rpg = sum("reb_tot") / n
    const apg = sum("assists") / n
    const spg = sum("steals") / n
    const tpg = sum("turnovers") / n
    const efg = fgAtt > 0 ? ((fgMade + 0.5 * t3Made) / fgAtt) * 100 : 0
    const ftRate = fgAtt > 0 ? (ftAtt / fgAtt) * 100 : 0
    const orbPct = sum("reb_off") / n
    const tovPct = tpg

    return {
      teamId: team.id,
      team,
      gamesPlayed: n,
      ppg,
      rpg,
      apg,
      spg,
      tpg,
      efg,
      ftRate,
      orbPct,
      tovPct,
      fgPct: fgAtt > 0 ? (fgMade / fgAtt) * 100 : 0,
      t3Pct: t3Att > 0 ? (t3Made / t3Att) * 100 : 0,
      ftPct: ftAtt > 0 ? (ftMade / ftAtt) * 100 : 0,
      rebOff: sum("reb_off") / n,
      rebDef: sum("reb_def") / n,
    }
  })
}

/** Get team shots filtered by quarter */
export async function getTeamShotsByQuarter(
  teamId: number,
  quarter?: number,
): Promise<Shot[]> {
  let query = supabase.from("shots").select("*").eq("team_id", teamId)
  if (quarter) query = query.eq("quarter", quarter)
  const { data } = await query
  return data ?? []
}

/** Get Play-by-Play for a team (all games) */
export async function getTeamPBP(teamId: number): Promise<PlayByPlay[]> {
  const { data } = await supabase
    .from("play_by_play")
    .select("*")
    .eq("team_id", teamId)
  return (data ?? []) as PlayByPlay[]
}

/** Get points allowed (opponent stats) for a team across all games */
export async function getTeamPointsAllowed(teamId: number) {
  // Get all games the team played
  const { data: games } = await supabase
    .from("games")
    .select("id, home_team_id, away_team_id, home_score, away_score")
    .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
    .eq("status", "PROCESSED")

  if (!games || games.length === 0) return { allowed: 0, games: 0 }

  let totalAllowed = 0
  for (const g of games) {
    const isHome = g.home_team_id === teamId
    totalAllowed += (isHome ? g.away_score : g.home_score) ?? 0
  }
  return { allowed: totalAllowed / games.length, games: games.length }
}

/** Get lineup combinations from substitution data in PBP.
 *  Uses home_score_partial / away_score_partial from PBP for accurate PF/PC. */
export async function getTeamLineups(teamId: number) {
  // Get all games for this team (need home/away to attribute scores and final scores)
  const { data: games } = await supabase
    .from("games")
    .select("id, home_team_id, away_team_id, home_score, away_score")
    .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
    .eq("status", "PROCESSED")

  if (!games || games.length === 0) return []

  const gameIds = games.map((g) => g.id)

  // Get ALL PBP events (both teams) – we need opponent scoring too
  const { data: pbpData } = await supabase
    .from("play_by_play")
    .select("*")
    .in("game_id", gameIds)
    .order("id", { ascending: true })

  if (!pbpData || pbpData.length === 0) return []

  // Get starters per game
  const { data: starterData } = await supabase
    .from("stats_player_games")
    .select("game_id, player_id")
    .eq("team_id", teamId)
    .eq("starter", true)
    .in("game_id", gameIds)

  // Player lookup
  const { data: players } = await supabase
    .from("players")
    .select("*")
    .eq("current_team_id", teamId)

  const playerMap = new Map<number, Player>()
  for (const p of players ?? []) playerMap.set(p.id, p)

  // Starters grouped by game
  const startersByGame = new Map<number, Set<number>>()
  for (const s of starterData ?? []) {
    if (!startersByGame.has(s.game_id)) startersByGame.set(s.game_id, new Set())
    startersByGame.get(s.game_id)!.add(s.player_id)
  }

  // Accumulated lineup stats across all games
  const lineupStats = new Map<
    string,
    { playerIds: number[]; minutes: number; ptsFor: number; ptsAgainst: number; stints: number }
  >()

  const parseTime = (minute: string | null, quarter: number) => {
    if (!minute) return (quarter - 1) * 10
    const parts = minute.split(":")
    const mins = parseInt(parts[0] || "0")
    const secs = parseInt(parts[1] || "0")
    return (quarter - 1) * 10 + (10 - mins - secs / 60)
  }

  for (const game of games) {
    const isHome = game.home_team_id === teamId
    const gamePbp = pbpData.filter((p) => p.game_id === game.id)
    const currentOnCourt = new Set<number>(startersByGame.get(game.id) ?? [])

    let prevTime = parseTime("10:00", 1)
    let lastHomeScore = 0
    let lastAwayScore = 0
    let prevScoreFor = 0
    let prevScoreAgainst = 0

    const getLineupKey = () =>
      Array.from(currentOnCourt).sort((a, b) => a - b).join("-")

    const ensureLineup = (key: string) => {
      if (!lineupStats.has(key)) {
        lineupStats.set(key, {
          playerIds: Array.from(currentOnCourt).sort((a, b) => a - b),
          minutes: 0,
          ptsFor: 0,
          ptsAgainst: 0,
          stints: 0,
        })
      }
      return lineupStats.get(key)!
    }

    /** Close the current stint: attribute minutes + score differential */
    const closeStint = (currentTime: number) => {
      const duration = currentTime - prevTime
      const scoreFor = isHome ? lastHomeScore : lastAwayScore
      const scoreAgainst = isHome ? lastAwayScore : lastHomeScore

      if (currentOnCourt.size === 5 && duration > 0) {
        const key = getLineupKey()
        const lineup = ensureLineup(key)
        lineup.minutes += duration
        
        // Ensure we never add NaN or undefined values
        const ptsForDelta = (scoreFor || 0) - (prevScoreFor || 0)
        const ptsAgainstDelta = (scoreAgainst || 0) - (prevScoreAgainst || 0)
        
        lineup.ptsFor += ptsForDelta
        lineup.ptsAgainst += ptsAgainstDelta
        lineup.stints++
      }

      prevTime = currentTime
      prevScoreFor = scoreFor || 0
      prevScoreAgainst = scoreAgainst || 0
    }

    for (const event of gamePbp) {
      // Always keep running score up-to-date - ensure we never have undefined scores
      if (event.home_score_partial != null) lastHomeScore = event.home_score_partial
      if (event.away_score_partial != null) lastAwayScore = event.away_score_partial

      // Handle our team's substitutions
      if (event.team_id === teamId && event.player_id) {
        if (event.action_type === "sub_out") {
          closeStint(parseTime(event.minute, event.quarter))
          currentOnCourt.delete(event.player_id)
        } else if (event.action_type === "sub_in") {
          closeStint(parseTime(event.minute, event.quarter))
          currentOnCourt.add(event.player_id)
        }
      }
    }

    // Use final game scores to close the last stint accurately
    lastHomeScore = game.home_score ?? lastHomeScore
    lastAwayScore = game.away_score ?? lastAwayScore
    closeStint(parseTime("0:00", 4))
  }

  // Return top lineups sorted by minutes
  const lineups = Array.from(lineupStats.values())
    .filter((l) => l.minutes > 1)
    .sort((a, b) => b.minutes - a.minutes)
    .slice(0, 15)
    .map((l) => ({
      ...l,
      players: l.playerIds.map((id) => playerMap.get(id)).filter(Boolean) as Player[],
      // Ensure all numeric values are never NaN or undefined
      ptsFor: l.ptsFor || 0,
      ptsAgainst: l.ptsAgainst || 0,
      netRating: (l.ptsFor || 0) - (l.ptsAgainst || 0),
    }))

  // Calculate lineup characteristics (badges)
  return assignLineupBadges(lineups)
}

/** Assign characteristic badges to lineups based on their performance */
function assignLineupBadges(lineups: any[]) {
  if (lineups.length === 0) return []

  // Calculate rates for each lineup
  const lineupsWithRates = lineups.map((l) => ({
    ...l,
    offensiveRate: l.minutes > 0 ? l.ptsFor / l.minutes : 0,
    defensiveRate: l.minutes > 0 ? l.ptsAgainst / l.minutes : 0,
    netRate: l.minutes > 0 ? (l.ptsFor - l.ptsAgainst) / l.minutes : 0,
  }))

  // Find the best in each category
  const bestOffense = lineupsWithRates.reduce((prev, curr) =>
    curr.offensiveRate > prev.offensiveRate ? curr : prev
  )
  const bestDefense = lineupsWithRates.reduce((prev, curr) =>
    curr.defensiveRate < prev.defensiveRate ? curr : prev
  )
  const mostMinutes = lineupsWithRates.reduce((prev, curr) =>
    curr.minutes > prev.minutes ? curr : prev
  )
  const bestNetRating = lineupsWithRates.reduce((prev, curr) =>
    curr.netRating > prev.netRating ? curr : prev
  )
  const mostStints = lineupsWithRates.reduce((prev, curr) =>
    curr.stints > prev.stints ? curr : prev
  )

  // Assign badges to each lineup
  return lineupsWithRates.map((lineup) => {
    const badges: string[] = []
    
    if (lineup === mostMinutes) {
      badges.push("Quinteto de Gala")
    }
    if (lineup === bestDefense) {
      badges.push("Muro Defensivo")
    }
    if (lineup === bestOffense) {
      badges.push("Francotiradores")
    }
    if (lineup === bestNetRating && lineup.netRating > 5) {
      badges.push("Dominio")
    }
    if (lineup === mostStints && lineup.stints > 3) {
      badges.push("Química")
    }

    return { ...lineup, badges }
  })
}

/** Get On/Off impact for each player.
 *  ON  = player's plus_minus from stats_player_games.
 *  OFF = game_margin − on_court_plus_minus  (what happens when the player sits). */
export async function getPlayerOnOffImpact(teamId: number) {
  const { data: playerStats } = await supabase
    .from("stats_player_games")
    .select("*, player:players(*), game:games(id, home_team_id, away_team_id, home_score, away_score)")
    .eq("team_id", teamId)

  if (!playerStats || playerStats.length === 0) return []

  // Group by player
  const byPlayer = new Map<number, { player: Player; rows: any[] }>()
  for (const s of playerStats) {
    const p = s.player as Player | null
    if (!p) continue
    if (!byPlayer.has(p.id)) byPlayer.set(p.id, { player: p, rows: [] })
    byPlayer.get(p.id)!.rows.push(s)
  }

  return Array.from(byPlayer.values())
    .map(({ player, rows }) => {
      const gp = rows.length
      let totalOnPM = 0
      let totalOffPM = 0
      let totalMinutes = 0
      let totalPts = 0

      for (const r of rows) {
        const game = r.game
        if (!game) continue

        // Team margin for this game (our score − opponent score)
        const isHome = game.home_team_id === teamId
        const gameMargin = isHome
          ? (game.home_score ?? 0) - (game.away_score ?? 0)
          : (game.away_score ?? 0) - (game.home_score ?? 0)

        const onPM = r.plus_minus ?? 0
        const offPM = gameMargin - onPM

        totalOnPM += onPM
        totalOffPM += offPM
        totalPts += r.points ?? 0

        const m = r.minutes as string | null
        if (m) {
          const parts = m.split(":")
          totalMinutes += parseInt(parts[0] || "0") + parseInt(parts[1] || "0") / 60
        }
      }

      return {
        player,
        gp,
        avgMinutes: (gp > 0 ? totalMinutes / gp : 0).toFixed(1),
        avgPts: (gp > 0 ? totalPts / gp : 0).toFixed(1),
        onCourtPlusMinus: (gp > 0 ? totalOnPM / gp : 0).toFixed(1),
        offCourtPlusMinus: (gp > 0 ? totalOffPM / gp : 0).toFixed(1),
      }
    })
    .sort((a, b) => Number(b.avgMinutes) - Number(a.avgMinutes))
}

/** Get team's league info */
export async function getTeamLeague(teamId: number): Promise<League | null> {
  const { data: game } = await supabase
    .from("games")
    .select("league:leagues(*)")
    .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
    .limit(1)
    .single()

  return (game as any)?.league ?? null
}

/** Get Four Factors for advanced stats */
export async function getTeamFourFactors(teamId: number) {
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
  const ftMade = sum("ft_made")
  const ftAtt = sum("ft_att")

  // eFG% = (FGM + 0.5 * 3PM) / FGA
  const efg = fgAtt > 0 ? ((fgMade + 0.5 * t3Made) / fgAtt) * 100 : 0

  // TOV% = TO / (FGA + 0.44 * FTA + TO)
  const to = sum("turnovers")
  const possessions = fgAtt + 0.44 * ftAtt + to
  const tovPct = possessions > 0 ? (to / possessions) * 100 : 0

  // ORB% = ORB / (ORB + Opp DRB) — simplified as ORB per game
  const orbPct = sum("reb_off") / n

  // FT Rate = FTA / FGA
  const ftRate = fgAtt > 0 ? (ftAtt / fgAtt) * 100 : 0

  return {
    efg: Number(efg.toFixed(1)),
    tovPct: Number(tovPct.toFixed(1)),
    orbPct: Number(orbPct.toFixed(1)),
    ftRate: Number(ftRate.toFixed(1)),
  }
}

/** Get scoring breakdown from PBP (points off turnovers, fastbreak, 2nd chance) */
export async function getTeamScoringBreakdown(teamId: number) {
  const { data: games } = await supabase
    .from("games")
    .select("id")
    .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
    .eq("status", "PROCESSED")

  if (!games || games.length === 0)
    return { offTurnover: 0, fastbreak: 0, secondChance: 0, regular: 0 }

  const gameIds = games.map((g) => g.id)

  const { data: pbp } = await supabase
    .from("play_by_play")
    .select("*")
    .in("game_id", gameIds)
    .eq("team_id", teamId)
    .order("id", { ascending: true })

  if (!pbp || pbp.length === 0)
    return { offTurnover: 0, fastbreak: 0, secondChance: 0, regular: 0 }

  let offTurnover = 0
  let secondChance = 0
  let fastbreak = 0
  let totalPoints = 0

  // Simple heuristic: Look at sequences 
  for (let i = 0; i < pbp.length; i++) {
    const ev = pbp[i]
    if (ev.action_value && ev.action_value > 0 && ev.action_type?.includes("made")) {
      totalPoints += ev.action_value

      // Check if preceded by steal/turnover/reb_off (within 2 events - more restrictive)
      // Window: i-2 to i-1 (immediate predecessor only, plus one extra event)
      let foundTurnover = false
      let foundOffReb = false
      let foundSteal = false
      for (let j = Math.max(0, i - 2); j < i; j++) {
        if (pbp[j].action_type === "turnover") {
          foundTurnover = true
        }
        if (pbp[j].action_type === "steal") {
          foundSteal = true
        }
        if (pbp[j].action_type === "reb_off") {
          foundOffReb = true
        }
      }

      if (foundOffReb) secondChance += ev.action_value
      else if (foundTurnover || foundSteal) offTurnover += ev.action_value
    }
  }

  // Fastbreak: 3% of total points (conservative estimate since we don't have real possession time data)
  fastbreak = Math.round(totalPoints * 0.03)
  const regular = totalPoints - offTurnover - secondChance - fastbreak

  return { offTurnover, fastbreak, secondChance, regular }
}

// ══════════════════════════════════════════════════════════════
// PLAYER PROFILE — Advanced queries
// ══════════════════════════════════════════════════════════════

/** Full game log for a player with game details — sorted by date ascending for charts */
export async function getPlayerFullGameLog(
  playerId: number,
  teamId: number,
): Promise<(StatsPlayerGame & { game: Game })[]> {
  const { data } = await supabase
    .from("stats_player_games")
    .select(
      "*, game:games(*, home_team:teams!games_home_team_id_fkey(*), away_team:teams!games_away_team_id_fkey(*))",
    )
    .eq("player_id", playerId)
    .eq("team_id", teamId)
    .order("id", { ascending: true })
  return (data ?? []) as any
}

/** Get shots for a player filtered by game IDs */
export async function getPlayerShotsFiltered(
  playerId: number,
  gameIds?: number[],
): Promise<Shot[]> {
  let query = supabase.from("shots").select("*").eq("player_id", playerId)
  if (gameIds && gameIds.length > 0) {
    query = query.in("game_id", gameIds)
  }
  const { data } = await query
  return data ?? []
}

/** Get shots for a player tagged with isAssisted (% de Canastas Asistidas) using pbp_id linkage.
 *  A shot is assisted (asistida) if the PBP event near it (by id, same game)
 *  has action_type = 'assist'.  For missed shots (which never have an
 *  assist event), we use a heuristic: if the nearest significant same-team
 *  event before the miss was by a different player → likely a pass.
 *  Otherwise it is Pull-up / off-dribble.
 *  
 *  LIMITACIÓN: Los tiros fallados siempre aparecen como "No asistidos" porque
 *  la FEB PBP solo registra asistencias en canastas metidas. Los tiros fallados
 *  tras pase no pueden calcularse con exactitud desde los datos oficiales. */
export async function getPlayerShotsTagged(
  playerId: number,
  teamId?: number,
  gameIds?: number[],
): Promise<(Shot & { isAssisted: boolean })[]> {
  // 1. Fetch shots
  let shotQuery = supabase.from("shots").select("*").eq("player_id", playerId)
  if (gameIds && gameIds.length > 0) shotQuery = shotQuery.in("game_id", gameIds)
  const { data: shotsRaw } = await shotQuery
  const shots: Shot[] = shotsRaw ?? []

  if (shots.length === 0) return []

  // 2. Fetch all PBP for these games (include team_id and player_name for assist matching)
  const gids = gameIds ?? [...new Set(shots.map((s) => s.game_id))]
  if (gids.length === 0) return shots.map((s) => ({ ...s, isAssisted: false }))

  const { data: pbpRaw } = await supabase
    .from("play_by_play")
    .select("id, game_id, action_type, player_id, team_id")
    .in("game_id", gids)
    .order("id", { ascending: true })
    .limit(10000)

  type PbpRow = Pick<PlayByPlay, "id" | "game_id" | "action_type" | "player_id"> & { team_id: number | null }
  const allPbp = (pbpRaw ?? []) as PbpRow[]

  // 3. Build per-game PBP index sorted by id
  const pbpByGame = new Map<number, PbpRow[]>()
  for (const ev of allPbp) {
    if (!pbpByGame.has(ev.game_id)) pbpByGame.set(ev.game_id, [])
    pbpByGame.get(ev.game_id)!.push(ev)
  }

  // 4. Build a lookup: pbp.id → index in game array
  const pbpIdToIndex = new Map<number, { game_id: number; idx: number }>()
  for (const [gid, events] of pbpByGame) {
    for (let i = 0; i < events.length; i++) {
      pbpIdToIndex.set(events[i].id, { game_id: gid, idx: i })
    }
  }

  // Helper: non-trivial action types that break the assist-search window
  const breaksSearch = (a: string | undefined) =>
    !!a && (a.includes("made") || a.includes("missed") || a.includes("turnover"))

  // Insignificant actions (subs, timeouts, etc.) — skip when looking for teammate context
  const insignificant = new Set([
    "sub_in", "sub_out", "timeout", "period_start", "period_end",
    "team_foul", "team_rebound",
  ])

  // 5. Tag each shot
  return shots.map((shot) => {
    if (!shot.pbp_id) return { ...shot, isAssisted: false }

    const ref = pbpIdToIndex.get(shot.pbp_id)
    if (!ref) return { ...shot, isAssisted: false }

    const gameEvents = pbpByGame.get(ref.game_id) ?? []
    let isAssisted = false

    if (shot.made) {
      // ── MADE shot: buscar evento 'assist' en adyacencia inmediata ──
      // OPTIMIZADO: ventana reducida ±1 a ±2 eventos (eventos PBP contiguos en FEB)
      
      // Backward: -1 a -2
      for (let i = ref.idx - 1; i >= Math.max(0, ref.idx - 2); i--) {
        const prev = gameEvents[i]
        if (prev.action_type === "assist") {
          // Evento asistencia encontrado
          // NOTA: Si player_id es null, se requeriría búsqueda en roster (implementar si necesario)
          isAssisted = prev.player_id !== null
          break
        }
        if (breaksSearch(prev.action_type)) break
      }
      
      // Forward: +1 a +2 (si no encontró en backward)
      if (!isAssisted) {
        for (let i = ref.idx + 1; i < Math.min(ref.idx + 3, gameEvents.length); i++) {
          const next = gameEvents[i]
          if (next.action_type === "assist") {
            // Evento asistencia encontrado
            isAssisted = next.player_id !== null
            break
          }
          if (breaksSearch(next.action_type)) break
        }
      }
    } else {
      // ── MISSED shot: sin evento assist. Usar heurística: ──
      // OPTIMIZADO: ventana reducida ±1 a ±2 eventos
      // Buscar el evento más cercano del equipo para determinar si fue pass o self-creation
      if (teamId) {
        for (let i = ref.idx - 1; i >= Math.max(0, ref.idx - 2); i--) {
          const prev = gameEvents[i]
          if (prev.team_id !== teamId && prev.team_id !== null) continue // skip opponent
          if (insignificant.has(prev.action_type)) continue
          if (prev.player_id && prev.player_id !== playerId) {
            isAssisted = true // teammate had last significant action → likely a pass
          }
          break // stop after first significant same-team event
        }
      }
    }

    return { ...shot, isAssisted }
  })
}

/** Get play-by-play events for a player */
export async function getPlayerPBP(
  playerId: number,
  gameIds?: number[],
): Promise<PlayByPlay[]> {
  let query = supabase
    .from("play_by_play")
    .select("*")
    .eq("player_id", playerId)
    .order("id", { ascending: true })
  if (gameIds && gameIds.length > 0) {
    query = query.in("game_id", gameIds)
  }
  const { data } = await query
  return (data ?? []) as PlayByPlay[]
}

/** Get all PBP for given games (both teams, for clutch context) */
export async function getGamesPBP(
  gameIds: number[],
): Promise<PlayByPlay[]> {
  if (gameIds.length === 0) return []

  // Supabase has a 1000-row default limit; we batch game IDs and paginate
  const BATCH_SIZE = 50 // game IDs per query
  const PAGE_SIZE = 10000 // rows per pagination request
  const allResults: PlayByPlay[] = []

  for (let i = 0; i < gameIds.length; i += BATCH_SIZE) {
    const batch = gameIds.slice(i, i + BATCH_SIZE)

    let offset = 0
    // eslint-disable-next-line no-constant-condition
    while (true) {
      try {
        const { data, error } = await supabase
          .from("play_by_play")
          .select("*", { count: "exact" })
          .in("game_id", batch)
          .order("id", { ascending: true })
          .range(offset, offset + PAGE_SIZE - 1)

        if (error) {
          console.warn(`[getGamesPBP] Error fetching batch ${i}:`, error)
          break
        }

        const rows = (data ?? []) as PlayByPlay[]
        if (!rows || rows.length === 0) break

        allResults.push(...rows)

        // If we got fewer rows than PAGE_SIZE, we've reached the end
        if (rows.length < PAGE_SIZE) break

        offset += PAGE_SIZE
      } catch (err) {
        console.error(`[getGamesPBP] Exception in batch ${i}:`, err)
        break
      }
    }
  }

  // Final sort by ID to maintain order
  return allResults.sort((a, b) => a.id - b.id)
}

/** Get league-wide player averages by position for benchmarking.
 *  Groups all players in the league by a position heuristic. */
export async function getLeaguePlayerBenchmarks(teamId: number) {
  // Get all stats across all teams in same league
  const { data } = await supabase
    .from("stats_player_games")
    .select("*, player:players(*)")

  if (!data || data.length === 0) return { all: [] as any[] }

  // Group by player
  const byPlayer = new Map<
    number,
    { player: Player; rows: StatsPlayerGame[] }
  >()
  for (const s of data) {
    const p = (s as any).player as Player | undefined
    if (!p) continue
    if (!byPlayer.has(p.id)) byPlayer.set(p.id, { player: p, rows: [] })
    byPlayer.get(p.id)!.rows.push(s)
  }

  const all = Array.from(byPlayer.values()).map(({ player, rows }) => {
    const n = rows.length
    const sum = (fn: (s: StatsPlayerGame) => number) =>
      rows.reduce((a, s) => a + fn(s), 0)
    return {
      playerId: player.id,
      teamId: rows[0].team_id,
      name: player.name,
      gp: n,
      ppg: sum((s) => s.points ?? 0) / n,
      rpg: sum((s) => s.reb_tot ?? 0) / n,
      apg: sum((s) => s.assists ?? 0) / n,
      spg: sum((s) => s.steals ?? 0) / n,
      val: sum((s) => s.valoracion ?? 0) / n,
    }
  })

  return { all }
}

/** Get synergy data: best partners by shared plus-minus and assist connections */
export async function getPlayerSynergyData(
  playerId: number,
  teamId: number,
  gameIds?: number[],
) {
  console.log(`[SYNERGY] Iniciando búsqueda - Jugador: ${playerId}, Equipo: ${teamId}, Juegos: ${gameIds?.length ?? 'todos'}`)
  
  // Get all team stats for same games
  let query = supabase
    .from("stats_player_games")
    .select("*, player:players(*), game:games(id, home_team_id, away_team_id, home_score, away_score)")
    .eq("team_id", teamId)
  if (gameIds && gameIds.length > 0) {
    query = query.in("game_id", gameIds)
  }
  const { data: allStats } = await query
  console.log(`[SYNERGY] Stats obtenidos: ${allStats?.length ?? 0} registros`)
  if (!allStats) {
    console.log(`[SYNERGY] ⚠️ No hay stats, retornando vacío`)
    return { partners: [], assistsGiven: [], assistsReceived: [] }
  }

  // Group by game
  const byGame = new Map<number, StatsPlayerGame[]>()
  for (const s of allStats) {
    const gid = s.game_id
    if (!byGame.has(gid)) byGame.set(gid, [])
    byGame.get(gid)!.push(s)
  }

  // For each game, pair the target player with all teammates
  const partnerPM = new Map<
    number,
    { player: Player; totalPM: number; games: number }
  >()

  for (const [, gameStats] of byGame) {
    const myStats = gameStats.find((s) => s.player_id === playerId)
    if (!myStats) continue

    for (const teammate of gameStats) {
      if (teammate.player_id === playerId) continue
      const p = (teammate as any).player as Player | undefined
      if (!p) continue

      if (!partnerPM.has(p.id)) {
        partnerPM.set(p.id, { player: p, totalPM: 0, games: 0 })
      }
      const entry = partnerPM.get(p.id)!
      // Shared PM is approximated as the average of both players' PM
      entry.totalPM += ((myStats.plus_minus ?? 0) + (teammate.plus_minus ?? 0)) / 2
      entry.games++
    }
  }

  const partners = Array.from(partnerPM.values())
    .map((e) => ({
      player: e.player,
      avgPM: e.games > 0 ? e.totalPM / e.games : 0,
      games: e.games,
    }))
    .sort((a, b) => b.avgPM - a.avgPM)

  console.log(`[SYNERGY] Socios encontrados: ${partners.length}`)

  // ── Assist network via PBP id-sequence ──────────────────────────────
  const gids = gameIds ?? Array.from(byGame.keys())
  console.log(`[SYNERGY] Buscando asistencias en juegos: ${gids.length} (${gids.slice(0, 3).join(',')})`)

  // NOTE: Supabase tiene límite de ~1000 filas por query. Usar batches pequeños (2 juegos)
  // para asegurar que cada query devuelve <1000 eventos
  let allPbp: Pick<PlayByPlay, "id" | "game_id" | "action_type" | "player_id" | "team_id">[] = []
  
  // Fetch PBP in batches of 2 games to avoid hitting Supabase row limits
  const batchSize = 2
  for (let i = 0; i < gids.length; i += batchSize) {
    const batch = gids.slice(i, i + batchSize)
    const batchNum = Math.floor(i / batchSize) + 1
    const totalBatches = Math.ceil(gids.length / batchSize)
    console.log(`[SYNERGY] Batch ${batchNum}/${totalBatches}: obteniendo juegos ${batch.join(',')}`)
    
    const { data: batchPbp } = await supabase
      .from("play_by_play")
      .select("id, game_id, action_type, player_id, team_id")
      .in("game_id", batch)
      .order("game_id", { ascending: true })
      .order("id", { ascending: true })
    
    const batchData = (batchPbp ?? []) as Pick<PlayByPlay, "id" | "game_id" | "action_type" | "player_id" | "team_id">[]
    console.log(`[SYNERGY]   ✓ ${batchData.length} eventos en este batch`)
    allPbp = allPbp.concat(batchData)
  }

  console.log(`[SYNERGY] ✅ PBP TOTAL: ${allPbp.length} eventos de ${gids.length} juegos`)

  // Group per game
  const pbpByGame = new Map<number, typeof allPbp>()
  for (const ev of allPbp) {
    if (!pbpByGame.has(ev.game_id)) pbpByGame.set(ev.game_id, [])
    pbpByGame.get(ev.game_id)!.push(ev)
  }

  console.log(`[SYNERGY] PBP agrupado: ${pbpByGame.size} juegos con datos de ${gids.length} esperados`)
  
  // Log which games have PBP data
  const gamesWithPbp = Array.from(pbpByGame.keys()).sort((a, b) => a - b)
  const gamesWithoutPbp = gids.filter(g => !gamesWithPbp.includes(g))
  if (gamesWithoutPbp.length > 0) {
    console.warn(`[SYNERGY] ⚠️ Juegos SIN datos PBP (${gamesWithoutPbp.length}): ${gamesWithoutPbp.join(', ')}`)
  } else {
    console.log(`[SYNERGY] ✓ TODOS los ${gids.length} juegos tienen datos de PBP`)
  }

  // Debug: check how many events player has in PBP
  const playerEventsCount = allPbp.filter(ev => ev.player_id === playerId).length
  console.log(`[SYNERGY] Eventos del jugador ${playerId} en PBP total: ${playerEventsCount}`)
  
  if (allPbp.length === 0) {
    console.warn(`[SYNERGY] ⚠️ NO HAY DATOS DE PBP para estos ${gids.length} juegos`)
    console.warn(`[SYNERGY] Juegos solicitados: ${gids.join(', ')}`)
  }

  // Build player lookup: include ALL players from all games (not just team roster)
  // This ensures we can find assists/scorers from both teams
  const playerMap = new Map<number, Player>()
  
  // First: add players from stats (those who played)
  for (const [, stats] of byGame) {
    for (const s of stats) {
      const p = (s as any).player as Player | undefined
      if (p) playerMap.set(p.id, p)
    }
  }
  
  // Second: add all team roster players from separate query
  const { data: rosterRaw } = await supabase
    .from("players")
    .select("*")
    .eq("current_team_id", teamId)
  
  const roster = (rosterRaw ?? []) as Player[]
  for (const p of roster) {
    if (!playerMap.has(p.id)) {
      playerMap.set(p.id, p)
    }
  }

  // Third: extract all unique player_ids from PBP events and fetch missing players
  // This handles players from opposing teams who may have scored or assisted
  const pbpPlayerIds = new Set<number>()
  for (const ev of allPbp) {
    if (ev.player_id) {
      pbpPlayerIds.add(ev.player_id)
    }
  }

  const missingPlayerIds = Array.from(pbpPlayerIds).filter(id => !playerMap.has(id))
  if (missingPlayerIds.length > 0) {
    const { data: missingPlayersRaw } = await supabase
      .from("players")
      .select("*")
      .in("id", missingPlayerIds)
    
    const missingPlayers = (missingPlayersRaw ?? []) as Player[]
    for (const p of missingPlayers) {
      playerMap.set(p.id, p)
    }
  }

  const assistsGiven = new Map<number, { player: Player; count: number }>()
  const assistsReceived = new Map<number, { player: Player; count: number }>()

  // Helper: actions that break the search window
  const breaksSearch = (a: string | undefined) =>
    !!a && (a.includes("made") || a.includes("missed") || a.includes("turnover"))

  let assistsGivenAttempts = 0
  let assistsGivenFound = 0
  let assistsReceivedAttempts = 0
  let assistsReceivedFound = 0

  for (const [gameId, events] of pbpByGame) {
    for (let i = 0; i < events.length; i++) {
      const ev = events[i]

      // ── ASSIST GIVEN: player_id = assister → find scorer ──
      // FEB PBP may record the basket BEFORE or AFTER the assist event,
      // so we search in BOTH directions with an expanded window
      if (ev.action_type === "assist" && ev.player_id === playerId) {
        assistsGivenAttempts++
        let scorerId: number | null = null

        // Look backward (basket may precede assist in FEB PBP)
        // Expanded from 3 to 5 events to catch more assists
        for (let j = i - 1; j >= Math.max(0, i - 5); j--) {
          const prev = events[j]
          if (prev.action_type?.includes("made") && prev.player_id && prev.player_id !== playerId) {
            scorerId = prev.player_id
            break
          }
          if (prev.action_type === "assist" || breaksSearch(prev.action_type)) break
        }
        // Look forward (basket may follow assist)
        // Expanded from 4 to 6 events to catch more assists
        if (!scorerId) {
          for (let j = i + 1; j < Math.min(i + 6, events.length); j++) {
            const next = events[j]
            if (next.action_type?.includes("made") && next.player_id && next.player_id !== playerId) {
              scorerId = next.player_id
              break
            }
            if (next.action_type === "assist" || breaksSearch(next.action_type)) break
          }
        }

        if (scorerId) {
          assistsGivenFound++
          const scorer = playerMap.get(scorerId)
          if (scorer) {
            if (!assistsGiven.has(scorer.id)) {
              assistsGiven.set(scorer.id, { player: scorer, count: 0 })
            }
            assistsGiven.get(scorer.id)!.count++
          }
        }
      }

      // ── ASSIST RECEIVED: player made basket → find assister ──
      // Search both directions for the assist event with expanded window
      if (ev.action_type?.includes("made") && !ev.action_type.includes("ft_") && ev.player_id === playerId) {
        assistsReceivedAttempts++
        let assisterId: number | null = null

        // Look backward (assist may precede basket)
        // Expanded from 3 to 5 events
        for (let j = i - 1; j >= Math.max(0, i - 5); j--) {
          const prev = events[j]
          if (prev.action_type === "assist" && prev.player_id && prev.player_id !== playerId) {
            assisterId = prev.player_id
            break
          }
          if (breaksSearch(prev.action_type)) break
        }
        // Look forward (assist may follow basket in FEB PBP)
        // Expanded from 4 to 6 events
        if (!assisterId) {
          for (let j = i + 1; j < Math.min(i + 6, events.length); j++) {
            const next = events[j]
            if (next.action_type === "assist" && next.player_id && next.player_id !== playerId) {
              assisterId = next.player_id
              break
            }
            if (breaksSearch(next.action_type)) break
          }
        }

        if (assisterId) {
          assistsReceivedFound++
          const assister = playerMap.get(assisterId)
          if (assister) {
            if (!assistsReceived.has(assister.id)) {
              assistsReceived.set(assister.id, { player: assister, count: 0 })
            }
            assistsReceived.get(assister.id)!.count++
          }
        }
      }
    }
  }

  // Get full lists BEFORE slicing
  const allAssistsGiven = Array.from(assistsGiven.values()).sort((a, b) => b.count - a.count)
  const allAssistsReceived = Array.from(assistsReceived.values()).sort((a, b) => b.count - a.count)
  
  console.log(`[SYNERGY] ✅ ANÁLISIS COMPLETO:`)
  console.log(`  - Asistencias TOTALES dadas: ${allAssistsGiven.length}`)
  console.log(`  - Asistencias TOTALES recibidas: ${allAssistsReceived.length}`)
  console.log(`  - Eventos 'assist' encontrados para ${playerId}: ${assistsGivenAttempts}`)
  console.log(`  - Canastas hechas por ${playerId}: ${assistsReceivedAttempts}`)
  console.log(`  - Asistencias dadas ENCONTRADAS: ${assistsGivenFound}`)
  console.log(`  - Asistencias recibidas ENCONTRADAS: ${assistsReceivedFound}`)
  
  // Log top 10
  console.log(`  - TOP Asistencias dadas (todas):`)
  allAssistsGiven.slice(0, 10).forEach((a, idx) => console.log(`    ${idx+1}. ${a.player.name}: ${a.count}`))
  console.log(`  - TOP Asistencias recibidas (todas):`)
  allAssistsReceived.slice(0, 10).forEach((a, idx) => console.log(`    ${idx+1}. ${a.player.name}: ${a.count}`))
  
  const result = {
    partners: partners.slice(0, 5),
    assistsGiven: allAssistsGiven.slice(0, 10),  // Show top 10 instead of 5
    assistsReceived: allAssistsReceived.slice(0, 10),  // Show top 10 instead of 5
  }
  
  console.log(`[SYNERGY] Retornando TOP 10 de cada una (antes eran solo 5)`)
  
  return result
}

/** Get single-player on/off impact */
export async function getSinglePlayerOnOff(
  playerId: number,
  teamId: number,
  gameIds?: number[],
) {
  let query = supabase
    .from("stats_player_games")
    .select("*, game:games(id, home_team_id, away_team_id, home_score, away_score)")
    .eq("player_id", playerId)
    .eq("team_id", teamId)
  if (gameIds && gameIds.length > 0) {
    query = query.in("game_id", gameIds)
  }
  const { data } = await query
  if (!data || data.length === 0) return null

  let totalOnPM = 0
  let totalOffPM = 0
  let totalMinutes = 0
  let totalPossessions = 0

  for (const r of data) {
    const game = (r as any).game
    if (!game) continue

    const isHome = game.home_team_id === teamId
    const gameMargin = isHome
      ? (game.home_score ?? 0) - (game.away_score ?? 0)
      : (game.away_score ?? 0) - (game.home_score ?? 0)

    const onPM = r.plus_minus ?? 0
    totalOnPM += onPM
    totalOffPM += gameMargin - onPM

    const m = r.minutes as string | null
    if (m) {
      const parts = m.split(":")
      totalMinutes += parseInt(parts[0] || "0") + parseInt(parts[1] || "0") / 60
    }

    // Estimate possessions: FGA + 0.44*FTA + TO
    const fga = (r.t2_att ?? 0) + (r.t3_att ?? 0)
    const fta = r.ft_att ?? 0
    const to = r.turnovers ?? 0
    totalPossessions += fga + 0.44 * fta + to
  }

  const gp = data.length

  // Get team total possessions for USG% calculation
  let teamQuery = supabase
    .from("stats_player_games")
    .select("t2_att, t3_att, ft_att, turnovers, minutes")
    .eq("team_id", teamId)
  if (gameIds && gameIds.length > 0) {
    teamQuery = teamQuery.in("game_id", gameIds)
  }
  const { data: teamStats } = await teamQuery

  let teamTotalPoss = 0
  if (teamStats) {
    for (const ts of teamStats) {
      const fga = (ts.t2_att ?? 0) + (ts.t3_att ?? 0)
      teamTotalPoss += fga + 0.44 * (ts.ft_att ?? 0) + (ts.turnovers ?? 0)
    }
  }

  const usgPct = teamTotalPoss > 0 ? (totalPossessions / teamTotalPoss) * 100 : 0

  return {
    gp,
    avgMinutes: (totalMinutes / gp).toFixed(1),
    onCourtPM: (totalOnPM / gp).toFixed(1),
    offCourtPM: (totalOffPM / gp).toFixed(1),
    netDiff: ((totalOnPM - totalOffPM) / gp).toFixed(1),
    usgPct: usgPct.toFixed(1),
    totalOnPM,
    totalOffPM,
  }
}

// ══════════════════════════════════════════════════════════════
// SCOUTING — NEXT GAME DETECTION
// ══════════════════════════════════════════════════════════════

/** Returns the very next scheduled game for a team (date >= now). */
export async function getNextGame(teamId: number): Promise<Game | null> {
  const today = new Date().toISOString()
  const { data } = await supabase
    .from("games")
    .select(
      "*, home_team:teams!games_home_team_id_fkey(*), away_team:teams!games_away_team_id_fkey(*)",
    )
    .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
    .eq("status", "SCHEDULED")
    .gte("date", today)
    .order("date", { ascending: true })
    .limit(1)
    .maybeSingle()
  return data
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

