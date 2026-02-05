"use client";

import { useEffect, useState } from "react";
import type { PlayerMatchStats } from "@/data/matchStats";
import { playerMatchStats as baseStats } from "@/data/matchStats";
import { getJSON, setJSON, scopedKey } from "@/utils/storage";
import { useAuth } from "@/hooks/useAuth";
import {
  fetchMatchStats,
  normalizeMatchStats,
  upsertMatchStats,
} from "@/utils/matchStatsPersistence";

const STORAGE_KEY = "fantasy_match_stats";

export function useMatchStats() {
  const { user, ready, isConfigured } = useAuth();
  const [stats, setStats] = useState<PlayerMatchStats[]>(baseStats);
  const isRemote = Boolean(user && isConfigured);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    if (!ready) return;
    if (user && isConfigured) {
      const loadRemote = async () => {
        const rows = await fetchMatchStats();
        if (rows.length > 0) {
          setStats(normalizeMatchStats(rows));
          return;
        }
        await upsertMatchStats(baseStats);
        setStats(baseStats);
      };
      loadRemote();
      return;
    }

    const key = scopedKey(STORAGE_KEY, user?.id);
    const parsed = getJSON<PlayerMatchStats[] | null>(key, null);
    if (!parsed) {
      setJSON(key, baseStats);
      return;
    }
    if (Array.isArray(parsed) && parsed.length > 0) {
      setStats(parsed);
    }
  }, [ready, user, isConfigured]);

  const persist = (next: PlayerMatchStats[]) => {
    setStats(next);
    const key = scopedKey(STORAGE_KEY, user?.id);
    setJSON(key, next);
    if (user && isConfigured) {
      upsertMatchStats(next);
    }
  };

  const refresh = async () => {
    if (!user || !isConfigured) return;
    setIsRefreshing(true);
    try {
      const rows = await fetchMatchStats();
      if (rows.length > 0) {
        setStats(normalizeMatchStats(rows));
      }
    } finally {
      setIsRefreshing(false);
    }
  };

  return { stats, setStats: persist, isRemote, refresh, isRefreshing };
}
