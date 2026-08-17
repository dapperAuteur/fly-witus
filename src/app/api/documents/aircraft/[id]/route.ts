import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { aircraftDocuments } from "@/db/schema/documents";
import { requireUser } from "@/lib/api-auth";
import { aircraftDocumentUpdateSchema } from "@/lib/documents-api";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  const userOrRes = await requireUser();
  if (userOrRes instanceof NextResponse) return userOrRes;
  const { id } = await params;

  const body = await req.json().catch(() => null);
  const parsed = aircraftDocumentUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid document payload", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const input = parsed.data;

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (input.kind !== undefined) updates.kind = input.kind;
  if (input.label !== undefined) updates.label = input.label ?? null;
  if (input.referenceNumber !== undefined) updates.referenceNumber = input.referenceNumber ?? null;
  if (input.onBoard !== undefined) updates.onBoard = input.onBoard;
  if (input.issuedOn !== undefined) updates.issuedOn = input.issuedOn ?? null;
  if (input.expiresOn !== undefined) updates.expiresOn = input.expiresOn ?? null;
  if (input.notes !== undefined) updates.notes = input.notes ?? null;

  // aircraftId is deliberately NOT updatable — moving a document between
  // airframes is a delete-and-recreate, not an edit, and allowing it here
  // would need the same ownership check the POST route does.
  const [updated] = await db
    .update(aircraftDocuments)
    .set(updates)
    .where(and(eq(aircraftDocuments.id, id), eq(aircraftDocuments.userId, userOrRes.id)))
    .returning();

  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ document: updated });
}

export async function DELETE(_req: Request, { params }: Params) {
  const userOrRes = await requireUser();
  if (userOrRes instanceof NextResponse) return userOrRes;
  const { id } = await params;

  const [deleted] = await db
    .delete(aircraftDocuments)
    .where(and(eq(aircraftDocuments.id, id), eq(aircraftDocuments.userId, userOrRes.id)))
    .returning();

  if (!deleted) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
