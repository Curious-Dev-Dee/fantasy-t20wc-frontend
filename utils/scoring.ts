import type { MatchStats } from "@/data/matchStats";

export type PlayerRole = "BAT" | "BOWL" | "AR" | "WK";

export type PlayerScoreBreakdown = {
  basePoints: number;
  motmBonus: number;
  totalPoints: number;
};

export type MatchScoreBreakdown = {
  matchId: number;
  basePoints: number;
  motmBonus: number;
  totalPoints: number;
};

export type LockedTeamSnapshot = {
  matchId: number;
  players: string[];
  captainId: string;
  viceCaptainId: string;
};

const battingBonus = (runs: number) => {
  if (runs >= 100) return 30;
  if (runs >= 75) return 20;
  if (runs >= 50) return 10;
  if (runs >= 25) return 5;
  return 0;
};

const strikeRateBonus = (runs: number, balls: number) => {
  if (balls < 10) return 0;
  const sr = (runs / balls) * 100;
  if (sr > 170) return 6;
  if (sr >= 150) return 4;
  if (sr >= 130) return 2;
  if (sr < 50) return -6;
  return 0;
};

const economyBonus = (overs: number, runsConceded: number) => {
  if (overs < 2) return 0;
  const econ = runsConceded / overs;
  if (econ < 5) return 15;
  if (econ < 6) return 8;
  if (econ <= 7) return 2;
  if (econ >= 10 && econ <= 11) return -2;
  if (econ > 11 && econ <= 12) return -4;
  if (econ > 12) return -15;
  return 0;
};

export const scoreMatchBase = (stats: MatchStats, role: PlayerRole) => {
  let points = 0;

  if (stats.inPlayingXI) points += 4;
  if (stats.impactPlayer) points += 4;

  if (stats.batting) {
    const { runs, balls, fours, sixes, duck } = stats.batting;
    points += runs;
    points += fours * 2;
    points += sixes * 4;
    points += battingBonus(runs);
    points += strikeRateBonus(runs, balls);
    if (duck && role !== "BOWL") points -= 10;
  }

  if (stats.bowling) {
    const { wickets, maidens, overs, runsConceded } = stats.bowling;
    points += wickets * 25;
    points += maidens * 15;
    if (wickets >= 5) points += 30;
    else if (wickets === 4) points += 20;
    else if (wickets === 3) points += 15;
    points += economyBonus(overs, runsConceded);
  }

  if (stats.fielding) {
    const { catches, stumpings, runOutDirect, runOutIndirect } = stats.fielding;
    points += catches * 10;
    if (catches >= 3) points += 5;
    points += stumpings * 15;
    points += runOutDirect * 15;
    points += runOutIndirect * 6;
  }

  return points;
};

export const scorePlayerBreakdown = (
  stats: MatchStats[],
  role: PlayerRole,
  isCaptain: boolean,
  isViceCaptain: boolean
): PlayerScoreBreakdown => {
  const breakdowns = scorePlayerMatches(stats, role, isCaptain, isViceCaptain);
  const basePoints = breakdowns.reduce((sum, m) => sum + m.basePoints, 0);
  const motmBonus = breakdowns.reduce((sum, m) => sum + m.motmBonus, 0);
  const totalPoints = basePoints + motmBonus;
  return { basePoints, motmBonus, totalPoints };
};

export const scorePlayerMatches = (
  stats: MatchStats[],
  role: PlayerRole,
  isCaptain: boolean,
  isViceCaptain: boolean
): MatchScoreBreakdown[] => {
  return stats.map(match => {
    const basePoints = scoreMatchBase(match, role);
    let motmBonus = 0;
    if (match.manOfTheMatch) {
      if (isCaptain) motmBonus = 50;
      else if (isViceCaptain) motmBonus = 30;
    }
    return {
      matchId: match.matchId,
      basePoints,
      motmBonus,
      totalPoints: basePoints + motmBonus,
    };
  });
};

export const scorePlayerTotal = (
  stats: MatchStats[],
  role: PlayerRole,
  isCaptain: boolean,
  isViceCaptain: boolean
) => {
  const breakdown = scorePlayerBreakdown(
    stats,
    role,
    isCaptain,
    isViceCaptain
  );
  return breakdown.totalPoints;
};

export const scoreTeam = ({
  playerIds,
  captainId,
  viceCaptainId,
  playerRoleMap,
  statsMap,
}: {
  playerIds: string[];
  captainId: string | null;
  viceCaptainId: string | null;
  playerRoleMap: Map<string, PlayerRole>;
  statsMap: Map<string, MatchStats[]>;
}) => {
  let total = 0;
  playerIds.forEach(playerId => {
    const role = playerRoleMap.get(playerId) || "BAT";
    const matches = statsMap.get(playerId) || [];
    const isCaptain = playerId === captainId;
    const isViceCaptain = playerId === viceCaptainId;
    const breakdown = scorePlayerBreakdown(matches, role, isCaptain, isViceCaptain);
    const baseMult = isCaptain ? 2 : isViceCaptain ? 1.5 : 1;
    total += Math.round(breakdown.basePoints * baseMult) + breakdown.motmBonus;
  });
  return total;
};

export const scoreLockedTeams = ({
  lockedTeams,
  playerRoleMap,
  statsMap,
}: {
  lockedTeams: LockedTeamSnapshot[];
  playerRoleMap: Map<string, PlayerRole>;
  statsMap: Map<string, MatchStats[]>;
}) => {
  let total = 0;
  lockedTeams.forEach(locked => {
    locked.players.forEach(playerId => {
      const role = playerRoleMap.get(playerId) || "BAT";
      const matches = statsMap.get(playerId) || [];
      const match = matches.find(m => m.matchId === locked.matchId);
      if (!match) return;
      const isCaptain = playerId === locked.captainId;
      const isVice = playerId === locked.viceCaptainId;
      const base = scoreMatchBase(match, role);
      const multiplier = isCaptain ? 2 : isVice ? 1.5 : 1;
      const motmBonus = match.manOfTheMatch
        ? isCaptain
          ? 50
          : isVice
          ? 30
          : 0
        : 0;
      total += Math.round(base * multiplier) + motmBonus;
    });
  });
  return total;
};

export const scoreLockedMatch = ({
  locked,
  playerRoleMap,
  statsMap,
}: {
  locked: LockedTeamSnapshot;
  playerRoleMap: Map<string, PlayerRole>;
  statsMap: Map<string, MatchStats[]>;
}) => {
  let total = 0;
  locked.players.forEach(playerId => {
    const role = playerRoleMap.get(playerId) || "BAT";
    const matches = statsMap.get(playerId) || [];
    const match = matches.find(m => m.matchId === locked.matchId);
    if (!match) return;
    const isCaptain = playerId === locked.captainId;
    const isVice = playerId === locked.viceCaptainId;
    const base = scoreMatchBase(match, role);
    const multiplier = isCaptain ? 2 : isVice ? 1.5 : 1;
    const motmBonus = match.manOfTheMatch
      ? isCaptain
        ? 50
        : isVice
        ? 30
        : 0
      : 0;
    total += Math.round(base * multiplier) + motmBonus;
  });
  return total;
};
