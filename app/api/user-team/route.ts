import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const LOCK_WINDOW_MS = 10 * 60 * 1000;

type WorkingTeam = {
  players: string[];
  captainId: string | null;
  viceCaptainId: string | null;
};

type UserTeamPayload = {
  team_name?: string | null;
  working_team?: WorkingTeam | null;
  locked_teams?: unknown | null;
  subs_used?: number | null;
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
  admin: ReturnType<typeof createClient>
) => {
  const { data: rows, error } = await admin.from("fixtures").select("*");
  if (error) throw error;
  const now = Date.now();
  return (rows || []).some((row: any) => {
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
  const token = (req.headers.get("authorization") || "")
    .replace("Bearer ", "")
    .trim();
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
  const token = (req.headers.get("authorization") || "")
    .replace("Bearer ", "")
    .trim();
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
  const payload: UserTeamPayload = {
    team_name: body.team_name ?? null,
    working_team: body.working_team ?? null,
    locked_teams: body.locked_teams ?? null,
    subs_used: typeof body.subs_used === "number" ? body.subs_used : null,
  };

  const { error } = await clients.admin.from("user_teams").upsert({
    user_id: user.id,
    ...payload,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
