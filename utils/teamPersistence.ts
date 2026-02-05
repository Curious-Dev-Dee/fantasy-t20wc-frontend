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
  const { data, error } = await supabase
    .from("user_teams")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    console.error("Supabase fetch failed", error);
    return null;
  }
  return data as UserTeamRow;
}

export async function upsertUserTeam(
  userId: string,
  payload: Partial<UserTeamRow>
) {
  if (!isSupabaseConfigured || !supabase) return;
  if (!userId) return;
  const { error } = await supabase.from("user_teams").upsert({
    user_id: userId,
    ...payload,
    updated_at: new Date().toISOString(),
  });
  if (error) {
    console.error("Supabase upsert failed", error);
  }
}
