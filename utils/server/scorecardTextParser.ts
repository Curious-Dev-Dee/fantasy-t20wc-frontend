import { NormalizedScorecard } from "@/types/scorecard";

type ParsedInnings = {
  team: string;
  batting: {
    player: string;
    runs: number;
    balls: number;
    fours: number;
    sixes: number;
    dismissed: boolean;
    dismissalText: string;
  }[];
  bowling: {
    player: string;
    overs: number;
    maidens: number;
    runsConceded: number;
    wickets: number;
  }[];
};

export function parseRawScorecard(
  matchId: number,
  raw: string
): NormalizedScorecard {
  const lines = raw
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const innings: ParsedInnings[] = [];

  let currentInnings: ParsedInnings | null = null;
  let mode: "batting" | "bowling" | null = null;

  for (const line of lines) {
    // ---- Detect innings start ----
    if (line.endsWith("Innings")) {
      if (currentInnings) innings.push(currentInnings);

      currentInnings = {
        team: line.replace(" Innings", "").trim(),
        batting: [],
        bowling: [],
      };
      mode = null;
      continue;
    }

    // ---- Switch modes ----
    if (line === "Batter") {
      mode = "batting";
      continue;
    }

    if (line === "Bowler") {
      mode = "bowling";
      continue;
    }

    if (!currentInnings || !mode) continue;

    // ---- Batting ----
    if (mode === "batting") {
      const match = line.match(
        /^(.+?)\s+(not out|c |b |lbw |run out|st ).*?(\d+)\s+(\d+)\s+(\d+)\s+(\d+)/
      );

      if (!match) continue;

      const [, nameRaw, dismissal, runs, balls, fours, sixes] = match;

      currentInnings.batting.push({
        player: nameRaw.replace(/\(.*?\)/g, "").trim(),
        runs: Number(runs),
        balls: Number(balls),
        fours: Number(fours),
        sixes: Number(sixes),
        dismissed: dismissal !== "not out",
        dismissalText: dismissal.trim(),
      });
    }

    // ---- Bowling ----
    if (mode === "bowling") {
      const match = line.match(
        /^(.+?)\s+(\d+(\.\d+)?)\s+(\d+)\s+(\d+)\s+(\d+)/
      );

      if (!match) continue;

      const [, name, overs, , maidens, runs, wickets] = match;

      currentInnings.bowling.push({
        player: name.trim(),
        overs: Number(overs),
        maidens: Number(maidens),
        runsConceded: Number(runs),
        wickets: Number(wickets),
      });
    }
  }

  if (currentInnings) innings.push(currentInnings);

  return {
    matchId,
    teams: [
      innings[0]?.team ?? "UNKNOWN",
      innings[1]?.team ?? "UNKNOWN",
    ],
    innings,
  };
}
