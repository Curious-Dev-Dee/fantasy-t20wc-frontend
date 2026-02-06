"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { getJSON, setJSON, scopedKey } from "@/utils/storage";
import {
  fetchUserProfile,
  upsertUserProfile,
  type UserProfileRow,
} from "@/utils/profilePersistence";
import { upsertUserTeam } from "@/utils/teamPersistence";

const STORAGE_KEY = "fantasy_user_profile";

export type UserProfile = Omit<UserProfileRow, "user_id"> & { user_id?: string };

const EMPTY_PROFILE: UserProfile = {
  full_name: "",
  team_name: "",
  contact_number: "",
  country: "",
  state: "",
  favorite_team: "",
  team_photo_url: null,
  full_name_edit_used: false,
  team_name_edit_used: false,
};

export function useProfile() {
  const { user, ready, isConfigured } = useAuth();
  const [profile, setProfile] = useState<UserProfile>(EMPTY_PROFILE);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const key = scopedKey(STORAGE_KEY, user?.id);
    const cached = getJSON<UserProfile | null>(key, null);
    if (cached) {
      setProfile(cached);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!ready) return;
    if (!user || !isConfigured) {
      setLoading(false);
      return;
    }
    const load = async () => {
      const remote = await fetchUserProfile(user.id);
      if (remote) {
        const mapped: UserProfile = {
          full_name: remote.full_name,
          team_name: remote.team_name,
          contact_number: remote.contact_number,
          country: remote.country,
          state: remote.state,
          favorite_team: remote.favorite_team,
          team_photo_url: remote.team_photo_url,
          full_name_edit_used: Boolean(remote.full_name_edit_used),
          team_name_edit_used: Boolean(remote.team_name_edit_used),
        };
        setProfile(mapped);
        setJSON(scopedKey(STORAGE_KEY, user.id), mapped);
        if (remote.team_name) {
          await upsertUserTeam(user.id, { team_name: remote.team_name });
        }
        setLoading(false);
        return;
      }

      const meta = user.user_metadata || {};
      const derived: UserProfile = {
        full_name: meta.full_name || "",
        team_name: meta.team_name || "",
        contact_number: meta.contact_number || "",
        country: meta.country || "",
        state: meta.state || "",
        favorite_team: meta.favorite_team || "",
        team_photo_url: meta.team_photo_url || null,
        full_name_edit_used: false,
        team_name_edit_used: false,
      };

      if (derived.full_name || derived.team_name) {
        await upsertUserProfile({
          user_id: user.id,
          full_name: derived.full_name,
          team_name: derived.team_name,
          contact_number: derived.contact_number,
          country: derived.country,
          state: derived.state,
          favorite_team: derived.favorite_team,
          team_photo_url: derived.team_photo_url,
          full_name_edit_used: derived.full_name_edit_used,
          team_name_edit_used: derived.team_name_edit_used,
        });
        if (derived.team_name) {
          await upsertUserTeam(user.id, { team_name: derived.team_name });
        }
        setProfile(derived);
        setJSON(scopedKey(STORAGE_KEY, user.id), derived);
      }
      setLoading(false);
    };
    load();
  }, [user, ready, isConfigured]);

  const saveProfile = async (next: UserProfile) => {
    setProfile(next);
    setJSON(scopedKey(STORAGE_KEY, user?.id), next);
    if (user && isConfigured) {
      await upsertUserProfile({
        user_id: user.id,
        full_name: next.full_name,
        team_name: next.team_name,
        contact_number: next.contact_number,
        country: next.country,
        state: next.state,
        favorite_team: next.favorite_team,
        team_photo_url: next.team_photo_url,
        full_name_edit_used: next.full_name_edit_used,
        team_name_edit_used: next.team_name_edit_used,
      });
      if (next.team_name) {
        await upsertUserTeam(user.id, { team_name: next.team_name });
      }
    }
  };

  const isComplete = useMemo(() => {
    return (
      profile.full_name.trim().length > 0 &&
      profile.team_name.trim().length > 0 &&
      profile.contact_number.trim().length > 0 &&
      profile.country.trim().length > 0 &&
      profile.state.trim().length > 0 &&
      profile.favorite_team.trim().length > 0
    );
  }, [profile]);

  return { profile, setProfile, saveProfile, loading, isComplete };
}
