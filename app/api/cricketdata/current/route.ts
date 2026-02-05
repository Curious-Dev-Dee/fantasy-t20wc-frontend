import { NextResponse } from "next/server";
import { cricketDataFetch } from "@/utils/cricketdataClient";

export async function GET() {
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
