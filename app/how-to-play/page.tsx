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

        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-4 text-sm text-slate-300">
          <div>1. Create your XI within 100 credits.</div>
          <div>2. Max 6 players from one country, max 4 star players.</div>
          <div>3. Minimum roles: 1 WK, 3 BAT, 1 AR, 3 BOWL.</div>
          <div>4. Pick Captain (2x) and Vice Captain (1.5x).</div>
          <div>
            5. Teams lock for 10 minutes starting at match time. After 10
            minutes, you can edit again for the next match.
          </div>
          <div>
            6. Subs reset by stage:
            Group: unlimited before Match 1, then 100 subs through Match 40.
            Super 8: unlimited before Match 41, then 30 subs through Match 52.
            Knockout: unlimited before Match 53, then 5 subs through Match 55.
          </div>
          <div>7. Your points update every 5 minutes during live matches.</div>
        </div>
      </div>
    </div>
  );
}
