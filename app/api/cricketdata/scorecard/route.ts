import { NextResponse } from "next/server";
import { cricketDataFetch } from "@/utils/cricketdataClient";

export async function GET(request: Request) {
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
