export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { fixtures } from "@/data/fixtures";
import { verifyCronRequest } from "@/utils/server/cronAuth";
import {
  fetchLiveMatches,
  fetchScorecard,
} from "@/utils/server/scraperClient";
import { adaptScorecardToMatchStats } from "@/utils/scorecardAdapter";

/**
 * Loose server-side type for ingestion.
 * We keep this flexible because scraped data can be partial.
 */
type PlayerMatchStatRow = {
  playerId: string;
  matchId: number;
  inPlayingXI: boolean;
  impactPlayer: boolean;
  batting?: any;
  bowling?: any;
  fielding?: any;
  manOfTheMatch?: boolean;
};

const SCORECARD_MINUTES = 60;

export async function POST(req: NextRequest) {
  // 🔐 Cron auth
  const cronAuth = verifyCronRequest(req);
  if (!cronAuth.ok) {
    return NextResponse.json(
      { ok: false, error: cronAuth.error },
      { status: cronAuth.status }
    );
  }

  // 🔑 Supabase config
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

  if (!supabaseUrl || !serviceRole) {
    return NextResponse.json(
      { ok: false, error: "Missing Supabase service role config" },
      { status: 500 }
    );
  }

  const supabase = createClient(supabaseUrl, serviceRole);
  const now = Date.now();

  /**
   * 🔁 TEMP BACKFILL MODE
   * Process ALL matches whose start time is in the past
   */
  const activeFixtures = fixtures.filter(
    (f) => new Date(f.startTimeUTC).getTime() < now
  );

  if (activeFixtures.length === 0) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: "no-past-fixtures",
    });
  }

  // 🏏 Fetch live matches (DEBUG HARD FAIL)
  let matchesData;
  try {
    matchesData = await fetchLiveMatches();
  } catch (e: any) {
    console.error("🔥 fetchLiveMatches FAILED");
    console.error(e?.message);
    console.error(e);
    throw e; // 👈 force Vercel to show stack trace
  }

  let updatedMatches = 0;
  let updatedPlayers = 0;

  for (const fixture of activeFixtures) {
    // 🔍 Match fixture ↔ scraped match
    const match = matchesData.matches?.find((m: any) => {
      if (!m?.teams) return false;
      const apiTeams = m.teams.map((t: string) => t.toLowerCase());
      return fixture.teams.every((t) =>
        apiTeams.includes(t.toLowerCase())
      );
    });

    if (!match) continue;

    // ⏱ Rate-limit per match
    const { data: lastRow } = await supabase
      .from("match_scorecards")
      .select("updated_at")
      .eq("match_id", fixture.matchId)
      .maybeSingle();

    if (lastRow?.updated_at) {
      const last = new Date(lastRow.updated_at).getTime();
      if (now - last < SCORECARD_MINUTES * 60 * 1000) {
        continue;
      }
    }

    // 📊 Fetch scorecard (DEBUG HARD FAIL)
    let scorecardData;
    try {
      scorecardData = await fetchScorecard(match.id);
    } catch (e: any) {
      console.error("🔥 fetchScorecard FAILED for match:", match.id);
      console.error(e?.message);
      console.error(e);
      throw e; // 👈 force Vercel to show stack trace
    }

    if (!scorecardData?.scorecard) {
      console.error("⚠️ No scorecard returned for match:", match.id);
      continue;
    }

    // 💾 Store RAW scorecard
    const { error: rawErr } = await supabase
      .from("match_scorecards")
      .upsert({
        match_id: fixture.matchId,
        source_match_id: match.id,
        raw_scorecard: scorecardData.scorecard,
        updated_at: new Date().toISOString(),
      });

    if (rawErr) {
      console.error("🔥 match_scorecards upsert failed");
      console.error(rawErr);
      throw rawErr;
    }

    // 🔄 Adapt → player match stats (DEBUG HARD FAIL)
    let playerStats: PlayerMatchStatRow[];
    try {
      playerStats = (await adaptScorecardToMatchStats(
        fixture.matchId,
        scorecardData.scorecard
      )) as PlayerMatchStatRow[];
    } catch (e: any) {
      console.error("🔥 adaptScorecardToMatchStats FAILED");
      console.error(e?.message);
      console.error(e);
      throw e;
    }

    // 💾 Upsert each player stat
    for (const stats of playerStats) {
      const { error: statErr } = await supabase
        .from("match_stats")
        .upsert({
          player_id: stats.playerId,
          match_id: stats.matchId,
          in_playing_xi: stats.inPlayingXI,
          impact_player: stats.impactPlayer,
          batting: stats.batting ?? null,
          bowling: stats.bowling ?? null,
          fielding: stats.fielding ?? null,
          man_of_the_match: stats.manOfTheMatch ?? false,
          updated_at: new Date().toISOString(),
        });

      if (statErr) {
        console.error("🔥 match_stats upsert FAILED");
        console.error(statErr);
        throw statErr;
      }

      updatedPlayers++;
    }

    updatedMatches++;
  }

  return NextResponse.json({
    ok: true,
    matchesUpdated: updatedMatches,
    playersUpdated: updatedPlayers,
  });
}
