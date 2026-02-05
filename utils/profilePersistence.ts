import { supabase, isSupabaseConfigured } from "@/utils/supabaseClient";

export type UserProfileRow = {
  user_id: string;
  full_name: string;
  team_name: string;
  contact_number: string;
  country: string;
  state: string;
  favorite_team: string;
  team_photo_url: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export async function fetchUserProfile(userId: string) {
  if (!isSupabaseConfigured || !supabase) return null;
  const { data, error } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("user_id", userId)
    .single();
  if (error) return null;
  return data as UserProfileRow;
}

export async function upsertUserProfile(profile: UserProfileRow) {
  if (!isSupabaseConfigured || !supabase) return;
  await supabase.from("user_profiles").upsert(profile);
}
