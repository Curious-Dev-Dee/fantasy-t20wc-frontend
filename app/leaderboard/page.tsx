"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { leaderboardTeams as baseLeaderboardTeams, LeaderboardTeam } from "@/data/leaderboard";
import { scoreLockedTeams, scoreTeam } from "@/utils/scoring";
import { useMatchStats } from "@/hooks/useMatchStats";
import { players } from "@/data/players";
import { teamShort } from "@/utils/teamCodes";
import { useTournament } from "@/hooks/useTournament";
import { getJSON } from "@/utils/storage";
import { useAuth } from "@/hooks/useAuth";
import { fetchLeaderboardTeams } from "@/utils/leaderboardPersistence";
import { fetchAllLockHistory, type LockedHistoryRow } from "@/utils/lockHistoryPersistence";
import { useTeam } from "@/hooks/useTeam";
import { fetchLeagueMembers, fetchUserLeagues } from "@/utils/leaguePersistence";
import { supabase, isSupabaseConfigured } from "@/utils/supabaseClient";

type LeagueEntry = {
  userId: string;
  name: string;
  score: number;
  rank: number;
};

type LeagueDetail = {
  id: string;
  name: string;
  entries: LeagueEntry[];
};

type LeaderboardWorkingTeam = {
  players?: string[];
  captainId?: string | null;
  viceCaptainId?: string | null;
};

type MemberTeamRow = {
  user_id: string;
  working_team: LeaderboardWorkingTeam | null;
};

export default function LeaderboardPage() {
  const tournament = useTournament();
  const myTeam = useTeam();
  const [leaderboardTeams] = useState<LeaderboardTeam[]>(() => {
    const saved = getJSON<LeaderboardTeam[] | null>("fantasy_leaderboard", null);
    if (saved && Array.isArray(saved) && saved.length > 0) {
      return saved;
    }
    return baseLeaderboardTeams;
  });
  const { stats, refresh, isRefreshing } = useMatchStats();
  const { user, ready, isConfigured } = useAuth();
  const [remoteTeams, setRemoteTeams] = useState<LeaderboardTeam[] | null>(null);
  const [lockedHistory, setLockedHistory] = useState<LockedHistoryRow[]>([]);
  const [leagueDetails, setLeagueDetails] = useState<LeagueDetail[]>([]);
  const [loadingLeagues, setLoadingLeagues] = useState(false);
  const [activeTab, setActiveTab] = useState<"global" | "private">("global");

  const playerRoleMap = useMemo(
    () => new Map(players.map(player => [player.id, player.role])),
    []
  );

  const statsMap = useMemo(() => {
    return new Map(stats.map(stat => [stat.playerId, stat.matches]));
  }, [stats]);

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
      };
      loadRemote();
      return;
    }

  }, [ready, user, isConfigured]);

  useEffect(() => {
    if (!user || !isSupabaseConfigured || !supabase) return;
    const loadLeagues = async () => {
      setLoadingLeagues(true);
      const leagues = await fetchUserLeagues(user.id);
      const details: LeagueDetail[] = [];
      const locked = await fetchAllLockHistory();
      const lockedByUser = new Map<string, LockedHistoryRow[]>();
      locked.forEach(row => {
        const list = lockedByUser.get(row.user_id) || [];
        list.push(row);
        lockedByUser.set(row.user_id, list);
      });

      for (const league of leagues) {
        const members = await fetchLeagueMembers(league.id);
        const memberIds = members.map(member => member.user_id);
        let memberTeams: MemberTeamRow[] = [];
        const memberNameMap = new Map<string, string>();
        if (memberIds.length > 0 && supabase) {
          const { data } = await supabase
            .from("user_teams")
            .select("user_id, working_team")
            .in("user_id", memberIds);
          memberTeams = (data as unknown as MemberTeamRow[]) || [];
          const { data: profiles } = await supabase
            .from("user_profiles")
            .select("user_id, team_name")
            .in("user_id", memberIds);
          (profiles || []).forEach(profile => {
            if (profile.team_name) {
              memberNameMap.set(profile.user_id, profile.team_name);
            }
          });
        }

        const scored = members.map(member => {
          const teamRow = memberTeams.find(
            entry => entry.user_id === member.user_id
          );
          const lockedRows = lockedByUser.get(member.user_id) || [];
          const lockedTeams = lockedRows.map(entry => ({
            matchId: entry.match_id,
            players: entry.players,
            captainId: entry.captain_id,
            viceCaptainId: entry.vice_captain_id,
          }));
          const score =
            lockedTeams.length > 0
              ? scoreLockedTeams({
                  lockedTeams,
                  playerRoleMap,
                  statsMap,
                })
              : scoreTeam({
                  playerIds: teamRow?.working_team?.players || [],
                  captainId: teamRow?.working_team?.captainId || null,
                  viceCaptainId: teamRow?.working_team?.viceCaptainId || null,
                  playerRoleMap,
                  statsMap,
                });
          return {
            userId: member.user_id,
            name:
              memberNameMap.get(member.user_id) ||
              member.team_name ||
              "Team",
            score,
          };
        });
        const sorted = [...scored]
          .sort((a, b) => b.score - a.score)
          .map((entry, index) => ({
            ...entry,
            rank: index + 1,
          }));
        details.push({
          id: league.id,
          name: league.name,
          entries: sorted,
        });
      }

      setLeagueDetails(details);
      setLoadingLeagues(false);
    };
    loadLeagues();
  }, [user, statsMap, playerRoleMap]);

  const displayTeams = useMemo(() => {
    const lockedByUser = new Map<string, LockedHistoryRow[]>();
    const lockedLatest = new Map<string, number>();
    lockedHistory.forEach(row => {
      const list = lockedByUser.get(row.user_id) || [];
      list.push(row);
      lockedByUser.set(row.user_id, list);
      const prev = lockedLatest.get(row.user_id) ?? 0;
      if (row.match_id > prev) lockedLatest.set(row.user_id, row.match_id);
    });
    const base = remoteTeams ?? leaderboardTeams;
    const scored = base.map(team => {
      const isMe = Boolean(user && team.id === user.id);
      const lockedRows = lockedByUser.get(team.id);
      const lockedTeams =
        lockedRows?.map(row => ({
          matchId: row.match_id,
          players: row.players,
          captainId: row.captain_id,
          viceCaptainId: row.vice_captain_id,
        })) || [];
      const score =
        lockedTeams.length > 0
          ? scoreLockedTeams({
              lockedTeams,
              playerRoleMap,
              statsMap,
            })
          : isMe && myTeam.lockedTeams.length > 0
          ? scoreLockedTeams({
              lockedTeams: myTeam.lockedTeams,
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
      return {
        ...team,
        score,
        lockedThrough:
          lockedLatest.get(team.id) ??
          (isMe && myTeam.lockedTeams.length > 0
            ? Math.max(...myTeam.lockedTeams.map(lock => lock.matchId))
            : undefined),
      };
    });
    const sorted = [...scored].sort((a, b) => b.score - a.score);
    return sorted.map((team, index) => ({
      ...team,
      rank: index + 1,
    }));
  }, [
    remoteTeams,
    leaderboardTeams,
    playerRoleMap,
    statsMap,
    user,
    myTeam.lockedTeams,
    lockedHistory,
  ]);

  const myEntry = useMemo(() => {
    if (!user) return null;
    return displayTeams.find(team => team.id === user.id) || null;
  }, [displayTeams, user]);

  const badgeForRank = (rank: number) => {
    if (rank === 1)
      return {
        label: "Champion",
        className: "bg-yellow-500/20 text-yellow-200 border-yellow-500/40",
      };
    if (rank === 2)
      return {
        label: "Runner-up",
        className: "bg-slate-300/20 text-slate-200 border-slate-300/40",
      };
    if (rank === 3)
      return {
        label: "Third",
        className: "bg-amber-600/20 text-amber-200 border-amber-600/40",
      };
    if (rank <= 10)
      return {
        label: "Top 10",
        className: "bg-indigo-500/20 text-indigo-200 border-indigo-500/40",
      };
    return null;
  };

  return (
    <div className="min-h-screen bg-[#0B0F1A] text-white px-4 sm:px-6 py-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Leaderboard</h1>
            {tournament.nextMatch && (
              <p className="text-[11px] text-indigo-300 mt-1">
                Next Match #{tournament.nextMatch.matchId}{" "}
                {teamShort(tournament.nextMatch.teams[0])} vs{" "}
                {teamShort(tournament.nextMatch.teams[1])}
              </p>
            )}
            <p className="text-[10px] text-slate-400 mt-1">
              Scores update every 5 minutes.
            </p>
          </div>
          <div className="flex items-center gap-3 text-[11px]">
            <button
              onClick={refresh}
              disabled={isRefreshing}
              className="rounded bg-indigo-600 px-3 py-1 text-xs disabled:opacity-60"
            >
              {isRefreshing ? "Refreshing..." : "Refresh Scores"}
            </button>
            <Link href="/" className="text-indigo-300 hover:underline">
              Home
            </Link>
          </div>
        </div>

        <div className="flex gap-2 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab("global")}
            className={`px-3 py-1 rounded-full ${
              activeTab === "global"
                ? "bg-indigo-600 text-white"
                : "bg-white/10 text-slate-300"
            }`}
          >
            Global
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("private")}
            className={`px-3 py-1 rounded-full ${
              activeTab === "private"
                ? "bg-indigo-600 text-white"
                : "bg-white/10 text-slate-300"
            }`}
          >
            Private
          </button>
        </div>

        <div className="space-y-3">
          {activeTab === "global" &&
            <>
              {myEntry && myEntry.rank > 50 && (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-100">
                  Your Rank: <b>#{myEntry.rank}</b> · Your Score:{" "}
                  <b>{myEntry.score}</b>
                </div>
              )}
              {displayTeams.slice(0, 50).map(team => {
              const badge = badgeForRank(team.rank);
              const isMe = Boolean(user && team.id === user.id);
              return (
                <Link
                  key={team.id}
                  href={`/leaderboard/${team.id}`}
                  className={`block border border-white/10 rounded-xl p-4 hover:border-white/30 transition ${
                    isMe ? "ring-1 ring-emerald-400/60" : ""
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="text-xs text-slate-400">
                        Rank #{team.rank}
                        {typeof team.lockedThrough === "number" && (
                          <> · Locked thru M{team.lockedThrough}</>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{team.name}</span>
                        {isMe && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full border border-emerald-500/40 text-emerald-200 bg-emerald-500/10">
                            My Team
                          </span>
                        )}
                        {badge && (
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full border ${badge.className}`}
                          >
                            {badge.label}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-slate-400">Score</div>
                      <div className="font-semibold">{team.score}</div>
                    </div>
                  </div>
                </Link>
              );
            })}
            </>
          }

          {activeTab === "private" && (
            <div className="space-y-5">
              {loadingLeagues && (
                <div className="text-sm text-slate-400">
                  Loading leagues...
                </div>
              )}
              {!loadingLeagues && leagueDetails.length === 0 && (
                <div className="text-sm text-slate-400">
                  You have not joined any leagues yet.
                </div>
              )}
              {leagueDetails.map(league => (
                <div
                  key={league.id}
                  className="border border-white/10 rounded-2xl p-4 bg-slate-900/70"
                >
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-lg font-semibold">{league.name}</h2>
                    <Link
                      href={`/leagues/${league.id}`}
                      className="text-xs text-indigo-300 hover:underline"
                    >
                      View League
                    </Link>
                  </div>
                  <div className="space-y-2">
                    {league.entries.map(entry => (
                      <div
                        key={entry.userId}
                        className="flex items-center justify-between text-sm"
                      >
                        <span className="text-slate-300">
                          #{entry.rank}{" "}
                          <span className="text-white ml-2">
                            {entry.name}
                          </span>
                        </span>
                        <span className="text-white font-medium">
                          {entry.score}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
