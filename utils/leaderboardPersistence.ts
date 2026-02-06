import { supabase, isSupabaseConfigured } from "@/utils/supabaseClient";

export type LeaderboardRow = {
  user_id: string;
  team_name: string | null;
  working_team: {
    players?: string[];
    captainId?: string | null;
    viceCaptainId?: string | null;
  } | null;
  subs_used: number | null;
};

export async function fetchLeaderboardTeams() {
  if (!isSupabaseConfigured || !supabase) return [];
  const { data: teams, error } = await supabase
    .from("user_teams")
    .select("user_id, working_team, subs_used");
  if (error || !teams) return [];
  const ids = teams.map(row => row.user_id);
  let profileMap = new Map<string, string>();
  if (ids.length > 0) {
    const { data: profiles } = await supabase
      .from("user_profiles")
      .select("user_id, team_name")
      .in("user_id", ids);
    (profiles || []).forEach(profile => {
      if (profile.team_name) {
        profileMap.set(profile.user_id, profile.team_name);
      }
    });
  }
  return (teams as any[]).map(row => ({
    user_id: row.user_id,
    team_name: profileMap.get(row.user_id) || null,
    working_team: row.working_team,
    subs_used: row.subs_used,
  })) as LeaderboardRow[];
}
