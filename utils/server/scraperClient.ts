// utils/server/scraperClient.ts
// Backend-only unofficial cricket data fetcher
// Used ONLY by cron jobs

export type ScraperMatch = {
  id: string;
  teams?: string[];
  status?: string;
};

export async function fetchLiveMatches() {
  const res = await fetch("https://cricket-api.vercel.app/matches", {
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error("Failed to fetch live matches");
  }

  return res.json();
}

export async function fetchScorecard(matchId: string) {
  const res = await fetch(
    `https://cricket-api.vercel.app/scorecard?matchId=${matchId}`,
    {
      cache: "no-store",
    }
  );

  if (!res.ok) {
    throw new Error("Failed to fetch scorecard");
  }

  return res.json();
}
