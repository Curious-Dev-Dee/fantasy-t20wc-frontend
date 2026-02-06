"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import AuthStatus from "./AuthStatus";
import { useAuth } from "@/hooks/useAuth";
import { isAdminEmail } from "@/utils/admin";

export default function Header() {
  const { user } = useAuth();
  const pathname = usePathname();
  if (pathname === "/team" || pathname === "/team/edit") return null;
  const hideNav = !user || pathname === "/login";
  const showAdmin =
    process.env.NEXT_PUBLIC_SHOW_ADMIN === "true" &&
    isAdminEmail(user?.email);

  return (
    <header className="bg-gradient-to-r from-[#0B0F1A] to-[#111827] border-b border-white/10 px-4 sm:px-6 py-5">
      <div className="max-w-6xl mx-auto flex flex-col items-center text-center sm:items-start sm:text-left">
        {/* Brand */}
        <h1 className="text-xl sm:text-2xl font-semibold text-white tracking-wide">
          Experience XI
        </h1>

        {/* Sponsor line */}
        <p className="mt-1 text-[10px] sm:text-sm text-white/50 tracking-wide">
          Sponsored by <span className="text-white/70">Red Zone & Co</span> -
          Powered by <span className="text-white/70">Flake Brothers</span>
        </p>

        <div className="mt-3 flex flex-wrap items-center justify-center sm:justify-start gap-3 text-xs">
          {showAdmin && !hideNav && (
            <>
              <Link
                href="/admin/match-stats"
                className="text-indigo-300 hover:underline"
              >
                Admin: Match Stats
              </Link>
            </>
          )}
          {!hideNav && <AuthStatus />}
        </div>

        {!hideNav && (
          <nav className="mt-3 flex flex-wrap items-center justify-center sm:justify-start gap-4 text-[11px] sm:text-xs text-indigo-200">
            <Link href="/" className="hover:underline">
              Home
            </Link>
            <Link href="/leaderboard" className="hover:underline">
              Leaderboard
            </Link>
            <Link href="/leagues" className="hover:underline">
              Leagues
            </Link>
            <Link href="/fixtures" className="hover:underline">
              Fixtures
            </Link>
            <Link href="/how-to-play" className="hover:underline">
              How To Play
            </Link>
            <Link href="/rules" className="hover:underline">
              Points Rules
            </Link>
          </nav>
        )}
      </div>
    </header>
  );
}
