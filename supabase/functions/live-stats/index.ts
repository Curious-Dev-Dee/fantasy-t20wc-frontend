import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import players from "../_shared/players.json" assert { type: "json" };
import fixtures from "../_shared/fixtures.json" assert { type: "json" };

const normalizeName = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();

type CricketDataResponse<T> = {
  data?: T;
  status?: string;
  [key: string]: unknown;
};

type NamedEntity = {
  name?: string;
  altnames?: string[];
};

type BattingEntry = {
  batsman?: NamedEntity;
  dismissal?: string;
  "dismissal-text"?: string;
  r?: number | string;
  b?: number | string;
  "4s"?: number | string;
  "6s"?: number | string;
};

type BowlingEntry = {
  bowler?: NamedEntity;
  o?: number | string;
  m?: number | string;
  r?: number | string;
  w?: number | string;
};

type CatchingEntry = {
  catcher?: NamedEntity;
  catch?: number | string;
  stumped?: number | string;
  runout?: number | string;
};

type ScorecardInning = {
  batting?: BattingEntry[];
  bowling?: BowlingEntry[];
  catching?: CatchingEntry[];
};

type ScorecardPayload = {
  data?: {
    scorecard?: ScorecardInning[];
  };
};

type CurrentMatch = {
  id?: string;
  teams?: string[];
};

type FieldingStats = {
  catches: number;
  stumpings: number;
  runOutDirect: number;
  runOutIndirect: number;
};

type LiveMatchStats = {
  matchId: number;
  inPlayingXI: boolean;
  impactPlayer: boolean;
  batting?: Record<string, unknown>;
  bowling?: Record<string, unknown>;
  fielding?: FieldingStats;
  manOfTheMatch?: boolean;
};

type MatchStatRow = {
  player_id: string;
  match_id: number;
  in_playing_xi: boolean;
  impact_player: boolean;
  batting: Record<string, unknown> | null;
  bowling: Record<string, unknown> | null;
  fielding: FieldingStats | null;
  man_of_the_match: boolean;
};

const buildPlayerMap = () => {
  const map = new Map<string, string>();
  (players as Array<{ id: string; name: string }>).forEach(player => {
    map.set(normalizeName(player.name), player.id);
  });
  return map;
};

const playerMap = buildPlayerMap();

const resolvePlayerId = (name?: string, altnames?: string[]) => {
  if (!name && (!altnames || altnames.length === 0)) return null;
  const candidates = [name, ...(altnames || [])].filter(Boolean) as string[];
  for (const candidate of candidates) {
    const key = normalizeName(candidate);
    const id = playerMap.get(key);
    if (id) return id;
  }
  return null;
};

const isDismissed = (dismissalText?: string, dismissal?: string) => {
  const text = `${dismissalText ?? ""} ${dismissal ?? ""}`.toLowerCase();
  if (!text) return false;
  if (text.includes("not out")) return false;
  if (text.includes("batting")) return false;
  if (text.includes("retired hurt")) return false;
  if (text.includes("retd hurt")) return false;
  if (text.includes("injury")) return false;
  return true;
};

const findFixtureMatchId = (teamA: string, teamB: string) => {
  const normA = normalizeName(teamA);
  const normB = normalizeName(teamB);
  const match = (fixtures as Array<{ matchId: number; teams: [string, string] }>).find(
    fixture => {
      const list = fixture.teams.map(normalizeName);
      return list.includes(normA) && list.includes(normB);
    }
  );
  return match?.matchId ?? null;
};

const fetchCricketData = async <T>(
  endpoint: string,
  params: Record<string, string> = {}
): Promise<CricketDataResponse<T>> => {
  const apiKey = Deno.env.get("CRICKETDATA_API_KEY");
  if (!apiKey) throw new Error("Missing CRICKETDATA_API_KEY");
  const baseUrl = Deno.env.get("CRICKETDATA_BASE_URL") || "https://api.cricapi.com/v1";
  const url = new URL(`${baseUrl.replace(/\/$/, "")}/${endpoint}`);
  url.searchParams.set("apikey", apiKey);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  const res = await fetch(url.toString());
  const json = (await res.json()) as CricketDataResponse<T>;
  return json;
};

const mapScorecard = (scorecard: ScorecardPayload, matchId: number): MatchStatRow[] => {
  const matchMap = new Map<string, LiveMatchStats>();
  const innings = scorecard?.data?.scorecard ?? [];

  const ensureMatch = (playerId: string) => {
    const existing = matchMap.get(playerId);
    if (existing) return existing;
    const next = { matchId, inPlayingXI: true, impactPlayer: false };
    matchMap.set(playerId, next);
    return next;
  };

  innings.forEach(inning => {
    (inning.batting || []).forEach(bat => {
      const playerId = resolvePlayerId(bat?.batsman?.name, bat?.batsman?.altnames);
      if (!playerId) return;
      const match = ensureMatch(playerId);
      const dismissed = isDismissed(bat["dismissal-text"], bat.dismissal);
      match.batting = {
        runs: Number(bat.r ?? 0),
        balls: Number(bat.b ?? 0),
        fours: Number(bat["4s"] ?? 0),
        sixes: Number(bat["6s"] ?? 0),
        dismissed,
        duck: Number(bat.r ?? 0) === 0 && dismissed,
      };
    });

    (inning.bowling || []).forEach(bowl => {
      const playerId = resolvePlayerId(bowl?.bowler?.name, bowl?.bowler?.altnames);
      if (!playerId) return;
      const match = ensureMatch(playerId);
      match.bowling = {
        overs: Number(bowl.o ?? 0),
        maidens: Number(bowl.m ?? 0),
        wickets: Number(bowl.w ?? 0),
        lbwBowled: 0,
        dotBalls: 0,
        runsConceded: Number(bowl.r ?? 0),
      };
    });

    (inning.catching || []).forEach(field => {
      const playerId = resolvePlayerId(field?.catcher?.name, field?.catcher?.altnames);
      if (!playerId) return;
      const match = ensureMatch(playerId);
      const existing = match.fielding || {
        catches: 0,
        stumpings: 0,
        runOutDirect: 0,
        runOutIndirect: 0,
      };
      match.fielding = {
        catches: existing.catches + Number(field.catch ?? 0),
        stumpings: existing.stumpings + Number(field.stumped ?? 0),
        runOutDirect: existing.runOutDirect + Number(field.runout ?? 0),
        runOutIndirect: existing.runOutIndirect,
      };
    });
  });

  return Array.from(matchMap.entries()).map(([playerId, match]) => ({
    player_id: playerId,
    match_id: matchId,
    in_playing_xi: match.inPlayingXI ?? true,
    impact_player: match.impactPlayer ?? false,
    batting: match.batting ?? null,
    bowling: match.bowling ?? null,
    fielding: match.fielding ?? null,
    man_of_the_match: Boolean(match.manOfTheMatch),
  }));
};

Deno.serve(async () => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRole) {
    return new Response(
      JSON.stringify({ ok: false, error: "Missing Supabase service role." }),
      { status: 500 }
    );
  }

  const supabase = createClient(supabaseUrl, serviceRole);

  try {
    const current = await fetchCricketData<CurrentMatch[]>("currentMatches");
    const matches = current?.data ?? [];

    const matched: Array<{ fixtureMatchId: number; apiMatchId: string }> = [];
    matches.forEach(match => {
      if (!match?.teams || match.teams.length < 2) return;
      const fixtureId = findFixtureMatchId(match.teams[0], match.teams[1]);
      if (!fixtureId) return;
      if (!match.id) return;
      matched.push({ fixtureMatchId: fixtureId, apiMatchId: match.id });
    });

    const allRows: MatchStatRow[] = [];
    for (const match of matched) {
      const scorecard = await fetchCricketData<ScorecardPayload>("match_scorecard", {
        id: match.apiMatchId,
      });
      const rows = mapScorecard(scorecard, match.fixtureMatchId);
      allRows.push(...rows);
    }

    if (allRows.length > 0) {
      await supabase.from("match_stats").upsert(allRows);
    }

    return new Response(
      JSON.stringify({ ok: true, matches: matched.length, rows: allRows.length }),
      { status: 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500,
    });
  }
});
