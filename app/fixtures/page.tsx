"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { fixtures, type TournamentPhase } from "@/data/fixtures";
import { teamShort } from "@/utils/teamCodes";
import { teamFlag } from "@/utils/teamFlags";
import { useTournament } from "@/hooks/useTournament";

const phaseLabels: Record<TournamentPhase, string> = {
  PRE_TOURNAMENT: "Pre Tournament",
  GROUP: "Group Stage",
  SUPER_8: "Super 8",
  KNOCKOUT: "Knockout",
};

export default function FixturesPage() {
  const { now } = useTournament();
  const [phaseFilter, setPhaseFilter] = useState<TournamentPhase | "ALL">(
    "ALL"
  );
  const [teamFilter, setTeamFilter] = useState("ALL");
  const [showAll, setShowAll] = useState(false);

  const teams = useMemo(() => {
    const set = new Set<string>();
    fixtures.forEach(match => {
      set.add(match.teams[0]);
      set.add(match.teams[1]);
    });
    return ["ALL", ...Array.from(set).sort()];
  }, []);

  const sorted = useMemo(() => {
    return [...fixtures].sort(
      (a, b) =>
        new Date(a.startTimeUTC).getTime() -
        new Date(b.startTimeUTC).getTime()
    );
  }, []);

  const filtered = useMemo(() => {
    return sorted.filter(match => {
      if (!showAll && new Date(match.startTimeUTC).getTime() < now) {
        return false;
      }
      if (phaseFilter !== "ALL" && match.phase !== phaseFilter) {
        return false;
      }
      if (
        teamFilter !== "ALL" &&
        !match.teams.includes(teamFilter)
      ) {
        return false;
      }
      return true;
    });
  }, [sorted, phaseFilter, teamFilter, showAll, now]);

  return (
    <div className="min-h-screen bg-[#0B0F1A] text-white p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Fixtures</h1>
            <p className="text-xs text-slate-400 mt-1">
              Upcoming matches in your local time.
            </p>
          </div>
          <Link href="/" className="text-sm text-indigo-300 hover:underline">
            Home
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
          <label className="space-y-1">
            <span className="text-slate-400">Phase</span>
            <select
              value={phaseFilter}
              onChange={event =>
                setPhaseFilter(event.target.value as TournamentPhase | "ALL")
              }
              className="w-full rounded-lg bg-slate-900 border border-white/10 px-3 py-2"
            >
              <option value="ALL">All Phases</option>
              {Object.entries(phaseLabels).map(([phase, label]) => (
                <option key={phase} value={phase}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-slate-400">Team</span>
            <select
              value={teamFilter}
              onChange={event => setTeamFilter(event.target.value)}
              className="w-full rounded-lg bg-slate-900 border border-white/10 px-3 py-2"
            >
              {teams.map(team => (
                <option key={team} value={team}>
                  {team}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-slate-400">Scope</span>
            <button
              type="button"
              onClick={() => setShowAll(prev => !prev)}
              className="w-full rounded-lg border border-white/10 px-3 py-2 text-slate-200 hover:border-white/30"
            >
              {showAll ? "Showing All" : "Showing Upcoming"}
            </button>
          </label>
          <label className="space-y-1">
            <span className="text-slate-400">Quick</span>
            <button
              type="button"
              onClick={() => {
                setPhaseFilter("ALL");
                setTeamFilter("ALL");
                setShowAll(false);
              }}
              className="w-full rounded-lg border border-white/10 px-3 py-2 text-slate-200 hover:border-white/30"
            >
              Clear Filters
            </button>
          </label>
        </div>

        <div className="space-y-3">
          {filtered.length === 0 && (
            <div className="text-sm text-slate-400 border border-white/10 rounded-xl p-4">
              No matches found for your filters.
            </div>
          )}
          {filtered.map(match => {
            const localTime = new Date(match.startTimeUTC).toLocaleString([], {
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            });
            return (
              <div
                key={match.matchId}
                className="border border-white/10 rounded-xl p-4 bg-slate-900/70"
              >
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div>
                    <div className="text-xs text-slate-400">
                      Match #{match.matchId} · {phaseLabels[match.phase]}
                      {match.group ? ` · Group ${match.group}` : ""}
                    </div>
                    <div className="text-lg font-semibold mt-1">
                      <span className="mr-2">{teamFlag(match.teams[0])}</span>
                      {teamShort(match.teams[0])} vs{" "}
                      {teamShort(match.teams[1])}
                      <span className="ml-2">{teamFlag(match.teams[1])}</span>
                    </div>
                    <div className="text-xs text-slate-400 mt-1">
                      {match.teams[0]} vs {match.teams[1]}
                    </div>
                    <div className="text-xs text-slate-400 mt-1">
                      Venue: {match.venue}
                    </div>
                  </div>
                  <div className="text-right text-sm">
                    <div className="text-xs text-slate-400">Local Time</div>
                    <div className="font-semibold whitespace-nowrap">
                      {localTime}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      UTC: {match.startTimeUTC}
                    </div>
                    <Link
                      href={`/match-center/${match.matchId}`}
                      className="mt-2 inline-block text-xs text-indigo-300 hover:underline"
                    >
                      Open Match Center
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
