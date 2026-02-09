"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { fixtures } from "@/data/fixtures";
import { useAuth } from "@/hooks/useAuth";
import { useTournament } from "@/hooks/useTournament";
import { isAdminEmail } from "@/utils/admin";
import { teamShort } from "@/utils/teamCodes";
import { fetchAllLockHistory, type LockedHistoryRow } from "@/utils/lockHistoryPersistence";

const MATCH_DURATION_MS = 3.5 * 60 * 60 * 1000;

export default function AdminOpsPage() {
  const { now } = useTournament();
  const { user, ready } = useAuth();
  const [selectedMatchId, setSelectedMatchId] = useState<number>(
    fixtures[0]?.matchId ?? 1
  );
  const [lockedHistory, setLockedHistory] = useState<LockedHistoryRow[]>([]);
  const [lockedLoaded, setLockedLoaded] = useState(false);

  const fixturesById = useMemo(
    () => new Map(fixtures.map(fixture => [fixture.matchId, fixture])),
    []
  );

  const sortedFixtures = useMemo(() => {
    return [...fixtures].sort(
      (a, b) => new Date(a.startTimeUTC).getTime() - new Date(b.startTimeUTC).getTime()
    );
  }, []);

  const matchStatus = (startTimeUTC: string) => {
    const start = new Date(startTimeUTC).getTime();
    if (now < start) return "UPCOMING";
    if (now >= start && now < start + MATCH_DURATION_MS) return "LIVE";
    return "COMPLETED";
  };

  const fixture = fixturesById.get(selectedMatchId);
  const teamA = fixture?.teams?.[0];
  const teamB = fixture?.teams?.[1];

  const handleLoadLocks = async () => {
    if (lockedLoaded) return;
    const rows = await fetchAllLockHistory();
    setLockedHistory(rows);
    setLockedLoaded(true);
  };

  const matchLocks = lockedHistory
    .filter(row => row.match_id === selectedMatchId)
    .sort((a, b) => (a.locked_at || "").localeCompare(b.locked_at || ""));

  if (!ready) {
    return (
      <div className="min-h-screen bg-[#0B0F1A] text-white p-6">
        <div className="max-w-5xl mx-auto text-sm text-slate-400">
          Loading...
        </div>
      </div>
    );
  }

  if (!user || !isAdminEmail(user.email)) {
    return (
      <div className="min-h-screen bg-[#0B0F1A] text-white p-6">
        <div className="max-w-3xl mx-auto space-y-3">
          <h1 className="text-2xl font-semibold">Admin only</h1>
          <p className="text-sm text-slate-400">
            You do not have permission to view this page.
          </p>
          <Link href="/" className="text-sm text-indigo-300 hover:underline">
            Go Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B0F1A] text-white px-4 sm:px-6 py-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Admin Match Monitor</h1>
            <p className="text-sm text-slate-400">
              Live status, playing XI, points, and lock history.
            </p>
          </div>
          <div className="flex gap-4 text-sm">
            <Link href="/admin/match-stats" className="text-indigo-300 hover:underline">
              Player Points
            </Link>
            <Link href="/" className="text-indigo-300 hover:underline">
              Home
            </Link>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
          <div className="text-sm text-slate-300">Matches</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {sortedFixtures.map(match => {
              const status = matchStatus(match.startTimeUTC);
              const isActive = match.matchId === selectedMatchId;
              return (
                <button
                  key={match.matchId}
                  onClick={() => setSelectedMatchId(match.matchId)}
                  className={`rounded-xl border px-3 py-2 text-left transition ${
                    isActive
                      ? "border-indigo-400/60 bg-indigo-500/10"
                      : "border-white/10 hover:border-white/30"
                  }`}
                >
                  <div className="text-xs text-slate-400">
                    #{match.matchId} {match.group ? `Group ${match.group}` : match.phase}
                  </div>
                  <div className="font-medium">
                    {teamShort(match.teams[0])} vs {teamShort(match.teams[1])}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {new Date(match.startTimeUTC).toLocaleString([], {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </div>
                  <div
                    className={`text-[11px] mt-1 inline-flex px-2 py-0.5 rounded-full border ${
                      status === "LIVE"
                        ? "border-emerald-400/50 text-emerald-200 bg-emerald-500/10"
                        : status === "COMPLETED"
                        ? "border-slate-400/40 text-slate-300 bg-white/5"
                        : "border-indigo-400/40 text-indigo-200 bg-indigo-500/10"
                    }`}
                  >
                    {status}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-sm text-slate-300">
                  Lock history for Match #{selectedMatchId}
                </div>
                <button
                  onClick={handleLoadLocks}
                  className="text-xs text-indigo-300 hover:underline"
                >
                  {lockedLoaded ? "Loaded" : "Load"}
                </button>
              </div>
              {!lockedLoaded ? (
                <div className="text-xs text-slate-500">
                  Load to view locked team timestamps.
                </div>
              ) : matchLocks.length === 0 ? (
                <div className="text-xs text-slate-500">No locks found.</div>
              ) : (
                <div className="space-y-2">
                  {matchLocks.map(row => (
                    <div
                      key={`${row.user_id}-${row.match_id}-${row.locked_at}`}
                      className="flex items-center justify-between rounded-lg border border-white/10 px-3 py-2 text-xs"
                    >
                      <div className="text-slate-300">{row.user_id}</div>
                      <div className="text-slate-400">
                        {row.locked_at
                          ? new Date(row.locked_at).toLocaleString()
                          : "n/a"}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
              <div className="text-sm text-slate-300">Match Summary</div>
              <div className="text-xs text-slate-400">
                {teamA} vs {teamB}
              </div>
              <div className="text-xs text-slate-500">
                Use the Player Points page to paste scores and update users.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
