"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { players } from "@/data/players";
import { fixtures } from "@/data/fixtures";
import type { MatchStats, PlayerMatchStats } from "@/data/matchStats";
import { useMatchStats } from "@/hooks/useMatchStats";
import { teamShort } from "@/utils/teamCodes";
import { useAuth } from "@/hooks/useAuth";
import { isAdminEmail } from "@/utils/admin";

const emptyStats: MatchStats = {
  matchId: 1,
  inPlayingXI: true,
  impactPlayer: false,
  batting: {
    runs: 0,
    balls: 0,
    fours: 0,
    sixes: 0,
    dismissed: false,
    duck: false,
  },
  bowling: {
    overs: 0,
    maidens: 0,
    wickets: 0,
    lbwBowled: 0,
    dotBalls: 0,
    runsConceded: 0,
  },
  fielding: {
    catches: 0,
    stumpings: 0,
    runOutDirect: 0,
    runOutIndirect: 0,
  },
};

export default function MatchStatsAdminPage() {
  const { user, ready } = useAuth();
  const { stats, setStats } = useMatchStats();
  const [playerId, setPlayerId] = useState(players[0]?.id || "");
  const [form, setForm] = useState<MatchStats>(emptyStats);
  const [message, setMessage] = useState<string | null>(null);
  const [csvMessage, setCsvMessage] = useState<string | null>(null);
  const [pointsPaste, setPointsPaste] = useState("");
  const [pointsMessage, setPointsMessage] = useState<string | null>(null);

  const fixtureOptions = useMemo(() => fixtures.slice(0, 55), []);

  const playerMap = useMemo(
    () => new Map(players.map(player => [player.id, player])),
    []
  );

  const playerNameMap = useMemo(() => {
    const normalize = (value: string) =>
      value
        .toLowerCase()
        .replace(/\(.*?\)/g, "")
        .replace(/[^a-z\s]/g, "")
        .replace(/\s+/g, " ")
        .trim();
    const map = new Map<string, string>();
    players.forEach(player => {
      map.set(normalize(player.name), player.id);
    });
    return { map, normalize };
  }, []);

  const fixtureMap = useMemo(
    () => new Map(fixtures.map(fixture => [fixture.matchId, fixture])),
    []
  );

  const recentEntries = useMemo(() => {
    const rows: {
      key: string;
      playerId: string;
      matchId: number;
      runs: number;
      wickets: number;
    }[] = [];
    stats.forEach(entry => {
      entry.matches.forEach(match => {
        rows.push({
          key: `${entry.playerId}-${match.matchId}`,
          playerId: entry.playerId,
          matchId: match.matchId,
          runs: match.batting?.runs ?? 0,
          wickets: match.bowling?.wickets ?? 0,
        });
      });
    });
    return rows.sort((a, b) => b.matchId - a.matchId).slice(0, 5);
  }, [stats]);

  if (!ready) {
    return (
      <div className="min-h-screen bg-[#0B0F1A] text-white p-6">
        <div className="max-w-3xl mx-auto text-sm text-slate-400">
          Loading...
        </div>
      </div>
    );
  }

  if (!user || !isAdminEmail(user.email)) {
    return (
      <div className="min-h-screen bg-[#0B0F1A] text-white p-6">
        <div className="max-w-3xl mx-auto space-y-3">
          <h1 className="text-2xl font-semibold">Admin only</h1>
          <p className="text-sm text-slate-400">
            You do not have permission to view this page.
          </p>
          <Link href="/" className="text-sm text-indigo-300 hover:underline">
            Go Home
          </Link>
        </div>
      </div>
    );
  }

  const handleSave = () => {
    if (!playerId) {
      setMessage("Select a player.");
      return;
    }
    const nextForm = { ...form };
    if (nextForm.batting) {
      if (nextForm.batting.runs > 0) {
        nextForm.batting.duck = false;
      }
      if (!nextForm.batting.dismissed) {
        nextForm.batting.duck = false;
      }
    }
    const errors: string[] = [];
    if (nextForm.batting) {
      const overridePoints = nextForm.batting.overridePoints;
      if (nextForm.batting.balls === 0 && nextForm.batting.runs > 0) {
        errors.push("Batting balls must be > 0 when runs > 0.");
      }
      if (typeof overridePoints !== "number") {
        if (
          nextForm.batting.runs < 0 ||
          nextForm.batting.balls < 0 ||
          nextForm.batting.fours < 0 ||
          nextForm.batting.sixes < 0
        ) {
          errors.push("Batting values must be non-negative.");
        }
      }
    }
    if (nextForm.bowling) {
      if (nextForm.bowling.overs === 0 && nextForm.bowling.wickets > 0) {
        errors.push("Bowling overs must be > 0 when wickets > 0.");
      }
      if (
        nextForm.bowling.overs < 0 ||
        nextForm.bowling.overs > 4 ||
        nextForm.bowling.maidens < 0 ||
        nextForm.bowling.wickets < 0 ||
        nextForm.bowling.wickets > 10 ||
        nextForm.bowling.dotBalls < 0 ||
        nextForm.bowling.dotBalls > Math.round(nextForm.bowling.overs * 6) ||
        nextForm.bowling.runsConceded < 0
      ) {
        errors.push("Bowling values are out of range.");
      }
    }
    if (nextForm.fielding) {
      if (
        nextForm.fielding.catches < 0 ||
        nextForm.fielding.stumpings < 0 ||
        nextForm.fielding.runOutDirect < 0 ||
        nextForm.fielding.runOutIndirect < 0
      ) {
        errors.push("Fielding values must be non-negative.");
      }
    }
    if (errors.length > 0) {
      setMessage(errors.join(" "));
      return;
    }
    const next: PlayerMatchStats[] = stats.map(entry =>
      entry.playerId === playerId
        ? {
            ...entry,
            matches: [
              ...entry.matches.filter(m => m.matchId !== form.matchId),
              nextForm,
            ],
          }
        : entry
    );

    if (!next.find(entry => entry.playerId === playerId)) {
      next.push({ playerId, matches: [nextForm] });
    }

    setStats(next);
    setMessage("Match stats saved.");
  };

  const parsePointsPaste = (text: string) => {
    const lines = text.split(/\r?\n/).map(line => line.trim());
    const entries: { playerId: string; points: number }[] = [];
    const { map, normalize } = playerNameMap;
    const playerNames = Array.from(map.keys()).sort(
      (a, b) => b.length - a.length
    );
    lines.forEach(line => {
      if (!line) return;
      if (/fantasy points/i.test(line)) return;
      if (/^player\b/i.test(line)) return;
      const totalMatch = line.match(/(-?\d+)\s*$/);
      if (!totalMatch) return;
      const total = Number(totalMatch[1]);
      const normalizedLine = normalize(line);
      let matchedId: string | null = null;
      for (const name of playerNames) {
        if (normalizedLine.startsWith(name)) {
          matchedId = map.get(name) || null;
          break;
        }
      }
      if (!matchedId) {
        for (const name of playerNames) {
          if (normalizedLine.includes(name)) {
            matchedId = map.get(name) || null;
            break;
          }
        }
      }
      if (!matchedId) return;
      entries.push({ playerId: matchedId, points: total });
    });
    return entries;
  };

  const handlePastePoints = () => {
    setPointsMessage(null);
    if (!pointsPaste.trim()) {
      setPointsMessage("Paste fantasy points first.");
      return;
    }
    if (!form.matchId) {
      setPointsMessage("Select a match.");
      return;
    }
    const entries = parsePointsPaste(pointsPaste);
    if (entries.length === 0) {
      setPointsMessage("No valid player totals found.");
      return;
    }
    const next: PlayerMatchStats[] = [...stats];
    const nextMap = new Map(next.map(entry => [entry.playerId, entry]));
    entries.forEach(entry => {
      const existing =
        nextMap.get(entry.playerId) || ({ playerId: entry.playerId, matches: [] } as PlayerMatchStats);
      const matches = existing.matches.filter(m => m.matchId !== form.matchId);
      matches.push({
        matchId: form.matchId,
        inPlayingXI: false,
        impactPlayer: false,
        batting: {
          runs: 0,
          balls: 0,
          fours: 0,
          sixes: 0,
          dismissed: false,
          duck: false,
          overridePoints: entry.points,
        },
        bowling: {
          overs: 0,
          maidens: 0,
          wickets: 0,
          lbwBowled: 0,
          dotBalls: 0,
          runsConceded: 0,
        },
        fielding: {
          catches: 0,
          stumpings: 0,
          runOutDirect: 0,
          runOutIndirect: 0,
        },
      });
      nextMap.set(entry.playerId, { ...existing, matches });
    });
    const nextStats = Array.from(nextMap.values());
    setStats(nextStats);
    setPointsMessage(`Imported ${entries.length} player totals.`);
  };

  const toCsv = () => {
    const header = [
      "playerId",
      "matchId",
      "inPlayingXI",
      "impactPlayer",
      "battingRuns",
      "battingBalls",
      "battingFours",
      "battingSixes",
      "battingDismissed",
      "battingDuck",
      "battingOverridePoints",
      "bowlingOvers",
      "bowlingMaidens",
      "bowlingWickets",
      "bowlingLbwBowled",
      "bowlingDotBalls",
      "bowlingRunsConceded",
      "fieldingCatches",
      "fieldingStumpings",
      "fieldingRunOutDirect",
      "fieldingRunOutIndirect",
      "manOfTheMatch",
    ];

    const rows = stats.flatMap(entry =>
      entry.matches.map(match => [
        entry.playerId,
        match.matchId,
        match.inPlayingXI,
        match.impactPlayer,
        match.batting?.runs ?? 0,
        match.batting?.balls ?? 0,
        match.batting?.fours ?? 0,
        match.batting?.sixes ?? 0,
        match.batting?.dismissed ?? false,
        match.batting?.duck ?? false,
        match.batting?.overridePoints ?? "",
        match.bowling?.overs ?? 0,
        match.bowling?.maidens ?? 0,
        match.bowling?.wickets ?? 0,
        match.bowling?.lbwBowled ?? 0,
        match.bowling?.dotBalls ?? 0,
        match.bowling?.runsConceded ?? 0,
        match.fielding?.catches ?? 0,
        match.fielding?.stumpings ?? 0,
        match.fielding?.runOutDirect ?? 0,
        match.fielding?.runOutIndirect ?? 0,
        match.manOfTheMatch ?? false,
      ])
    );

    const csv = [header, ...rows]
      .map(row => row.map(value => String(value)).join(","))
      .join("\n");
    return csv;
  };

  const handleExport = () => {
    const csv = toCsv();
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "match-stats.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const parseCsvLine = (line: string) => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i += 1) {
      const char = line[i];
      if (char === "\"") {
        if (inQuotes && line[i + 1] === "\"") {
          current += "\"";
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === "," && !inQuotes) {
        result.push(current);
        current = "";
      } else {
        current += char;
      }
    }
    result.push(current);
    return result;
  };

  const handleImport = async (file: File) => {
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter(Boolean);
    if (lines.length < 2) {
      setCsvMessage("CSV is empty.");
      return;
    }
    const header = parseCsvLine(lines[0]);
    const expectedHeader = [
      "playerId",
      "matchId",
      "inPlayingXI",
      "impactPlayer",
      "battingRuns",
      "battingBalls",
      "battingFours",
      "battingSixes",
      "battingDismissed",
      "battingDuck",
      "bowlingOvers",
      "bowlingMaidens",
      "bowlingWickets",
      "bowlingLbwBowled",
      "bowlingDotBalls",
      "bowlingRunsConceded",
      "fieldingCatches",
      "fieldingStumpings",
      "fieldingRunOutDirect",
      "fieldingRunOutIndirect",
      "manOfTheMatch",
    ];
    const missingCols = expectedHeader.filter(col => !header.includes(col));
    if (missingCols.length > 0) {
      setCsvMessage(`Missing columns: ${missingCols.join(", ")}`);
      return;
    }
    const rows = lines.slice(1);

    const nextMap = new Map<string, MatchStats[]>();
    const invalidRows: number[] = [];

    rows.forEach((line, index) => {
      const cols = parseCsvLine(line);
      if (cols.length < header.length) {
        invalidRows.push(index + 2);
        return;
      }
      const get = (key: string) => cols[header.indexOf(key)] ?? "";
      const player = get("playerId");
      const matchId = Number(get("matchId"));
      if (!player || !matchId) {
        invalidRows.push(index + 2);
        return;
      }
      const match: MatchStats = {
        matchId,
        inPlayingXI: get("inPlayingXI") === "true",
        impactPlayer: get("impactPlayer") === "true",
        batting: {
          runs: Number(get("battingRuns")),
          balls: Number(get("battingBalls")),
          fours: Number(get("battingFours")),
          sixes: Number(get("battingSixes")),
          dismissed: get("battingDismissed") === "true",
          duck: get("battingDuck") === "true",
          overridePoints: get("battingOverridePoints")
            ? Number(get("battingOverridePoints"))
            : undefined,
        },
        bowling: {
          overs: Number(get("bowlingOvers")),
          maidens: Number(get("bowlingMaidens")),
          wickets: Number(get("bowlingWickets")),
          lbwBowled: Number(get("bowlingLbwBowled")),
          dotBalls: Number(get("bowlingDotBalls")),
          runsConceded: Number(get("bowlingRunsConceded")),
        },
        fielding: {
          catches: Number(get("fieldingCatches")),
          stumpings: Number(get("fieldingStumpings")),
          runOutDirect: Number(get("fieldingRunOutDirect")),
          runOutIndirect: Number(get("fieldingRunOutIndirect")),
        },
        manOfTheMatch: get("manOfTheMatch") === "true",
      };

      const batting = match.batting!;
      const bowling = match.bowling!;
      const fielding = match.fielding!;
      const hasOverride = typeof batting.overridePoints === "number";
      const invalid =
        (!hasOverride &&
          (batting.runs < 0 ||
            batting.balls < 0 ||
            batting.fours < 0 ||
            batting.sixes < 0)) ||
        bowling.overs < 0 ||
        bowling.overs > 4 ||
        bowling.maidens < 0 ||
        bowling.wickets < 0 ||
        bowling.wickets > 10 ||
        bowling.dotBalls < 0 ||
        bowling.dotBalls > Math.round(bowling.overs * 6) ||
        bowling.runsConceded < 0 ||
        fielding.catches < 0 ||
        fielding.stumpings < 0 ||
        fielding.runOutDirect < 0 ||
        fielding.runOutIndirect < 0;

      if (invalid) {
        invalidRows.push(index + 2);
        return;
      }

      const list = nextMap.get(player) || [];
      const filtered = list.filter(m => m.matchId !== matchId);
      nextMap.set(player, [...filtered, match]);
    });

    if (invalidRows.length > 0) {
      setCsvMessage(`Invalid rows: ${invalidRows.join(", ")}`);
      return;
    }

    const nextStats: PlayerMatchStats[] = Array.from(nextMap.entries()).map(
      ([playerId, matches]) => ({ playerId, matches })
    );
    setStats(nextStats);
    setCsvMessage("CSV imported.");
  };

  return (
    <div className="min-h-screen bg-[#0B0F1A] text-white p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Match Stats Admin</h1>
          <Link href="/" className="text-sm text-indigo-300 hover:underline">
            Home
          </Link>
        </div>

        <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <label className="space-y-1">
              <span className="text-slate-400">Player</span>
              <select
                value={playerId}
                onChange={event => setPlayerId(event.target.value)}
                className="w-full rounded-lg bg-slate-900 border border-white/10 px-3 py-2"
              >
                {players.map(player => (
                  <option key={player.id} value={player.id}>
                    {player.name} ({player.country})
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1">
              <span className="text-slate-400">Match</span>
              <select
                value={form.matchId}
                onChange={event =>
                  setForm({ ...form, matchId: Number(event.target.value) })
                }
                className="w-full rounded-lg bg-slate-900 border border-white/10 px-3 py-2"
              >
                {fixtureOptions.map(match => (
                  <option key={match.matchId} value={match.matchId}>
                    M{match.matchId} {teamShort(match.teams[0])} vs{" "}
                    {teamShort(match.teams[1])}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.inPlayingXI}
                onChange={event =>
                  setForm({ ...form, inPlayingXI: event.target.checked })
                }
              />
              <span>In Playing XI</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.impactPlayer}
                onChange={event =>
                  setForm({ ...form, impactPlayer: event.target.checked })
                }
              />
              <span>Impact Player Played</span>
            </label>
          </div>

          <Section title="Batting">
            <NumberField
              label="Runs"
              value={form.batting?.runs ?? 0}
              onChange={value =>
                setForm({
                  ...form,
                  batting: { ...form.batting!, runs: value },
                })
              }
            />
            <NumberField
              label="Balls"
              value={form.batting?.balls ?? 0}
              onChange={value =>
                setForm({
                  ...form,
                  batting: { ...form.batting!, balls: value },
                })
              }
            />
            <NumberField
              label="Fours"
              value={form.batting?.fours ?? 0}
              onChange={value =>
                setForm({
                  ...form,
                  batting: { ...form.batting!, fours: value },
                })
              }
            />
            <NumberField
              label="Sixes"
              value={form.batting?.sixes ?? 0}
              onChange={value =>
                setForm({
                  ...form,
                  batting: { ...form.batting!, sixes: value },
                })
              }
            />
            <label className="space-y-1 text-xs">
              <span className="text-slate-400">Override Points (optional)</span>
              <input
                type="number"
                value={form.batting?.overridePoints ?? ""}
                onChange={event =>
                  setForm({
                    ...form,
                    batting: {
                      ...form.batting!,
                      overridePoints:
                        event.target.value === ""
                          ? undefined
                          : Number(event.target.value),
                    },
                  })
                }
                className="w-full rounded-lg bg-slate-900 border border-white/10 px-3 py-2"
              />
            </label>
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={form.batting?.dismissed ?? false}
                onChange={event =>
                  setForm({
                    ...form,
                    batting: {
                      ...form.batting!,
                      dismissed: event.target.checked,
                    },
                  })
                }
              />
              <span>Dismissed</span>
            </label>
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={form.batting?.duck ?? false}
                onChange={event =>
                  setForm({
                    ...form,
                    batting: {
                      ...form.batting!,
                      duck: event.target.checked,
                    },
                  })
                }
              />
              <span>Duck</span>
            </label>
          </Section>

          <Section title="Bowling">
            <NumberField
              label="Overs"
              value={form.bowling?.overs ?? 0}
              onChange={value =>
                setForm({
                  ...form,
                  bowling: { ...form.bowling!, overs: value },
                })
              }
            />
            <NumberField
              label="Maidens"
              value={form.bowling?.maidens ?? 0}
              onChange={value =>
                setForm({
                  ...form,
                  bowling: { ...form.bowling!, maidens: value },
                })
              }
            />
            <NumberField
              label="Wickets"
              value={form.bowling?.wickets ?? 0}
              onChange={value =>
                setForm({
                  ...form,
                  bowling: { ...form.bowling!, wickets: value },
                })
              }
            />
            <NumberField
              label="LBW/Bowled"
              value={form.bowling?.lbwBowled ?? 0}
              onChange={value =>
                setForm({
                  ...form,
                  bowling: { ...form.bowling!, lbwBowled: value },
                })
              }
            />
            <NumberField
              label="Dot Balls"
              value={form.bowling?.dotBalls ?? 0}
              onChange={value =>
                setForm({
                  ...form,
                  bowling: { ...form.bowling!, dotBalls: value },
                })
              }
            />
            <NumberField
              label="Runs Conceded"
              value={form.bowling?.runsConceded ?? 0}
              onChange={value =>
                setForm({
                  ...form,
                  bowling: { ...form.bowling!, runsConceded: value },
                })
              }
            />
          </Section>

          <Section title="Fielding">
            <NumberField
              label="Catches"
              value={form.fielding?.catches ?? 0}
              onChange={value =>
                setForm({
                  ...form,
                  fielding: { ...form.fielding!, catches: value },
                })
              }
            />
            <NumberField
              label="Stumpings"
              value={form.fielding?.stumpings ?? 0}
              onChange={value =>
                setForm({
                  ...form,
                  fielding: { ...form.fielding!, stumpings: value },
                })
              }
            />
            <NumberField
              label="Run Out (Direct)"
              value={form.fielding?.runOutDirect ?? 0}
              onChange={value =>
                setForm({
                  ...form,
                  fielding: { ...form.fielding!, runOutDirect: value },
                })
              }
            />
            <NumberField
              label="Run Out (Indirect)"
              value={form.fielding?.runOutIndirect ?? 0}
              onChange={value =>
                setForm({
                  ...form,
                  fielding: { ...form.fielding!, runOutIndirect: value },
                })
              }
            />
          </Section>

          <button
            onClick={handleSave}
            className="px-4 py-2 rounded bg-indigo-600 text-sm"
          >
            Save Stats
          </button>
          {message && <div className="text-xs text-slate-300">{message}</div>}

          <div className="border-t border-white/10 pt-4 space-y-3">
            <div className="text-xs uppercase tracking-wide text-slate-400">
              Paste Fantasy Points
            </div>
            <p className="text-xs text-slate-400">
              Paste player totals (one per line). We match player names and save
              the total as an override for the selected match.
            </p>
            <textarea
              value={pointsPaste}
              onChange={event => setPointsPaste(event.target.value)}
              rows={6}
              className="w-full rounded-lg bg-slate-900 border border-white/10 px-3 py-2 text-xs"
              placeholder="Pathum Nissanka 30&#10;Kusal Mendis (wk) 88"
            />
            <button
              onClick={handlePastePoints}
              className="px-3 py-2 rounded bg-slate-800 text-xs hover:bg-slate-700"
            >
              Import Points
            </button>
            {pointsMessage && (
              <div className="text-xs text-slate-300">{pointsMessage}</div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-5 space-y-3">
          <h2 className="text-lg font-semibold">Recent Match Stats</h2>
          <div className="text-xs text-slate-400">
            Total entries: {stats.reduce((sum, entry) => sum + entry.matches.length, 0)}
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => {
                const sample = toCsv();
                const blob = new Blob([sample], {
                  type: "text/csv;charset=utf-8;",
                });
                const url = URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.href = url;
                link.download = "match-stats-sample.csv";
                link.click();
                URL.revokeObjectURL(url);
              }}
              className="px-3 py-2 rounded bg-slate-800 text-xs hover:bg-slate-700"
            >
              Download Sample CSV
            </button>
            <button
              onClick={handleExport}
              className="px-3 py-2 rounded bg-slate-800 text-xs hover:bg-slate-700"
            >
              Export CSV
            </button>
            <label className="px-3 py-2 rounded border border-white/10 text-xs cursor-pointer hover:border-white/30">
              Import CSV
              <input
                type="file"
                accept=".csv"
                className="hidden"
                onChange={event => {
                  const file = event.target.files?.[0];
                  if (file) handleImport(file);
                }}
              />
            </label>
          </div>
          {csvMessage && <div className="text-xs text-slate-300">{csvMessage}</div>}
          {recentEntries.length === 0 && (
            <div className="text-xs text-slate-400">No stats saved yet.</div>
          )}
          {recentEntries.map(entry => {
            const player = playerMap.get(entry.playerId);
            const fixture = fixtureMap.get(entry.matchId);
            const matchLabel = fixture
              ? `M${fixture.matchId} ${teamShort(
                  fixture.teams[0]
                )} vs ${teamShort(fixture.teams[1])}`
              : `Match ${entry.matchId}`;
            return (
              <div
                key={entry.key}
                className="border border-white/10 rounded-lg p-3 text-xs"
              >
                <div className="text-slate-300 font-medium">
                  {player?.name || entry.playerId}
                </div>
                <div className="text-slate-400">{matchLabel}</div>
                <div className="text-slate-400">
                  Runs: {entry.runs} · Wickets: {entry.wickets}
                </div>
              </div>
            );
          })}
        </div>
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
    <div className="space-y-2">
      <div className="text-xs uppercase tracking-wide text-slate-400">
        {title}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {children}
      </div>
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="space-y-1 text-xs">
      <span className="text-slate-400">{label}</span>
      <input
        type="number"
        value={value}
        min={0}
        onChange={event => onChange(Number(event.target.value))}
        className="w-full rounded-lg bg-slate-900 border border-white/10 px-3 py-2"
      />
    </label>
  );
}
