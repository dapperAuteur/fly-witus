import { headers } from "next/headers";
import { NextResponse, after } from "next/server";
import { nanoid } from "nanoid";
import { db } from "@/db/client";
import { feedbackAttachments, feedbackSubmissions } from "@/db/schema/feedback";
import { auth } from "@/lib/auth";
import { feedbackInputSchema } from "@/lib/feedback-api";
import { notifyOfFeedback } from "@/lib/feedback-notify";

// POST /api/feedback — help-bubble submissions (bug / feedback / question).
// Auth is OPTIONAL: we read the session directly (not requireUser) so
// logged-out visitors can submit too. The row is the durable record; the
// admin email + WitUS Inbox fan-out fires via after() so a slow Mailgun /
// Inbox can't delay the user's response.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = feedbackInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid feedback payload", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const input = parsed.data;

  // Best-effort session read — never blocks an anonymous submission.
  const session = await auth.api
    .getSession({ headers: await headers() })
    .catch(() => null);
  const userId = session?.user?.id ?? null;
  // Prefer the signed-in email; fall back to whatever the form supplied.
  const contactEmail = session?.user?.email ?? (input.contactEmail || null);

  const id = nanoid();

  try {
    await db.transaction(async (tx) => {
      await tx.insert(feedbackSubmissions).values({
        id,
        userId,
        type: input.type,
        message: input.message,
        pageUrl: input.pageUrl ?? null,
        userAgent: input.userAgent ?? null,
        contactEmail,
      });
      if (input.attachments?.length) {
        await tx.insert(feedbackAttachments).values(
          input.attachments.map((a) => ({
            id: nanoid(),
            feedbackId: id,
            url: a.url,
            kind: a.kind,
          })),
        );
      }
    });
  } catch (err) {
    console.error("[POST /api/feedback]", err);
    return NextResponse.json(
      { error: "Could not save your feedback. Please try again." },
      { status: 500 },
    );
  }

  // Fire the email + Inbox fan-out after the response is sent.
  after(() =>
    notifyOfFeedback({
      submissionId: id,
      type: input.type,
      message: input.message,
      pageUrl: input.pageUrl,
      userAgent: input.userAgent,
      submitterEmail: contactEmail,
      attachments: input.attachments,
    }),
  );

  return NextResponse.json({ ok: true, id }, { status: 201 });
}
