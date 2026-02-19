/* ─────────────────────────────────────────────────────────────
   Database-aligned TypeScript types for the Supabase schema
   ───────────────────────────────────────────────────────────── */

export interface Team {
  id: number
  feb_id: string | null
  name: string
  logo_url: string | null
  created_at: string
}

export interface Player {
  id: number
  name: string
  current_team_id: number | null
  feb_player_id: string
  jersey_number: number | null
}

export interface Game {
  id: number
  feb_game_id: string
  league_id: number | null
  date: string | null
  home_team_id: number | null
  away_team_id: number | null
  home_score: number | null
  away_score: number | null
  status: string
  url: string
  updated_at: string
  jornada: number | null
  // Joined fields
  home_team?: Team
  away_team?: Team
}

export interface StatsPlayerGame {
  id: number
  game_id: number
  player_id: number
  team_id: number
  minutes: string | null
  points: number | null
  t2_made: number | null
  t2_att: number | null
  t3_made: number | null
  t3_att: number | null
  ft_made: number | null
  ft_att: number | null
  reb_off: number | null
  reb_def: number | null
  reb_tot: number | null
  assists: number | null
  steals: number | null
  turnovers: number | null
  blocks_for: number | null
  blocks_against: number | null
  fouls_comm: number | null
  fouls_rec: number | null
  valoracion: number | null
  plus_minus: number | null
  starter: boolean
  // Joined
  player?: Player
  game?: Game
}

export interface StatsTeamGame {
  id: number
  game_id: number
  team_id: number
  points: number
  t2_pct: number | null
  t3_pct: number | null
  ft_pct: number | null
  fg_made: number
  fg_att: number
  fg_pct: number
  t2_made: number
  t2_att: number
  t3_made: number
  t3_att: number
  ft_made: number
  ft_att: number
  reb_off: number
  reb_def: number
  reb_tot: number
  assists: number
  steals: number
  turnovers: number
  blocks_for: number
  blocks_against: number
  fouls_comm: number
  fouls_rec: number
}

export interface Shot {
  id: number
  game_id: number
  player_id: number
  team_id: number
  x_coord: number
  y_coord: number
  made: boolean
  quarter: number
  zone: string | null
  pbp_id: number | null
}

export interface PlayByPlay {
  id: number
  game_id: number
  quarter: number
  minute: string | null
  team_id: number | null
  player_id: number | null
  action_type: string
  home_score_partial: number | null
  away_score_partial: number | null
  action_value: number
  stat_count: number | null
  free_throws_awarded: number
}

export interface League {
  id: number
  name: string
  base_url: string | null
  season_year: string | null
  group_name: string
  feb_group_id: string
}

export interface AppUser {
  id: string
  email: string | null
  display_name: string | null
  created_at: string
  team_id: number | null
  team?: Team
}
