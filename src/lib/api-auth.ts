import { headers } from "next/headers";
import { NextResponse } from "next/server";
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
