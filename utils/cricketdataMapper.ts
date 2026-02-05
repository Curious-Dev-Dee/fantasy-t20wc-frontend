import type { MatchStats, PlayerMatchStats } from "@/data/matchStats";
import { players } from "@/data/players";

const normalizeName = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const playerNameMap = new Map(
  players.map(player => [normalizeName(player.name), player.id])
);

const resolvePlayerId = (name?: string) => {
  if (!name) return null;
  return playerNameMap.get(normalizeName(name)) || null;
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

const ensureMatch = (map: Map<string, MatchStats>, playerId: string, matchId: number) => {
  const existing = map.get(playerId);
  if (existing) return existing;
  const next: MatchStats = {
    matchId,
    inPlayingXI: true,
    impactPlayer: false,
  };
  map.set(playerId, next);
  return next;
};

type ScorecardPayload = {
  data?: {
    scorecard?: Array<{
      batting?: Array<{
        batsman?: { name?: string };
        dismissal?: string;
        [key: string]: unknown;
        "dismissal-text"?: string;
        r?: number;
        b?: number;
        "4s"?: number;
        "6s"?: number;
      }>;
      bowling?: Array<{
        bowler?: { name?: string };
        o?: number;
        m?: number;
        r?: number;
        w?: number;
      }>;
      catching?: Array<{
        catcher?: { name?: string };
        catch?: number;
        stumped?: number;
        runout?: number;
      }>;
    }>;
  };
};

export const mapCricketDataScorecard = (
  payload: ScorecardPayload,
  matchId: number
): PlayerMatchStats[] => {
  const entries = new Map<string, MatchStats>();
  const innings = payload.data?.scorecard ?? [];

  innings.forEach(inning => {
    inning.batting?.forEach(bat => {
      const playerId = resolvePlayerId(bat.batsman?.name);
      if (!playerId) return;
      const match = ensureMatch(entries, playerId, matchId);
      match.inPlayingXI = true;
      const dismissed = isDismissed(
        bat["dismissal-text"] as string | undefined,
        bat.dismissal
      );
      match.batting = {
        runs: Number(bat.r ?? 0),
        balls: Number(bat.b ?? 0),
        fours: Number(bat["4s"] ?? 0),
        sixes: Number(bat["6s"] ?? 0),
        dismissed,
        duck: Number(bat.r ?? 0) === 0 && dismissed,
      };
    });

    inning.bowling?.forEach(bowl => {
      const playerId = resolvePlayerId(bowl.bowler?.name);
      if (!playerId) return;
      const match = ensureMatch(entries, playerId, matchId);
      match.inPlayingXI = true;
      match.bowling = {
        overs: Number(bowl.o ?? 0),
        maidens: Number(bowl.m ?? 0),
        wickets: Number(bowl.w ?? 0),
        lbwBowled: 0,
        dotBalls: 0,
        runsConceded: Number(bowl.r ?? 0),
      };
    });

    inning.catching?.forEach(field => {
      const playerId = resolvePlayerId(field.catcher?.name);
      if (!playerId) return;
      const match = ensureMatch(entries, playerId, matchId);
      match.inPlayingXI = true;
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

  return Array.from(entries.entries()).map(([playerId, match]) => ({
    playerId,
    matches: [match],
  }));
};

export const findCricketDataMatchId = (
  currentPayload: { data?: Array<{ id?: string; teams?: string[] }> },
  teams: [string, string]
) => {
  const [teamA, teamB] = teams.map(normalizeName);
  const matches = currentPayload.data ?? [];
  const found = matches.find(match => {
    const list = match.teams?.map(normalizeName) ?? [];
    return list.includes(teamA) && list.includes(teamB);
  });
  return found?.id ?? null;
};

export const mergeMatchStats = (
  existing: PlayerMatchStats[],
  incoming: PlayerMatchStats[],
  matchId: number
): PlayerMatchStats[] => {
  const map = new Map(existing.map(entry => [entry.playerId, entry]));

  incoming.forEach(entry => {
    const current = map.get(entry.playerId);
    if (!current) {
      map.set(entry.playerId, entry);
      return;
    }
    const filtered = current.matches.filter(m => m.matchId !== matchId);
    map.set(entry.playerId, {
      ...current,
      matches: [...filtered, ...entry.matches],
    });
  });

  return Array.from(map.values());
};
