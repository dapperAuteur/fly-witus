import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users } from "@/db/schema/auth";
import { env } from "@/lib/env";
import { requireUser } from "@/lib/api-auth";
import { changeEmailSchema } from "@/lib/account-api";
import { createEmailChangeToken } from "@/lib/account-tokens";
import { sendEmail } from "@/lib/mailer";

// POST /api/account/email — request an email change. We don't mutate the
// account here: we email a verification link to the NEW address, and the
// change only takes effect when that link is clicked (verify route). This
// proves the user controls the new mailbox, matching the magic-link model.
export async function POST(req: Request) {
  const userOrRes = await requireUser();
  if (userOrRes instanceof NextResponse) return userOrRes;

  const body = await req.json().catch(() => null);
  const parsed = changeEmailSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Enter a valid email address." },
      { status: 400 },
    );
  }
  const newEmail = parsed.data.newEmail.toLowerCase();

  if (newEmail === userOrRes.email.toLowerCase()) {
    return NextResponse.json(
      { error: "That's already your email." },
      { status: 400 },
    );
  }

  try {
    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, newEmail))
      .limit(1);
    if (existing) {
      return NextResponse.json(
        { error: "That email is already in use." },
        { status: 409 },
      );
    }

    const token = createEmailChangeToken(userOrRes.id, newEmail);
    const url = `${env.BETTER_AUTH_URL}/api/account/email/verify?token=${encodeURIComponent(token)}`;

    await sendEmail({
      to: newEmail,
      subject: "Confirm your new Fly WitUS email",
      text: [
        `You asked to change your Fly WitUS account email to this address.`,
        ``,
        `Confirm the change (link expires in 30 minutes):`,
        url,
        ``,
        `If you didn't request this, you can ignore this email — your`,
        `account email won't change.`,
      ].join("\n"),
    });
  } catch (err) {
    console.error("[POST /api/account/email]", err);
    return NextResponse.json(
      { error: "Couldn't start the email change. Try again." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
