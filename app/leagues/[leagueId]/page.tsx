"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { leagues as baseLeagues, League } from "@/data/leagues";
import { useTournament } from "@/hooks/useTournament";
import { teamShort } from "@/utils/teamCodes";
import { useTeam } from "@/hooks/useTeam";
import { useProfile } from "@/hooks/useProfile";
import { getJSON } from "@/utils/storage";
import { useAuth } from "@/hooks/useAuth";
import {
  fetchLeague,
  fetchLeagueMembers,
  LeagueMemberRow,
  LeagueRow,
} from "@/utils/leaguePersistence";
import {
  fetchAllLockHistory,
  type LockedHistoryRow,
} from "@/utils/lockHistoryPersistence";
import { supabase } from "@/utils/supabaseClient";
import { fetchUsersTotalPoints } from "@/utils/pointsPersistence";

export default function LeagueDetailPage() {
  const params = useParams<{ leagueId: string }>();
  const tournament = useTournament();
  const [isOwner, setIsOwner] = useState(false);
  const [copied, setCopied] = useState(false);
  const [leagues, setLeagues] = useState<League[]>(baseLeagues);
  const [loaded, setLoaded] = useState(false);
  const myTeam = useTeam();
  const { profile } = useProfile();
  const { user, ready, isConfigured } = useAuth();
  const [remoteLeague, setRemoteLeague] = useState<LeagueRow | null>(null);
  const [remoteMembers, setRemoteMembers] = useState<LeagueMemberRow[]>([]);
  const [memberNames, setMemberNames] = useState<Record<string, string>>({});
  const [lockedHistory, setLockedHistory] = useState<LockedHistoryRow[]>([]);
  const [memberTotals, setMemberTotals] = useState(new Map<string, number>());

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!ready) return;
      if (user && isConfigured) {
        const [leagueRow, members, locked] = await Promise.all([
          fetchLeague(params.leagueId),
          fetchLeagueMembers(params.leagueId),
          fetchAllLockHistory(),
        ]);
        if (cancelled) return;
        setRemoteLeague(leagueRow);
        setRemoteMembers(members);
        setLockedHistory(locked);

        if (leagueRow && supabase && members.length > 0) {
          const ids = members.map(member => member.user_id);
          const { data: profiles } = await supabase
            .from("user_profiles")
            .select("user_id, team_name")
            .in("user_id", ids);
          if (cancelled) return;
          if (profiles) {
            const map: Record<string, string> = {};
            profiles.forEach(profileRow => {
              if (profileRow.team_name) {
                map[profileRow.user_id] = profileRow.team_name;
              }
            });
            setMemberNames(map);
          }
          const totalsMap = await fetchUsersTotalPoints(ids);
          setMemberTotals(totalsMap);
        }
        if (cancelled) return;
        setLoaded(true);
        return;
      }

      const saved = getJSON<League[] | null>("fantasy_leagues", null);
      await Promise.resolve();
      if (cancelled) return;
      if (saved && Array.isArray(saved)) {
        const merged = [...baseLeagues];
        saved.forEach(savedLeague => {
          if (!merged.find(l => l.id === savedLeague.id)) {
            merged.push(savedLeague);
          }
        });
        setLeagues(merged);
      }
      setLoaded(true);
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [ready, user, isConfigured, params.leagueId]);


  const league = useMemo(() => {
    if (user && isConfigured) {
      return remoteLeague
        ? ({
            id: remoteLeague.id,
            name: remoteLeague.name,
            code: remoteLeague.code,
            members: [],
          } as League)
        : null;
    }
    return leagues.find(l => l.id === params.leagueId) || null;
  }, [leagues, params.leagueId, remoteLeague, user, isConfigured]);

  const leagueId = league?.id ?? null;
  const userId = user?.id ?? null;
  const remoteOwnerId = remoteLeague?.owner_id ?? null;

  const myTeamScore = useMemo(() => {
    if (!user) return 0;
    return memberTotals.get(user.id) ?? 0;
  }, [memberTotals, user]);

  const computedMembers = useMemo(() => {
    if (!league) return [];
    const lockedByUser = new Map<string, LockedHistoryRow[]>();
    const lockedLatest = new Map<string, number>();
    lockedHistory.forEach(row => {
      const list = lockedByUser.get(row.user_id) || [];
      list.push(row);
      lockedByUser.set(row.user_id, list);
      const prev = lockedLatest.get(row.user_id) ?? 0;
      if (row.match_id > prev) lockedLatest.set(row.user_id, row.match_id);
    });

    if (user && isConfigured) {
      const memberScores = remoteMembers.map(member => {
        const score = memberTotals.get(member.user_id) ?? 0;
        const name =
          member.user_id === user.id
            ? (profile.team_name || "Team")
            : memberNames[member.user_id] || member.team_name || "Team";
        return {
          teamId: member.user_id,
          teamName: name,
          rank: 0,
          score,
          lockedThrough:
            lockedLatest.get(member.user_id) ??
            (member.user_id === user.id && myTeam.lockedTeams.length > 0
              ? Math.max(...myTeam.lockedTeams.map(lock => lock.matchId))
              : undefined),
        };
      });
      const sorted = [...memberScores].sort((a, b) => b.score - a.score);
      return sorted.map((member, index) => ({
        ...member,
        rank: index + 1,
      }));
    }

    const membersWithScore = league.members.map(member => {
      const score =
        member.teamId === "my-team"
          ? myTeamScore
          : member.score;
      const name = member.teamId === "my-team" ? (profile.team_name || "Team") : member.teamName;
      return {
        ...member,
        score,
        teamName: name,
        lockedThrough:
          member.teamId === "my-team" && myTeam.lockedTeams.length > 0
            ? Math.max(...myTeam.lockedTeams.map(lock => lock.matchId))
            : undefined,
      };
    });

    const sorted = [...membersWithScore].sort((a, b) => b.score - a.score);
    return sorted.map((member, index) => ({
      ...member,
      rank: index + 1,
    }));
  }, [
    league,
    myTeamScore,
    profile.team_name,
    memberNames,
    memberTotals,
    remoteMembers,
    user,
    isConfigured,
    lockedHistory,
    myTeam.lockedTeams,
  ]);

  useEffect(() => {
    let cancelled = false;

    const loadOwner = async () => {
      if (!leagueId) return;
      if (userId && isConfigured && remoteOwnerId) {
        await Promise.resolve();
        if (cancelled) return;
        setIsOwner(remoteOwnerId === userId);
        return;
      }
      const saved = getJSON<string[]>("fantasy_owned_leagues", []);
      await Promise.resolve();
      if (cancelled) return;
      setIsOwner(saved.includes(leagueId));
    };

    void loadOwner();

    return () => {
      cancelled = true;
    };
  }, [leagueId, userId, isConfigured, remoteOwnerId]);

  if (loaded && !league) {
    return (
      <div className="min-h-screen bg-[#0B0F1A] text-white p-6">
        <div className="max-w-3xl mx-auto space-y-4">
          <h1 className="text-2xl font-semibold">League not found</h1>
          <Link href="/leagues" className="text-indigo-300 hover:underline">
            Back to Leagues
          </Link>
        </div>
      </div>
    );
  }

  if (!league) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#0B0F1A] text-white p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">{league.name}</h1>
            <div className="text-[10px] mt-1 inline-block px-2 py-0.5 rounded-full border border-indigo-500/40 text-indigo-300">
              Live Scores
            </div>
            {isOwner && (
              <div className="text-xs text-slate-400 mt-1 flex items-center gap-3">
                <span>
                  League Code: <b>{league.code}</b>
                </span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(league.code);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  }}
                  className="text-xs text-indigo-300 hover:underline"
                >
                  Copy Code
                </button>
              </div>
            )}
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
              href="/leagues"
              className="text-indigo-300 hover:underline"
            >
              Back to Leagues
            </Link>
            <Link href="/" className="text-indigo-300 hover:underline">
              Home
            </Link>
          </div>
        </div>

        <div className="space-y-3">
          {computedMembers.map(member => {
            const displayScore = member.score;
            const isRemote = Boolean(user && isConfigured);
            const isMe = isRemote
              ? member.teamId === user?.id
              : member.teamId === "my-team";
            const href = isMe
              ? "/team"
              : `/leaderboard/${member.teamId}`;
            const Wrapper: React.ElementType = Link;
            const wrapperProps = {
              href,
              className:
                "block border border-white/10 rounded-xl p-4 hover:border-white/30 transition",
            };

            return (
              <Wrapper key={member.teamId} {...wrapperProps}>
                <div className="flex justify-between items-center">
                  <div>
                    <div className="text-xs text-slate-400">
                      Rank #{member.rank}
                      {typeof member.lockedThrough === "number" && (
                        <> · Locked thru M{member.lockedThrough}</>
                      )}
                    </div>
                    <div className="font-semibold">{member.teamName}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-slate-400">Score</div>
                    <div className="font-semibold">{displayScore}</div>
                  </div>
                </div>
              </Wrapper>
            );
          })}
        </div>
        {copied && (
          <div className="fixed top-4 right-4 rounded-lg border border-white/10 bg-[#0F1626] px-4 py-2 text-xs text-white shadow">
            Copied!
          </div>
        )}
      </div>
    </div>
  );
}
