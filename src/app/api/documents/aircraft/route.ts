import { NextResponse } from "next/server";
import { and, asc, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/db/client";
import { aircraftProfiles } from "@/db/schema/aircraft-profiles";
import { aircraftDocuments } from "@/db/schema/documents";
import { requireUser } from "@/lib/api-auth";
import { aircraftDocumentInputSchema } from "@/lib/documents-api";

export async function GET() {
  const userOrRes = await requireUser();
  if (userOrRes instanceof NextResponse) return userOrRes;

  try {
    const documents = await db
      .select()
      .from(aircraftDocuments)
      .where(eq(aircraftDocuments.userId, userOrRes.id))
      .orderBy(asc(aircraftDocuments.expiresOn));

    return NextResponse.json({ documents });
  } catch (err) {
    console.error("[GET /api/documents/aircraft]", err);
    return NextResponse.json({ error: "Failed to load aircraft documents" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const userOrRes = await requireUser();
  if (userOrRes instanceof NextResponse) return userOrRes;

  const body = await req.json().catch(() => null);
  const parsed = aircraftDocumentInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid document payload", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const input = parsed.data;

  // Confirm the aircraft belongs to this user before attaching anything to it.
  // The FK alone would happily let a pilot hang documents off someone else's
  // airframe, which would then leak back through that owner's GET.
  const [aircraft] = await db
    .select({ id: aircraftProfiles.id })
    .from(aircraftProfiles)
    .where(
      and(
        eq(aircraftProfiles.id, input.aircraftId),
        eq(aircraftProfiles.userId, userOrRes.id),
      ),
    );

  if (!aircraft) {
    return NextResponse.json({ error: "Aircraft not found" }, { status: 404 });
  }

  const [created] = await db
    .insert(aircraftDocuments)
    .values({
      id: nanoid(),
      userId: userOrRes.id,
      aircraftId: input.aircraftId,
      kind: input.kind,
      label: input.label ?? null,
      referenceNumber: input.referenceNumber ?? null,
      onBoard: input.onBoard,
      issuedOn: input.issuedOn ?? null,
      expiresOn: input.expiresOn ?? null,
      notes: input.notes ?? null,
    })
    .returning();

  return NextResponse.json({ document: created }, { status: 201 });
}
