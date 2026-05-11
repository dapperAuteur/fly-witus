import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { groups } from "@/db/schema/groups";
import { generateInviteCode } from "@/lib/groups-api";
import { getMembership } from "@/lib/groups-queries";
import { requireUser } from "@/lib/api-auth";

type Ctx = { params: Promise<{ id: string }> };

// POST /api/groups/[id]/invite/regenerate — owner-only invite-code rotation.
// Old code stops resolving immediately on next /join request.
export async function POST(_req: Request, { params }: Ctx) {
  const userOrRes = await requireUser();
  if (userOrRes instanceof NextResponse) return userOrRes;

  const { id } = await params;
  const membership = await getMembership(id, userOrRes.id);
  if (!membership || membership.role !== "owner") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Retry once on the (extremely unlikely) collision; the unique index
  // catches it. Two attempts is plenty for an 8-char alphabet of 32 chars
  // (~10^12 keyspace).
  for (let attempt = 0; attempt < 3; attempt++) {
    const inviteCode = generateInviteCode();
    try {
      await db
        .update(groups)
        .set({ inviteCode, updatedAt: new Date() })
        .where(eq(groups.id, id));
      return NextResponse.json({ inviteCode });
    } catch (err) {
      if (!isUniqueViolation(err) || attempt === 2) throw err;
    }
  }
  return NextResponse.json({ error: "Could not generate code" }, { status: 500 });
}

function isUniqueViolation(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const direct = (err as { code?: unknown }).code;
  if (direct === "23505") return true;
  const cause = (err as { cause?: unknown }).cause;
  if (!cause || typeof cause !== "object") return false;
  return (cause as { code?: unknown }).code === "23505";
}
