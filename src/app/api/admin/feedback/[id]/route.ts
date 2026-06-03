import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { feedbackSubmissions } from "@/db/schema/feedback";
import { requireAdmin } from "@/lib/api-auth";

const FEEDBACK_STATUSES = ["new", "triaged", "resolved"] as const;

const patchSchema = z.object({
  status: z.enum(FEEDBACK_STATUSES),
});

// PATCH /api/admin/feedback/[id] — advance a submission's triage status.
// Admin-only (requireAdmin DB-checks is_admin per request).
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const userOrRes = await requireAdmin();
  if (userOrRes instanceof NextResponse) return userOrRes;

  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid status", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const [updated] = await db
      .update(feedbackSubmissions)
      .set({ status: parsed.data.status })
      .where(eq(feedbackSubmissions.id, id))
      .returning({ id: feedbackSubmissions.id, status: feedbackSubmissions.status });

    if (!updated) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, ...updated });
  } catch (err) {
    console.error("[PATCH /api/admin/feedback/[id]]", err);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}
