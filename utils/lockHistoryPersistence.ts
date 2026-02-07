import { supabase, isSupabaseConfigured } from "@/utils/supabaseClient";

export type LockedHistoryRow = {
  user_id: string;
  match_id: number;
  players: string[];
  captain_id: string;
  vice_captain_id: string;
  subs_used: number;
  locked_at?: string | null;
};

export async function fetchLockHistory(userId: string) {
  if (!isSupabaseConfigured || !supabase) return [];
  const { data, error } = await supabase
    .from("locked_team_history")
    .select("*")
    .eq("user_id", userId)
    .order("match_id", { ascending: true });
  if (error || !data) return [];
  return data as LockedHistoryRow[];
}

export async function insertLockHistory(row: LockedHistoryRow) {
  if (!isSupabaseConfigured || !supabase) return;
  const { error } = await supabase.rpc("insert_locked_team_history", {
    p_user_id: row.user_id,
    p_match_id: row.match_id,
    p_players: row.players,
    p_captain_id: row.captain_id,
    p_vice_captain_id: row.vice_captain_id,
    p_subs_used: row.subs_used,
  });
  if (error) {
    // Surface lock errors in console for debugging.
    // Client already guards lock timing, so this is a safety net.
    console.warn("Lock history insert failed:", error.message);
  }
}

export async function fetchAllLockHistory() {
  if (!isSupabaseConfigured || !supabase) return [];
  const { data, error } = await supabase.rpc("get_all_locked_teams");
  if (error || !data) return [];
  return data as LockedHistoryRow[];
}
