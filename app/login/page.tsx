"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase, isSupabaseConfigured } from "@/utils/supabaseClient";
import { useAuth } from "@/hooks/useAuth";

export default function LoginPage() {
  const router = useRouter();
  const { user, ready } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!ready) return;
    if (user) router.replace("/");
  }, [user, ready, router]);

  useEffect(() => {
    setEmail("");
    setPassword("");
    setMessage("");
  }, []);

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
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      setMessage(error.message);
    } else {
      router.push("/");
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
    <div className="min-h-screen bg-[#0B0F1A] text-white px-4 py-8">
      <div className="max-w-sm mx-auto space-y-5">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.28em] text-indigo-300/70">
            Fantasy Cricket Season
          </div>
          <h1 className="text-3xl font-semibold leading-tight">
            Season-long fantasy cricket.
          </h1>
          <p className="text-[13px] text-slate-400 leading-relaxed">
            Build smart, lock on time, and manage limited substitutions.
          </p>
        </div>

        <div className="border border-white/10 bg-white/5 rounded-3xl p-6 space-y-4 shadow-[0_0_36px_rgba(79,70,229,0.12)] backdrop-blur">
          <div className="space-y-1">
            <h2 className="text-2xl font-semibold">Welcome back</h2>
            <p className="text-xs text-slate-300">
              Sign in to manage your team and leagues.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block text-xs text-slate-300">
              Email
              <input
                type="email"
                autoComplete="off"
                value={email}
                onChange={event => setEmail(event.target.value)}
                className="mt-1 w-full rounded-xl bg-slate-900/70 border border-white/10 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600/50"
              />
            </label>
            <label className="block text-xs text-slate-300">
              Password
              <input
                type="password"
                autoComplete="off"
                value={password}
                onChange={event => setPassword(event.target.value)}
                className="mt-1 w-full rounded-xl bg-slate-900/70 border border-white/10 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600/50"
              />
            </label>

            <button
              type="button"
              onClick={handleForgotPassword}
              className="text-xs text-indigo-300 hover:underline self-start"
            >
              Forgot password?
            </button>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold disabled:opacity-60"
            >
              {loading ? "Working..." : "Sign in"}
            </button>
          </form>

          {message && (
            <div className="text-xs text-slate-300 border border-white/10 rounded-lg px-3 py-2">
              {message}
            </div>
          )}

          <div className="text-xs text-slate-300">
            New here?{" "}
            <a href="/signup" className="text-indigo-300 hover:underline">
              Create account
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
