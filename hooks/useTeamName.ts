"use client";

import { useEffect, useState } from "react";
import { getJSON, setJSON, scopedKey } from "@/utils/storage";
import { useAuth } from "@/hooks/useAuth";
import { fetchUserTeam, upsertUserTeam } from "@/utils/teamPersistence";

const STORAGE_KEY = "fantasy_team_name";
const DEFAULT_NAME = "My Team";

export function useTeamName() {
  const { user, ready, isConfigured } = useAuth();
  const [teamName, setTeamName] = useState(DEFAULT_NAME);

  useEffect(() => {
    const key = scopedKey(STORAGE_KEY, user?.id);
    const saved = getJSON<string | null>(key, null);
    if (saved) setTeamName(saved);
  }, [user?.id]);

  useEffect(() => {
    if (!ready) return;
    if (!user || !isConfigured) return;

    const load = async () => {
      const remote = await fetchUserTeam(user.id);
      const key = scopedKey(STORAGE_KEY, user.id);
      if (remote?.team_name) {
        setTeamName(remote.team_name);
        setJSON(key, remote.team_name);
        return;
      }

      const metaTeam = typeof user.user_metadata?.team_name === "string"
        ? user.user_metadata.team_name
        : "";

      if (metaTeam) {
        setTeamName(metaTeam);
        setJSON(key, metaTeam);
        await upsertUserTeam(user.id, { team_name: metaTeam });
        return;
      }

      const local = getJSON<string | null>(key, null);
      if (local) {
        await upsertUserTeam(user.id, { team_name: local });
      }
    };

    load();
  }, [user, ready, isConfigured]);

  const updateTeamName = (name: string) => {
    const next = name.trim() || DEFAULT_NAME;
    setTeamName(next);
    const key = scopedKey(STORAGE_KEY, user?.id);
    setJSON(key, next);
    if (user && isConfigured) {
      upsertUserTeam(user.id, { team_name: next });
    }
  };

  return { teamName, setTeamName: updateTeamName };
}
