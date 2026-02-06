"use client";

import Link from "next/link";

export default function HowToPlayPage() {
  return (
    <div className="min-h-screen bg-[#0B0F1A] text-white px-4 sm:px-6 py-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">How To Play</h1>
          <Link href="/" className="text-sm text-indigo-300 hover:underline">
            Home
          </Link>
        </div>

        <div className="space-y-6 text-sm text-slate-300">
          <section className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-3">
            <h2 className="text-base font-semibold text-white">Season Format</h2>
            <p>
              This is a season‑long fantasy cricket game. You build a core XI,
              manage substitutions across the tournament, and compete for the
              full season leaderboard.
            </p>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-3">
            <h2 className="text-base font-semibold text-white">Core Flow</h2>
            <div className="space-y-2">
              <div>1. Create your initial XI (11 players).</div>
              <div>2. Players earn points from real match performance.</div>
              <div>
                3. Your team score ranks on global and private leaderboards.
              </div>
              <div>4. Winners receive official prizes.</div>
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-3">
            <h2 className="text-base font-semibold text-white">Match Lock</h2>
            <div className="space-y-2">
              <div>Teams can be edited unlimited times before match start.</div>
              <div>At match start, the team locks automatically.</div>
              <div>Only the locked XI counts for that match.</div>
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-3">
            <h2 className="text-base font-semibold text-white">
              Substitutions (Strategic Resource)
            </h2>
            <p>
              Substitutions are limited across the season. Use them carefully.
              A substitution is counted by comparing your previous locked XI to
              your current locked XI — only actual changes reduce the count.
            </p>
            <div className="space-y-2">
              <div>
                Group Stage: Match 1 free XI, next 39 matches = 100 subs total.
              </div>
              <div>
                Super 8: Match 41 free XI, remaining matches = 30 subs total.
              </div>
              <div>
                Knockout: Match 53 free XI, remaining matches = 5 subs total.
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-3">
            <h2 className="text-base font-semibold text-white">
              Captain & Vice‑Captain
            </h2>
            <div className="space-y-2">
              <div>Captain earns 2× points.</div>
              <div>Vice‑Captain earns 1.5× points.</div>
              <div>Both can be changed before each lock.</div>
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-3">
            <h2 className="text-base font-semibold text-white">
              Scoring Reference
            </h2>
            <p>
              Detailed scoring is listed on the{" "}
              <Link href="/rules" className="text-indigo-300 hover:underline">
                Points Rules
              </Link>{" "}
              page.
            </p>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-3">
            <h2 className="text-base font-semibold text-white">
              Expectation Setting
            </h2>
            <p>
              This is not daily fantasy. It rewards long‑term planning, match
              preparation, and disciplined substitutions.
            </p>
          </section>

          <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-2">
              <h3 className="text-base font-semibold text-white">
                This game is for you if…
              </h3>
              <div>• You follow cricket closely.</div>
              <div>• You like long‑term strategy.</div>
              <div>• You want serious competition.</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-2">
              <h3 className="text-base font-semibold text-white">
                This game is not for you if…
              </h3>
              <div>• You want daily fantasy.</div>
              <div>• You prefer short sessions.</div>
              <div>• You don’t want season planning.</div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
