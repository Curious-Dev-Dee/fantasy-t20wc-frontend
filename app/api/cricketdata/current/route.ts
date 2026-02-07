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

  const rateLimit = checkRateLimit(`cricketdata:current:${auth.userId}`, {
    windowMs: 60 * 1000,
    max: 30,
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

  const result = await cricketDataFetch<unknown[]>("currentMatches");
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
