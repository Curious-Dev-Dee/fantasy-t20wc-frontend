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

  // index-based loop (needed for lookahead)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // ================================
    // 🏏 Detect innings (Cricbuzz format)
    // ================================
    if (
      /^[A-Za-z\s]+$/.test(line) &&          // Team name
      lines[i + 1]?.includes("(") &&          // Score line e.g. 163-6 (20 Ov)
      lines[i + 2] === "Batter"
    ) {
      if (currentInnings) innings.push(currentInnings);

      currentInnings = {
        team: line.trim(),
        batting: [],
        bowling: [],
      };
      mode = null;
      continue;
    }

    // ================================
    // 🔁 Switch modes
    // ================================
    if (line === "Batter") {
      mode = "batting";
      continue;
    }

    if (line === "Bowler") {
      mode = "bowling";
      continue;
    }

    if (!currentInnings || !mode) continue;

    // ================================
    // 🏏 Batting rows
    // ================================
    if (mode === "batting") {
      // Skip column headers
      if (["R", "B", "4s", "6s", "SR"].includes(line)) {
        continue;
      }

      // Example:
      // Pathum Nissanka c Stirling b Dockrell 24 23 1 1 104.35
      // Kusal Mendis not out 56 43 5 0 130.23
      const match = line.match(
        /^(.+?)\s+(not out|c .*?|b .*?|lbw .*?|run out .*?|st .*?)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)/
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

    // ================================
    // 🎯 Bowling rows
    // ================================
    if (mode === "bowling") {
      // Skip column headers
      if (["O", "M", "R", "W", "NB", "WD", "ECO"].includes(line)) {
        continue;
      }

      // Example:
      // Matthew Humphreys 4 0 44 0
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
