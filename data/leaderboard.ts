export type LeaderboardTeam = {
  id: string;
  name: string;
  rank: number;
  score: number;
  subsLeft: number;
  players: string[];
  captainId: string;
  viceCaptainId: string;
};

export const leaderboardTeams: LeaderboardTeam[] = [
  {
    id: "team-alpha",
    name: "Team Alpha",
    rank: 1,
    score: 1890,
    subsLeft: 42,
    players: [
      "suryakumar-yadav-1",
      "jasprit-bumrah-2",
      "travis-head-3",
      "rashid-khan-4",
      "jos-buttler-5",
      "hardik-pandya-6",
      "quinton-de-kock-7",
      "shaheen-afridi-8",
      "kagiso-rabada-9",
      "kuldeep-yadav-10",
      "glenn-maxwell-12",
    ],
    captainId: "suryakumar-yadav-1",
    viceCaptainId: "jos-buttler-5",
  },
  {
    id: "team-blaze",
    name: "Team Blaze",
    rank: 2,
    score: 1824,
    subsLeft: 39,
    players: [
      "travis-head-3",
      "rashid-khan-4",
      "jos-buttler-5",
      "hardik-pandya-6",
      "quinton-de-kock-7",
      "shaheen-afridi-8",
      "kagiso-rabada-9",
      "kuldeep-yadav-10",
      "glenn-phillips-17",
      "adam-zampa-15",
      "phil-salt-16",
    ],
    captainId: "rashid-khan-4",
    viceCaptainId: "travis-head-3",
  },
  {
    id: "friends-league-01",
    name: "Strikers XI",
    rank: 3,
    score: 1732,
    subsLeft: 45,
    players: [
      "suryakumar-yadav-1",
      "jasprit-bumrah-2",
      "rashid-khan-4",
      "hardik-pandya-6",
      "quinton-de-kock-7",
      "shaheen-afridi-8",
      "kagiso-rabada-9",
      "kuldeep-yadav-10",
      "harry-brook-11",
      "wanindu-hasaranga-14",
      "josh-inglis-25",
    ],
    captainId: "jasprit-bumrah-2",
    viceCaptainId: "suryakumar-yadav-1",
  },
  {
    id: "office-league-07",
    name: "Office Legends",
    rank: 7,
    score: 1615,
    subsLeft: 48,
    players: [
      "suryakumar-yadav-1",
      "travis-head-3",
      "jos-buttler-5",
      "hardik-pandya-6",
      "quinton-de-kock-7",
      "kagiso-rabada-9",
      "kuldeep-yadav-10",
      "glenn-maxwell-12",
      "rachin-ravindra-13",
      "matheesha-pathirana-18",
      "josh-hazlewood-19",
    ],
    captainId: "jos-buttler-5",
    viceCaptainId: "hardik-pandya-6",
  },
];
