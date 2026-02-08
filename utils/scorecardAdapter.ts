import { createClient } from "@supabase/supabase-js";
import type { MatchStats } from "@/data/matchStats";

type RawScorecard = any;

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function resolvePlayerId(playerName: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("player_aliases")
    .select("player_id")
    .eq("alias_name", playerName)
    .limit(1)
    .maybeSingle();

  return data?.player_id ?? null;
}

export async function adaptScorecardToMatchStats(
  matchId: number,
  scorecard: RawScorecard
): Promise<MatchStats[]> {
  const results: MatchStats[] = [];
  const manOfTheMatchName = scorecard?.man_of_the_match?.name ?? null;

  for (const inning of scorecard.innings ?? []) {
    // 🏏 Batting
    for (const bat of inning.batting ?? []) {
      const playerId = await resolvePlayerId(bat.batsman_name);
      if (!playerId) continue;

      results.push({
        matchId,
        inPlayingXI: true,
        impactPlayer: false,
        batting: {
          runs: Number(bat.runs ?? 0),
          balls: Number(bat.balls ?? 0),
          fours: Number(bat.fours ?? 0),
          sixes: Number(bat.sixes ?? 0),
          dismissed: Boolean(bat.dismissal),
          duck: Number(bat.runs) === 0,
        },
        fielding: {
          catches: 0,
          stumpings: 0,
          runOutDirect: 0,
          runOutIndirect: 0,
        },
        manOfTheMatch: bat.batsman_name === manOfTheMatchName,
      });
    }

    // 🎯 Bowling
    for (const bowl of inning.bowling ?? []) {
      const playerId = await resolvePlayerId(bowl.bowler_name);
      if (!playerId) continue;

      results.push({
        matchId,
        inPlayingXI: true,
        impactPlayer: false,
        bowling: {
          overs: Number(bowl.overs ?? 0),
          maidens: Number(bowl.maidens ?? 0),
          wickets: Number(bowl.wickets ?? 0),
          lbwBowled: 0, // scraper doesn't split this
          dotBalls: 0,  // scraper doesn't give this
          runsConceded: Number(bowl.runs_conceded ?? 0),
        },
        fielding: {
          catches: 0,
          stumpings: 0,
          runOutDirect: 0,
          runOutIndirect: 0,
        },
        manOfTheMatch: bowl.bowler_name === manOfTheMatchName,
      });
    }
  }

  return results;
}
