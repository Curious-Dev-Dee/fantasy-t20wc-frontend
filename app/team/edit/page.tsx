"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { players } from "@/data/players";
import { useTeam } from "@/hooks/useTeam";
import { useTournament } from "@/hooks/useTournament";
import { normalizeTeamName, teamShort } from "@/utils/teamCodes";
import { getJSON, scopedKey } from "@/utils/storage";
import { useAuth } from "@/hooks/useAuth";

type TeamSnapshot = {
  players: string[];
  captainId: string | null;
  viceCaptainId: string | null;
};

const EMPTY_SNAPSHOT: TeamSnapshot = {
  players: [],
  captainId: null,
  viceCaptainId: null,
};

function loadSnapshot(userId?: string | null): TeamSnapshot {
  const key = scopedKey("fantasy_working_team", userId);
  const parsed = getJSON<TeamSnapshot | null>(key, null);
  if (!parsed) return EMPTY_SNAPSHOT;
  return {
    players: Array.isArray(parsed.players) ? parsed.players : [],
    captainId: parsed.captainId ?? null,
    viceCaptainId: parsed.viceCaptainId ?? null,
  };
}

function formatCountdown(ms: number) {
  if (ms <= 0) return "Locked";
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

function formatLocalTime(value: string | number | null) {
  if (!value) return "TBD";
  const date = typeof value === "string" ? new Date(value) : new Date(value);
  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function EditTeamPage() {
  const team = useTeam();
  const tournament = useTournament();
  const { user } = useAuth();
  const [mounted, setMounted] = useState(false);

  const [savedSnapshot, setSavedSnapshot] = useState<TeamSnapshot>(
    EMPTY_SNAPSHOT
  );
  const [showPreview, setShowPreview] = useState(false);
  const [recentId, setRecentId] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [showLockTip, setShowLockTip] = useState(false);
  const [showAutoLockToast, setShowAutoLockToast] = useState(false);
  const lockTipRef = useRef<HTMLButtonElement | null>(null);

  const [roleFilter, setRoleFilter] = useState("ALL");
  const [countryFilter, setCountryFilter] = useState<string[]>([]);
  const [pointsFilter, setPointsFilter] = useState("ALL");
  const [matchFilter, setMatchFilter] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<"selected" | "available">(
    "selected"
  );

  useEffect(() => {
    setSavedSnapshot(loadSnapshot(user?.id));
  }, [user?.id]);

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!tournament.nextMatch) return;
    const notice = localStorage.getItem(scopedKey("fantasy_lock_notice", user?.id));
    if (!notice) return;
    if (notice !== String(tournament.nextMatch.matchId)) return;
    const matchTime = new Date(tournament.nextMatch.startTimeUTC).getTime();
    if (now < matchTime) return;
    setShowAutoLockToast(true);
    localStorage.removeItem(scopedKey("fantasy_lock_notice", user?.id));
    const timeout = setTimeout(() => setShowAutoLockToast(false), 1500);
    return () => clearTimeout(timeout);
  }, [tournament.nextMatch, now]);

  useEffect(() => {
    if (!showLockTip) return;
    const timeout = setTimeout(() => setShowLockTip(false), 1000);
    return () => clearTimeout(timeout);
  }, [showLockTip]);

  const toggleMatchFilter = (id: string) => {
    setMatchFilter(prev => {
      if (prev.includes(id)) return prev.filter(v => v !== id);
      return [...prev, id];
    });
  };

  const toggleCountryFilter = (country: string) => {
    setCountryFilter(prev => {
      if (prev.includes(country)) return prev.filter(v => v !== country);
      return [...prev, country];
    });
  };

  const clearMatchFilter = () => setMatchFilter([]);
  const clearCountryFilter = () => setCountryFilter([]);

  useEffect(() => {
    if (!showLockTip) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (!lockTipRef.current) return;
      if (lockTipRef.current.contains(event.target as Node)) return;
      setShowLockTip(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [showLockTip]);

  const playerMap = useMemo(() => {
    return new Map(players.map(player => [player.id, player]));
  }, []);

  const countries = useMemo(() => {
    const unique = new Set(players.map(player => player.country));
    return ["ALL", ...Array.from(unique).sort()];
  }, []);

  const matchFilterTeams = useMemo(() => {
    if (!matchFilter.length) return null;
    const selected = new Set(matchFilter);
    const teams =
      tournament.nextMatches
        ?.filter(m => selected.has(String(m.matchId)))
        .flatMap(m => m.teams.map(normalizeTeamName)) ?? [];
    return teams.length ? teams : null;
  }, [matchFilter, tournament.nextMatches]);

  const filteredPlayers = useMemo(() => {
    return players.filter(player => {
      if (roleFilter !== "ALL" && player.role !== roleFilter) return false;
      if (countryFilter.length > 0 && !countryFilter.includes(player.country))
        return false;
      if (matchFilterTeams && !matchFilterTeams.includes(player.country))
        return false;
      if (pointsFilter === "STAR") return player.isStar;
      if (pointsFilter !== "ALL") {
        const target = Number(pointsFilter);
        if (!Number.isFinite(target)) return true;
        const matchesExact = Math.abs(player.credit - target) < 0.01;
        if (!matchesExact) return false;
      }
      if (searchTerm.trim().length > 0) {
        const needle = searchTerm.trim().toLowerCase();
        if (!player.name.toLowerCase().includes(needle)) return false;
      }
      return true;
    });
  }, [roleFilter, countryFilter, pointsFilter, matchFilterTeams, searchTerm]);

  const savedSet = useMemo(
    () => new Set(savedSnapshot.players),
    [savedSnapshot.players]
  );

  const currentSet = useMemo(
    () => new Set(team.workingTeam.players),
    [team.workingTeam.players]
  );

  const playersOut = [...savedSet]
    .filter(id => !currentSet.has(id))
    .map(id => playerMap.get(id))
    .filter(Boolean);

  const playersIn = [...currentSet]
    .filter(id => !savedSet.has(id))
    .map(id => playerMap.get(id))
    .filter(Boolean);

  const subsUsed = Math.max(playersOut.length, playersIn.length);
  const subsLeftAfter = Number.isFinite(team.subsLeft)
    ? Math.max(team.subsLeft - subsUsed, 0)
    : Infinity;

  const subsLeftAfterLabel = Number.isFinite(subsLeftAfter)
    ? String(subsLeftAfter)
    : "Unlimited";

  const highlight = (id: string) => {
    setRecentId(id);
    setTimeout(() => setRecentId(null), 300);
  };

  const handleSave = () => {
    if (team.isEditLocked) {
      alert("Team is locked for 10 minutes from match start.");
      return;
    }
    if (!team.workingTeam.captainId || !team.workingTeam.viceCaptainId) {
      alert("Please choose a captain and vice-captain before saving.");
      return;
    }

    if (team.workingTeam.captainId === team.workingTeam.viceCaptainId) {
      alert("Captain and vice-captain must be different.");
      return;
    }

    if (!team.isValidTeam) {
      alert("Team rules are not met. Please fix the warnings above.");
      return;
    }

    setShowPreview(true);
  };

  const confirmSave = () => {
    if (team.isEditLocked) {
      alert("Team is locked for 10 minutes from match start.");
      setShowPreview(false);
      return;
    }
    team.saveTeam();
    setSavedSnapshot({
      players: [...team.workingTeam.players],
      captainId: team.workingTeam.captainId,
      viceCaptainId: team.workingTeam.viceCaptainId,
    });
    setShowPreview(false);
    alert("Team saved.");
  };

  const nextMatchLabel = tournament.nextMatch
    ? `#${tournament.nextMatch.matchId} ${teamShort(
        tournament.nextMatch.teams[0]
      )} vs ${teamShort(tournament.nextMatch.teams[1])}`
    : "TBD";

  const nextMatchStart = tournament.nextMatch
    ? new Date(tournament.nextMatch.startTimeUTC).getTime()
    : null;
  const isLockWindow = Boolean(tournament.lockWindowMatch);
  const lockEndsAt = tournament.lockWindowEndsAt;

  const countdown = nextMatchStart
    ? formatCountdown(nextMatchStart - now)
    : "TBD";

  const lockBadgeLabel = tournament.lockWindowMatch
    ? `Locked for Match #${tournament.lockWindowMatch.matchId}`
    : null;

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="min-h-screen bg-[#0B0F1A] text-white px-4 sm:px-6 py-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Edit Team</h1>
            <p className="text-[11px] text-indigo-300 mt-1">
              Next Match: {nextMatchLabel} - Lock at{" "}
              {formatLocalTime(tournament.nextMatch?.startTimeUTC ?? null)} -{" "}
              {isLockWindow
                ? `Locked until ${formatLocalTime(lockEndsAt)}`
                : mounted
                ? `Lock in ${countdown}`
                : "Lock in --:--:--"}
            </p>
            {lockBadgeLabel && (
              <span className="inline-block mt-2 text-xs px-2.5 py-1 rounded-full bg-red-500/25 text-red-100 border border-red-400/50 shadow-[0_0_10px_rgba(248,113,113,0.15)]">
                {lockBadgeLabel}
                <button
                  type="button"
                  onClick={() => setShowLockTip(prev => !prev)}
                  ref={lockTipRef}
                className="relative group ml-2 text-red-100"
                >
                  i
                  <span
                    className={`absolute left-1/2 -translate-x-1/2 top-full mt-2 w-60 rounded-lg border border-white/10 bg-[#0F1626] px-3 py-2 text-[10px] text-slate-200 opacity-0 pointer-events-none transition group-hover:opacity-100 ${
                      showLockTip ? "opacity-100" : ""
                    }`}
                  >
                    Edits are paused for 10 minutes from match start.
                  </span>
                </button>
              </span>
            )}
          </div>
          <div className="flex gap-4 text-[11px]">
            <Link href="/" className="text-indigo-300 hover:underline">
              Home
            </Link>
            <Link
              href="/team"
              className="text-indigo-300 hover:underline"
            >
              View Team
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <SummaryCard
            label="Budget"
            value={`${team.totalBudget} / ${team.limits.MAX_BUDGET}`}
            compact
          />
          <SummaryCard
            label="Stars"
            value={`${team.starCount} / ${team.limits.MAX_STAR_PLAYERS}`}
            compact
          />
          <SummaryCard
            label="Subs Left"
            value={team.subsLeftLabel}
            compact
          />
          <SummaryCard
            label="Roles"
            value={`WK ${team.roleCounts.WK} | BAT ${team.roleCounts.BAT} | AR ${team.roleCounts.AR} | BOWL ${team.roleCounts.BOWL}`}
            compact
          />
        </div>

        <div className="text-[11px] text-slate-300">
          Captain: {team.workingTeam.captainId ? playerMap.get(team.workingTeam.captainId)?.name : "Not set"} | Vice Captain: {team.workingTeam.viceCaptainId ? playerMap.get(team.workingTeam.viceCaptainId)?.name : "Not set"}
        </div>

        <div className="space-y-2">
          {team.teamSize > team.limits.MAX_PLAYERS && (
            <Warning msg="Maximum 11 players allowed." />
          )}
          {team.totalBudget > team.limits.MAX_BUDGET && (
            <Warning msg="Budget cap exceeded." />
          )}
          {team.starCount > team.limits.MAX_STAR_PLAYERS && (
            <Warning msg="Maximum 4 star players allowed." />
          )}
          {team.overCountryLimit && (
            <Warning msg={`Max 6 players from ${team.overCountryLimit[0]}.`} />
          )}
          {team.missingRoles.length > 0 && (
            <Warning
              msg={`Role requirements missing: ${team.missingRoles
                .map(([role, min]) => {
                  const current = team.roleCounts[role as keyof typeof team.roleCounts];
                  return `${role} need ${min - current}`;
                })
                .join(", ")}`}
            />
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="flex items-center gap-2 lg:hidden">
            <button
              onClick={() => setActiveTab("selected")}
              className={`px-3 py-1 rounded-full text-[11px] ${
                activeTab === "selected"
                  ? "bg-indigo-600 text-white"
                  : "bg-white/10 text-slate-300"
              }`}
            >
              Selected
            </button>
            <button
              onClick={() => setActiveTab("available")}
              className={`px-3 py-1 rounded-full text-[11px] ${
                activeTab === "available"
                  ? "bg-indigo-600 text-white"
                  : "bg-white/10 text-slate-300"
              }`}
            >
              Available
            </button>
          </div>

          <div
            key={`selected-${team.workingTeam.players.join(",")}`}
            className={`space-y-3 ${
              activeTab === "selected" ? "block" : "hidden"
            } lg:block`}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">My Team</h2>
              <button
                onClick={handleSave}
                disabled={team.isEditLocked}
                className="px-4 py-2 bg-blue-600 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:grayscale"
              >
                {team.isEditLocked ? "Locked" : "Save Team"}
              </button>
            </div>

            {team.selectedPlayers.length === 0 && (
              <div className="text-sm text-slate-400 border border-white/10 rounded-xl p-4">
                No players selected yet.
              </div>
            )}

            {team.selectedPlayers.map(player => {
              const isCaptain = team.workingTeam.captainId === player!.id;
              const isViceCaptain = team.workingTeam.viceCaptainId === player!.id;

              return (
                <div
                  key={player!.id}
                  className={`border border-white/10 rounded-xl p-4 flex justify-between items-start gap-4 transition-all duration-200 ${
                    recentId === player!.id ? "ring-2 ring-indigo-400/70" : ""
                  }`}
                >
                  <div className="flex gap-3">
                    <div className="h-11 w-11 rounded-full bg-emerald-500/10 border border-emerald-400/40 overflow-hidden shrink-0 shadow-[0_0_12px_rgba(16,185,129,0.2)]">
                      <img
                        src="/player-silhouette.svg"
                        alt={player!.name}
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="font-medium flex items-center gap-2">
                        {player!.name}
                        {player!.isStar && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full border border-yellow-400/50 text-yellow-200 bg-yellow-500/10">
                            Star
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-400">
                        {player!.role} - {player!.country} - {player!.credit}
                      </div>
                    </div>

                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={() => team.setCaptain(player!.id)}
                        disabled={team.isEditLocked}
                        className={`text-xs px-2 py-1 rounded ${
                          isCaptain
                            ? "bg-indigo-600"
                            : "bg-slate-700 hover:bg-slate-600"
                        } disabled:opacity-50 disabled:cursor-not-allowed disabled:grayscale`}
                      >
                        Captain
                      </button>
                      <button
                        onClick={() => team.setViceCaptain(player!.id)}
                        disabled={team.isEditLocked}
                        className={`text-xs px-2 py-1 rounded ${
                          isViceCaptain
                            ? "bg-purple-600"
                            : "bg-slate-700 hover:bg-slate-600"
                        } disabled:opacity-50 disabled:cursor-not-allowed disabled:grayscale`}
                      >
                        Vice
                      </button>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      team.removePlayer(player!.id);
                      highlight(player!.id);
                    }}
                    disabled={team.isEditLocked}
                    className="px-3 py-2 rounded bg-red-600 text-xs disabled:opacity-50 disabled:cursor-not-allowed disabled:grayscale"
                  >
                    {"Remove ->"}
                  </button>
                </div>
              );
            })}

            <div className="flex justify-end">
              <button
                onClick={handleSave}
                disabled={team.isEditLocked}
                className="px-4 py-2 bg-blue-600 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:grayscale"
              >
                {team.isEditLocked ? "Locked" : "Save Team"}
              </button>
            </div>
          </div>

          <div
            key={`available-${team.workingTeam.players.join(",")}`}
            className={`space-y-3 ${
              activeTab === "available" ? "block" : "hidden"
            } lg:block`}
          >
            <h2 className="text-lg font-semibold">Available Players</h2>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-3 text-xs">
              <div className="space-y-1">
                <span className="text-slate-400">Role</span>
                <select
                  value={roleFilter}
                  onChange={event => setRoleFilter(event.target.value)}
                  className="w-full rounded-lg bg-slate-900 border border-white/10 px-3 py-2"
                >
                  <option value="ALL">All Roles</option>
                  <option value="WK">WK</option>
                  <option value="BAT">BAT</option>
                  <option value="AR">AR</option>
                  <option value="BOWL">BOWL</option>
                </select>
              </div>
              <div className="space-y-1">
                <span className="text-slate-400">Match Filter</span>
                <div className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 max-h-32 overflow-y-auto space-y-2">
                  <label className="flex items-center gap-2 text-[11px] text-slate-200">
                    <input
                      type="checkbox"
                      checked={matchFilter.length === 0}
                      onChange={() => clearMatchFilter()}
                    />
                    All Matches
                  </label>
                  {tournament.nextMatches?.map(match => (
                    <label
                      key={match.matchId}
                      className="flex items-center gap-2 text-[11px] text-slate-200"
                    >
                      <input
                        type="checkbox"
                        checked={matchFilter.includes(String(match.matchId))}
                        onChange={() => toggleMatchFilter(String(match.matchId))}
                      />
                      M{match.matchId} {teamShort(match.teams[0])} vs {teamShort(match.teams[1])}
                    </label>
                  ))}
                </div>
              </div>
              <label className="space-y-1">
                <span className="text-slate-400">Search</span>
                <input
                  value={searchTerm}
                  onChange={event => setSearchTerm(event.target.value)}
                  placeholder="Player name"
                  className="w-full rounded-lg bg-slate-900 border border-white/10 px-3 py-2"
                />
              </label>
              <div className="space-y-1">
                <span className="text-slate-400">Teams</span>
                <div className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 max-h-32 overflow-y-auto space-y-2">
                  <label className="flex items-center gap-2 text-[11px] text-slate-200">
                    <input
                      type="checkbox"
                      checked={countryFilter.length === 0}
                      onChange={() => clearCountryFilter()}
                    />
                    All Teams
                  </label>
                  {countries.filter(c => c !== "ALL").map(country => (
                    <label
                      key={country}
                      className="flex items-center gap-2 text-[11px] text-slate-200"
                    >
                      <input
                        type="checkbox"
                        checked={countryFilter.includes(country)}
                        onChange={() => toggleCountryFilter(country)}
                      />
                      {country}
                    </label>
                  ))}
                </div>
              </div>
              <label className="space-y-1">
                <span className="text-slate-400">Points / Star</span>
                <select
                  value={pointsFilter}
                  onChange={event => setPointsFilter(event.target.value)}
                  className="w-full rounded-lg bg-slate-900 border border-white/10 px-3 py-2"
                >
                  <option value="ALL">All</option>
                  <option value="STAR">Star Players</option>
                  <option value="11">11</option>
                  <option value="10">10</option>
                  <option value="9">9</option>
                  <option value="8">8</option>
                  <option value="7">7</option>
                  <option value="6">6</option>
                  <option value="5.5">5.5</option>
                </select>
              </label>
              <div className="flex items-end">
                <button
                  onClick={() => {
                    setRoleFilter("ALL");
                    clearMatchFilter();
                    clearCountryFilter();
                    setPointsFilter("ALL");
                    setSearchTerm("");
                  }}
                  className="w-full rounded-lg border border-white/10 px-3 py-2 text-slate-200 hover:border-white/30"
                >
                  Clear Filters
                </button>
              </div>
            </div>

            <div className="text-xs text-slate-400">
              Showing {filteredPlayers.length} players
            </div>

            {filteredPlayers.map(player => {
              const selected = team.workingTeam.players.includes(player.id);
              const canAdd = team.canAddPlayer(player.id);

              return (
                <div
                  key={player.id}
                  className={`border border-white/10 rounded-xl p-4 flex justify-between items-start gap-4 transition-all duration-200 ${
                    recentId === player.id ? "ring-2 ring-emerald-400/70" : ""
                  }`}
                >
                  <div className="flex gap-3">
                    <div className="h-11 w-11 rounded-full bg-emerald-500/10 border border-emerald-400/40 overflow-hidden shrink-0 shadow-[0_0_12px_rgba(16,185,129,0.2)]">
                      <img
                        src="/player-silhouette.svg"
                        alt={player.name}
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="font-medium flex items-center gap-2">
                        {player.name}
                        {player.isStar && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full border border-yellow-400/50 text-yellow-200 bg-yellow-500/10">
                            Star
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-400">
                        {player.role} - {player.country} - {player.credit}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      team.addPlayer(player.id);
                      highlight(player.id);
                    }}
                    disabled={!canAdd || selected || team.isEditLocked}
                    className={`px-3 py-2 rounded text-xs ${
                      selected
                        ? "bg-slate-700 cursor-not-allowed"
                        : canAdd
                        ? "bg-green-600"
                        : "bg-slate-700 cursor-not-allowed"
                    } disabled:opacity-50 disabled:cursor-not-allowed disabled:grayscale`}
                  >
                    {"<- Add"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {showPreview && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl bg-[#0F1626] border border-white/10 p-6 space-y-4 shadow-[0_0_40px_rgba(15,23,42,0.6)]">
            <h2 className="text-lg font-semibold">Confirm Changes</h2>

            <div className="grid grid-cols-3 gap-2 text-xs">
              <SummaryCard label="Subs Used" value={String(subsUsed)} />
              <SummaryCard label="Subs Had" value={team.subsLeftLabel} />
              <SummaryCard label="Subs Left After" value={subsLeftAfterLabel} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="text-xs text-slate-300 mb-2 uppercase tracking-wide">
                  Old Team
                </div>
                <div className="text-[11px] text-slate-400 mb-2">Players Out</div>
                {playersOut.length === 0 && (
                  <div className="text-xs text-slate-500">None</div>
                )}
                {playersOut.map(p => (
                  <div key={p!.id} className="text-sm">
                    {p!.name}
                  </div>
                ))}
                <div className="mt-3 text-[11px] text-slate-400">Captain</div>
                <div className="text-sm">
                  {savedSnapshot.captainId
                    ? playerMap.get(savedSnapshot.captainId)?.name
                    : "Not set"}
                </div>
                <div className="mt-2 text-[11px] text-slate-400">Vice Captain</div>
                <div className="text-sm">
                  {savedSnapshot.viceCaptainId
                    ? playerMap.get(savedSnapshot.viceCaptainId)?.name
                    : "Not set"}
                </div>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="text-xs text-slate-300 mb-2 uppercase tracking-wide">
                  New Team
                </div>
                <div className="text-[11px] text-slate-400 mb-2">Players In</div>
                {playersIn.length === 0 && (
                  <div className="text-xs text-slate-500">None</div>
                )}
                {playersIn.map(p => (
                  <div key={p!.id} className="text-sm">
                    {p!.name}
                  </div>
                ))}
                <div className="mt-3 text-[11px] text-slate-400">Captain</div>
                <div className="text-sm">
                  {team.workingTeam.captainId
                    ? playerMap.get(team.workingTeam.captainId)?.name
                    : "Not set"}
                </div>
                <div className="mt-2 text-[11px] text-slate-400">Vice Captain</div>
                <div className="text-sm">
                  {team.workingTeam.viceCaptainId
                    ? playerMap.get(team.workingTeam.viceCaptainId)?.name
                    : "Not set"}
                </div>
              </div>
            </div>

            <p className="text-xs text-slate-400">
              Note: Your team locks for 10 minutes starting at the next match time.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-end">
              <button
                onClick={() => setShowPreview(false)}
                className="px-4 py-2 rounded bg-slate-700 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={confirmSave}
                className="px-4 py-2 rounded bg-green-600 text-sm"
              >
                Confirm Save
              </button>
            </div>
          </div>
        </div>
      )}

      {showAutoLockToast && (
        <div className="fixed top-4 right-4 rounded-lg border border-white/10 bg-[#0F1626] px-4 py-2 text-xs text-white shadow">
          Team locked automatically.
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  className,
  compact = false,
}: {
  label: string;
  value: string;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border border-white/10 bg-white/5 ${
        compact ? "px-3 py-2" : "px-4 py-3"
      } ${className ?? ""}`}
    >
      <div className="text-[11px] text-slate-400">{label}</div>
      <div
        className={`font-semibold text-white whitespace-nowrap leading-tight ${
          compact ? "text-sm mt-1" : "text-lg mt-1"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function Warning({ msg }: { msg: string }) {
  return (
    <div className="border border-yellow-500/40 bg-yellow-500/10 text-yellow-300 text-xs rounded-lg px-3 py-2">
      {msg}
    </div>
  );
}
