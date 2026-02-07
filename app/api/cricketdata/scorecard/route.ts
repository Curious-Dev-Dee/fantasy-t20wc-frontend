import { NextResponse } from "next/server";
import { cricketDataFetch } from "@/utils/cricketdataClient";
import { checkRateLimit, requireAuthenticatedUser } from "@/utils/server/requestGuards";

export async function GET(request: Request) {
  const auth = await requireAuthenticatedUser(request);
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, error: auth.error },
      { status: auth.status }
    );
  }

  const rateLimit = checkRateLimit(`cricketdata:scorecard:${auth.userId}`, {
    windowMs: 60 * 1000,
    max: 60,
  });
  if (!rateLimit.ok) {
    return NextResponse.json(
      { ok: false, error: "Too many requests" },
      {
        status: 429,
        headers: {
          "Retry-After": String(rateLimit.retryAfterSeconds),
        },
      }
    );
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json(
      { ok: false, error: "Missing match id" },
      { status: 400 }
    );
  }

  const result = await cricketDataFetch<unknown>("match_scorecard", { id });
  if (!result) {
    return NextResponse.json(
      { ok: false, error: "CRICKETDATA_API_KEY is missing" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: result.ok,
    status: result.status,
    payload: {
      ...result.payload,
      apikey: undefined,
    },
  });
}
