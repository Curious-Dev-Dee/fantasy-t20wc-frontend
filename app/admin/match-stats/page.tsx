"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { fixtures } from "@/data/fixtures";
import { players } from "@/data/players";
import { teamShort } from "@/utils/teamCodes";
import { useAuth } from "@/hooks/useAuth";
import { isAdminEmail } from "@/utils/admin";
import { supabase } from "@/utils/supabaseClient";

type ParsedRow = {
  playerId: string;
  points: number;
};

const parseLines = (raw: string) => {
  return raw
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);
};

export default function AdminPlayerPointsPage() {
  const { user, ready } = useAuth();
  const [matchId, setMatchId] = useState(fixtures[0]?.matchId ?? 1);
  const [input, setInput] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const playerMap = useMemo(
    () => new Map(players.map(player => [player.id, player])),
    []
  );

  const parsed = useMemo(() => {
    const rows: ParsedRow[] = [];
    parseLines(input).forEach(line => {
      const [playerId, pointsRaw] = line.split(",").map(chunk => chunk.trim());
      if (!playerId) return;
      const points = Number(pointsRaw);
      if (!Number.isFinite(points)) return;
      rows.push({ playerId, points });
    });
    return rows;
  }, [input]);

  const invalidLines = useMemo(() => {
    return parseLines(input).filter(line => {
      const [playerId, pointsRaw] = line.split(",").map(chunk => chunk.trim());
      if (!playerId) return true;
      const points = Number(pointsRaw);
      if (!Number.isFinite(points)) return true;
      return !playerMap.has(playerId);
    });
  }, [input, playerMap]);

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

  const handleSave = async () => {
    setMessage(null);
    if (invalidLines.length > 0) {
      setMessage("Fix invalid lines before saving.");
      return;
    }
    if (parsed.length === 0) {
      setMessage("Paste playerId,points entries.");
      return;
    }
    if (!supabase) {
      setMessage("Supabase is not configured.");
      return;
    }
    setIsSaving(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        setMessage("Session expired. Please log in again.");
        return;
      }
      const response = await fetch("/api/admin/player-points", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          matchId,
          points: parsed,
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) {
        setMessage(payload.error || "Failed to save points.");
        return;
      }
      setMessage(
        `Saved ${payload.updatedPlayers} player rows and updated ${payload.updatedUsers} teams.`
      );
    } catch (error) {
      setMessage("Unexpected error while saving.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0F1A] text-white p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Admin Player Points</h1>
          <Link href="/" className="text-sm text-indigo-300 hover:underline">
            Home
          </Link>
        </div>

        <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-5 space-y-4">
          <label className="space-y-1 text-sm block">
            <span className="text-slate-400">Match</span>
            <select
              value={matchId}
              onChange={event => setMatchId(Number(event.target.value))}
              className="w-full rounded-lg bg-slate-900 border border-white/10 px-3 py-2"
            >
              {fixtures.map(match => (
                <option key={match.matchId} value={match.matchId}>
                  M{match.matchId} {teamShort(match.teams[0])} vs{" "}
                  {teamShort(match.teams[1])}
                </option>
              ))}
            </select>
          </label>

          <div className="text-xs text-slate-400">
            Paste <b>playerId,points</b> per line. Example:
            <div className="mt-2 rounded-lg bg-slate-950/60 border border-white/10 px-3 py-2 text-[11px] text-slate-300">
              suryakumar-yadav-1,45
              <br />
              hardik-pandya-5,68
            </div>
          </div>

          <textarea
            value={input}
            onChange={event => setInput(event.target.value)}
            rows={10}
            className="w-full rounded-lg bg-slate-900 border border-white/10 px-3 py-2 text-sm"
            placeholder="playerId,points"
          />

          {invalidLines.length > 0 && (
            <div className="text-xs text-amber-300">
              Invalid lines: {invalidLines.join(" | ")}
            </div>
          )}

          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-2 rounded bg-indigo-600 text-sm disabled:opacity-60"
          >
            {isSaving ? "Saving..." : "Save Points"}
          </button>
          {message && <div className="text-xs text-slate-300">{message}</div>}
        </div>

        <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-5 space-y-3">
          <h2 className="text-lg font-semibold">Preview</h2>
          {parsed.length === 0 && (
            <div className="text-xs text-slate-400">No parsed rows yet.</div>
          )}
          {parsed.length > 0 && (
            <div className="space-y-2 text-xs">
              {parsed.slice(0, 10).map(entry => (
                <div
                  key={`${entry.playerId}-${entry.points}`}
                  className="flex items-center justify-between rounded-lg border border-white/10 px-3 py-2"
                >
                  <div>
                    <div className="text-slate-200">
                      {playerMap.get(entry.playerId)?.name || entry.playerId}
                    </div>
                    <div className="text-slate-500">{entry.playerId}</div>
                  </div>
                  <div className="text-white font-semibold">
                    {entry.points}
                  </div>
                </div>
              ))}
              {parsed.length > 10 && (
                <div className="text-xs text-slate-500">
                  Showing first 10 of {parsed.length} entries.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
