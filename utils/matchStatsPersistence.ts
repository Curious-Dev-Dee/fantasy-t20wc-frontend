import { supabase, isSupabaseConfigured } from "@/utils/supabaseClient";
import type { PlayerMatchStats } from "@/data/matchStats";

type MatchStatRow = {
  player_id: string;
  match_id: number;
  in_playing_xi: boolean;
  impact_player: boolean;
  batting: Record<string, unknown> | null;
  bowling: Record<string, unknown> | null;
  fielding: Record<string, unknown> | null;
  man_of_the_match: boolean;
};

export async function fetchMatchStats() {
  if (!isSupabaseConfigured || !supabase) return [];
  const { data, error } = await supabase
    .from("match_stats")
    .select("*");
  if (error || !data) return [];
  return data as MatchStatRow[];
}

export async function upsertMatchStats(stats: PlayerMatchStats[]) {
  if (!isSupabaseConfigured || !supabase) return;
  const rows: MatchStatRow[] = stats.flatMap(entry =>
    entry.matches.map(match => ({
      player_id: entry.playerId,
      match_id: match.matchId,
      in_playing_xi: match.inPlayingXI,
      impact_player: match.impactPlayer,
      batting: match.batting ?? null,
      bowling: match.bowling ?? null,
      fielding: match.fielding ?? null,
      man_of_the_match: Boolean(match.manOfTheMatch),
    }))
  );
  if (rows.length === 0) return;
  await supabase.from("match_stats").upsert(rows);
}

export function normalizeMatchStats(rows: MatchStatRow[]) {
  const map = new Map<string, PlayerMatchStats>();
  rows.forEach(row => {
    const entry =
      map.get(row.player_id) ||
      ({
        playerId: row.player_id,
        matches: [],
      } as PlayerMatchStats);
    entry.matches.push({
      matchId: row.match_id,
      inPlayingXI: row.in_playing_xi,
      impactPlayer: row.impact_player,
      batting: row.batting as PlayerMatchStats["matches"][number]["batting"],
      bowling: row.bowling as PlayerMatchStats["matches"][number]["bowling"],
      fielding: row.fielding as PlayerMatchStats["matches"][number]["fielding"],
      manOfTheMatch: row.man_of_the_match,
    });
    map.set(row.player_id, entry);
  });
  return Array.from(map.values()).map(entry => ({
    ...entry,
    matches: entry.matches.sort((a, b) => a.matchId - b.matchId),
  }));
}
