// Stateless, signed tokens for email-change verification. We don't need a
// DB table: the token carries userId + the requested new email + an expiry,
// HMAC-signed with BETTER_AUTH_SECRET. Tampering invalidates the signature;
// expiry bounds the window. One-time-use is approximated by the expiry plus
// the fact that the new email becomes the account email on first use (a
// replay just re-sets the same value).

import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "./env";

const TTL_MS = 1000 * 60 * 30; // 30 minutes

function b64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function b64urlDecode(input: string): Buffer {
  return Buffer.from(input.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

function sign(payload: string): string {
  return b64url(
    createHmac("sha256", env.BETTER_AUTH_SECRET).update(payload).digest(),
  );
}

export interface EmailChangePayload {
  userId: string;
  newEmail: string;
  exp: number;
}

export function createEmailChangeToken(userId: string, newEmail: string): string {
  const exp = Date.now() + TTL_MS;
  const payloadJson = JSON.stringify({ userId, newEmail, exp });
  const payload = b64url(payloadJson);
  return `${payload}.${sign(payload)}`;
}

export function verifyEmailChangeToken(token: string): EmailChangePayload | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payload, signature] = parts;

  const expected = sign(payload);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const parsed = JSON.parse(b64urlDecode(payload).toString()) as EmailChangePayload;
    if (
      typeof parsed.userId !== "string" ||
      typeof parsed.newEmail !== "string" ||
      typeof parsed.exp !== "number"
    ) {
      return null;
    }
    if (Date.now() > parsed.exp) return null;
    return parsed;
  } catch {
    return null;
  }
}
