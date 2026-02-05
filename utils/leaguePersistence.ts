import { supabase, isSupabaseConfigured } from "@/utils/supabaseClient";

export type LeagueRow = {
  id: string;
  name: string;
  code: string;
  owner_id: string;
  created_at?: string | null;
};

export type LeagueMemberRow = {
  id: string;
  league_id: string;
  user_id: string;
  team_name: string | null;
  joined_at?: string | null;
};

export const generateLeagueCode = (name: string) => {
  const base = name.replace(/[^a-z0-9]/gi, "").toUpperCase().slice(0, 6);
  const suffix = String(Math.floor(100 + Math.random() * 900));
  return `${base || "LEAGUE"}${suffix}`;
};

export async function createLeague(
  name: string,
  ownerId: string,
  teamName: string | null
) {
  if (!isSupabaseConfigured || !supabase) return null;
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return { league: null, error: "Auth session missing. Please re-login." };
  }
  const sessionUserId = userData.user.id;
  if (ownerId !== sessionUserId) {
    return {
      league: null,
      error: "Auth mismatch. Please logout and login again.",
    };
  }
  let attempts = 0;
  let lastError: string | null = null;
  while (attempts < 3) {
    attempts += 1;
    const code = generateLeagueCode(name);
    const { data, error } = await supabase.rpc("create_league", {
      p_name: name,
      p_code: code,
      p_team_name: teamName,
    });
    if (error) {
      lastError = error.message;
      continue;
    }
    return { league: data as LeagueRow, error: null };
  }
  return { league: null, error: lastError || "Failed to create league." };
}

export async function fetchUserLeagues(userId: string) {
  if (!isSupabaseConfigured || !supabase) return [];
  const { data, error } = await supabase
    .from("league_members")
    .select("league:leagues(*)")
    .eq("user_id", userId);
  if (error || !data) return [];
  const rows = data as unknown as Array<{ league: LeagueRow | null }>;
  return rows.map(row => row.league).filter(Boolean) as LeagueRow[];
}

export async function fetchLeague(leagueId: string) {
  if (!isSupabaseConfigured || !supabase) return null;
  const { data, error } = await supabase
    .from("leagues")
    .select("*")
    .eq("id", leagueId)
    .single();
  if (error) return null;
  return data as LeagueRow;
}

export async function fetchLeagueMembers(leagueId: string) {
  if (!isSupabaseConfigured || !supabase) return [];
  const { data, error } = await supabase
    .from("league_members")
    .select("*")
    .eq("league_id", leagueId);
  if (error || !data) return [];
  return data as LeagueMemberRow[];
}

export async function joinLeagueByCode(
  code: string,
  userId: string,
  teamName: string | null
) {
  if (!isSupabaseConfigured || !supabase) return null;
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return { league: null, error: "Auth session missing. Please re-login." };
  }
  if (userId !== userData.user.id) {
    return { league: null, error: "Auth mismatch. Please re-login." };
  }
  const { data, error } = await supabase.rpc("join_league", {
    p_code: code,
    p_team_name: teamName,
  });
  if (error || !data) {
    return { league: null, error: error?.message || "Invalid league code." };
  }
  return { league: data as LeagueRow, error: null };
}

export async function leaveLeague(leagueId: string, userId: string) {
  if (!isSupabaseConfigured || !supabase) return;
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user || userData.user.id !== userId) return;
  await supabase.rpc("leave_league", { p_league_id: leagueId });
}

export async function deleteLeague(leagueId: string) {
  if (!isSupabaseConfigured || !supabase) return;
  await supabase.rpc("delete_league", { p_league_id: leagueId });
}
