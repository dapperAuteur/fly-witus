import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/db/client";
import { groupSharedMissions } from "@/db/schema/groups";
import { missions } from "@/db/schema/missions";
import { shareMissionSchema } from "@/lib/groups-api";
import { getMembership } from "@/lib/groups-queries";
import { requireUser } from "@/lib/api-auth";

type Ctx = { params: Promise<{ id: string }> };

// POST /api/groups/[id]/share-mission — share one of MY missions to a
// group I'm a member of. v3 §3 sharing is per-mission opt-in.
export async function POST(req: Request, { params }: Ctx) {
  const userOrRes = await requireUser();
  if (userOrRes instanceof NextResponse) return userOrRes;

  const { id: groupId } = await params;
  const membership = await getMembership(groupId, userOrRes.id);
  if (!membership) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const parsed = shareMissionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid share payload", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  // Confirm the mission belongs to the caller — sharing someone else's
  // mission would be a privacy bug.
  const [mission] = await db
    .select({ id: missions.id })
    .from(missions)
    .where(and(eq(missions.id, parsed.data.missionId), eq(missions.userId, userOrRes.id)))
    .limit(1);
  if (!mission) {
    return NextResponse.json({ error: "Mission not found" }, { status: 404 });
  }

  try {
    await db.insert(groupSharedMissions).values({
      id: nanoid(),
      groupId,
      missionId: parsed.data.missionId,
      sharedById: userOrRes.id,
      note: parsed.data.note ?? null,
    });
  } catch (err) {
    if (isUniqueViolation(err)) {
      return NextResponse.json(
        { error: "Mission already shared to this group", code: "ALREADY_SHARED" },
        { status: 409 },
      );
    }
    throw err;
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}

function isUniqueViolation(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const direct = (err as { code?: unknown }).code;
  if (direct === "23505") return true;
  const cause = (err as { cause?: unknown }).cause;
  if (!cause || typeof cause !== "object") return false;
  return (cause as { code?: unknown }).code === "23505";
}
