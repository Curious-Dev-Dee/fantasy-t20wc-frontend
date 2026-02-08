import { createHmac, timingSafeEqual } from "node:crypto";
import { extractBearerToken } from "./tokenUtils";

const MAX_CLOCK_SKEW_SECONDS = 5 * 60;
const HEX_SHA256_PATTERN = /^[a-f0-9]{64}$/i;

type VerifyResult =
  | { ok: true }
  | { ok: false; status: number; error: string };

const getBearerToken = (authorizationHeader: string) => {
  return extractBearerToken(authorizationHeader);
};

const normalizeSignature = (signatureHeader: string) => {
  const signature = signatureHeader.trim();
  if (signature.toLowerCase().startsWith("sha256=")) {
    return signature.slice("sha256=".length).trim();
  }
  return signature;
};

const safeEqualHex = (left: string, right: string) => {
  if (!HEX_SHA256_PATTERN.test(left) || !HEX_SHA256_PATTERN.test(right)) {
    return false;
  }
  const leftBuffer = Buffer.from(left.toLowerCase(), "hex");
  const rightBuffer = Buffer.from(right.toLowerCase(), "hex");
  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
};

export const verifyCronRequest = (request: Request): VerifyResult => {
  const cronSecret = process.env.CRON_SECRET || "";
  const cronHmacSecret = process.env.CRON_HMAC_SECRET || "";
  if (!cronSecret) {
    return { ok: false, status: 500, error: "Missing cron auth configuration" };
  }

  const authHeader = request.headers.get("authorization") || "";
  const token = getBearerToken(authHeader);
  if (!token || token !== cronSecret) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }

  // Backward-compatible mode: if no HMAC secret is configured, keep simple Bearer auth.
  if (!cronHmacSecret) {
    return { ok: true };
  }

  if (cronSecret === cronHmacSecret) {
    return {
      ok: false,
      status: 500,
      error: "Invalid cron auth configuration",
    };
  }

  const timestampHeader = request.headers.get("x-cron-timestamp") || "";
  const signatureHeader = request.headers.get("x-cron-signature") || "";
  if (!timestampHeader || !signatureHeader) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }

  const timestamp = Number(timestampHeader);
  if (!Number.isInteger(timestamp) || timestamp <= 0) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSeconds - timestamp) > MAX_CLOCK_SKEW_SECONDS) {
    return { ok: false, status: 401, error: "Stale cron signature" };
  }

  const path = new URL(request.url).pathname;
  const payload = `${timestamp}.${request.method.toUpperCase()}.${path}`;
  const expectedSignature = createHmac("sha256", cronHmacSecret)
    .update(payload)
    .digest("hex");
  const providedSignature = normalizeSignature(signatureHeader);

  if (!safeEqualHex(providedSignature, expectedSignature)) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }

  return { ok: true };
};
