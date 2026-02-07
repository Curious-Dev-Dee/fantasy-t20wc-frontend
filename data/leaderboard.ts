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
      "jasprit-bumrah-12",
      "travis-head-32",
      "rashid-khan-141",
      "jos-buttler-85",
      "hardik-pandya-5",
      "quinton-de-kock-113",
      "shaheen-afridi-223",
      "kagiso-rabada-117",
      "kuldeep-yadav-14",
      "glenn-maxwell-37",
    ],
    captainId: "suryakumar-yadav-1",
    viceCaptainId: "jos-buttler-85",
  },
  {
    id: "team-blaze",
    name: "Team Blaze",
    rank: 2,
    score: 1824,
    subsLeft: 39,
    players: [
      "travis-head-32",
      "rashid-khan-141",
      "jos-buttler-85",
      "hardik-pandya-5",
      "quinton-de-kock-113",
      "shaheen-afridi-223",
      "kagiso-rabada-117",
      "kuldeep-yadav-14",
      "glenn-phillips-126",
      "adam-zampa-44",
      "philip-salt-86",
    ],
    captainId: "rashid-khan-141",
    viceCaptainId: "travis-head-32",
  },
  {
    id: "friends-league-01",
    name: "Strikers XI",
    rank: 3,
    score: 1732,
    subsLeft: 45,
    players: [
      "suryakumar-yadav-1",
      "jasprit-bumrah-12",
      "rashid-khan-141",
      "hardik-pandya-5",
      "quinton-de-kock-113",
      "shaheen-afridi-223",
      "kagiso-rabada-117",
      "kuldeep-yadav-14",
      "harry-brook-76",
      "wanindu-hasaranga-292",
      "josh-inglis-39",
    ],
    captainId: "jasprit-bumrah-12",
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
      "travis-head-32",
      "jos-buttler-85",
      "hardik-pandya-5",
      "quinton-de-kock-113",
      "kagiso-rabada-117",
      "kuldeep-yadav-14",
      "glenn-maxwell-37",
      "rachin-ravindra-127",
      "matheesha-pathirana-299",
      "josh-hazlewood-42",
    ],
    captainId: "jos-buttler-85",
    viceCaptainId: "hardik-pandya-5",
  },
];
