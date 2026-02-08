export type NormalizedScorecard = {
  matchId: number;
  teams: [string, string];
  innings: {
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
  }[];
};
