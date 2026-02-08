export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyCronRequest } from "@/utils/server/cronAuth";
import { scoreLockedMatch } from "@/utils/scoring";
import type { MatchStats } from "@/data/matchStats";

export async function POST(req: NextRequest) {
  // 🔐 cron-only
  const cronAuth = verifyCronRequest(req);
  if (!cronAuth.ok) {
    return NextResponse.json(
      { ok: false, error: cronAuth.error },
      { status: cronAuth.status }
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

  if (!supabaseUrl || !serviceRole) {
    return NextResponse.json(
      { ok: false, error: "Missing Supabase config" },
      { status: 500 }
    );
  }

  const supabase = createClient(supabaseUrl, serviceRole);

  // 🔹 fetch all locked teams (all users, all matches)
  const { data: teams, error: teamErr } = await supabase
    .from("user_teams")
    .select("user_id, locked_teams");

  if (teamErr) throw teamErr;

  let processed = 0;

  for (const team of teams || []) {
    const lockedTeams = team.locked_teams || [];

    for (const locked of lockedTeams) {
      const matchId = locked.matchId;

      // 🔹 fetch match stats for this match
      const { data: statsRows } = await supabase
        .from("match_stats")
        .select("*")
        .eq("match_id", matchId);

      if (!statsRows || statsRows.length === 0) continue;

      // 🔹 build stats map
      const statsMap = new Map<string, MatchStats[]>();
      statsRows.forEach((row: any) => {
        const entry: MatchStats = {
          matchId: row.match_id,
          inPlayingXI: row.in_playing_xi,
          impactPlayer: row.impact_player,
          batting: row.batting ?? undefined,
          bowling: row.bowling ?? undefined,
          fielding: row.fielding ?? undefined,
          manOfTheMatch: row.man_of_the_match ?? false,
        };

        if (!statsMap.has(row.player_id)) {
          statsMap.set(row.player_id, []);
        }
        statsMap.get(row.player_id)!.push(entry);
      });

      // 🔹 calculate points
      const points = scoreLockedMatch({
        locked,
        playerRoleMap: new Map(), // default roles
        statsMap,
      });

      // 💾 upsert result
      await supabase.from("user_match_points").upsert({
        user_id: team.user_id,
        match_id: matchId,
        points,
        breakdown: {
          players: locked.players,
          captainId: locked.captainId,
          viceCaptainId: locked.viceCaptainId,
        },
        calculated_at: new Date().toISOString(),
      });

      processed++;
    }
  }

  return NextResponse.json({
    ok: true,
    processed,
  });
}
