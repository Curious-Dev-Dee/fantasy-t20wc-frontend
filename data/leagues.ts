export type LeagueMember = {
  teamId: string;
  teamName: string;
  rank: number;
  score: number;
};

export type League = {
  id: string;
  name: string;
  code: string;
  members: LeagueMember[];
};

export const leagues: League[] = [
  {
    id: "friends-league",
    name: "Friends League",
    code: "FRIENDS26",
    members: [
      { teamId: "friends-league-01", teamName: "Strikers XI", rank: 3, score: 1732 },
      { teamId: "team-alpha", teamName: "Team Alpha", rank: 1, score: 1890 },
      { teamId: "team-blaze", teamName: "Team Blaze", rank: 2, score: 1824 },
    ],
  },
  {
    id: "office-league",
    name: "Office League",
    code: "OFFICE26",
    members: [
      { teamId: "office-league-07", teamName: "Office Legends", rank: 7, score: 1615 },
      { teamId: "team-alpha", teamName: "Team Alpha", rank: 1, score: 1890 },
      { teamId: "team-blaze", teamName: "Team Blaze", rank: 2, score: 1824 },
    ],
  },
];
