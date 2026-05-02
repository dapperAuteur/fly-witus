import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users } from "@/db/schema/auth";
import { auth } from "./auth";

// Server-side helper for API routes. Returns the signed-in user or a
// 401 NextResponse the caller can return directly. Centralizing it keeps
// route handlers tight + makes auth requirements explicit.
//
// Usage:
//   const userOrRes = await requireUser();
//   if (userOrRes instanceof NextResponse) return userOrRes;
//   // userOrRes is { id, email, ... }
export async function requireUser() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return session.user;
}

// Same gate as requireUser plus an is_admin column check from the DB.
// We DB-check (not session-check) because:
//   - is_admin can be revoked between session refreshes; treating the
//     session as authoritative would let a demoted admin keep doing
//     admin work until their JWT expired.
//   - the DB check is a single small query keyed on PK, so the latency
//     hit is negligible vs the safety it buys.
//
// Returns the user object on success, or 401/403 NextResponse the caller
// can return directly.
export async function requireAdmin() {
  const userOrRes = await requireUser();
  if (userOrRes instanceof NextResponse) return userOrRes;

  const [row] = await db
    .select({ isAdmin: users.isAdmin })
    .from(users)
    .where(eq(users.id, userOrRes.id))
    .limit(1);

  if (!row?.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return userOrRes;
}
