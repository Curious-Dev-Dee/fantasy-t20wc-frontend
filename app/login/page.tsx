"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase, isSupabaseConfigured } from "@/utils/supabaseClient";
import { useAuth } from "@/hooks/useAuth";
import { fixtures } from "@/data/fixtures";

export default function LoginPage() {
  const router = useRouter();
  const { user, ready } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [fullName, setFullName] = useState("");
  const [teamName, setTeamName] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [country, setCountry] = useState("");
  const [stateName, setStateName] = useState("");
  const [favoriteTeam, setFavoriteTeam] = useState("");

  const teamOptions = useMemo(() => {
    const unique = new Set<string>();
    fixtures.forEach(match => {
      match.teams.forEach(team => unique.add(team));
    });
    return Array.from(unique).sort();
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (user) router.replace("/");
  }, [user, ready, router]);

  useEffect(() => {
    setEmail("");
    setPassword("");
    setMessage("");
  }, [mode]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage("");

    if (!isSupabaseConfigured || !supabase) {
      setMessage("Supabase is not configured.");
      return;
    }

    if (!email || !password) {
      setMessage("Enter email and password.");
      return;
    }
    if (mode === "signup") {
      if (
        !fullName ||
        !teamName ||
        !contactNumber ||
        !country ||
        !stateName ||
        !favoriteTeam
      ) {
        setMessage("Please fill all details to create your account.");
        return;
      }
    }
    setLoading(true);
    if (mode === "signup") {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName || undefined,
            team_name: teamName || undefined,
            contact_number: contactNumber || undefined,
            country: country || undefined,
            state: stateName || undefined,
            favorite_team: favoriteTeam || undefined,
            // Avoid storing large base64 in auth session (can exceed storage quota).
          },
        },
      });
      if (error) {
        setMessage(error.message);
      } else {
        setMessage("Account created. Check your email to confirm.");
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        setMessage(error.message);
      } else {
        router.push("/");
      }
    }
    setLoading(false);
  };

  const handleForgotPassword = async () => {
    setMessage("");
    if (!email) {
      setMessage("Enter your email to reset password.");
      return;
    }
    if (!supabase) return;
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) {
      setMessage(error.message);
    } else {
      setMessage("Password reset email sent.");
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0F1A] text-white px-4 sm:px-6 py-8">
      <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.25em] text-indigo-300/70">
            Fantasy Cricket Season
          </div>
          <h1 className="text-3xl sm:text-4xl font-semibold leading-tight">
            Draft your XI. Lock on time.
          </h1>
          <p className="text-sm text-slate-400 max-w-md leading-relaxed">
            A clean, premium T20 fantasy experience for leagues and live scoring.
          </p>
          <div className="flex flex-wrap gap-2 text-[10px] text-slate-500">
            <div className="rounded-full border border-white/5 px-3 py-1">
              Live scores
            </div>
            <div className="rounded-full border border-white/5 px-3 py-1">
              Private leagues
            </div>
            <div className="rounded-full border border-white/5 px-3 py-1">
              Auto locks
            </div>
          </div>
        </div>

        <div className="border border-white/10 bg-white/5 rounded-3xl p-6 sm:p-7 space-y-5 shadow-[0_0_40px_rgba(79,70,229,0.15)] backdrop-blur">
          <div className="space-y-1">
            <h2 className="text-2xl font-semibold">
              {mode === "signin" ? "Welcome back" : "Create account"}
            </h2>
            <p className="text-xs text-slate-300">
              {mode === "signin"
                ? "Sign in to manage your team and leagues."
                : "Fill the details once to set up your team."}
            </p>
          </div>

          <div className="flex gap-2 text-[11px] bg-white/5 border border-white/10 rounded-full p-1">
            <button
              type="button"
              onClick={() => setMode("signin")}
              className={`px-3 py-1 rounded-full ${
                mode === "signin"
                  ? "bg-indigo-600 text-white"
                  : "text-slate-300"
              }`}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => setMode("signup")}
              className={`px-3 py-1 rounded-full ${
                mode === "signup"
                  ? "bg-indigo-600 text-white"
                  : "text-slate-300"
              }`}
            >
              Sign up
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block text-xs text-slate-300">
              Email
              <input
                type="email"
                autoComplete="off"
                value={email}
                onChange={event => setEmail(event.target.value)}
                className="mt-1 w-full rounded-lg bg-slate-900 border border-white/10 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600/50"
              />
            </label>
            <label className="block text-xs text-slate-300">
              Password
              <input
                type="password"
                autoComplete={mode === "signin" ? "off" : "new-password"}
                value={password}
                onChange={event => setPassword(event.target.value)}
                className="mt-1 w-full rounded-lg bg-slate-900 border border-white/10 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600/50"
              />
            </label>
            {mode === "signin" && (
              <button
                type="button"
                onClick={handleForgotPassword}
                className="text-xs text-indigo-300 hover:underline self-start"
              >
                Forgot password?
              </button>
            )}

            {mode === "signup" && (
              <div className="space-y-4">
                <label className="block text-xs text-slate-300">
                  Full Name
                  <input
                    value={fullName}
                    onChange={event => setFullName(event.target.value)}
                    className="mt-1 w-full rounded-lg bg-slate-900 border border-white/10 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600/50"
                  />
                </label>
                <label className="block text-xs text-slate-300">
                  Team Name
                  <input
                    value={teamName}
                    onChange={event => setTeamName(event.target.value)}
                    className="mt-1 w-full rounded-lg bg-slate-900 border border-white/10 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600/50"
                  />
                </label>
                <label className="block text-xs text-slate-300">
                  Contact Number
                  <input
                    value={contactNumber}
                    onChange={event => setContactNumber(event.target.value)}
                    className="mt-1 w-full rounded-lg bg-slate-900 border border-white/10 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600/50"
                  />
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <label className="block text-xs text-slate-300">
                    Country
                    <input
                      value={country}
                      onChange={event => setCountry(event.target.value)}
                      className="mt-1 w-full rounded-lg bg-slate-900 border border-white/10 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600/50"
                    />
                  </label>
                  <label className="block text-xs text-slate-300">
                    State
                    <input
                      value={stateName}
                      onChange={event => setStateName(event.target.value)}
                      className="mt-1 w-full rounded-lg bg-slate-900 border border-white/10 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600/50"
                    />
                  </label>
                </div>
                <label className="block text-xs text-slate-300">
                  Favorite Team
                  <select
                    value={favoriteTeam}
                    onChange={event => setFavoriteTeam(event.target.value)}
                    className="mt-1 w-full rounded-lg bg-slate-900 border border-white/10 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600/50"
                  >
                    <option value="">Select team</option>
                    {teamOptions.map(team => (
                      <option key={team} value={team}>
                        {team}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
            className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold disabled:opacity-60"
          >
              {loading
                ? "Working..."
                : mode === "signin"
                ? "Sign in"
                : "Create account"}
            </button>
          </form>

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
