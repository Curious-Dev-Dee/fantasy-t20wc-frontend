"use client";

import { useEffect, useState } from "react";
import { fixtures } from "@/data/fixtures";

const REFRESH_MS = 30 * 1000;
const LOCK_WINDOW_MS = 10 * 60 * 1000;

export function useTournament() {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, REFRESH_MS);

    return () => clearInterval(interval);
  }, []);

  const sorted = [...fixtures].sort(
    (a, b) =>
      new Date(a.startTimeUTC).getTime() -
      new Date(b.startTimeUTC).getTime()
  );

  const upcoming = sorted.filter(
    m => new Date(m.startTimeUTC).getTime() >= now
  );

  const lockWindowMatch = sorted.find(match => {
    const start = new Date(match.startTimeUTC).getTime();
    return now >= start && now < start + LOCK_WINDOW_MS;
  });

  const nextMatch = upcoming[0];
  const nextMatches = upcoming.slice(0, 5);

  const nextMatchTime = nextMatch
    ? new Date(nextMatch.startTimeUTC).getTime()
    : null;

  const isLocked =
    nextMatchTime !== null && now >= nextMatchTime && now < nextMatchTime + LOCK_WINDOW_MS;
  const lockWindowEndsAt = lockWindowMatch
    ? new Date(lockWindowMatch.startTimeUTC).getTime() + LOCK_WINDOW_MS
    : null;

  return {
    now,
    nextMatch,
    nextMatches,
    isLocked: Boolean(isLocked),
    lockWindowMatch,
    lockWindowEndsAt,
    lockWindowMinutes: LOCK_WINDOW_MS / 60000,
  };
}
