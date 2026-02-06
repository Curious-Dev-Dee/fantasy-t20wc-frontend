"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { leaderboardTeams as baseLeaderboardTeams, LeaderboardTeam } from "@/data/leaderboard";
import { players, type Player } from "@/data/players";
import { fixtures } from "@/data/fixtures";
import { teamShort } from "@/utils/teamCodes";
import { useTournament } from "@/hooks/useTournament";
import {
  scoreLockedTeams,
  scorePlayerBreakdown,
  scorePlayerMatches,
  scoreTeam,
  type PlayerRole,
} from "@/utils/scoring";
import { useMatchStats } from "@/hooks/useMatchStats";
import { getJSON } from "@/utils/storage";
import { useAuth } from "@/hooks/useAuth";
import { fetchLeaderboardTeams } from "@/utils/leaderboardPersistence";
import { useTeam } from "@/hooks/useTeam";
import {
  fetchAllLockHistory,
  type LockedHistoryRow,
} from "@/utils/lockHistoryPersistence";

export default function LeaderboardTeamPage() {
  const params = useParams<{ teamId: string }>();
  const tournament = useTournament();
  const [leaderboardTeams, setLeaderboardTeams] =
    useState<LeaderboardTeam[]>(baseLeaderboardTeams);
  const [loaded, setLoaded] = useState(false);
  const [showAllMatches, setShowAllMatches] = useState(true);
  const { user, ready, isConfigured } = useAuth();
  const [remoteTeams, setRemoteTeams] = useState<LeaderboardTeam[] | null>(null);
  const myTeam = useTeam();
  const [lockedHistory, setLockedHistory] = useState<LockedHistoryRow[]>([]);

  useEffect(() => {
    if (!ready) return;
    if (user && isConfigured) {
      const loadRemote = async () => {
        const rows = await fetchLeaderboardTeams();
        const mapped: LeaderboardTeam[] = rows.map(row => ({
          id: row.user_id,
          name: row.team_name || "Team",
          players: row.working_team?.players || [],
          captainId: row.working_team?.captainId || "",
          viceCaptainId: row.working_team?.viceCaptainId || "",
          rank: 0,
          score: 0,
          subsLeft: row.subs_used ?? 0,
        }));
        setRemoteTeams(mapped);
        const locked = await fetchAllLockHistory();
        setLockedHistory(locked);
        setLoaded(true);
      };
      loadRemote();
      return;
    }

    const saved = getJSON<LeaderboardTeam[] | null>(
      "fantasy_leaderboard",
      null
    );
    if (saved && Array.isArray(saved) && saved.length > 0) {
      setLeaderboardTeams(saved);
    }
    setLoaded(true);
  }, [ready, user, isConfigured]);

  const teamSource = remoteTeams ?? leaderboardTeams;
  const team = teamSource.find(t => t.id === params.teamId);

  const playerMap = useMemo(
    () => new Map(players.map(player => [player.id, player])),
    []
  );

  const fixturesMap = useMemo(
    () => new Map(fixtures.map(fixture => [fixture.matchId, fixture])),
    []
  );

  const { stats } = useMatchStats();

  const playerRoleMap = useMemo(
    () => new Map(players.map(player => [player.id, player.role] as const)),
    []
  );

  const statsMap = useMemo(() => {
    return new Map(stats.map(stat => [stat.playerId, stat.matches]));
  }, [stats]);

  if (loaded && !team) {
    return (
      <div className="min-h-screen bg-[#0B0F1A] text-white p-6">
        <div className="max-w-3xl mx-auto space-y-4">
          <h1 className="text-2xl font-semibold">Team not found</h1>
          <Link href="/leaderboard" className="text-indigo-300 hover:underline">
            Back to Leaderboard
          </Link>
        </div>
      </div>
    );
  }

  if (!team) {
    return null;
  }

  const roster = team.players
    .map(id => playerMap.get(id))
    .filter(Boolean);

  const isMe = Boolean(user && team.id === user.id);
  const totalScore =
    isMe && myTeam.lockedTeams.length > 0
      ? scoreLockedTeams({
          lockedTeams: myTeam.lockedTeams,
          playerRoleMap,
          statsMap,
        })
      : lockedHistory.some(row => row.user_id === team.id)
      ? scoreLockedTeams({
          lockedTeams: lockedHistory
            .filter(row => row.user_id === team.id)
            .map(row => ({
              matchId: row.match_id,
              players: row.players,
              captainId: row.captain_id,
              viceCaptainId: row.vice_captain_id,
            })),
          playerRoleMap,
          statsMap,
        })
      : scoreTeam({
          playerIds: team.players,
          captainId: team.captainId,
          viceCaptainId: team.viceCaptainId,
          playerRoleMap,
          statsMap,
        });

  const lockedThrough = useMemo(() => {
    if (isMe && myTeam.lockedTeams.length > 0) {
      return Math.max(...myTeam.lockedTeams.map(lock => lock.matchId));
    }
    const rows = lockedHistory.filter(row => row.user_id === team.id);
    if (rows.length === 0) return null;
    return Math.max(...rows.map(row => row.match_id));
  }, [isMe, myTeam.lockedTeams, lockedHistory, team.id]);

  const captain = team.captainId
    ? playerMap.get(team.captainId)
    : null;
  const viceCaptain = team.viceCaptainId
    ? playerMap.get(team.viceCaptainId)
    : null;

  const badgeForRank = (rank: number) => {
    if (rank === 1) return { label: "Champion", className: "bg-yellow-500/20 text-yellow-200 border-yellow-500/40" };
    if (rank === 2) return { label: "Runner-up", className: "bg-slate-300/20 text-slate-200 border-slate-300/40" };
    if (rank === 3) return { label: "Third", className: "bg-amber-600/20 text-amber-200 border-amber-600/40" };
    if (rank <= 10) return { label: "Top 10", className: "bg-indigo-500/20 text-indigo-200 border-indigo-500/40" };
    return null;
  };
  const badge = badgeForRank(team.rank);

  return (
    <div className="min-h-screen bg-[#0B0F1A] text-white px-4 sm:px-6 py-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-semibold">{team.name}</h1>
              {badge && (
                <span className={`text-[10px] px-2 py-0.5 rounded-full border ${badge.className}`}>
                  {badge.label}
                </span>
              )}
            </div>
            <div className="text-xs text-slate-400 mt-1">
              Rank #{team.rank} - Score {totalScore}
              {typeof lockedThrough === "number" && (
                <> · Locked thru M{lockedThrough}</>
              )}
            </div>
            {tournament.nextMatch && (
              <p className="text-xs text-indigo-300 mt-2">
                Next Match #{tournament.nextMatch.matchId}{" "}
                {teamShort(tournament.nextMatch.teams[0])} vs{" "}
                {teamShort(tournament.nextMatch.teams[1])}
              </p>
            )}
          </div>
          <div className="flex gap-4 text-sm">
            <Link
              href="/leaderboard"
              className="text-indigo-300 hover:underline"
            >
              Back to Leaderboard
            </Link>
            <Link href="/" className="text-indigo-300 hover:underline">
              Home
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
          <SummaryCard
            label="Subs Left"
            value={
              Number.isFinite(team.subsLeft)
                ? String(team.subsLeft)
                : "Unlimited"
            }
          />
          <SummaryCard
            label="Captain"
            value={captain ? captain.name : "Not set"}
          />
          <SummaryCard
            label="Vice Captain"
            value={viceCaptain ? viceCaptain.name : "Not set"}
          />
        </div>

        <div className="space-y-3">
          {roster.length === 0 && (
            <div className="text-sm text-slate-400 border border-white/10 rounded-xl p-4">
              No players selected yet.
            </div>
          )}

          {roster.length > 0 && (
            <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-emerald-900/30 to-slate-900/70 p-6">
              <div className="text-xs text-slate-300 mb-4">
                Team Formation
              </div>
              <GroundRow
                title="Wicket Keeper"
                players={roster.filter(p => p?.role === "WK")}
                team={team}
                statsMap={statsMap}
                playerRoleMap={playerRoleMap}
              />
              <GroundRow
                title="Batters"
                players={roster.filter(p => p?.role === "BAT")}
                team={team}
                statsMap={statsMap}
                playerRoleMap={playerRoleMap}
              />
              <GroundRow
                title="All Rounders"
                players={roster.filter(p => p?.role === "AR")}
                team={team}
                statsMap={statsMap}
                playerRoleMap={playerRoleMap}
              />
              <GroundRow
                title="Bowlers"
                players={roster.filter(p => p?.role === "BOWL")}
                team={team}
                statsMap={statsMap}
                playerRoleMap={playerRoleMap}
              />
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Player Points Breakdown</h2>
            <button
              onClick={() => setShowAllMatches(prev => !prev)}
              className="text-xs text-indigo-300 hover:underline"
            >
              {showAllMatches ? "Show Latest Match" : "Show All Matches"}
            </button>
          </div>
          {roster.map(player => {
            const playerId = player!.id;
            const role: PlayerRole = playerRoleMap.get(playerId) || "BAT";
            const allMatches = statsMap.get(playerId) || [];
            const matches = showAllMatches
              ? allMatches
              : allMatches.length > 0
              ? [allMatches[allMatches.length - 1]]
              : [];
            const isCaptain = playerId === team.captainId;
            const isVice = playerId === team.viceCaptainId;
            const breakdown = scorePlayerBreakdown(
              matches,
              role,
              isCaptain,
              isVice
            );
            const matchBreakdown = scorePlayerMatches(
              matches,
              role,
              isCaptain,
              isVice
            );
            const multiplier = isCaptain ? 2 : isVice ? 1.5 : 1;
            const total =
              Math.round(breakdown.basePoints * multiplier) +
              breakdown.motmBonus;
            return (
              <div
                key={`score-${playerId}`}
                className="border border-white/10 rounded-xl p-4 text-sm"
              >
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-medium">{player!.name}</div>
                    <div className="text-xs text-slate-400">
                      {player!.role}
                      {isCaptain && " - Captain"}
                      {isVice && " - Vice"}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-slate-400">Total</div>
                    <div className="font-semibold">{total}</div>
                  </div>
                </div>
                <div className="text-xs text-slate-400 mt-2">
                  Base: {breakdown.basePoints} - Multiplier: {multiplier}x -
                  MOTM: {breakdown.motmBonus}
                </div>
                {matchBreakdown.length > 0 && (
                  <div className="mt-3 text-xs">
                    <div className="text-slate-400 mb-1">Per Match</div>
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-left border border-white/10">
                        <thead className="bg-white/5 text-slate-300">
                          <tr>
                            <th className="px-2 py-1">Match</th>
                            <th className="px-2 py-1">Base</th>
                            <th className="px-2 py-1">MOTM</th>
                            <th className="px-2 py-1">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {matchBreakdown.map(match => {
                            const totalMatch =
                              Math.round(match.basePoints * multiplier) +
                              match.motmBonus;
                            const fixture = fixturesMap.get(match.matchId);
                            const label = fixture
                              ? `M${fixture.matchId} ${teamShort(
                                  fixture.teams[0]
                                )} vs ${teamShort(fixture.teams[1])}`
                              : `M${match.matchId}`;
                            const startTime = fixture
                              ? new Date(
                                  fixture.startTimeUTC
                                ).toLocaleString([], {
                                  month: "short",
                                  day: "numeric",
                                  hour: "numeric",
                                  minute: "2-digit",
                                })
                              : "";
                            return (
                              <tr key={`${playerId}-${match.matchId}`}>
                                <td className="px-2 py-1 text-slate-300">
                                  {label}
                                  {startTime ? ` - ${startTime}` : ""}
                                </td>
                                <td className="px-2 py-1">{match.basePoints}</td>
                                <td className="px-2 py-1">{match.motmBonus}</td>
                                <td className="px-2 py-1 text-slate-200">
                                  {totalMatch}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
      <div className="text-xs text-slate-400">{label}</div>
      <div className="text-sm sm:text-base font-semibold text-white mt-1 whitespace-nowrap leading-tight">
        {value}
      </div>
    </div>
  );
}

function GroundRow({
  title,
  players,
  team,
  statsMap,
  playerRoleMap,
}: {
  title: string;
  players: Array<Player | undefined>;
  team: LeaderboardTeam;
  statsMap: Map<string, any>;
  playerRoleMap: Map<string, PlayerRole>;
}) {
  const validPlayers = players.filter(Boolean);
  if (validPlayers.length === 0) return null;

  return (
    <div className="mb-5">
      <div className="text-[10px] uppercase tracking-widest text-emerald-200/70 mb-2">
        {title}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {validPlayers.map(player => {
          const id = player!.id;
          const role: PlayerRole = playerRoleMap.get(id) || player!.role;
          const matches = (statsMap as any).get(id) || [];
          const isCaptain = team.captainId === id;
          const isVice = team.viceCaptainId === id;
          const breakdown = scorePlayerBreakdown(
            matches,
            role,
            isCaptain,
            isVice
          );
          const multiplier = isCaptain ? 2 : isVice ? 1.5 : 1;
          const total =
            Math.round(breakdown.basePoints * multiplier) + breakdown.motmBonus;

          return (
            <div
              key={id}
              className="rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3"
            >
              <div className="flex items-center justify-between">
                <div className="font-medium text-sm flex items-center gap-2">
                  {player!.name}
                  {player!.isStar && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full border border-yellow-400/50 text-yellow-200 bg-yellow-500/10">
                      Star
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-300">Pts {total}</div>
              </div>
              <div className="text-xs text-slate-400 mt-1">
                {player!.role} · {player!.country} · {player!.credit} cr
              </div>
              <div className="text-[10px] text-slate-500 mt-1">
                {isCaptain && "Captain"}
                {isCaptain && isVice && " / "}
                {isVice && "Vice Captain"}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
