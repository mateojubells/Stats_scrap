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
    const fgAtt = sum("fg_att")
    const t3Made = sum("t3_made")
    const t3Att = sum("t3_att")
    const ftMade = sum("ft_made")
    const ftAtt = sum("ft_att")

    const ppg = (fgMade * 2 + t3Made + ftMade) / n
    const rpg = sum("reb_tot") / n
    const apg = sum("assists") / n
    const spg = sum("steals") / n
    const tpg = sum("turnovers") / n
    const efg = fgAtt > 0 ? ((fgMade + 0.5 * t3Made) / fgAtt) * 100 : 0
    const ftRate = fgAtt > 0 ? (ftAtt / fgAtt) * 100 : 0
    const orbPct = sum("reb_off") / n
    const tovPct = tpg // simplified

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
  let totalPoints = 0

  // Simple heuristic: Look at sequences 
  for (let i = 0; i < pbp.length; i++) {
    const ev = pbp[i]
    if (ev.action_value && ev.action_value > 0 && ev.action_type?.includes("made")) {
      totalPoints += ev.action_value

      // Check if preceded by steal/turnover (within 3 events)
      let foundTurnover = false
      let foundOffReb = false
      for (let j = Math.max(0, i - 5); j < i; j++) {
        if (pbp[j].action_type === "steal" || pbp[j].action_type === "turnover") {
          foundTurnover = true
        }
        if (pbp[j].action_type === "reb_off") {
          foundOffReb = true
        }
      }

      if (foundOffReb) secondChance += ev.action_value
      else if (foundTurnover) offTurnover += ev.action_value
    }
  }

  const fastbreak = Math.round(totalPoints * 0.08) // estimated
  const regular = totalPoints - offTurnover - secondChance - fastbreak

  return { offTurnover, fastbreak, secondChance, regular }
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

