import { supabase, isSupabaseConfigured } from "@/utils/supabaseClient";

export type UserTeamRow = {
  user_id: string;
  team_name: string | null;
  working_team: unknown | null;
  locked_teams: unknown | null;
  subs_used: number | null;
  updated_at?: string | null;
};

export async function fetchUserTeam(userId: string) {
  if (!isSupabaseConfigured || !supabase) return null;
  if (!userId) return null;
  const sessionData = await supabase.auth.getSession();
  const token = sessionData.data.session?.access_token;
  if (!token) return null;
  const response = await fetch("/api/user-team", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    console.error("Supabase fetch failed", error);
    return null;
  }
  const payload = await response.json();
  return (payload?.data as UserTeamRow) || null;
}

export async function upsertUserTeam(
  userId: string,
  payload: Partial<UserTeamRow>
) {
  if (!isSupabaseConfigured || !supabase) return;
  if (!userId) return;
  const sessionData = await supabase.auth.getSession();
  const token = sessionData.data.session?.access_token;
  if (!token) return;
  const response = await fetch("/api/user-team", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    // Silently handle errors - don't expose in console
    await response.json().catch(() => ({}));
  }
}
