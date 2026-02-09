import { supabase, isSupabaseConfigured } from "@/utils/supabaseClient";

export type LeaderboardTotalRow = {
  user_id: string;
  team_name: string | null;
  total_points: number | null;
};

export type UserTotalRow = {
  user_id: string;
  total_points: number | null;
};

export type PlayerMatchPointRow = {
  player_id: string;
  match_id: number;
  points: number;
};

export async function fetchLeaderboardTotals() {
  if (!isSupabaseConfigured || !supabase) return [];
  const { data, error } = await supabase.rpc("get_leaderboard_totals");
  if (error || !data) return [];
  return data as LeaderboardTotalRow[];
}

export async function fetchUsersTotalPoints(userIds: string[]) {
  if (!isSupabaseConfigured || !supabase) return new Map<string, number>();
  if (userIds.length === 0) return new Map<string, number>();
  const { data, error } = await supabase.rpc("get_users_total_points", {
    p_user_ids: userIds,
  });
  if (error || !data) return new Map<string, number>();
  return new Map(
    (data as UserTotalRow[]).map(row => [
      row.user_id,
      Number(row.total_points ?? 0),
    ])
  );
}

export async function fetchPlayerMatchPoints(matchId?: number) {
  if (!isSupabaseConfigured || !supabase) return [];
  let query = supabase.from("player_match_points").select("*");
  if (matchId) {
    query = query.eq("match_id", matchId);
  }
  const { data, error } = await query;
  if (error || !data) return [];
  return data as PlayerMatchPointRow[];
}
