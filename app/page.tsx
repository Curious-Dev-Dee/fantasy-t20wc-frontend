"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTournament } from "@/hooks/useTournament";
import { useTeam } from "@/hooks/useTeam";
import { useMatchStats } from "@/hooks/useMatchStats";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { players } from "@/data/players";
import { fixtures } from "@/data/fixtures";
import { scoreLockedTeams, scoreTeam } from "@/utils/scoring";
import { teamShort } from "@/utils/teamCodes";
import { fetchLeaderboardTeams } from "@/utils/leaderboardPersistence";
import { fetchAllLockHistory } from "@/utils/lockHistoryPersistence";
import { fetchLeagueMembers, fetchUserLeagues } from "@/utils/leaguePersistence";
import { supabase, isSupabaseConfigured } from "@/utils/supabaseClient";
import { getJSON, setJSON } from "@/utils/storage";

type LeagueSummary = {
  id: string;
  name: string;
  myRank: number | null;
  myScore: number | null;
};

type WorkingTeamLite = {
  players?: string[];
  captainId?: string | null;
  viceCaptainId?: string | null;
};

type UserTeamLite = {
  user_id: string;
  working_team: WorkingTeamLite | null;
};

type HomeCache = {
  globalTop: Array<{ id: string; name: string; score: number }>;
  myGlobalRank: number | null;
  myGlobalScore: number | null;
  leagueSummaries: LeagueSummary[];
  cachedAt: number;
};

const HOME_CACHE_KEY = "fantasy_home_cache_v1";
const CACHE_TTL_MS = 5 * 60 * 1000;

export default function HomePage() {
  const router = useRouter();
  const { user, ready } = useAuth();
  const { profile, loading: profileLoading } = useProfile();
  const tournament = useTournament();
  const team = useTeam();
  const { stats } = useMatchStats();

  const cachedHome = useMemo(() => {
    return getJSON<HomeCache | null>(HOME_CACHE_KEY, null);
  }, []);

  const [globalTop, setGlobalTop] = useState<
    Array<{ id: string; name: string; score: number }>
  >(cachedHome?.globalTop ?? []);
  const [myGlobalRank, setMyGlobalRank] = useState<number | null>(
    cachedHome?.myGlobalRank ?? null
  );
  const [myGlobalScore, setMyGlobalScore] = useState<number | null>(
    cachedHome?.myGlobalScore ?? null
  );
  const [leagueSummaries, setLeagueSummaries] = useState<LeagueSummary[]>(
    cachedHome?.leagueSummaries ?? []
  );
  const [loadingLeagues, setLoadingLeagues] = useState(false);

  const playerRoleMap = useMemo(
    () => new Map(players.map(player => [player.id, player.role])),
    []
  );

  const statsMap = useMemo(() => {
    return new Map(stats.map(stat => [stat.playerId, stat.matches]));
  }, [stats]);

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      router.replace("/login");
      return;
    }
  }, [user, ready, router]);

  const totalScore = useMemo(() => {
    if (team.lockedTeams.length > 0) {
      return scoreLockedTeams({
        lockedTeams: team.lockedTeams,
        playerRoleMap,
        statsMap,
      });
    }
    return scoreTeam({
      playerIds: team.workingTeam.players,
      captainId: team.workingTeam.captainId,
      viceCaptainId: team.workingTeam.viceCaptainId,
      playerRoleMap,
      statsMap,
    });
  }, [
    team.lockedTeams,
    team.workingTeam.players,
    team.workingTeam.captainId,
    team.workingTeam.viceCaptainId,
    playerRoleMap,
    statsMap,
  ]);

  const nextMatchLabel = tournament.nextMatch
    ? `#${tournament.nextMatch.matchId} ${teamShort(
        tournament.nextMatch.teams[0]
      )} vs ${teamShort(tournament.nextMatch.teams[1])}`
    : "TBD";

  const nextMatchTime = tournament.nextMatch
    ? new Date(tournament.nextMatch.startTimeUTC).toLocaleString([], {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "TBD";

  const lastLocked = useMemo(() => {
    if (team.lockedTeams.length === 0) return null;
    return [...team.lockedTeams].sort((a, b) => b.matchId - a.matchId)[0];
  }, [team.lockedTeams]);

  const fixtureMap = useMemo(
    () => new Map(fixtures.map(fixture => [fixture.matchId, fixture])),
    []
  );

  const lastLockedLabel = lastLocked
    ? `M${lastLocked.matchId} ${(() => {
        const fixture = fixtureMap.get(lastLocked.matchId);
        return fixture
          ? `${teamShort(fixture.teams[0])} vs ${teamShort(fixture.teams[1])}`
          : "Match";
      })()}`
    : "Not locked yet";

  const lastLockedTime = lastLocked
    ? fixtureMap.get(lastLocked.matchId)?.startTimeUTC
    : null;

  useEffect(() => {
    if (!user || !isSupabaseConfigured || !supabase) return;
    let cancelled = false;
    const loadData = async () => {
      const cached = getJSON<HomeCache | null>(HOME_CACHE_KEY, null);
      const isFresh = cached ? Date.now() - cached.cachedAt < CACHE_TTL_MS : false;
      if (isFresh) {
        setLoadingLeagues(false);
      } else {
        setLoadingLeagues(true);
      }

      const [rows, locked, leagues] = await Promise.all([
        fetchLeaderboardTeams(),
        fetchAllLockHistory(),
        fetchUserLeagues(user.id),
      ]);

      const lockedByUser = new Map<string, typeof locked>();
      locked.forEach(row => {
        const list = lockedByUser.get(row.user_id) || [];
        list.push(row);
        lockedByUser.set(row.user_id, list);
      });

      const scoredGlobal = rows.map(row => {
        const lockedRows = lockedByUser.get(row.user_id) || [];
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
                playerIds: row.working_team?.players || [],
                captainId: row.working_team?.captainId || null,
                viceCaptainId: row.working_team?.viceCaptainId || null,
                playerRoleMap,
                statsMap,
              });
        return {
          id: row.user_id,
          name: row.team_name || "Team",
          score,
        };
      });
      const sortedGlobal = [...scoredGlobal].sort((a, b) => b.score - a.score);
      const nextGlobalTop = sortedGlobal.slice(0, 2);
      const myIndex = sortedGlobal.findIndex(entry => entry.id === user.id);
      const nextMyRank = myIndex >= 0 ? myIndex + 1 : null;
      const nextMyScore = myIndex >= 0 ? sortedGlobal[myIndex].score : null;

      const leagueSummariesNext: LeagueSummary[] = [];
      if (leagues.length > 0) {
        const membersList = await Promise.all(
          leagues.map(league => fetchLeagueMembers(league.id))
        );
        const allMemberIds = Array.from(
          new Set(
            membersList.flatMap(members =>
              members.map(member => member.user_id)
            )
          )
        );
        let memberTeams: UserTeamLite[] = [];
        if (allMemberIds.length > 0 && supabase) {
          const { data } = await supabase
            .from("user_teams")
            .select("user_id, working_team")
            .in("user_id", allMemberIds);
          memberTeams = (data ?? []) as UserTeamLite[];
        }

        leagues.forEach((league, index) => {
          const members = membersList[index];
          const scored = members.map(member => {
            const teamRow = memberTeams.find(
              teamEntry => teamEntry.user_id === member.user_id
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
            return { userId: member.user_id, score };
          });
          const sorted = [...scored].sort((a, b) => b.score - a.score);
          const myLeagueIndex = sorted.findIndex(
            entry => entry.userId === user.id
          );
          leagueSummariesNext.push({
            id: league.id,
            name: league.name,
            myRank: myLeagueIndex >= 0 ? myLeagueIndex + 1 : null,
            myScore: myLeagueIndex >= 0 ? sorted[myLeagueIndex].score : null,
          });
        });
      }

      if (cancelled) return;
      setGlobalTop(nextGlobalTop);
      setMyGlobalRank(nextMyRank);
      setMyGlobalScore(nextMyScore);
      setLeagueSummaries(leagueSummariesNext.slice(0, 3));
      setLoadingLeagues(false);

      setJSON(HOME_CACHE_KEY, {
        globalTop: nextGlobalTop,
        myGlobalRank: nextMyRank,
        myGlobalScore: nextMyScore,
        leagueSummaries: leagueSummariesNext.slice(0, 3),
        cachedAt: Date.now(),
      });
    };

    loadData();
    return () => {
      cancelled = true;
    };
  }, [user, statsMap, playerRoleMap]);

  if (!user || profileLoading) {
    return (
      <div className="min-h-screen bg-[#0B0F1A] text-white p-6">
        <div className="max-w-xl mx-auto text-sm text-slate-400">
          Loading...
        </div>
      </div>
    );
  }

  const welcomeName = profile.full_name || "Player";
  const displayTeamName = profile.team_name || "Team";

  return (
    <div className="min-h-screen bg-[#0B0F1A] text-slate-200 pb-24">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
        <section className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {profile.team_photo_url ? (
                <img
                  src={profile.team_photo_url}
                  alt="Team"
                  className="h-10 w-10 rounded-full border border-white/10 object-cover"
                />
              ) : (
                <div className="h-10 w-10 rounded-full border border-white/10 bg-slate-800 flex items-center justify-center text-[10px]">
                  XI
                </div>
              )}
              <div>
                <h1 className="text-base font-semibold text-white">
                  Welcome, {welcomeName}
                </h1>
                <p className="text-xs text-slate-400">{displayTeamName}</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-indigo-600/18 to-transparent p-5">
            <div className="text-[11px] uppercase tracking-[0.2em] text-indigo-200/80">
              Next Match
            </div>
            <div className="mt-2 text-lg font-semibold text-white">
              {nextMatchLabel}
            </div>
            <div className="mt-1 text-sm text-slate-300">{nextMatchTime}</div>
            <div className="mt-2 text-xs text-slate-400">
              Lock status: {tournament.nextMatch ? `Locks at ${nextMatchTime}` : "TBD"}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400">
            <span>
              Team: <span className="text-white">{displayTeamName}</span>
            </span>
            <span>
              Score: <span className="text-white">{totalScore}</span>
            </span>
            <span>
              Subs Left: <span className="text-white">{team.subsLeftLabel}</span>
            </span>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/team"
              className="px-6 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition"
            >
              View Team
            </Link>
            <Link
              href="/team/edit"
              className="px-5 py-2 rounded-xl bg-white/5 text-slate-200 hover:bg-white/10 transition"
            >
              Edit Team
            </Link>
            <Link
              href="/fixtures"
              className="ml-auto text-xs text-slate-400 hover:text-slate-200 transition"
            >
              View All Fixtures
            </Link>
          </div>

          <div className="text-xs text-slate-400">
            Last Locked: {lastLockedLabel}
            {lastLockedTime
              ? ` · ${new Date(lastLockedTime).toLocaleString([], {
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}`
              : ""}
          </div>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <Card>
            <CardHeader title="Global Leaderboard" actionLabel="View All" actionHref="/leaderboard" />
            {globalTop.length === 0 && (
              <div className="text-sm text-slate-400">No scores yet.</div>
            )}
            {globalTop.map((entry, index) => (
              <LeaderboardRow
                key={entry.id}
                rank={index + 1}
                name={entry.name}
                score={entry.score}
              />
            ))}
            <div className="mt-4 border-t border-white/10 pt-3 text-xs text-slate-400 flex justify-between">
              <span>Your Rank: <b className="text-white">{myGlobalRank ?? "-"}</b></span>
              <span>Your Score: <b className="text-white">{myGlobalScore ?? "-"}</b></span>
            </div>
          </Card>

          <Card>
            <CardHeader title="Private Leagues" actionLabel="View All" actionHref="/leagues" />
            {loadingLeagues && (
              <div className="text-sm text-slate-400">Loading leagues...</div>
            )}
            {!loadingLeagues && leagueSummaries.length === 0 && (
              <div className="text-sm text-slate-400">
                You have not joined any leagues yet.
              </div>
            )}
            {leagueSummaries.map(league => (
              <LeaguePreview
                key={league.id}
                name={league.name}
                rank={league.myRank}
                score={league.myScore}
                href={`/leagues/${league.id}`}
              />
            ))}
            <div className="mt-4 flex gap-3">
              <Link
                href="/leagues"
                className="px-4 py-2 rounded-lg bg-indigo-600 text-sm"
              >
                Create / Join League
              </Link>
            </div>
          </Card>
        </section>
      </div>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
      {children}
    </div>
  );
}

function CardHeader({
  title,
  actionLabel,
  actionHref,
}: {
  title: string;
  actionLabel: string;
  actionHref: string;
}) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h3 className="text-lg font-semibold">{title}</h3>
      <Link href={actionHref} className="text-xs text-indigo-400 hover:underline">
        {actionLabel}
      </Link>
    </div>
  );
}

function LeaderboardRow({
  rank,
  name,
  score,
}: {
  rank: number;
  name: string;
  score: number;
}) {
  return (
    <div className="flex justify-between items-center py-2 text-sm">
      <span className="text-slate-400">
        #{rank} <span className="text-white ml-2">{name}</span>
      </span>
      <span className="text-white font-medium">{score}</span>
    </div>
  );
}

function LeaguePreview({
  name,
  rank,
  score,
  href,
}: {
  name: string;
  rank: number | null;
  score: number | null;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="flex justify-between items-center py-2 text-sm border-b border-white/5 last:border-none"
    >
      <div>
        <div className="text-white">{name}</div>
        <div className="text-xs text-slate-400">Rank {rank ?? "-"}</div>
      </div>
      <div className="text-white font-medium">{score ?? "-"}</div>
    </Link>
  );
}
