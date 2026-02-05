"use client";

import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";

export default function DashboardPage() {
  const { user, ready } = useAuth();

  return (
    <main className="p-6 min-h-screen bg-[#0B0F1A] text-white">
      <div className="max-w-3xl mx-auto space-y-3">
        <h2 className="text-2xl font-semibold">Dashboard</h2>
        {!ready && (
          <p className="text-sm text-slate-400">Loading...</p>
        )}
        {ready && !user && (
          <p className="text-sm text-slate-400">
            Please{" "}
            <Link href="/login" className="text-indigo-300 hover:underline">
              login
            </Link>{" "}
            to access your team and leagues.
          </p>
        )}
        {ready && user && (
          <p className="text-sm text-slate-300">
            Welcome back! You can now manage your team and leagues.
          </p>
        )}
      </div>
    </main>
  );
}
