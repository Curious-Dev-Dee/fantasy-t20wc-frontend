"use client";

import { useState } from "react";

export default function AdminScorecardPage() {
  const [matchId, setMatchId] = useState<number | "">("");
  const [raw, setRaw] = useState("");
  const [loading, setLoading] = useState(false);
  const [parsed, setParsed] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleParse() {
    setError(null);
    setParsed(null);

    if (!matchId || !raw.trim()) {
      setError("Match ID and raw scorecard are required");
      return;
    }

    try {
      setLoading(true);

      const res = await fetch("/api/admin/parse-scorecard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          matchId: Number(matchId),
          raw,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Parse failed");
      }

      setParsed(data.parsed);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">Admin · Paste Match Scorecard</h1>

      {/* Match ID */}
      <div>
        <label className="block text-sm font-medium mb-1">
          Match ID
        </label>
        <input
          type="number"
          value={matchId}
          onChange={(e) =>
            setMatchId(e.target.value ? Number(e.target.value) : "")
          }
          className="w-40 border rounded px-3 py-2"
          placeholder="e.g. 6"
        />
      </div>

      {/* Raw Scorecard */}
      <div>
        <label className="block text-sm font-medium mb-1">
          Raw Scorecard (paste from Cricbuzz)
        </label>
        <textarea
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          rows={18}
          className="w-full border rounded px-3 py-2 font-mono text-sm"
          placeholder="Paste full scorecard text here…"
        />
      </div>

      {/* Actions */}
      <button
        onClick={handleParse}
        disabled={loading}
        className="bg-black text-white px-4 py-2 rounded disabled:opacity-50"
      >
        {loading ? "Parsing…" : "Parse Scorecard"}
      </button>

      {/* Error */}
      {error && (
        <div className="text-red-600 font-medium">
          {error}
        </div>
      )}

      {/* Parsed Preview */}
      {parsed && (
        <div>
          <h2 className="text-lg font-semibold mb-2">
            Parsed Output (Preview)
          </h2>
          <pre className="bg-gray-100 p-4 rounded text-xs overflow-auto">
            {JSON.stringify(parsed, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
