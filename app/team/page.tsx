"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useTeam } from "@/hooks/useTeam";
import { useTournament } from "@/hooks/useTournament";
import { useAuth } from "@/hooks/useAuth";
import { scopedKey } from "@/utils/storage";
import { teamShort } from "@/utils/teamCodes";
import { players, type Player } from "@/data/players";
import {
  scoreTeam,
  scoreLockedTeams,
  scorePlayerBreakdown,
  type PlayerRole,
} from "@/utils/scoring";
import { useMatchStats } from "@/hooks/useMatchStats";
import { useTeamName } from "@/hooks/useTeamName";

export default function TeamPage() {
  const team = useTeam();
  const tournament = useTournament();
  const { user } = useAuth();
  const { teamName } = useTeamName();
  const { stats } = useMatchStats();

  const [showLockTip, setShowLockTip] = useState(false);
  const [showAutoLockToast, setShowAutoLockToast] = useState(false);
  const lockTipRef = useRef<HTMLButtonElement | null>(null);
  const fieldWrapRef = useRef<HTMLDivElement | null>(null);
  const fieldRef = useRef<HTMLDivElement | null>(null);
  const [fieldScale, setFieldScale] = useState(1);

  const playerRoleMap = useRef(
    new Map(players.map(player => [player.id, player.role] as const))
  );
  const statsMap = useRef(new Map<string, typeof stats[number]["matches"]>());

  useEffect(() => {
    statsMap.current = new Map(
      stats.map(stat => [stat.playerId, stat.matches])
    );
  }, [stats]);

  useEffect(() => {
    if (!showLockTip) return;
    const timeout = setTimeout(() => setShowLockTip(false), 1000);
    return () => clearTimeout(timeout);
  }, [showLockTip]);

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

  useEffect(() => {
    if (!tournament.nextMatch) return;
    const notice = localStorage.getItem(scopedKey("fantasy_lock_notice", user?.id));
    if (!notice) return;
    if (notice != String(tournament.nextMatch.matchId)) return;
    const matchTime = new Date(tournament.nextMatch.startTimeUTC).getTime();
    if (tournament.now < matchTime) return;
    setShowAutoLockToast(true);
    localStorage.removeItem(scopedKey("fantasy_lock_notice", user?.id));
    const timeout = setTimeout(() => setShowAutoLockToast(false), 1500);
    return () => clearTimeout(timeout);
  }, [tournament.nextMatch, tournament.now]);

  useEffect(() => {
    const computeScale = () => {
      if (!fieldWrapRef.current || !fieldRef.current) return;
      const wrap = fieldWrapRef.current.getBoundingClientRect();
      const field = fieldRef.current.getBoundingClientRect();
      if (field.height === 0 || field.width === 0) return;
      const heightScale = wrap.height / field.height;
      const widthScale = wrap.width / field.width;
      const nextScale = Math.min(heightScale, widthScale);
      setFieldScale(Number.isFinite(nextScale) ? nextScale : 1);
    };
    computeScale();
    window.addEventListener("resize", computeScale);
    return () => window.removeEventListener("resize", computeScale);
  }, [team.selectedPlayers.length]);

  const lockLabel = tournament.lockWindowMatch
    ? `Locked for Match #${tournament.lockWindowMatch.matchId} until ${new Date(
        tournament.lockWindowEndsAt || Date.now()
      ).toLocaleTimeString()}`
    : null;

  return (
    <div className="min-h-screen bg-[#0B0F1A] text-white px-4 sm:px-6 py-4">
      <div className="max-w-6xl mx-auto space-y-3">
        <div className="h-0" />

        <div
          className="space-y-3 h-[calc(100vh-140px)] sm:h-auto"
          ref={fieldWrapRef}
        >
          {team.selectedPlayers.length === 0 && (
            <div className="text-sm text-slate-400 border border-white/10 rounded-xl p-4">
              No players selected yet. Head to Edit Team to build your XI.
            </div>
          )}

          {team.selectedPlayers.length > 0 && (
            <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_top,rgba(34,197,94,0.35),rgba(15,23,42,0.9))] p-3 sm:p-5">
              <div className="absolute inset-0 opacity-30">
                <div className="absolute inset-0 bg-[repeating-linear-gradient(90deg,rgba(16,185,129,0.12)_0,rgba(16,185,129,0.12)_18px,rgba(16,185,129,0.22)_18px,rgba(16,185,129,0.22)_36px)]" />
                <div className="absolute left-1/2 top-6 h-[70%] w-[70%] -translate-x-1/2 rounded-full border border-white/10" />
                <div className="absolute left-1/2 top-24 h-14 w-28 -translate-x-1/2 rounded-full border border-white/10" />
                <div className="absolute left-1/2 top-1/2 h-28 w-28 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/10" />
              </div>
              <div
                ref={fieldRef}
                className="relative origin-top"
                style={{ transform: `scale(${fieldScale})` }}
              >
                <div className="flex items-center justify-between text-[10px] sm:text-[11px] text-slate-200 mb-1">
                  <span className="font-semibold truncate max-w-[55%]">
                    {teamName}
                  </span>
                  <div className="flex gap-3 text-[10px] sm:text-[11px]">
                    <Link href="/" className="text-indigo-200 hover:underline">
                      Home
                    </Link>
                    {team.isEditLocked ? (
                      <span className="text-slate-400">Edit Team (Locked)</span>
                    ) : (
                      <Link
                        href="/team/edit"
                        className="text-indigo-200 hover:underline"
                      >
                        Edit Team
                      </Link>
                    )}
                  </div>
                </div>
                <GroundRow
                  title="Wicket Keeper"
                  players={team.selectedPlayers.filter(p => p?.role === "WK")}
                  team={team}
                  statsMap={statsMap.current}
                  playerRoleMap={playerRoleMap.current}
                />
                <GroundRow
                  title="Batters"
                  players={team.selectedPlayers.filter(p => p?.role === "BAT")}
                  team={team}
                  statsMap={statsMap.current}
                  playerRoleMap={playerRoleMap.current}
                />
                <GroundRow
                  title="All Rounders"
                  players={team.selectedPlayers.filter(p => p?.role === "AR")}
                  team={team}
                  statsMap={statsMap.current}
                  playerRoleMap={playerRoleMap.current}
                />
                <GroundRow
                  title="Bowlers"
                  players={team.selectedPlayers.filter(p => p?.role === "BOWL")}
                  team={team}
                  statsMap={statsMap.current}
                  playerRoleMap={playerRoleMap.current}
                />
              </div>
            </div>
          )}
        </div>
      </div>
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
  team: ReturnType<typeof useTeam>;
  statsMap: Map<string, any>;
  playerRoleMap: Map<string, PlayerRole>;
}) {
  const validPlayers = players.filter(Boolean);
  if (validPlayers.length === 0) return null;

  return (
    <div className="mb-3 sm:mb-4">
      <div className="text-[8px] sm:text-[9px] uppercase tracking-[0.3em] text-emerald-200/70 mb-1.5 text-center">
        {title}
      </div>
      <div className="flex flex-wrap justify-center gap-2 sm:gap-3">
        {validPlayers.map(player => {
          const id = player!.id;
          const role: PlayerRole = playerRoleMap.get(id) || player!.role;
          const matches = (statsMap as any).get(id) || [];
          const isCaptain = team.workingTeam.captainId === id;
          const isVice = team.workingTeam.viceCaptainId === id;
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
            <div key={id} className="flex flex-col items-center gap-0.5">
              <div className="relative">
                <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-full bg-emerald-500/10 border border-emerald-400/40 overflow-hidden shadow-[0_0_12px_rgba(16,185,129,0.2)]">
                  <img
                    src="/player-silhouette.svg"
                    alt={player!.name}
                    className="h-full w-full object-cover"
                  />
                </div>
                {isCaptain && (
                  <span className="absolute -top-1 -right-2 h-4 min-w-[18px] rounded-full border border-emerald-400/70 bg-emerald-500/20 text-[8px] font-semibold text-emerald-100 flex items-center justify-center">
                    C
                  </span>
                )}
                {isVice && !isCaptain && (
                  <span className="absolute -top-1 -right-2 h-4 min-w-[18px] rounded-full border border-indigo-400/70 bg-indigo-500/20 text-[8px] font-semibold text-indigo-100 flex items-center justify-center">
                    VC
                  </span>
                )}
              </div>
              <div className="text-[9px] sm:text-[10px] font-medium text-white text-center max-w-[70px] sm:max-w-[84px] truncate">
                {player!.name}
              </div>
              <div className="rounded-full bg-white/10 border border-white/15 px-2 py-0.5 text-[8px] sm:text-[9px] text-slate-200">
                {player!.credit} cr
              </div>
              <div className="text-[8px] sm:text-[9px] text-slate-300">
                {total} pts
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
