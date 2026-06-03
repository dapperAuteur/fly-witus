import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users } from "@/db/schema/auth";
import { groups } from "@/db/schema/groups";
import { requireUser } from "@/lib/api-auth";
import { deleteAccountSchema } from "@/lib/account-api";

// DELETE /api/account — permanently delete the signed-in user's account
// and all of their cloud data. Requires a typed "DELETE" confirmation.
//
// Most child rows cascade off users.id (accounts, sessions, missions →
// flights/photos, aircraft, group memberships, shares, requests). The one
// exception is groups.ownerId, which has no ON DELETE rule (RESTRICT) — so
// we delete the groups this user OWNS first (that cascades the group's
// members/shares/requests), then delete the user.
export async function DELETE(req: Request) {
  const userOrRes = await requireUser();
  if (userOrRes instanceof NextResponse) return userOrRes;

  const body = await req.json().catch(() => null);
  const parsed = deleteAccountSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Type "DELETE" to confirm.' },
      { status: 400 },
    );
  }

  try {
    await db.transaction(async (tx) => {
      // Groups owned by this user (RESTRICT FK) — delete first; cascades
      // members/shared missions/flight requests for each.
      await tx.delete(groups).where(eq(groups.ownerId, userOrRes.id));
      // The user — cascades accounts, sessions, missions, aircraft, group
      // memberships, shares, and authored requests/comments.
      await tx.delete(users).where(eq(users.id, userOrRes.id));
    });
  } catch (err) {
    console.error("[DELETE /api/account]", err);
    return NextResponse.json(
      { error: "Couldn't delete your account. Try again." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
