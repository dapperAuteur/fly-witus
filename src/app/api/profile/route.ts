import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users } from "@/db/schema/auth";
import { requireUser } from "@/lib/api-auth";
import { profileUpdateSchema } from "@/lib/profile-api";

// Returns only the columns the dashboard form binds to. Account tier /
// cashapp / stripe / admin fields are exposed elsewhere (checkout flow,
// admin pages); leaking them in a profile read is unnecessary.
const PROFILE_COLUMNS = {
  id: users.id,
  email: users.email,
  emailVerified: users.emailVerified,
  name: users.name,
  displayName: users.displayName,
  avatarUrl: users.avatarUrl,
  part107CertNumber: users.part107CertNumber,
  homeLocation: users.homeLocation,
  createdAt: users.createdAt,
  updatedAt: users.updatedAt,
};

export async function GET() {
  const userOrRes = await requireUser();
  if (userOrRes instanceof NextResponse) return userOrRes;

  const [profile] = await db
    .select(PROFILE_COLUMNS)
    .from(users)
    .where(eq(users.id, userOrRes.id))
    .limit(1);

  if (!profile) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ profile });
}

export async function PATCH(req: Request) {
  const userOrRes = await requireUser();
  if (userOrRes instanceof NextResponse) return userOrRes;

  const body = await req.json().catch(() => null);
  const parsed = profileUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid profile payload", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const input = parsed.data;

  // Skip undefined fields (don't overwrite stored values); allow null
  // through (explicit clear).
  const updates: Partial<typeof users.$inferInsert> = { updatedAt: new Date() };
  if (input.displayName !== undefined) updates.displayName = input.displayName ?? null;
  if (input.avatarUrl !== undefined) updates.avatarUrl = input.avatarUrl ?? null;
  if (input.part107CertNumber !== undefined) {
    updates.part107CertNumber = input.part107CertNumber ?? null;
  }
  if (input.homeLocation !== undefined) updates.homeLocation = input.homeLocation ?? null;

  const [updated] = await db
    .update(users)
    .set(updates)
    .where(eq(users.id, userOrRes.id))
    .returning(PROFILE_COLUMNS);

  if (!updated) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ profile: updated });
}
