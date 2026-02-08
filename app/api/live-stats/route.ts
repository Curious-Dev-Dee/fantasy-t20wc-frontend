import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { cricketDataFetch } from "@/utils/cricketdataClient";
import { fixtures } from "@/data/fixtures";
import { mapCricketDataScorecard, findCricketDataMatchId } from "@/utils/cricketdataMapper";
import type { ScorecardPayload } from "@/utils/cricketdataMapper";
import { verifyCronRequest } from "@/utils/server/cronAuth";

const SCORECARD_MINUTES = 30;
const WINDOW_BEFORE_MS = 2 * 60 * 60 * 1000;
const WINDOW_AFTER_MS = 6 * 60 * 60 * 1000;

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

type ScorecardData = NonNullable<ScorecardPayload["data"]>;

const toRows = (stats: ReturnType<typeof mapCricketDataScorecard>, matchId: number) => {
  return stats.flatMap(entry =>
    entry.matches.map(match => ({
      player_id: entry.playerId,
      match_id: matchId,
      in_playing_xi: match.inPlayingXI,
      impact_player: match.impactPlayer,
      batting: match.batting ?? null,
      bowling: match.bowling ?? null,
      fielding: match.fielding ?? null,
      man_of_the_match: Boolean(match.manOfTheMatch),
    }))
  ) as MatchStatRow[];
};

const isFixtureInWindow = (startTimeUTC: string, now: number) => {
  const start = new Date(startTimeUTC).getTime();
  return now >= start - WINDOW_BEFORE_MS && now <= start + WINDOW_AFTER_MS;
};

export async function POST(req: NextRequest) {
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
      { ok: false, error: "Missing service role configuration" },
      { status: 500 }
    );
  }

  const now = Date.now();
  const activeFixtures = fixtures.filter(f => isFixtureInWindow(f.startTimeUTC, now));
  if (activeFixtures.length === 0) {
    return NextResponse.json({ ok: true, skipped: true, reason: "no-fixtures-window" });
  }

  const current = await cricketDataFetch<{ id?: string; teams?: string[] }[]>("currentMatches");
  if (!current) {
    return NextResponse.json(
      { ok: false, error: "CRICKETDATA_API_KEY is missing" },
      { status: 500 }
    );
  }

  const supabase = createClient(supabaseUrl, serviceRole);
  let updatedMatches = 0;
  let updatedRows = 0;

  for (const fixture of activeFixtures) {
    const apiMatchId = findCricketDataMatchId(current.payload, fixture.teams);
    if (!apiMatchId) continue;

    const { data: lastRow } = await supabase
      .from("match_stats")
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

    const scorecard = await cricketDataFetch<ScorecardData>("match_scorecard", { id: apiMatchId });
    if (!scorecard || scorecard.payload?.status === "failure") continue;

    const stats = mapCricketDataScorecard(scorecard.payload, fixture.matchId);
    const rows = toRows(stats, fixture.matchId);
    if (rows.length === 0) continue;

    const { error: upsertError } = await supabase.from("match_stats").upsert(rows);
    if (upsertError) throw upsertError;
    updatedMatches += 1;
    updatedRows += rows.length;
  }

  return NextResponse.json({
    ok: true,
    matches: updatedMatches,
    rows: updatedRows,
  });
}
