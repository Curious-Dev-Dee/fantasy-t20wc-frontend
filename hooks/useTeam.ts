"use client";

import { useEffect, useMemo, useState } from "react";
import { players } from "@/data/players";
import { useTournament } from "./useTournament";
import { getJSON, scopedKey } from "@/utils/storage";
import { useAuth } from "@/hooks/useAuth";
import { fetchUserTeam, upsertUserTeam } from "@/utils/teamPersistence";
import {
  fetchLockHistory,
  insertLockHistory,
} from "@/utils/lockHistoryPersistence";

type WorkingTeam = {
  players: string[];
  captainId: string | null;
  viceCaptainId: string | null;
};

type LockedTeam = {
  matchId: number;
  players: string[];
  captainId: string;
  viceCaptainId: string;
  subsUsed: number;
};

const MAX_SUBS = {
  GROUP_AFTER_MATCH1: 100,
  SUPER8_AFTER_MATCH41: 30,
  KNOCKOUT_AFTER_MATCH53: 5,
};

const MAX_PLAYERS = 11;
const MAX_BUDGET = 100;
const MAX_COUNTRY_PLAYERS = 6;
const MAX_STAR_PLAYERS = 4;
const MIN_ROLES = {
  WK: 1,
  BAT: 3,
  AR: 1,
  BOWL: 3,
};

const VALID_PLAYER_IDS = new Set(players.map(player => player.id));

const sanitizePlayers = (ids: string[]) => {
  const unique = Array.from(new Set(ids)).filter(id =>
    VALID_PLAYER_IDS.has(id)
  );
  return unique.slice(0, MAX_PLAYERS);
};

const sanitizeWorkingTeam = (team: WorkingTeam): WorkingTeam => {
  const players = sanitizePlayers(team.players || []);
  const captainId = players.includes(team.captainId || "")
    ? team.captainId
    : null;
  const viceCaptainId = players.includes(team.viceCaptainId || "")
    ? team.viceCaptainId
    : null;
  const finalCaptain =
    captainId && captainId !== viceCaptainId ? captainId : null;
  const finalVice =
    viceCaptainId && viceCaptainId !== finalCaptain ? viceCaptainId : null;

  return {
    players,
    captainId: finalCaptain,
    viceCaptainId: finalVice,
  };
};

const sanitizeLockedTeam = (team: LockedTeam): LockedTeam | null => {
  const players = sanitizePlayers(team.players || []);
  if (players.length === 0) return null;
  let captainId = players.includes(team.captainId)
    ? team.captainId
    : players[0];
  let viceCaptainId = players.includes(team.viceCaptainId)
    ? team.viceCaptainId
    : players[1] || null;
  if (viceCaptainId && viceCaptainId === captainId) {
    viceCaptainId = players.find(id => id !== captainId) || null;
  }
  return {
    ...team,
    players,
    captainId,
    viceCaptainId: viceCaptainId || captainId,
  };
};

const dedupeLockedTeams = (teams: LockedTeam[]) => {
  const map = new Map<number, LockedTeam>();
  teams.forEach(team => {
    const cleaned = sanitizeLockedTeam(team);
    if (!cleaned) return;
    map.set(team.matchId, cleaned);
  });
  return Array.from(map.values()).sort((a, b) => a.matchId - b.matchId);
};

export function useTeam() {
  const { nextMatch, now, lockWindowMatch } = useTournament();
  const { user, ready, isConfigured } = useAuth();

  const [workingTeam, setWorkingTeam] = useState<WorkingTeam>({
    players: [],
    captainId: null,
    viceCaptainId: null,
  });

  const [lockedTeams, setLockedTeams] = useState<LockedTeam[]>([]);
  const [subsUsed, setSubsUsed] = useState(0);
  const [remoteLoaded, setRemoteLoaded] = useState(false);

  /* LOAD */
  useEffect(() => {
    const keyWorking = scopedKey("fantasy_working_team", user?.id);
    const keyLocked = scopedKey("fantasy_locked_teams", user?.id);
    const keySubs = scopedKey("fantasy_subs_used", user?.id);
    const saved = getJSON<WorkingTeam | null>(keyWorking, null);
    const locked = getJSON<LockedTeam[] | null>(keyLocked, null);
    const subs = localStorage.getItem(keySubs);

    if (saved && Array.isArray(saved.players)) {
      const cleaned = sanitizeWorkingTeam(saved);
      setWorkingTeam(cleaned);
      localStorage.setItem(keyWorking, JSON.stringify(cleaned));
    } else {
      setWorkingTeam({
        players: [],
        captainId: null,
        viceCaptainId: null,
      });
    }

    if (locked && Array.isArray(locked)) {
      const cleanedLocked = dedupeLockedTeams(locked);
      setLockedTeams(cleanedLocked);
      localStorage.setItem(keyLocked, JSON.stringify(cleanedLocked));
    } else {
      setLockedTeams([]);
    }

    if (subs) {
      const parsed = Number(subs);
      setSubsUsed(Number.isFinite(parsed) ? parsed : 0);
    } else {
      setSubsUsed(0);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!ready || !user || !isConfigured) return;

    const loadRemote = async () => {
      const remote = await fetchUserTeam(user.id);
      if (remote) {
        const remoteWorking = remote.working_team as WorkingTeam | null;
        const remoteLocked = remote.locked_teams as LockedTeam[] | null;
        const keyWorking = scopedKey("fantasy_working_team", user.id);
        const keyLocked = scopedKey("fantasy_locked_teams", user.id);
        const keySubs = scopedKey("fantasy_subs_used", user.id);

        const needsDefaultTeam =
          !remoteWorking || !Array.isArray(remoteWorking.players);

        if (remoteWorking && Array.isArray(remoteWorking.players)) {
          const cleaned = sanitizeWorkingTeam(remoteWorking);
          setWorkingTeam(cleaned);
          localStorage.setItem(keyWorking, JSON.stringify(cleaned));
        } else {
          const cleaned = sanitizeWorkingTeam({
            players: [],
            captainId: null,
            viceCaptainId: null,
          });
          setWorkingTeam(cleaned);
          localStorage.setItem(keyWorking, JSON.stringify(cleaned));
        }
        if (remoteLocked && Array.isArray(remoteLocked)) {
          const cleanedLocked = dedupeLockedTeams(remoteLocked);
          setLockedTeams(cleanedLocked);
          localStorage.setItem(keyLocked, JSON.stringify(cleanedLocked));
        }

        const historyRows = await fetchLockHistory(user.id);
        if (historyRows.length > 0) {
          const history = historyRows.map(row => ({
            matchId: row.match_id,
            players: row.players,
            captainId: row.captain_id,
            viceCaptainId: row.vice_captain_id,
            subsUsed: row.subs_used,
          }));
          setLockedTeams(history);
          localStorage.setItem(keyLocked, JSON.stringify(history));
        }
        if (typeof remote.subs_used === "number") {
          setSubsUsed(remote.subs_used);
          localStorage.setItem(keySubs, String(remote.subs_used));
        } else {
          setSubsUsed(0);
          localStorage.setItem(keySubs, "0");
        }
        if (needsDefaultTeam || remoteLocked || typeof remote.subs_used !== "number") {
          await upsertUserTeam(user.id, {
            working_team:
              remoteWorking && Array.isArray(remoteWorking.players)
                ? sanitizeWorkingTeam(remoteWorking)
                : {
                    players: [],
                    captainId: null,
                    viceCaptainId: null,
                  },
            locked_teams:
              remoteLocked && Array.isArray(remoteLocked)
                ? dedupeLockedTeams(remoteLocked)
                : [],
            subs_used:
              typeof remote.subs_used === "number"
                ? remote.subs_used
                : 0,
          });
        }
      } else {
        const keyWorking = scopedKey("fantasy_working_team", user.id);
        const keyLocked = scopedKey("fantasy_locked_teams", user.id);
        const keySubs = scopedKey("fantasy_subs_used", user.id);
        const localWorking = getJSON<WorkingTeam | null>(keyWorking, null);
        const localLocked = getJSON<LockedTeam[] | null>(keyLocked, null);
        const localSubs = Number(localStorage.getItem(keySubs) || 0);
        await upsertUserTeam(user.id, {
          working_team: localWorking
            ? sanitizeWorkingTeam(localWorking)
            : null,
          locked_teams: localLocked
            ? dedupeLockedTeams(localLocked)
            : null,
          subs_used: Number.isFinite(localSubs) ? localSubs : 0,
        });
      }
      setRemoteLoaded(true);
    };

    loadRemote();
  }, [user, ready, isConfigured]);

  const persistRemote = (
    payload: Partial<{
      working_team: WorkingTeam;
      locked_teams: LockedTeam[];
      subs_used: number;
    }>
  ) => {
    if (!user || !isConfigured) return;
    upsertUserTeam(user.id, {
      working_team: payload.working_team ?? workingTeam,
      locked_teams: payload.locked_teams ?? lockedTeams,
      subs_used: payload.subs_used ?? subsUsed,
    });
  };

  const isEditLocked = Boolean(lockWindowMatch);

  /* SAVE WORKING TEAM */
  const saveTeam = () => {
    if (isEditLocked) return;
    const keyWorking = scopedKey("fantasy_working_team", user?.id);
    localStorage.setItem(keyWorking, JSON.stringify(workingTeam));
    persistRemote({ working_team: workingTeam });
  };

  /* LOCK TEAM AT MATCH TIME */
  const lockTeam = (matchOverride?: typeof nextMatch): { ok: boolean; reason?: string } => {
    const matchToLock = matchOverride ?? lockWindowMatch ?? nextMatch;
    if (!matchToLock) {
      return { ok: false, reason: "No upcoming match found." };
    }

    if (lockedTeams.some(team => team.matchId === matchToLock.matchId)) {
      return { ok: false, reason: "Team already locked for this match." };
    }

    if (!workingTeam.captainId || !workingTeam.viceCaptainId) {
      return {
        ok: false,
        reason: "Select a captain and vice-captain before locking.",
      };
    }

    const lastLocked = lockedTeams.at(-1);

    let subs = 0;

    if (lastLocked) {
      const prev = new Set(lastLocked.players);
      const curr = new Set(workingTeam.players);

      const out = [...prev].filter(p => !curr.has(p));
      const _in = [...curr].filter(p => !prev.has(p));

      subs = Math.max(out.length, _in.length);
    }

    const locked: LockedTeam = {
      matchId: matchToLock.matchId,
      players: workingTeam.players,
      captainId: workingTeam.captainId!,
      viceCaptainId: workingTeam.viceCaptainId!,
      subsUsed: subs,
    };

    const updated = [...lockedTeams, locked];

    const nextSubsUsed = subsUsed + subs;
    if (Number.isFinite(maxSubs) && nextSubsUsed > maxSubs) {
      return { ok: false, reason: "No subs left for this stage." };
    }

    setLockedTeams(updated);
    setSubsUsed(nextSubsUsed);

    const keyLocked = scopedKey("fantasy_locked_teams", user?.id);
    const keySubs = scopedKey("fantasy_subs_used", user?.id);
    const keyNotice = scopedKey("fantasy_lock_notice", user?.id);
    localStorage.setItem(keyLocked, JSON.stringify(updated));
    localStorage.setItem(keySubs, String(nextSubsUsed));
    localStorage.setItem(keyNotice, String(matchToLock.matchId));

    upsertUserTeam(user!.id, {
      working_team: workingTeam,
      locked_teams: updated,
      subs_used: nextSubsUsed,
    });

    if (user && isConfigured) {
      insertLockHistory({
        user_id: user.id,
        match_id: matchToLock.matchId,
        players: workingTeam.players,
        captain_id: workingTeam.captainId!,
        vice_captain_id: workingTeam.viceCaptainId!,
        subs_used: subs,
      });
    }

    return { ok: true };
  };

  /* HELPERS */
  const playerMap = useMemo(() => {
    return new Map(players.map(player => [player.id, player]));
  }, []);

  const selectedPlayers = useMemo(() => {
    return workingTeam.players
      .map(id => playerMap.get(id))
      .filter(Boolean);
  }, [workingTeam.players, playerMap]);

  const teamSize = selectedPlayers.length;
  const totalBudget = selectedPlayers.reduce(
    (sum, p) => sum + p!.credit,
    0
  );
  const starCount = selectedPlayers.filter(p => p!.isStar).length;

  const roleCounts = selectedPlayers.reduce(
    (acc, p) => {
      const role = p!.role;
      acc[role] += 1;
      return acc;
    },
    { WK: 0, BAT: 0, AR: 0, BOWL: 0 }
  );

  const countryCounts = selectedPlayers.reduce(
    (acc, p) => {
      const country = p!.country;
      acc[country] = (acc[country] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const missingRoles = Object.entries(MIN_ROLES).filter(
    ([role, min]) =>
      roleCounts[role as keyof typeof roleCounts] < min
  );

  const overCountryLimit = Object.entries(countryCounts).find(
    ([, count]) => count > MAX_COUNTRY_PLAYERS
  );

  const isValidTeam =
    teamSize === MAX_PLAYERS &&
    totalBudget <= MAX_BUDGET &&
    starCount <= MAX_STAR_PLAYERS &&
    !overCountryLimit &&
    missingRoles.length === 0;

  const canAddPlayer = (id: string) => {
    if (isEditLocked) return false;
    const player = playerMap.get(id);
    if (!player) return false;
    if (workingTeam.players.includes(id)) return false;
    if (teamSize >= MAX_PLAYERS) return false;
    if (totalBudget + player.credit > MAX_BUDGET) return false;
    if (player.isStar && starCount >= MAX_STAR_PLAYERS) return false;
    if ((countryCounts[player.country] || 0) >= MAX_COUNTRY_PLAYERS)
      return false;
    return true;
  };

  const addPlayer = (id: string) => {
    if (isEditLocked) return;
    if (!canAddPlayer(id)) return;
    setWorkingTeam(t => ({
      ...t,
      players: [...t.players, id],
    }));
  };

  const removePlayer = (id: string) => {
    if (isEditLocked) return;
    setWorkingTeam(t => ({
      ...t,
      players: t.players.filter(p => p !== id),
      captainId: t.captainId === id ? null : t.captainId,
      viceCaptainId: t.viceCaptainId === id ? null : t.viceCaptainId,
    }));
  };

  const setCaptain = (id: string) => {
    if (isEditLocked) return;
    setWorkingTeam(t => ({
      ...t,
      captainId: id,
      viceCaptainId: t.viceCaptainId === id ? null : t.viceCaptainId,
    }));
  };

  const setViceCaptain = (id: string) => {
    if (isEditLocked) return;
    setWorkingTeam(t => ({
      ...t,
      viceCaptainId: id,
      captainId: t.captainId === id ? null : t.captainId,
    }));
  };

  const nextMatchId = nextMatch?.matchId ?? null;

  const phaseKey =
    nextMatchId && nextMatchId >= 53
      ? "KNOCKOUT"
      : nextMatchId && nextMatchId >= 41
      ? "SUPER8"
      : "GROUP";

  const getSubsCap = (matchId: number | null) => {
    if (!matchId) return Infinity;
    if (matchId === 1 || matchId === 41 || matchId === 53) return Infinity;
    if (matchId <= 40) return MAX_SUBS.GROUP_AFTER_MATCH1;
    if (matchId <= 52) return MAX_SUBS.SUPER8_AFTER_MATCH41;
    return MAX_SUBS.KNOCKOUT_AFTER_MATCH53;
  };

  const maxSubs = getSubsCap(nextMatchId);
  const subsLeft = Number.isFinite(maxSubs)
    ? Math.max(maxSubs - subsUsed, 0)
    : Infinity;

  useEffect(() => {
    if (!nextMatchId) return;
    const phaseKeyStorage = scopedKey("fantasy_subs_phase", user?.id);
    const storedPhase = localStorage.getItem(phaseKeyStorage);
    if (storedPhase && storedPhase === phaseKey) return;
    localStorage.setItem(phaseKeyStorage, phaseKey);
    setSubsUsed(0);
    localStorage.setItem(scopedKey("fantasy_subs_used", user?.id), "0");
    persistRemote({ subs_used: 0 });
  }, [phaseKey, nextMatchId, user?.id]);

  useEffect(() => {
    if (!remoteLoaded) return;
    if (!user || !isConfigured) return;
    upsertUserTeam(user.id, {
      working_team: workingTeam,
      locked_teams: lockedTeams,
      subs_used: subsUsed,
    });
  }, [remoteLoaded, user, isConfigured]);

  useEffect(() => {
    const matchToLock = lockWindowMatch ?? nextMatch;
    if (!matchToLock) return;
    const matchTime = new Date(matchToLock.startTimeUTC).getTime();
    if (now < matchTime) return;
    if (!isValidTeam) return;
    if (!workingTeam.captainId || !workingTeam.viceCaptainId) return;
    if (lockedTeams.some(team => team.matchId === matchToLock.matchId)) return;
    lockTeam(matchToLock);
  }, [
    now,
    nextMatch,
    lockWindowMatch,
    isValidTeam,
    workingTeam.captainId,
    workingTeam.viceCaptainId,
    lockedTeams,
  ]);

  const subsLeftLabel = Number.isFinite(subsLeft)
    ? String(subsLeft)
    : "Unlimited";

  return {
    workingTeam,
    lockedTeams,
    subsUsed,
    subsLeft,
    subsLeftLabel,
    isEditLocked,

    saveTeam,
    lockTeam,

    selectedPlayers,
    teamSize,
    totalBudget,
    starCount,
    roleCounts,
    countryCounts,
    missingRoles,
    overCountryLimit,
    isValidTeam,
    canAddPlayer,

    addPlayer,
    removePlayer,
    setCaptain,
    setViceCaptain,

    limits: {
      MAX_PLAYERS,
      MAX_BUDGET,
      MAX_COUNTRY_PLAYERS,
      MAX_STAR_PLAYERS,
      MIN_ROLES,
    },
  };
}
