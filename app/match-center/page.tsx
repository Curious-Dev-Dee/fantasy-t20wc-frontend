"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { fixtures } from "@/data/fixtures";
import { teamShort } from "@/utils/teamCodes";
import { teamFlag } from "@/utils/teamFlags";
import { useMatchStats } from "@/hooks/useMatchStats";

export default function MatchCenterIndexPage() {
  const [search, setSearch] = useState("");
  const { stats, isRemote } = useMatchStats();

  const matchHasStats = useMemo(() => {
    const ids = new Set<number>();
    stats.forEach(entry => {
      entry.matches.forEach(match => {
        ids.add(match.matchId);
      });
    });
    return ids;
  }, [stats]);

  const sorted = useMemo(() => {
    return [...fixtures].sort((a, b) => {
      const aLive = matchHasStats.has(a.matchId);
      const bLive = matchHasStats.has(b.matchId);
      if (aLive !== bLive) return aLive ? -1 : 1;
      return (
        new Date(b.startTimeUTC).getTime() -
        new Date(a.startTimeUTC).getTime()
      );
    });
  }, [matchHasStats]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return sorted;
    return sorted.filter(match => {
      const hay = `${match.matchId} ${match.teams[0]} ${match.teams[1]} ${match.venue}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [sorted, search]);

  const matchEntryCounts = useMemo(() => {
    const counts = new Map<number, number>();
    stats.forEach(entry => {
      entry.matches.forEach(match => {
        counts.set(match.matchId, (counts.get(match.matchId) || 0) + 1);
      });
    });
    return counts;
  }, [stats]);

  return (
    <div className="min-h-screen bg-[#0B0F1A] text-white px-4 sm:px-6 py-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Match Center</h1>
            <p className="text-xs text-slate-400 mt-1">
              Select a fixture to enter or review stats.
            </p>
            <p className="text-[10px] text-slate-500 mt-1">
              Data source: {isRemote ? "Supabase (live)" : "Local (device)"} ·
              Live/finished matches shown first
            </p>
          </div>
          <Link href="/" className="text-sm text-indigo-300 hover:underline">
            Home
          </Link>
        </div>

        <input
          value={search}
          onChange={event => setSearch(event.target.value)}
          placeholder="Search match, team, or venue"
          className="w-full rounded-lg bg-slate-900 border border-white/10 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600"
        />

        <div className="space-y-3">
          {filtered.map(match => (
            <Link
              key={match.matchId}
              href={`/match-center/${match.matchId}`}
              className="block border border-white/10 rounded-xl p-4 hover:border-white/30 transition"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-slate-400">
                    Match #{match.matchId}
                  </div>
                  <div className="font-semibold">
                    {teamFlag(match.teams[0])} {teamShort(match.teams[0])} vs{" "}
                    {teamShort(match.teams[1])} {teamFlag(match.teams[1])}
                  </div>
                  <div className="text-xs text-slate-400 mt-1 whitespace-nowrap">
                    {new Date(match.startTimeUTC).toLocaleString([], {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1">
                    Entries: {matchEntryCounts.get(match.matchId) || 0}
                  </div>
                </div>
                <div className="text-xs text-indigo-300">Open</div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
