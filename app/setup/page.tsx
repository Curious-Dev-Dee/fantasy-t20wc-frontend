\"use client\";

import { useEffect } from \"react\";
import { useRouter } from \"next/navigation\";
import { useAuth } from \"@/hooks/useAuth\";

export default function SetupPage() {
  const router = useRouter();
  const { user, ready } = useAuth();

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      router.replace(\"/login\");
      return;
    }
    router.replace(\"/\");
  }, [user, ready, router]);

  return (
    <div className=\"min-h-screen bg-[#0B0F1A] text-white px-4 py-10\">
      <div className=\"max-w-xl mx-auto text-sm text-slate-400\">
        Redirecting...
      </div>
    </div>
  );
}
    if (file.size > MAX_IMAGE_SIZE) {
      setError("Please upload an image under 400KB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : null;
      setProfile({ ...profile, team_photo_url: result });
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    setError("");
    if (!isComplete) {
      setError("Please fill all required fields.");
      return;
    }
    setShowConfirm(true);
  };

  const confirmSave = async () => {
    setSaving(true);
    await saveProfile(profile);
    setTeamName(profile.team_name);
    setSaving(false);
    setShowConfirm(false);
    router.replace("/");
  };

  if (!ready || loading) {
    return (
      <div className="min-h-screen bg-[#0B0F1A] text-white p-6">
        <div className="max-w-xl mx-auto text-sm text-slate-400">
          Loading setup...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B0F1A] text-white p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Initial Setup</h1>
            <p className="text-xs text-slate-400 mt-1">
              Complete this once to personalize your team experience.
            </p>
          </div>
          <Link href="/" className="text-sm text-indigo-300 hover:underline">
            Home
          </Link>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="text-xs text-slate-300 space-y-1">
              Full Name *
              <input
                value={profile.full_name}
                onChange={event =>
                  setProfile({ ...profile, full_name: event.target.value })
                }
                className="w-full rounded-lg bg-slate-900 border border-white/10 px-3 py-2 text-sm"
              />
            </label>
            <label className="text-xs text-slate-300 space-y-1">
              Team Name *
              <input
                value={profile.team_name}
                onChange={event =>
                  setProfile({ ...profile, team_name: event.target.value })
                }
                className="w-full rounded-lg bg-slate-900 border border-white/10 px-3 py-2 text-sm"
              />
            </label>
            <label className="text-xs text-slate-300 space-y-1">
              Contact Number *
              <input
                value={profile.contact_number}
                onChange={event =>
                  setProfile({
                    ...profile,
                    contact_number: event.target.value,
                  })
                }
                className="w-full rounded-lg bg-slate-900 border border-white/10 px-3 py-2 text-sm"
              />
            </label>
            <label className="text-xs text-slate-300 space-y-1">
              Country *
              <input
                value={profile.country}
                onChange={event =>
                  setProfile({ ...profile, country: event.target.value })
                }
                className="w-full rounded-lg bg-slate-900 border border-white/10 px-3 py-2 text-sm"
              />
            </label>
            <label className="text-xs text-slate-300 space-y-1">
              State *
              <input
                value={profile.state}
                onChange={event =>
                  setProfile({ ...profile, state: event.target.value })
                }
                className="w-full rounded-lg bg-slate-900 border border-white/10 px-3 py-2 text-sm"
              />
            </label>
            <label className="text-xs text-slate-300 space-y-1">
              Favorite Team *
              <select
                value={profile.favorite_team}
                onChange={event =>
                  setProfile({
                    ...profile,
                    favorite_team: event.target.value,
                  })
                }
                className="w-full rounded-lg bg-slate-900 border border-white/10 px-3 py-2 text-sm"
              >
                <option value="">Select team</option>
                {teams.map(team => (
                  <option key={team} value={team}>
                    {team}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="space-y-2">
            <div className="text-xs text-slate-300">Team Photo (optional)</div>
            <input
              type="file"
              accept="image/*"
              onChange={event => handleFile(event.target.files?.[0] ?? null)}
              className="text-xs text-slate-300"
            />
            {profile.team_photo_url && (
              <img
                src={profile.team_photo_url}
                alt="Team"
                className="h-20 w-20 rounded-full border border-white/10 object-cover"
              />
            )}
          </div>

          {error && (
            <div className="text-xs text-red-300 border border-red-500/40 bg-red-500/10 px-3 py-2 rounded-lg">
              {error}
            </div>
          )}

          <button
            onClick={handleSave}
            className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold"
          >
            Save Setup
          </button>
        </div>
      </div>

      {showConfirm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-[#0F1626] border border-white/10 p-6 space-y-4">
            <h2 className="text-lg font-semibold">Confirm Setup</h2>
            <p className="text-xs text-slate-400">
              These details cannot be changed later. Are you sure you want to
              save?
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-end">
              <button
                onClick={() => setShowConfirm(false)}
                className="px-4 py-2 rounded bg-slate-700 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={confirmSave}
                disabled={saving}
                className="px-4 py-2 rounded bg-green-600 text-sm disabled:opacity-60"
              >
                {saving ? "Saving..." : "Confirm Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
