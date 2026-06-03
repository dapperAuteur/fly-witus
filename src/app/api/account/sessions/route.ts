import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { sessions } from "@/db/schema/auth";
import { requireUser } from "@/lib/api-auth";

// DELETE /api/account/sessions — "sign out everywhere". Deletes every
// session row for the signed-in user (including the current one), so all
// devices are logged out. The client signs out locally afterward; the
// next sign-in needs a fresh magic link.
export async function DELETE() {
  const userOrRes = await requireUser();
  if (userOrRes instanceof NextResponse) return userOrRes;

  try {
    await db.delete(sessions).where(eq(sessions.userId, userOrRes.id));
  } catch (err) {
    console.error("[DELETE /api/account/sessions]", err);
    return NextResponse.json(
      { error: "Couldn't sign out everywhere. Try again." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
