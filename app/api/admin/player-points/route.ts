export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAuthenticatedUser } from "@/utils/server/requestGuards";
import { isAdminEmail } from "@/utils/admin";

type PlayerPointInput = {
  playerId: string;
  points: number;
};

type Payload = {
  matchId: number;
  points: PlayerPointInput[];
};

const validatePayload = (payload: Payload) => {
  if (!payload.matchId || payload.matchId <= 0) {
    return "Match ID is required.";
  }
  if (!Array.isArray(payload.points) || payload.points.length === 0) {
    return "Player points are required.";
  }
  const invalid = payload.points.find(
    entry =>
      !entry.playerId ||
      typeof entry.points !== "number" ||
      Number.isNaN(entry.points)
  );
  if (invalid) return "Each player must include a valid points number.";
  return null;
};

export async function POST(request: NextRequest) {
  const auth = await requireAuthenticatedUser(request);
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, error: auth.error },
      { status: auth.status }
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

  if (!supabaseUrl || !anonKey || !serviceRole) {
    return NextResponse.json(
      { ok: false, error: "Missing Supabase configuration" },
      { status: 500 }
    );
  }

  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  const authClient = createClient(supabaseUrl, anonKey);
  const { data: userData } = await authClient.auth.getUser(token);
  const email = userData.user?.email ?? null;
  if (!isAdminEmail(email)) {
    return NextResponse.json(
      { ok: false, error: "Admin only" },
      { status: 403 }
    );
  }

  const payload = (await request.json()) as Payload;
  const errorMessage = validatePayload(payload);
  if (errorMessage) {
    return NextResponse.json(
      { ok: false, error: errorMessage },
      { status: 400 }
    );
  }

  const adminClient = createClient(supabaseUrl, serviceRole);

  const rows = payload.points.map(entry => ({
    player_id: entry.playerId,
    match_id: payload.matchId,
    points: entry.points,
    updated_at: new Date().toISOString(),
  }));

  const { error: upsertError } = await adminClient
    .from("player_match_points")
    .upsert(rows);
  if (upsertError) {
    return NextResponse.json(
      { ok: false, error: upsertError.message },
      { status: 500 }
    );
  }

  const { data: lockedTeams, error: lockedError } = await adminClient
    .from("locked_team_history")
    .select("user_id, players, captain_id, vice_captain_id")
    .eq("match_id", payload.matchId);

  if (lockedError) {
    return NextResponse.json(
      { ok: false, error: lockedError.message },
      { status: 500 }
    );
  }

  const pointsMap = new Map(
    payload.points.map(entry => [entry.playerId, entry.points])
  );

  const userRows = (lockedTeams || []).map(entry => {
    const players = Array.isArray(entry.players) ? entry.players : [];
    let total = 0;
    players.forEach(playerId => {
      const base = pointsMap.get(playerId) ?? 0;
      const multiplier =
        playerId === entry.captain_id
          ? 2
          : playerId === entry.vice_captain_id
          ? 1.5
          : 1;
      total += base * multiplier;
    });
    return {
      user_id: entry.user_id,
      match_id: payload.matchId,
      points: total,
      breakdown: {
        players,
        captainId: entry.captain_id,
        viceCaptainId: entry.vice_captain_id,
      },
      calculated_at: new Date().toISOString(),
    };
  });

  if (userRows.length > 0) {
    const { error: userUpsertError } = await adminClient
      .from("user_match_points")
      .upsert(userRows);
    if (userUpsertError) {
      return NextResponse.json(
        { ok: false, error: userUpsertError.message },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({
    ok: true,
    updatedPlayers: rows.length,
    updatedUsers: userRows.length,
  });
}
