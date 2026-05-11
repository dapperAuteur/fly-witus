import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users } from "@/db/schema/auth";

// v3 §3: groups are gated to paid users (Cloud or Lifetime). Free users
// stay on the localStorage flow with no group surface. We DB-check the
// tier (not session) for the same reason api-auth's requireAdmin does:
// downgrade should kick in immediately on the next request.
export type PaidTier = "cloud_monthly" | "cloud_annual" | "lifetime";

export async function requirePaidUser() {
  const { requireUser } = await import("./api-auth");
  const userOrRes = await requireUser();
  if (userOrRes instanceof NextResponse) return userOrRes;

  const [row] = await db
    .select({ tier: users.accountTier, expires: users.tierExpiresAt })
    .from(users)
    .where(eq(users.id, userOrRes.id))
    .limit(1);

  if (!row) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isPaidTier(row.tier, row.expires)) {
    return NextResponse.json(
      {
        error: "Paid plan required",
        code: "TIER_REQUIRED",
        upgradeUrl: "/pricing",
      },
      { status: 403 },
    );
  }
  return userOrRes;
}

export function isPaidTier(
  tier: string | null | undefined,
  expiresAt: Date | null | undefined,
): tier is PaidTier {
  if (tier === "lifetime") return true;
  if (tier === "cloud_monthly" || tier === "cloud_annual") {
    if (!expiresAt) return true;
    return expiresAt.getTime() > Date.now();
  }
  return false;
}
