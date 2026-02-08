import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { fixtures } from "@/data/fixtures";
import { verifyCronRequest } from "@/utils/server/cronAuth";
import {
  fetchLiveMatches,
  fetchScorecard,
} from "@/utils/server/scraperClient";
import { adaptScorecardToMatchStats } from "@/utils/scorecardAdapter";

const SCORECARD_MINUTES = 60;
const WINDOW_BEFORE_MS = 2 * 60 * 60 * 1000;
const WINDOW_AFTER_MS = 6 * 60 * 60 * 1000;

const isFixtureInWindow = (startTimeUTC: string, now: number) => {
  const start = new Date(startTimeUTC).getTime();
  return now >= start - WINDOW_BEFORE_MS && now <= start + WINDOW_AFTER_MS;
};

export async function POST(req: NextRequest) {
  // 🔐 Cron auth
  const cronAuth = verifyCronRequest(req);
  if (!cronAuth.ok) {
    return NextResponse.json(
      { ok: false, error: cronAuth.error },
      { status: cronAuth.status }
    );
  }

  // 🔑 Supabase
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

  // ⏱ active fixtures
  const activeFixtures = fixtures.filter((f) =>
    isFixtureInWindow(f.startTimeUTC, now)
  );

  if (activeFixtures.length === 0) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: "no-active-fixtures",
    });
  }

  // 🏏 fetch live matches
  let matchesData;
  try {
    matchesData = await fetchLiveMatches();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Failed to fetch live matches" },
      { status: 500 }
    );
  }

  let updatedMatches = 0;
  let updatedPlayers = 0;

  for (const fixture of activeFixtures) {
    // 🔍 match fixture ↔ live match
    const match = matchesData.matches?.find((m: any) => {
      if (!m.teams) return false;
      const apiTeams = m.teams.map((t: string) => t.toLowerCase());
      return fixture.teams.every((t) =>
        apiTeams.includes(t.toLowerCase())
      );
    });

    if (!match) continue;

    // ⏱ rate-limit
    const { data: lastRow } = await supabase
      .from("match_scorecards")
      .select("updated_at")
      .eq("match_id", fixture.matchId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastRow?.updated_at) {
      const last = new Date(lastRow.updated_at).getTime();
      if (now - last < SCORECARD_MINUTES * 60 * 1000) {
        continue;
      }
    }

    // 📊 fetch scorecard
    let scorecardData;
    try {
      scorecardData = await fetchScorecard(match.id);
    } catch {
      continue;
    }

    if (!scorecardData?.scorecard) continue;

    // 💾 store RAW scorecard
    const { error: rawErr } = await supabase
      .from("match_scorecards")
      .upsert({
        match_id: fixture.matchId,
        source_match_id: match.id,
        raw_scorecard: scorecardData.scorecard,
        updated_at: new Date().toISOString(),
      });

    if (rawErr) throw rawErr;

    // 🔄 ADAPT → MatchStats
    const matchStats = await adaptScorecardToMatchStats(
      fixture.matchId,
      scorecardData.scorecard
    );

    // 💾 upsert player match stats
    for (const stats of matchStats) {
      const { error: statErr } = await supabase
        .from("match_stats")
        .upsert({
          match_id: stats.matchId,
          in_playing_xi: stats.inPlayingXI,
          impact_player: stats.impactPlayer,
          batting: stats.batting ?? null,
          bowling: stats.bowling ?? null,
          fielding: stats.fielding ?? null,
          man_of_the_match: stats.manOfTheMatch ?? false,
          updated_at: new Date().toISOString(),
        });

      if (statErr) throw statErr;
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
