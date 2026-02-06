"use client";

import Link from "next/link";

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-[#0B0F1A] text-white px-4 sm:px-6 py-8">
      <div className="max-w-3xl mx-auto space-y-8 text-sm text-slate-300">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-white">About</h1>
          <Link href="/" className="text-sm text-indigo-300 hover:underline">
            Home
          </Link>
        </div>

        <section className="space-y-3">
          <p>
            This platform exists to bring fantasy cricket back to its original
            format: season‑long planning, limited substitutions, and disciplined
            decision‑making.
          </p>
          <p>
            It is built around a simple belief: over a full tournament, skill
            matters more than short‑term luck.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-white">How Fantasy Evolved</h2>
          <p>
            Fantasy cricket started as a long game. You built a team, lived with
            your choices, and used substitutions carefully. It rewarded patience
            and preparation.
          </p>
          <p>
            Over time, fantasy shifted into daily formats. The game became
            faster, shorter, and more reactive.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-white">Marathon vs Sprint</h2>
          <p>
            Daily fantasy is a sprint — fast, intense, and immediate. Season‑long
            fantasy is a marathon — endurance, consistency, and long‑term
            clarity.
          </p>
          <p>
            This platform is designed for the marathon.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-white">Our Philosophy</h2>
          <div className="space-y-2">
            <div>Skill over luck.</div>
            <div>Planning over impulse.</div>
            <div>Consistency over instant wins.</div>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-white">Who This Is For</h2>
          <p>
            This is built for serious cricket minds — people who enjoy long‑form
            strategy and want their decisions to compound over a full season.
          </p>
          <p>
            It is not meant for everyone. If you want quick results and short
            cycles, this experience will feel slow by design.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-white">Closing Note</h2>
          <p>
            This platform is a challenge, not an invitation. If you align with
            the philosophy, you’ll feel it immediately. If not, it’s okay to
            step away.
          </p>
        </section>
      </div>
    </div>
  );
}
