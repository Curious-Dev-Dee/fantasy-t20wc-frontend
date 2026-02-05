"use client";

import Link from "next/link";
import { useMemo, useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { players } from "@/data/players";
import { fixtures } from "@/data/fixtures";
import type { MatchStats, PlayerMatchStats } from "@/data/matchStats";
import { useMatchStats } from "@/hooks/useMatchStats";
import { useTeam } from "@/hooks/useTeam";
import { teamShort, normalizeTeamName } from "@/utils/teamCodes";
import { teamFlag } from "@/utils/teamFlags";
import { scoreMatchBase, scoreLockedMatch } from "@/utils/scoring";
import {
  findCricketDataMatchId,
  mapCricketDataScorecard,
  mergeMatchStats,
} from "@/utils/cricketdataMapper";

export default function MatchCenterPage() {
  const params = useParams<{ matchId: string }>();
  const matchId = Number(params.matchId);
  const fixture = fixtures.find(match => match.matchId === matchId);
  const { stats, setStats, isRemote } = useMatchStats();
  const team = useTeam();
  const statsRef = useRef(stats);
  const [liveMessage, setLiveMessage] = useState<string | null>(null);
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const matchEntries = useMemo(() => {
    const rows: {
      key: string;
      playerId: string;
      runs: number;
      wickets: number;
    }[] = [];
    stats.forEach(entry => {
      entry.matches.forEach(match => {
        if (match.matchId !== matchId) return;
        rows.push({
          key: `${entry.playerId}-${match.matchId}`,
          playerId: entry.playerId,
          runs: match.batting?.runs ?? 0,
          wickets: match.bowling?.wickets ?? 0,
        });
      });
    });
    return rows;
  }, [stats, matchId]);

  const playerMap = useMemo(
    () => new Map(players.map(player => [player.id, player])),
    []
  );

  const teamTotals = useMemo(() => {
    if (!fixture) {
      return {
        teamA: { runs: 0, wickets: 0 },
        teamB: { runs: 0, wickets: 0 },
      };
    }
    const teamA = normalizeTeamName(fixture.teams[0]);
    const teamB = normalizeTeamName(fixture.teams[1]);
    const totals = {
      teamA: { runs: 0, wickets: 0 },
      teamB: { runs: 0, wickets: 0 },
    };
    stats.forEach(entry => {
      const player = playerMap.get(entry.playerId);
      if (!player) return;
      const bucket =
        player.country === teamA
          ? totals.teamA
          : player.country === teamB
          ? totals.teamB
          : null;
      if (!bucket) return;
      entry.matches.forEach(match => {
        if (match.matchId !== matchId) return;
        bucket.runs += match.batting?.runs ?? 0;
        bucket.wickets += match.bowling?.wickets ?? 0;
      });
    });
    return totals;
  }, [stats, matchId, fixture, playerMap]);

  const matchMvp = useMemo((): { name: string; points: number; country: string } | null => {
    let bestId: string | null = null;
    let bestPoints = -1;
    stats.forEach(entry => {
      const player = playerMap.get(entry.playerId);
      if (!player) return;
      entry.matches.forEach(match => {
        if (match.matchId !== matchId) return;
        const base = scoreMatchBase(match, player.role);
        const motmBonus = match.manOfTheMatch ? 50 : 0;
        const points = base + motmBonus;
        if (points > bestPoints) {
          bestPoints = points;
          bestId = entry.playerId;
        }
      });
    });
    if (!bestId) return null;
    const player = playerMap.get(bestId);
    return {
      name: player?.name || bestId,
      points: bestPoints,
      country: player?.country || "",
    };
  }, [stats, matchId, playerMap]);

  const matchSummary = useMemo(() => {
    let totalRuns = 0;
    let totalWickets = 0;
    let totalFours = 0;
    let totalSixes = 0;
    let totalCatches = 0;
    let totalStumpings = 0;
    let totalRunOuts = 0;
    let inXI = 0;
    stats.forEach(entry => {
      entry.matches.forEach(match => {
        if (match.matchId !== matchId) return;
        if (match.inPlayingXI) inXI += 1;
        totalRuns += match.batting?.runs ?? 0;
        totalWickets += match.bowling?.wickets ?? 0;
        totalFours += match.batting?.fours ?? 0;
        totalSixes += match.batting?.sixes ?? 0;
        totalCatches += match.fielding?.catches ?? 0;
        totalStumpings += match.fielding?.stumpings ?? 0;
        totalRunOuts +=
          (match.fielding?.runOutDirect ?? 0) +
          (match.fielding?.runOutIndirect ?? 0);
      });
    });
    return {
      totalRuns,
      totalWickets,
      totalFours,
      totalSixes,
      totalCatches,
      totalStumpings,
      totalRunOuts,
      inXI,
    };
  }, [stats, matchId]);

  const myTeamSummary = useMemo(() => {
    const locked = team.lockedTeams.find(entry => entry.matchId === matchId);
    const myPlayers = new Set(
      locked ? locked.players : team.workingTeam.players
    );
    let totalPoints = 0;
    let totalRuns = 0;
    let totalWickets = 0;
    let totalCatches = 0;
    let totalStumpings = 0;
    let totalRunOuts = 0;
    let playing = 0;

    stats.forEach(entry => {
      if (!myPlayers.has(entry.playerId)) return;
      const player = playerMap.get(entry.playerId);
      if (!player) return;
      entry.matches.forEach(match => {
        if (match.matchId !== matchId) return;
        if (match.inPlayingXI) playing += 1;
        totalRuns += match.batting?.runs ?? 0;
        totalWickets += match.bowling?.wickets ?? 0;
        totalCatches += match.fielding?.catches ?? 0;
        totalStumpings += match.fielding?.stumpings ?? 0;
        totalRunOuts +=
          (match.fielding?.runOutDirect ?? 0) +
          (match.fielding?.runOutIndirect ?? 0);
        totalPoints += scoreMatchBase(match, player.role);
      });
    });

    if (locked) {
      const statsMap = new Map(stats.map(stat => [stat.playerId, stat.matches]));
      totalPoints = scoreLockedMatch({
        locked,
        playerRoleMap: playerMap,
        statsMap,
      });
    }

    return {
      playing,
      totalPoints,
      totalRuns,
      totalWickets,
      totalCatches,
      totalStumpings,
      totalRunOuts,
    };
  }, [
    stats,
    matchId,
    team.workingTeam.players,
    playerMap,
    team.lockedTeams,
  ]);

  useEffect(() => {
    statsRef.current = stats;
  }, [stats]);

  const syncLive = async () => {
    if (!fixture || isSyncing) return;
    setIsSyncing(true);
    setLiveMessage(null);
    try {
      const currentRes = await fetch("/api/cricketdata/current");
      const currentJson = await currentRes.json();
      if (!currentJson.ok) {
        throw new Error(currentJson.error || "Failed to load live matches.");
      }
      const matchUuid = findCricketDataMatchId(currentJson.payload, [
        fixture.teams[0],
        fixture.teams[1],
      ]);
      if (!matchUuid) {
        setLiveMessage("No live match found for this fixture yet.");
        return;
      }
      const scoreRes = await fetch(
        `/api/cricketdata/scorecard?id=${matchUuid}`
      );
      const scoreJson = await scoreRes.json();
      if (!scoreJson.ok) {
        throw new Error(scoreJson.error || "Failed to load scorecard.");
      }
      const mapped = mapCricketDataScorecard(scoreJson.payload, matchId);
      if (mapped.length === 0) {
        setLiveMessage("Live score loaded, but no players matched yet.");
        return;
      }
      setStats(mergeMatchStats(statsRef.current, mapped, matchId));
      setLastSyncAt(new Date());
      setLiveMessage(`Synced live stats (${matchUuid.slice(0, 8)}).`);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Live sync failed.";
      setLiveMessage(message);
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    if (!fixture) return;
    syncLive();
    const interval = setInterval(syncLive, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fixture]);

  if (!fixture) {
    return (
      <div className="min-h-screen bg-[#0B0F1A] text-white p-6">
      <div className="max-w-3xl mx-auto space-y-4">
          <h1 className="text-2xl font-semibold">Match not found</h1>
          <Link href="/match-center" className="text-indigo-300 hover:underline">
            Back to Match Center
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B0F1A] text-white px-4 sm:px-6 py-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Match Center</h1>
            <div className="text-xs text-slate-400 mt-1">
              Match #{fixture.matchId} - {fixture.venue}
            </div>
            <div className="text-lg font-semibold mt-2">
              {teamFlag(fixture.teams[0])} {teamShort(fixture.teams[0])} vs{" "}
              {teamShort(fixture.teams[1])} {teamFlag(fixture.teams[1])}
            </div>
            <div className="text-xs text-slate-400 mt-1">
              {new Date(fixture.startTimeUTC).toLocaleString([], {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </div>
            <div className="text-[10px] text-slate-500 mt-1">
              Data source: {isRemote ? "Supabase (live)" : "Local (device)"}
            </div>
          </div>
          <div className="flex gap-4 text-sm">
            <Link
              href="/match-center"
              className="text-indigo-300 hover:underline"
            >
              Back to Match Center
            </Link>
            <Link href="/" className="text-indigo-300 hover:underline">
              Home
            </Link>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="text-slate-400">
              Live updates every 5 minutes
              {lastSyncAt
                ? ` · Last sync ${lastSyncAt.toLocaleTimeString()}`
                : ""}
            </div>
            <button
              onClick={syncLive}
              disabled={isSyncing}
              className="rounded bg-indigo-600 px-3 py-1 text-xs disabled:opacity-60"
            >
              {isSyncing ? "Syncing..." : "Sync Live"}
            </button>
          </div>
          {liveMessage && (
            <div className="text-[11px] text-slate-400">{liveMessage}</div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <SummaryCard
              label={`${teamShort(fixture.teams[0])} Runs / Wkts`}
              value={`${teamTotals.teamA.runs} / ${teamTotals.teamA.wickets}`}
            />
            <SummaryCard
              label={`${teamShort(fixture.teams[1])} Runs / Wkts`}
              value={`${teamTotals.teamB.runs} / ${teamTotals.teamB.wickets}`}
            />
            <SummaryCard
              label="MVP (Top Points)"
              value={
                matchMvp
                  ? `${matchMvp.name} (${matchMvp.points})`
                  : "TBD"
              }
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <SummaryCard label="In XI" value={String(matchSummary.inXI)} />
            <SummaryCard label="Runs" value={String(matchSummary.totalRuns)} />
            <SummaryCard
              label="Wickets"
              value={String(matchSummary.totalWickets)}
            />
            <SummaryCard label="Fours" value={String(matchSummary.totalFours)} />
            <SummaryCard label="Sixes" value={String(matchSummary.totalSixes)} />
            <SummaryCard
              label="Catches"
              value={String(matchSummary.totalCatches)}
            />
            <SummaryCard
              label="Stumpings"
              value={String(matchSummary.totalStumpings)}
            />
            <SummaryCard
              label="Run Outs"
              value={String(matchSummary.totalRunOuts)}
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <SummaryCard label="My Players" value={String(team.teamSize)} />
            <SummaryCard label="My XI Playing" value={String(myTeamSummary.playing)} />
            <SummaryCard label="My Points" value={String(myTeamSummary.totalPoints)} />
            <SummaryCard label="My Runs" value={String(myTeamSummary.totalRuns)} />
            <SummaryCard label="My Wickets" value={String(myTeamSummary.totalWickets)} />
            <SummaryCard label="My Catches" value={String(myTeamSummary.totalCatches)} />
            <SummaryCard label="My Stumpings" value={String(myTeamSummary.totalStumpings)} />
            <SummaryCard label="My Run Outs" value={String(myTeamSummary.totalRunOuts)} />
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-5 space-y-3">
          <h2 className="text-lg font-semibold">Match Entries</h2>
          {matchEntries.length === 0 && (
            <div className="text-xs text-slate-400">
              No stats saved for this match yet.
            </div>
          )}
          {matchEntries.map(entry => {
            const player = players.find(p => p.id === entry.playerId);
            return (
              <div
                key={entry.key}
                className="border border-white/10 rounded-lg p-3 text-xs"
              >
                <div className="text-slate-300 font-medium">
                  {player?.name || entry.playerId}
                </div>
                <div className="text-slate-400">
                  Runs: {entry.runs} - Wickets: {entry.wickets}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
      <div className="text-[10px] text-slate-400">{label}</div>
      <div className="text-sm font-semibold text-white whitespace-nowrap leading-tight">
        {value}
      </div>
    </div>
  );
}
