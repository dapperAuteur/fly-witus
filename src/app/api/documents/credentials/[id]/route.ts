import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { pilotCredentials } from "@/db/schema/documents";
import { requireUser } from "@/lib/api-auth";
import { pilotCredentialUpdateSchema } from "@/lib/documents-api";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  const userOrRes = await requireUser();
  if (userOrRes instanceof NextResponse) return userOrRes;
  const { id } = await params;

  const body = await req.json().catch(() => null);
  const parsed = pilotCredentialUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid credential payload", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const input = parsed.data;

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (input.kind !== undefined) updates.kind = input.kind;
  if (input.label !== undefined) updates.label = input.label ?? null;
  if (input.referenceNumber !== undefined) updates.referenceNumber = input.referenceNumber ?? null;
  if (input.issuedOn !== undefined) updates.issuedOn = input.issuedOn ?? null;
  if (input.expiresOn !== undefined) updates.expiresOn = input.expiresOn ?? null;
  if (input.notes !== undefined) updates.notes = input.notes ?? null;

  // userId in the WHERE, not just the id — otherwise any signed-in user could
  // edit another pilot's credentials by guessing an id.
  const [updated] = await db
    .update(pilotCredentials)
    .set(updates)
    .where(and(eq(pilotCredentials.id, id), eq(pilotCredentials.userId, userOrRes.id)))
    .returning();

  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ credential: updated });
}

export async function DELETE(_req: Request, { params }: Params) {
  const userOrRes = await requireUser();
  if (userOrRes instanceof NextResponse) return userOrRes;
  const { id } = await params;

  const [deleted] = await db
    .delete(pilotCredentials)
    .where(and(eq(pilotCredentials.id, id), eq(pilotCredentials.userId, userOrRes.id)))
    .returning();

  if (!deleted) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
