import { createClient } from "@supabase/supabase-js";

type AuthResult =
  | { ok: true; userId: string }
  | { ok: false; status: number; error: string };

type RateLimitOptions = {
  windowMs: number;
  max: number;
};

type RateLimitResult =
  | { ok: true }
  | { ok: false; retryAfterSeconds: number };

type Bucket = {
  count: number;
  resetAt: number;
};

declare global {
  var __requestRateLimitBuckets: Map<string, Bucket> | undefined;
}

const rateBuckets = globalThis.__requestRateLimitBuckets ?? new Map<string, Bucket>();
globalThis.__requestRateLimitBuckets = rateBuckets;

const getBearerToken = (request: Request) => {
  const authHeader = request.headers.get("authorization") || "";
  if (!authHeader.startsWith("Bearer ")) return "";
  return authHeader.slice("Bearer ".length).trim();
};

export const requireAuthenticatedUser = async (request: Request): Promise<AuthResult> => {
  const token = getBearerToken(request);
  if (!token) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  if (!supabaseUrl || !anonKey) {
    return { ok: false, status: 500, error: "Supabase not configured" };
  }

  const authClient = createClient(supabaseUrl, anonKey);
  const { data, error } = await authClient.auth.getUser(token);
  if (error || !data.user) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }

  return { ok: true, userId: data.user.id };
};

export const checkRateLimit = (
  key: string,
  options: RateLimitOptions
): RateLimitResult => {
  const now = Date.now();
  const existing = rateBuckets.get(key);

  if (!existing || existing.resetAt <= now) {
    rateBuckets.set(key, {
      count: 1,
      resetAt: now + options.windowMs,
    });
    return { ok: true };
  }

  if (existing.count >= options.max) {
    return {
      ok: false,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((existing.resetAt - now) / 1000)
      ),
    };
  }

  existing.count += 1;
  rateBuckets.set(key, existing);
  return { ok: true };
};
