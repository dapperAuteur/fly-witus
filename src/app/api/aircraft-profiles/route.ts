import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/db/client";
import { aircraftProfiles } from "@/db/schema/aircraft-profiles";
import { requireUser } from "@/lib/api-auth";
import { aircraftProfileInputSchema } from "@/lib/aircraft-profiles-api";

export async function GET() {
  const userOrRes = await requireUser();
  if (userOrRes instanceof NextResponse) return userOrRes;

  const profiles = await db
    .select()
    .from(aircraftProfiles)
    .where(eq(aircraftProfiles.userId, userOrRes.id))
    .orderBy(desc(aircraftProfiles.createdAt));

  return NextResponse.json({ profiles });
}

export async function POST(req: Request) {
  const userOrRes = await requireUser();
  if (userOrRes instanceof NextResponse) return userOrRes;

  const body = await req.json().catch(() => null);
  const parsed = aircraftProfileInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid aircraft profile payload", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const input = parsed.data;

  const [created] = await db
    .insert(aircraftProfiles)
    .values({
      id: nanoid(),
      userId: userOrRes.id,
      name: input.name,
      model: input.model ?? null,
      weightGrams: input.weightGrams ?? null,
      regNumber: input.regNumber ?? null,
      notes: input.notes ?? null,
    })
    .returning();

  return NextResponse.json({ profile: created }, { status: 201 });
}
