"use client";

import Link from "next/link";

export default function RulesPage() {
  return (
    <div className="min-h-screen bg-[#0B0F1A] text-white px-4 sm:px-6 py-8">
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Points Rules</h1>
            <p className="text-xs text-slate-400 mt-1">
              Transparent scoring to help you plan your XI.
            </p>
          </div>
          <Link href="/" className="text-sm text-indigo-300 hover:underline">
            Home
          </Link>
        </div>

        <Section title="Base Participation">
          <Rule label="In Playing XI" value="+4" />
          <Rule label="Impact Player Played" value="+4" />
        </Section>

        <Section title="Batting">
          <Rule label="Runs" value="+1 per run" />
          <Rule label="Four" value="+2" />
          <Rule label="Six" value="+4" />
          <Rule label="25 runs" value="+5 bonus" />
          <Rule label="50 runs" value="+10 bonus" />
          <Rule label="75 runs" value="+20 bonus" />
          <Rule label="100 runs" value="+30 bonus" />
          <Rule label="Strike rate 130-149.99" value="+2" />
          <Rule label="Strike rate 150-169.99" value="+4" />
          <Rule label="Strike rate 170+" value="+6" />
          <Rule label="Strike rate below 50 (min 10 balls)" value="-6" />
          <Rule label="Duck (non-bowlers only)" value="-10" />
        </Section>

        <Section title="Bowling">
          <Rule label="Wicket" value="+25" />
          <Rule label="Maiden Over" value="+10" />
          <Rule label="3 Wickets" value="+15 bonus" />
          <Rule label="4 Wickets" value="+20 bonus" />
          <Rule label="5 Wickets" value="+30 bonus" />
          <Rule label="Economy under 5 (min 2 overs)" value="+15" />
          <Rule label="Economy 5-5.99" value="+8" />
          <Rule label="Economy 6-7" value="+2" />
          <Rule label="Economy 10-11" value="-2" />
          <Rule label="Economy 11.01-12" value="-4" />
          <Rule label="Economy above 12" value="-15" />
        </Section>

        <Section title="Fielding">
          <Rule label="Catch" value="+8" />
          <Rule label="3+ catches in an innings" value="+5 bonus" />
          <Rule label="Stumping" value="+10" />
          <Rule label="Run out (direct)" value="+10" />
          <Rule label="Run out (indirect)" value="+6" />
        </Section>

        <Section title="Captaincy">
          <Rule label="Captain" value="2x base points" />
          <Rule label="Vice Captain" value="1.5x base points" />
          <Rule label="Man of the Match (Captain/Vice Captain only)" value="+20" />
        </Section>

      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
      <h2 className="text-lg font-semibold mb-3">{title}</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
        {children}
      </div>
    </div>
  );
}

function Rule({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border border-white/10 rounded-lg px-3 py-2">
      <span className="text-slate-200">{label}</span>
      <span className="text-indigo-200 font-semibold">{value}</span>
    </div>
  );
}
