import "server-only";

type CricketDataResponse<T> = {
  status?: string;
  info?: string;
  data?: T;
  [key: string]: unknown;
};

const DEFAULT_BASE_URL = "https://api.cricapi.com/v1";

export async function cricketDataFetch<T>(
  endpoint: string,
  params: Record<string, string | number | boolean | undefined> = {}
): Promise<{ ok: boolean; status: number; payload: CricketDataResponse<T> } | null> {
  const apiKey = process.env.CRICKETDATA_API_KEY;
  if (!apiKey) return null;
  const baseUrl = process.env.CRICKETDATA_BASE_URL || DEFAULT_BASE_URL;

  const url = new URL(`${baseUrl.replace(/\/$/, "")}/${endpoint.replace(/^\//, "")}`);
  url.searchParams.set("apikey", apiKey);
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined) return;
    url.searchParams.set(key, String(value));
  });

  const response = await fetch(url.toString(), {
    cache: "no-store",
  });

  const payload = (await response.json()) as CricketDataResponse<T>;
  return { ok: response.ok, status: response.status, payload };
}

export type { CricketDataResponse };
