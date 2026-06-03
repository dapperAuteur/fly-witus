import { NextResponse } from "next/server";
import { and, eq, ne } from "drizzle-orm";
import { db } from "@/db/client";
import { users } from "@/db/schema/auth";
import { env } from "@/lib/env";
import { verifyEmailChangeToken } from "@/lib/account-tokens";

// GET /api/account/email/verify?token=… — completes an email change.
// Reached by clicking the link sent to the new address. Validates the
// signed token, re-checks the email is still free, applies the change,
// then redirects to the dashboard with a status flag.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token") ?? "";
  const dash = (status: string) =>
    NextResponse.redirect(`${env.BETTER_AUTH_URL}/dashboard?email=${status}`);

  const payload = verifyEmailChangeToken(token);
  if (!payload) return dash("invalid");

  try {
    // Still free? (Someone else could have taken it since the request.)
    const [taken] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.email, payload.newEmail), ne(users.id, payload.userId)))
      .limit(1);
    if (taken) return dash("taken");

    const [updated] = await db
      .update(users)
      .set({ email: payload.newEmail, emailVerified: true, updatedAt: new Date() })
      .where(eq(users.id, payload.userId))
      .returning({ id: users.id });

    if (!updated) return dash("invalid");
  } catch (err) {
    console.error("[GET /api/account/email/verify]", err);
    return dash("error");
  }

  return dash("changed");
}
