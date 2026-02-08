"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabaseClient";
import { useAuth } from "@/hooks/useAuth";

export default function AuthStatus() {
  const { user, ready, isConfigured } = useAuth();
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!ready) return;
  }, [ready]);

  const handleLogout = async () => {
    setLoading(true);
    try {
      if (supabase) {
        await supabase.auth.signOut({ scope: "global" });
      }
    } catch {
      // Logout errors are handled by redirecting to login
    } finally {
      try {
        const keys = Object.keys(localStorage || {});
        keys
          .filter(
            key =>
              key.startsWith("sb-") ||
              key.includes("supabase") ||
              key.includes("auth-token")
          )
          .forEach(key => localStorage.removeItem(key));
      } catch {
        // ignore storage cleanup errors
      }
      setLoading(false);
      router.replace("/login");
      router.refresh();
    }
  };

  if (!ready) {
    return <div className="text-[10px] text-slate-400">Loading...</div>;
  }

  if (!isConfigured) {
    return (
      <div className="text-[10px] text-slate-400">
        Auth not configured
      </div>
    );
  }

  if (!user) {
    return (
      <Link
        href="/login"
        className="text-xs text-indigo-200 hover:underline"
      >
        Login
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-3 text-xs text-indigo-200">
      <span className="text-[10px] text-slate-300">
        {user.email}
      </span>
      <button
        onClick={handleLogout}
        className="text-indigo-200 hover:underline"
        disabled={loading}
      >
        {loading ? "Logging out..." : "Logout"}
      </button>
    </div>
  );
}
