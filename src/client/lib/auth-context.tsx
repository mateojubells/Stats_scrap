"use client"

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react"
import { supabase } from "@/lib/supabase"
import type { AppUser, Team } from "@/lib/types"
import type { Session, User } from "@supabase/supabase-js"

interface AuthState {
  session: Session | null
  user: User | null
  profile: AppUser | null
  team: Team | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<string | null>
  signUp: (email: string, password: string, displayName: string, teamId: number) => Promise<string | null>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<AppUser | null>(null)
  const [team, setTeam] = useState<Team | null>(null)
  const [loading, setLoading] = useState(true)

  /* ── Fetch the user row & associated team from public.users ── */
  async function fetchProfile(uid: string) {
    const { data } = await supabase
      .from("users")
      .select("*, team:teams(*)")
      .eq("id", uid)
      .single()

    if (data) {
      const { team: teamData, ...rest } = data as AppUser & { team: Team }
      setProfile(rest as AppUser)
      setTeam(teamData ?? null)
    }
  }

  /* ── Bootstrap: check existing session ── */
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s)
      setUser(s?.user ?? null)
      if (s?.user) fetchProfile(s.user.id)
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
      setUser(s?.user ?? null)
      if (s?.user) fetchProfile(s.user.id)
      else {
        setProfile(null)
        setTeam(null)
      }
    })

    return () => subscription.unsubscribe()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* ── Sign in ── */
  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return error ? error.message : null
  }

  /* ── Sign up + insert profile row ── */
  async function signUp(
    email: string,
    password: string,
    displayName: string,
    teamId: number,
  ) {
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) return error.message
    if (data.user) {
      await supabase.from("users").upsert({
        id: data.user.id,
        email,
        display_name: displayName,
        team_id: teamId,
      })
    }
    return null
  }

  /* ── Sign out ── */
  async function signOut() {
    await supabase.auth.signOut()
    setProfile(null)
    setTeam(null)
  }

  return (
    <AuthContext.Provider
      value={{ session, user, profile, team, loading, signIn, signUp, signOut }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>")
  return ctx
}
