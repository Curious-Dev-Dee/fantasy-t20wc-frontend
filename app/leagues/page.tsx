"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { leagues as baseLeagues, League } from "@/data/leagues";
import { useTournament } from "@/hooks/useTournament";
import { teamShort } from "@/utils/teamCodes";
import { useTeam } from "@/hooks/useTeam";
import { useMatchStats } from "@/hooks/useMatchStats";
import { scoreTeam } from "@/utils/scoring";
import { players } from "@/data/players";
import { useProfile } from "@/hooks/useProfile";
import { getJSON, setJSON } from "@/utils/storage";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/utils/supabaseClient";
import {
  createLeague,
  deleteLeague,
  fetchUserLeagues,
  joinLeagueByCode,
  leaveLeague,
} from "@/utils/leaguePersistence";

type CreatedLeague = {
  name: string;
  code: string;
};

export default function LeaguesPage() {
  const tournament = useTournament();
  const team = useTeam();
  const { profile } = useProfile();
  const { stats } = useMatchStats();
  const { user, ready, isConfigured } = useAuth();
  const [leagueName, setLeagueName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [createdLeague, setCreatedLeague] = useState<CreatedLeague | null>(null);
  const [joinMessage, setJoinMessage] = useState<string | null>(null);
  const [leagues, setLeagues] = useState<League[]>(baseLeagues);
  const [joinedLeagueIds, setJoinedLeagueIds] = useState<string[]>([]);
  const [ownerLeagueIds, setOwnerLeagueIds] = useState<string[]>([]);
  const [memberCounts, setMemberCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!ready) return;
    if (user && isConfigured) {
      const loadRemote = async () => {
        const remoteLeagues = await fetchUserLeagues(user.id);
        const normalized: League[] = remoteLeagues.map(league => ({
          id: league.id,
          name: league.name,
          code: league.code,
          members: [],
        }));
        setLeagues(normalized);
        setJoinedLeagueIds(remoteLeagues.map(league => league.id));
        setOwnerLeagueIds(
          remoteLeagues
            .filter(league => league.owner_id === user.id)
            .map(league => league.id)
        );

        if (supabase && remoteLeagues.length > 0) {
          const ids = remoteLeagues.map(league => league.id);
          const { data } = await supabase
            .from("league_members")
            .select("league_id")
            .in("league_id", ids);
          if (data) {
            const counts: Record<string, number> = {};
            data.forEach(row => {
              const leagueId = row.league_id as string;
              counts[leagueId] = (counts[leagueId] || 0) + 1;
            });
            setMemberCounts(counts);
          }
        }
      };
      loadRemote();
      return;
    }

    const saved = getJSON<League[] | null>("fantasy_leagues", null);
    const joined = getJSON<string[]>("fantasy_joined_leagues", []);
    const owners = getJSON<string[]>("fantasy_owned_leagues", []);
    if (saved && Array.isArray(saved)) {
      const merged = [...baseLeagues];
      saved.forEach(savedLeague => {
        if (!merged.find(l => l.id === savedLeague.id)) {
          merged.push(savedLeague);
        }
      });
      setLeagues(merged);
    }
    setJoinedLeagueIds(joined);
    setOwnerLeagueIds(owners);
  }, [ready, user, isConfigured]);


  const persistLeagues = (nextLeagues: League[]) => {
    setLeagues(nextLeagues);
    setJSON("fantasy_leagues", nextLeagues);
  };

  const persistJoined = (nextJoined: string[]) => {
    setJoinedLeagueIds(nextJoined);
    setJSON("fantasy_joined_leagues", nextJoined);
  };

  const persistOwners = (nextOwners: string[]) => {
    setOwnerLeagueIds(nextOwners);
    setJSON("fantasy_owned_leagues", nextOwners);
  };

  const ensureMyTeamMember = (league: League) => {
    const myTeamId = "my-team";
    if (league.members.some(member => member.teamId === myTeamId)) {
      return league;
    }
    const nextRank = league.members.length + 1;
    const playerRoleMap = new Map(players.map(player => [player.id, player.role]));
    const statsMap = new Map(stats.map(stat => [stat.playerId, stat.matches]));
    const score = scoreTeam({
      playerIds: team.workingTeam.players,
      captainId: team.workingTeam.captainId,
      viceCaptainId: team.workingTeam.viceCaptainId,
      playerRoleMap,
      statsMap,
    });
    return {
      ...league,
        members: [
          ...league.members,
          {
            teamId: myTeamId,
            teamName: profile.team_name || "Team",
            rank: nextRank,
            score,
          },
        ],
    };
  };

  const knownCodes = useMemo(
    () => new Set(leagues.map(league => league.code)),
    [leagues]
  );

  const handleCreate = () => {
    if (!leagueName.trim()) {
      setJoinMessage("Enter a league name to create.");
      return;
    }
    if (user && isConfigured) {
      const createRemote = async () => {
        const result = await createLeague(
          leagueName.trim(),
          user.id,
          profile.team_name || "Team"
        );
        if (!result || !result.league) {
          setJoinMessage(
            result?.error || "Could not create league. Try again."
          );
          return;
        }
        const league = result.league;
        setCreatedLeague({ name: league.name, code: league.code });
        const nextLeagues = [
          {
            id: league.id,
            name: league.name,
            code: league.code,
            members: [],
          },
          ...leagues,
        ];
        setLeagues(nextLeagues);
        setJoinedLeagueIds([league.id, ...joinedLeagueIds]);
        setOwnerLeagueIds([league.id, ...ownerLeagueIds]);
        setLeagueName("");
      };
      createRemote();
      return;
    }

    const code = `${leagueName.trim().slice(0, 6).toUpperCase()}${Math.floor(
      100 + Math.random() * 900
    )}`;
    setCreatedLeague({ name: leagueName.trim(), code });
    const nextLeague: League = {
      id: `user-${Date.now()}`,
      name: leagueName.trim(),
      code,
      members: [],
    };
    const withMyTeam = ensureMyTeamMember(nextLeague);
    persistLeagues([withMyTeam, ...leagues]);
    persistJoined([nextLeague.id, ...joinedLeagueIds]);
    persistOwners([nextLeague.id, ...ownerLeagueIds]);
    setLeagueName("");
  };

  const handleJoin = () => {
    const code = joinCode.trim().toUpperCase();
    if (!code) {
      setJoinMessage("Enter a league code to join.");
      return;
    }

    if (user && isConfigured) {
      const joinRemote = async () => {
        const result = await joinLeagueByCode(code, user.id, profile.team_name || "Team");
        if (!result || !result.league) {
          setJoinMessage(
            result?.error || "Invalid league code."
          );
          return;
        }
        const league = result.league;
        const nextLeagues = [
          {
            id: league.id,
            name: league.name,
            code: league.code,
            members: [],
          },
          ...leagues.filter(l => l.id !== league.id),
        ];
        setLeagues(nextLeagues);
        const nextJoined = joinedLeagueIds.includes(league.id)
          ? joinedLeagueIds
          : [league.id, ...joinedLeagueIds];
        setJoinedLeagueIds(nextJoined);
        window.location.href = `/leagues/${league.id}`;
      };
      joinRemote();
      return;
    }

    if (knownCodes.has(code)) {
      const league = leagues.find(l => l.code === code);
      if (league) {
        const updatedLeague = ensureMyTeamMember(league);
        const nextLeagues = leagues.map(l =>
          l.id === league.id ? updatedLeague : l
        );
        persistLeagues(nextLeagues);
        const nextJoined = joinedLeagueIds.includes(league.id)
          ? joinedLeagueIds
          : [league.id, ...joinedLeagueIds];
        persistJoined(nextJoined);
        window.location.href = `/leagues/${league.id}`;
        return;
      }
    }

    setJoinMessage("Invalid league code.");
  };

  const handleLeave = (leagueId: string) => {
    if (user && isConfigured) {
      const leaveRemote = async () => {
        if (ownerLeagueIds.includes(leagueId)) {
          await deleteLeague(leagueId);
          const nextLeagues = leagues.filter(l => l.id !== leagueId);
          setLeagues(nextLeagues);
          setJoinedLeagueIds(
            joinedLeagueIds.filter(id => id !== leagueId)
          );
          setOwnerLeagueIds(
            ownerLeagueIds.filter(id => id !== leagueId)
          );
          return;
        }
        await leaveLeague(leagueId, user.id);
        setJoinedLeagueIds(
          joinedLeagueIds.filter(id => id !== leagueId)
        );
      };
      leaveRemote();
      return;
    }

    const nextJoined = joinedLeagueIds.filter(id => id !== leagueId);
    persistJoined(nextJoined);

    if (leagueId.startsWith("user-")) {
      const nextLeagues = leagues.filter(l => l.id !== leagueId);
      persistLeagues(nextLeagues);
      const nextOwners = ownerLeagueIds.filter(id => id !== leagueId);
      persistOwners(nextOwners);
    }
  };

  const joinedLeagues = leagues.filter(league =>
    joinedLeagueIds.includes(league.id)
  );

  return (
    <div className="min-h-screen bg-[#0B0F1A] text-white px-4 sm:px-6 py-8">
      <div className="max-w-6xl mx-auto space-y-8">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold">Private Leagues</h1>
              {tournament.nextMatch && (
                <p className="text-[11px] text-indigo-300 mt-1">
                  Next Match #{tournament.nextMatch.matchId}{" "}
                  {teamShort(tournament.nextMatch.teams[0])} vs{" "}
                  {teamShort(tournament.nextMatch.teams[1])}
                </p>
              )}
            </div>
            <Link href="/" className="text-sm text-indigo-300 hover:underline">
            Home
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-5 space-y-3">
            <h3 className="text-lg font-semibold">Create League</h3>
            <input
              value={leagueName}
              onChange={event => setLeagueName(event.target.value)}
              placeholder="League name"
              className="w-full rounded-lg bg-slate-900 border border-white/10 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600"
            />
            <button
              onClick={handleCreate}
              className="w-full px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 transition"
            >
              Create League
            </button>
            {createdLeague && (
              <div className="text-xs text-slate-300 border border-white/10 rounded-lg p-3">
                Created <b>{createdLeague.name}</b>. Share code:{" "}
                <b>{createdLeague.code}</b>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-5 space-y-3">
            <h3 className="text-lg font-semibold">Join League</h3>
            <input
              value={joinCode}
              onChange={event => setJoinCode(event.target.value)}
              placeholder="Enter league code"
              className="w-full rounded-lg bg-slate-900 border border-white/10 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600"
            />
            <button
              onClick={handleJoin}
              className="w-full px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 transition"
            >
              Join League
            </button>
            {joinMessage && (
              <div className="text-xs text-slate-300">{joinMessage}</div>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="text-lg font-semibold">Your Leagues</h3>
          {joinedLeagues.length === 0 && (
            <div className="text-xs text-slate-400">
              You have not joined any leagues yet.
            </div>
          )}
          {joinedLeagues.map(league => (
            <div
              key={league.id}
              className="border border-white/10 rounded-xl p-4 hover:border-white/30 transition"
            >
              <div className="flex justify-between items-center">
                <Link href={`/leagues/${league.id}`} className="block">
                  {ownerLeagueIds.includes(league.id) && (
                    <div className="text-xs text-slate-400">
                      Code: {league.code}
                    </div>
                  )}
                  <div className="font-semibold">{league.name}</div>
                </Link>
                <div className="text-right">
                  <div className="text-xs text-slate-400">
                    {(memberCounts[league.id] ?? league.members.length) || 0}{" "}
                    members
                  </div>
                  <button
                    onClick={() => handleLeave(league.id)}
                    className="text-xs text-red-300 hover:underline mt-1"
                  >
                    Leave League
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
