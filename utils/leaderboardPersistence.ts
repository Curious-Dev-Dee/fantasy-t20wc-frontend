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
  const { data, error } = await supabase.rpc("get_leaderboard_teams");
  if (error || !data) return [];
  return data as LeaderboardRow[];
}
