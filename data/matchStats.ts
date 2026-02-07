export type BattingStats = {
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  dismissed: boolean;
  duck: boolean;
};

export type BowlingStats = {
  overs: number;
  maidens: number;
  wickets: number;
  lbwBowled: number;
  dotBalls: number;
  runsConceded: number;
};

export type FieldingStats = {
  catches: number;
  stumpings: number;
  runOutDirect: number;
  runOutIndirect: number;
};

export type MatchStats = {
  matchId: number;
  inPlayingXI: boolean;
  impactPlayer: boolean;
  batting?: BattingStats;
  bowling?: BowlingStats;
  fielding?: FieldingStats;
  manOfTheMatch?: boolean;
};

export type PlayerMatchStats = {
  playerId: string;
  matches: MatchStats[];
};

// Sample stats for local testing. Extend with real match data as it comes in.
export const playerMatchStats: PlayerMatchStats[] = [
  {
    playerId: "suryakumar-yadav-1",
    matches: [
      {
        matchId: 1,
        inPlayingXI: true,
        impactPlayer: false,
        batting: {
          runs: 72,
          balls: 38,
          fours: 8,
          sixes: 3,
          dismissed: true,
          duck: false,
        },
        fielding: { catches: 1, stumpings: 0, runOutDirect: 0, runOutIndirect: 0 },
        manOfTheMatch: true,
      },
    ],
  },
  {
    playerId: "jasprit-bumrah-12",
    matches: [
      {
        matchId: 1,
        inPlayingXI: true,
        impactPlayer: false,
        bowling: {
          overs: 4,
          maidens: 1,
          wickets: 3,
          lbwBowled: 2,
          dotBalls: 14,
          runsConceded: 18,
        },
        fielding: { catches: 0, stumpings: 0, runOutDirect: 0, runOutIndirect: 0 },
      },
    ],
  },
  {
    playerId: "jos-buttler-85",
    matches: [
      {
        matchId: 1,
        inPlayingXI: true,
        impactPlayer: false,
        batting: {
          runs: 25,
          balls: 20,
          fours: 2,
          sixes: 1,
          dismissed: true,
          duck: false,
        },
        fielding: { catches: 0, stumpings: 1, runOutDirect: 0, runOutIndirect: 0 },
      },
    ],
  },
];
