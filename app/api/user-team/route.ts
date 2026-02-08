import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { players } from "@/data/players";
import { checkRateLimit } from "@/utils/server/requestGuards";
import { extractBearerToken } from "@/utils/server/tokenUtils";

const LOCK_WINDOW_MS = 10 * 60 * 1000;
const MAX_PLAYERS = 11;
const TEAM_NAME_MIN_LENGTH = 3;
const TEAM_NAME_MAX_LENGTH = 30;
const TEAM_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9 ._'&-]*$/;

type WorkingTeam = {
  players: string[];
  captainId: string | null;
  viceCaptainId: string | null;
};

type UserTeamPayload = {
  team_name?: unknown;
  working_team?: unknown;
};

const VALID_PLAYER_IDS = new Set(players.map(player => player.id));

const sanitizeTeamName = (value: string) => {
  const normalized = value.trim().replace(/\s+/g, " ");
  if (normalized.length < TEAM_NAME_MIN_LENGTH) {
    return {
      ok: false as const,
      error: `team_name must be at least ${TEAM_NAME_MIN_LENGTH} characters`,
    };
  }
  if (normalized.length > TEAM_NAME_MAX_LENGTH) {
    return {
      ok: false as const,
      error: `team_name must be at most ${TEAM_NAME_MAX_LENGTH} characters`,
    };
  }
  if (!TEAM_NAME_PATTERN.test(normalized)) {
    return {
      ok: false as const,
      error:
        "team_name can only contain letters, numbers, spaces, and . _ ' & -",
    };
  }
  return { ok: true as const, value: normalized };
};

const sanitizeWorkingTeam = (value: unknown): WorkingTeam | null => {
  if (value === null) return null;
  if (!value || typeof value !== "object") return null;

  const row = value as {
    players?: unknown;
    captainId?: unknown;
    viceCaptainId?: unknown;
  };

  const rawPlayers = Array.isArray(row.players) ? row.players : [];
  const cleanedPlayers = Array.from(
    new Set(
      rawPlayers.filter(
        playerId =>
          typeof playerId === "string" && VALID_PLAYER_IDS.has(playerId)
      )
    )
  ).slice(0, MAX_PLAYERS);

  const captainId =
    typeof row.captainId === "string" && cleanedPlayers.includes(row.captainId)
      ? row.captainId
      : null;
  const viceCaptainId =
    typeof row.viceCaptainId === "string" &&
    cleanedPlayers.includes(row.viceCaptainId) &&
    row.viceCaptainId !== captainId
      ? row.viceCaptainId
      : null;

  return {
    players: cleanedPlayers,
    captainId,
    viceCaptainId,
  };
};

const getSupabaseClients = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!supabaseUrl || !anonKey || !serviceRole) return null;
  return {
    auth: createClient(supabaseUrl, anonKey),
    admin: createClient(supabaseUrl, serviceRole),
  };
};

const isWithinLockWindow = async (
  admin: SupabaseClient
) => {
  const { data: rows, error } = await admin.from("fixtures").select("*");
  if (error) throw error;
  const now = Date.now();
  return (rows || []).some((row: Record<string, string | null>) => {
    const startTime =
      row.start_time_utc ??
      row.startTimeUTC ??
      row.start_time ??
      row.startTime;
    if (!startTime) return false;
    const start = new Date(startTime).getTime();
    return now >= start && now < start + LOCK_WINDOW_MS;
  });
};

const getUserFromToken = async (token: string) => {
  const clients = getSupabaseClients();
  if (!clients) return null;
  const { data, error } = await clients.auth.auth.getUser(token);
  if (error) return null;
  return data.user ?? null;
};

export async function GET(req: NextRequest) {
  const clients = getSupabaseClients();
  if (!clients) {
    return NextResponse.json(
      { ok: false, error: "Supabase not configured" },
      { status: 500 }
    );
  }

  // Rate limiting
  const ip = req.headers.get("x-forwarded-for") || "unknown";
  const rateLimitCheck = checkRateLimit(`get-user-team-${ip}`, {
    windowMs: 60000,
    max: 100,
  });
  if (!rateLimitCheck.ok) {
    return NextResponse.json(
      { ok: false, error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(rateLimitCheck.retryAfterSeconds) } }
    );
  }

  const token = extractBearerToken(req.headers.get("authorization") || "");
  if (!token) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const user = await getUserFromToken(token);
  if (!user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await clients.admin
    .from("user_teams")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, data: data ?? null });
}

export async function POST(req: NextRequest) {
  const clients = getSupabaseClients();
  if (!clients) {
    return NextResponse.json(
      { ok: false, error: "Supabase not configured" },
      { status: 500 }
    );
  }

  // Rate limiting
  const ip = req.headers.get("x-forwarded-for") || "unknown";
  const rateLimitCheck = checkRateLimit(`post-user-team-${ip}`, {
    windowMs: 60000,
    max: 20,
  });
  if (!rateLimitCheck.ok) {
    return NextResponse.json(
      { ok: false, error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(rateLimitCheck.retryAfterSeconds) } }
    );
  }

  const token = extractBearerToken(req.headers.get("authorization") || "");
  if (!token) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const user = await getUserFromToken(token);
  if (!user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const locked = await isWithinLockWindow(clients.admin);
    if (locked) {
      return NextResponse.json(
        { ok: false, error: "Team is locked" },
        { status: 423 }
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }

  const body = (await req.json().catch(() => ({}))) as UserTeamPayload;
  const hasTeamName = Object.prototype.hasOwnProperty.call(body, "team_name");
  const hasWorkingTeam = Object.prototype.hasOwnProperty.call(body, "working_team");

  if (!hasTeamName && !hasWorkingTeam) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const updateRow: {
    user_id: string;
    updated_at: string;
    team_name?: string | null;
    working_team?: WorkingTeam | null;
  } = {
    user_id: user.id,
    updated_at: new Date().toISOString(),
  };

  if (hasTeamName) {
    if (body.team_name === null) {
      updateRow.team_name = null;
    } else if (typeof body.team_name === "string") {
      const parsed = sanitizeTeamName(body.team_name);
      if (!parsed.ok) {
        return NextResponse.json(
          { ok: false, error: parsed.error },
          { status: 400 }
        );
      }
      updateRow.team_name = parsed.value;
    } else {
      return NextResponse.json(
        { ok: false, error: "Invalid team_name" },
        { status: 400 }
      );
    }
  }

  if (hasWorkingTeam) {
    const parsed = sanitizeWorkingTeam(body.working_team);
    if (body.working_team !== null && parsed === null) {
      return NextResponse.json(
        { ok: false, error: "Invalid working_team" },
        { status: 400 }
      );
    }
    updateRow.working_team = parsed;
  }

  const { error } = await clients.admin.from("user_teams").upsert(updateRow);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
