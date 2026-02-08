import { NextRequest, NextResponse } from "next/server";
import { parseRawScorecard } from "@/utils/server/scorecardTextParser";

export async function POST(req: NextRequest) {
  try {
    const { raw, matchId } = await req.json();

    if (!raw || typeof raw !== "string") {
      return NextResponse.json(
        { error: "Raw scorecard text is required" },
        { status: 400 }
      );
    }

    if (!matchId || typeof matchId !== "number") {
      return NextResponse.json(
        { error: "matchId is required and must be a number" },
        { status: 400 }
      );
    }

    const parsed = parseRawScorecard(matchId, raw);

    return NextResponse.json({
      ok: true,
      parsed,
    });
  } catch (err) {
    console.error("parse-scorecard failed", err);
    return NextResponse.json(
      { error: "Failed to parse scorecard" },
      { status: 500 }
    );
  }
}
