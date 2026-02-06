"use client";

import { useEffect, useState } from "react";
import { useProfile } from "@/hooks/useProfile";
import { useAuth } from "@/hooks/useAuth";

export default function ProfilePage() {
  const { user } = useAuth();
  const { profile, saveProfile, loading } = useProfile();
  const [fullName, setFullName] = useState("");
  const [teamName, setTeamName] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoDirty, setPhotoDirty] = useState(false);

  useEffect(() => {
    setFullName(profile.full_name || "");
    setTeamName(profile.team_name || "");
    setPhotoPreview(profile.team_photo_url || null);
    setPhotoDirty(false);
  }, [profile.full_name, profile.team_name]);

  const canEditName = !profile.full_name_edit_used;
  const canEditTeam = !profile.team_name_edit_used;

  const handleSave = async () => {
    setMessage(null);
    if (!user) return;

    const nextFullName = canEditName ? fullName.trim() : profile.full_name;
    const nextTeamName = canEditTeam ? teamName.trim() : profile.team_name;

    const fullNameChanged = Boolean(
      canEditName && nextFullName && nextFullName !== profile.full_name
    );
    const teamNameChanged = Boolean(
      canEditTeam && nextTeamName && nextTeamName !== profile.team_name
    );

    if (canEditName && !nextFullName) {
      setMessage("Full name cannot be empty.");
      return;
    }
    if (canEditTeam && !nextTeamName) {
      setMessage("Team name cannot be empty.");
      return;
    }

    await saveProfile({
      ...profile,
      full_name: nextFullName,
      team_name: nextTeamName,
      full_name_edit_used: Boolean(profile.full_name_edit_used) || fullNameChanged,
      team_name_edit_used: Boolean(profile.team_name_edit_used) || teamNameChanged,
      team_photo_url: photoPreview,
    });

    setMessage("Profile updated.");
    setPhotoDirty(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B0F1A] text-white px-4 sm:px-6 py-8">
        <div className="max-w-3xl mx-auto text-sm text-slate-300">
          Loading profile…
        </div>
      </div>
    );
  }

  const handlePhotoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      setPhotoPreview(profile.team_photo_url || null);
      setPhotoDirty(false);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result?.toString() || null;
      setPhotoPreview(result);
      setPhotoDirty(true);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="min-h-screen bg-[#0B0F1A] text-white px-4 sm:px-6 py-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Profile</h1>
          <p className="text-xs text-slate-400 mt-1">
            You can edit your name and team name only once.
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-4">
          <label className="block text-xs text-slate-300">
            Full Name
            <input
              value={fullName}
              onChange={event => setFullName(event.target.value)}
              disabled={!canEditName}
              className="mt-1 w-full rounded-lg bg-slate-900 border border-white/10 px-3 py-2 text-sm disabled:opacity-60"
            />
            {!canEditName && (
              <div className="mt-1 text-[10px] text-slate-500">
                Name edit already used.
              </div>
            )}
          </label>

          <label className="block text-xs text-slate-300">
            Team Name
            <input
              value={teamName}
              onChange={event => setTeamName(event.target.value)}
              disabled={!canEditTeam}
              className="mt-1 w-full rounded-lg bg-slate-900 border border-white/10 px-3 py-2 text-sm disabled:opacity-60"
            />
            {!canEditTeam && (
              <div className="mt-1 text-[10px] text-slate-500">
                Team name edit already used.
              </div>
            )}
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-slate-300">
            <div>
              <div className="text-slate-400">Email</div>
              <div className="mt-1 text-sm text-white">{user?.email}</div>
            </div>
            <div>
              <div className="text-slate-400">Contact Number</div>
              <div className="mt-1 text-sm text-white">
                {profile.contact_number}
              </div>
            </div>
            <div>
              <div className="text-slate-400">Country</div>
              <div className="mt-1 text-sm text-white">{profile.country}</div>
            </div>
            <div>
              <div className="text-slate-400">State</div>
              <div className="mt-1 text-sm text-white">{profile.state}</div>
            </div>
            <div>
              <div className="text-slate-400">Favorite Team</div>
              <div className="mt-1 text-sm text-white">
                {profile.favorite_team}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-xs text-slate-300">Team Photo (optional)</div>
            <label className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2 text-xs text-slate-200 cursor-pointer">
              <span className="text-slate-300">Upload team logo</span>
              <span className="rounded-full bg-indigo-600/80 px-3 py-1 text-[10px] text-white">
                Choose File
              </span>
              <input
                type="file"
                accept="image/*"
                onChange={handlePhotoChange}
                className="hidden"
              />
            </label>
            <div className="text-[10px] text-slate-400">
              You can change this anytime.
            </div>
          </div>
          {photoPreview && (
            <img
              src={photoPreview}
              alt="Team preview"
              className="h-16 w-16 rounded-full border border-white/10 object-cover"
            />
          )}

          <button
            onClick={handleSave}
            className="w-full rounded-xl bg-indigo-600 py-2 text-sm font-semibold disabled:opacity-60"
            disabled={!canEditName && !canEditTeam && !photoDirty}
          >
            Save Changes
          </button>

          {message && (
            <div className="text-xs text-slate-300 border border-white/10 rounded-lg px-3 py-2">
              {message}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
