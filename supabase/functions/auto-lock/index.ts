import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const LOCK_WINDOW_MS = 10 * 60 * 1000;
const MAX_SUBS = {
  GROUP_AFTER_MATCH1: 100,
  SUPER8_AFTER_MATCH41: 30,
  KNOCKOUT_AFTER_MATCH53: 5,
};

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

type UserTeamRow = {
  user_id: string;
  working_team: WorkingTeam | null;
  locked_teams: LockedTeam[] | null;
  subs_used: number | null;
};

type FixtureRow = {
  match_id?: number | null;
  matchId?: number | null;
  start_time_utc?: string | null;
  startTimeUTC?: string | null;
};

const getSubsCap = (matchId: number) => {
  if (matchId === 1 || matchId === 41 || matchId === 53) return Infinity;
  if (matchId <= 40) return MAX_SUBS.GROUP_AFTER_MATCH1;
  if (matchId <= 52) return MAX_SUBS.SUPER8_AFTER_MATCH41;
  return MAX_SUBS.KNOCKOUT_AFTER_MATCH53;
};

const normalizeLockedTeams = (teams: LockedTeam[] | null) => {
  if (!Array.isArray(teams)) return [] as LockedTeam[];
  return teams
    .filter(Boolean)
    .sort((a, b) => (a?.matchId ?? 0) - (b?.matchId ?? 0));
};

const toSet = (arr: string[]) => new Set(arr);

const diffSubs = (prev: LockedTeam | null, current: WorkingTeam) => {
  if (!prev) return 0;
  const prevSet = toSet(prev.players || []);
  const currSet = toSet(current.players || []);
  const out = [...prevSet].filter(p => !currSet.has(p));
  const inn = [...currSet].filter(p => !prevSet.has(p));
  return Math.max(out.length, inn.length);
};

const buildLocked = (matchId: number, current: WorkingTeam, subs: number): LockedTeam => {
  const captainId = current.captainId || current.players[0];
  const viceCaptainId =
    current.viceCaptainId && current.viceCaptainId !== captainId
      ? current.viceCaptainId
      : current.players.find(p => p !== captainId) || captainId;

  return {
    matchId,
    players: current.players,
    captainId,
    viceCaptainId,
    subsUsed: subs,
  };
};

Deno.serve(async () => {
  const supabaseUrl = Deno.env.get("AUTOLOCK_SUPABASE_URL");
  const serviceRole = Deno.env.get("AUTOLOCK_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRole) {
    return new Response(
      JSON.stringify({ ok: false, error: "Missing Supabase service role." }),
      { status: 500 }
    );
  }

  const supabase = createClient(supabaseUrl, serviceRole);

  try {
    const now = Date.now();
    const { data: fixtureRows, error: fixtureError } = await supabase
      .from("fixtures")
      .select("*");

    if (fixtureError) throw fixtureError;

    const allFixtures = ((fixtureRows || []) as FixtureRow[]).map(row => ({
      matchId: row.match_id ?? row.matchId,
      startTimeUTC: row.start_time_utc ?? row.startTimeUTC,
    })) as Array<{ matchId: number; startTimeUTC: string }>;

    const lockTargets = allFixtures.filter(match => {
      if (!match.matchId || !match.startTimeUTC) return false;
      const start = new Date(match.startTimeUTC).getTime();
      return now >= start && now < start + LOCK_WINDOW_MS;
    });

    if (lockTargets.length === 0) {
      return new Response(JSON.stringify({ ok: true, locked: 0 }), { status: 200 });
    }

    const { data: rows, error } = await supabase
      .from("user_teams")
      .select("user_id, working_team, locked_teams, subs_used");

    if (error) throw error;
    const users = (rows || []) as UserTeamRow[];

    let lockedCount = 0;

    for (const match of lockTargets) {
      const matchId = match.matchId;
      const cap = getSubsCap(matchId);

      for (const user of users) {
        const working = user.working_team;
        if (!working || !Array.isArray(working.players) || working.players.length === 0) {
          continue;
        }

        const lockedTeams = normalizeLockedTeams(user.locked_teams);
        if (lockedTeams.some(t => t.matchId === matchId)) continue;

        const lastLocked = lockedTeams.length ? lockedTeams[lockedTeams.length - 1] : null;
        const subs = diffSubs(lastLocked, working);
        const currentSubsUsed = typeof user.subs_used === "number" ? user.subs_used : 0;
        const nextSubsUsed = Number.isFinite(cap) ? currentSubsUsed + subs : currentSubsUsed + subs;

        let locked: LockedTeam;
        let finalSubsUsed = nextSubsUsed;

        if (Number.isFinite(cap) && nextSubsUsed > cap) {
          if (lastLocked) {
            locked = {
              matchId,
              players: lastLocked.players,
              captainId: lastLocked.captainId,
              viceCaptainId: lastLocked.viceCaptainId,
              subsUsed: 0,
            };
            finalSubsUsed = currentSubsUsed;
          } else {
            locked = buildLocked(matchId, working, subs);
          }
        } else {
          locked = buildLocked(matchId, working, subs);
        }

        const updatedLocked = [...lockedTeams, locked].sort((a, b) => a.matchId - b.matchId);

        const { error: userTeamError } = await supabase.from("user_teams").upsert({
          user_id: user.user_id,
          working_team: working,
          locked_teams: updatedLocked,
          subs_used: finalSubsUsed,
          updated_at: new Date().toISOString(),
        });
        if (userTeamError) throw userTeamError;

        const lockRow = {
          user_id: user.user_id,
          match_id: matchId,
          players: locked.players,
          captain_id: locked.captainId,
          vice_captain_id: locked.viceCaptainId,
          subs_used: locked.subsUsed,
          locked_at: new Date().toISOString(),
        };

        const [
          { error: lockHistoryError },
          { error: lockPublicError },
        ] = await Promise.all([
          supabase.from("locked_team_history").upsert(lockRow),
          supabase.from("locked_team_public").upsert(lockRow),
        ]);
        if (lockHistoryError) throw lockHistoryError;
        if (lockPublicError) throw lockPublicError;

        lockedCount += 1;
      }
    }

    return new Response(
      JSON.stringify({ ok: true, locked: lockedCount, matches: lockTargets.map(m => m.matchId) }),
      { status: 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500,
    });
  }
});
