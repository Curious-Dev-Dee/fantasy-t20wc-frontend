import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { fixtures } from "@/data/fixtures";

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

const diffSubs = (prev: LockedTeam | null, current: WorkingTeam) => {
  if (!prev) return 0;
  const prevSet = new Set(prev.players || []);
  const currSet = new Set(current.players || []);
  const out = [...prevSet].filter(p => !currSet.has(p));
  const inn = [...currSet].filter(p => !prevSet.has(p));
  return Math.max(out.length, inn.length);
};

const buildLocked = (
  matchId: number,
  current: WorkingTeam,
  subs: number
): LockedTeam => {
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

export async function POST(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET || "";
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.replace("Bearer ", "").trim();

  if (!cronSecret || token !== cronSecret) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!supabaseUrl || !serviceRole) {
    return NextResponse.json(
      { ok: false, error: "Missing service role configuration" },
      { status: 500 }
    );
  }

  const supabase = createClient(supabaseUrl, serviceRole);

  try {
    const now = Date.now();
    const lockTargets = fixtures.filter(match => {
      const start = new Date(match.startTimeUTC).getTime();
      return now >= start && now < start + LOCK_WINDOW_MS;
    });

    if (lockTargets.length === 0) {
      return NextResponse.json({ ok: true, locked: 0 });
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

        const updatedLocked = [...lockedTeams, locked].sort(
          (a, b) => a.matchId - b.matchId
        );

        await supabase.from("user_teams").upsert({
          user_id: user.user_id,
          working_team: working,
          locked_teams: updatedLocked,
          subs_used: finalSubsUsed,
          updated_at: new Date().toISOString(),
        });

        await supabase.from("locked_team_history").upsert({
          user_id: user.user_id,
          match_id: matchId,
          players: locked.players,
          captain_id: locked.captainId,
          vice_captain_id: locked.viceCaptainId,
          subs_used: locked.subsUsed,
          locked_at: new Date().toISOString(),
        });

        lockedCount += 1;
      }
    }

    return NextResponse.json({
      ok: true,
      locked: lockedCount,
      matches: lockTargets.map(m => m.matchId),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
