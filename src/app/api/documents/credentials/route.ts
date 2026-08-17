import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/db/client";
import { pilotCredentials } from "@/db/schema/documents";
import { requireUser } from "@/lib/api-auth";
import { pilotCredentialInputSchema } from "@/lib/documents-api";

export async function GET() {
  const userOrRes = await requireUser();
  if (userOrRes instanceof NextResponse) return userOrRes;

  try {
    const credentials = await db
      .select()
      .from(pilotCredentials)
      .where(eq(pilotCredentials.userId, userOrRes.id))
      // Soonest expiry first — the whole point of the list is what lapses
      // next. Nulls sort last in Postgres ASC, which is what we want: rows
      // with no tracked expiry are the least urgent.
      .orderBy(asc(pilotCredentials.expiresOn));

    return NextResponse.json({ credentials });
  } catch (err) {
    // Most likely cause in prod: migration 0010 was never applied.
    console.error("[GET /api/documents/credentials]", err);
    return NextResponse.json({ error: "Failed to load credentials" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const userOrRes = await requireUser();
  if (userOrRes instanceof NextResponse) return userOrRes;

  const body = await req.json().catch(() => null);
  const parsed = pilotCredentialInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid credential payload", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const input = parsed.data;

  const [created] = await db
    .insert(pilotCredentials)
    .values({
      id: nanoid(),
      userId: userOrRes.id,
      kind: input.kind,
      label: input.label ?? null,
      referenceNumber: input.referenceNumber ?? null,
      issuedOn: input.issuedOn ?? null,
      expiresOn: input.expiresOn ?? null,
      notes: input.notes ?? null,
    })
    .returning();

  return NextResponse.json({ credential: created }, { status: 201 });
}
