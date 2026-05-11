import Link from "next/link";
import { and, count, desc, eq, gte, isNotNull, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { users } from "@/db/schema/auth";
import { lifetimeSlotCounter } from "@/db/schema/commerce";
import { groups } from "@/db/schema/groups";
import { missions } from "@/db/schema/missions";

export const metadata = { title: "Dashboard — Admin" };
export const dynamic = "force-dynamic";

// Lightweight aggregate dashboard. Each card runs one count query so the
// page stays fast even as the user table grows. Activity panel pulls 10
// most-recent rows from the relevant tables.
export default async function AdminDashboardPage() {
  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [
    [{ value: totalUsers }],
    [{ value: paidUsers }],
    [{ value: lifetimeUsers }],
    [{ value: pendingCashApp }],
    [{ value: missionsLast30 }],
    [{ value: missionsLast7 }],
    [{ value: groupsTotal }],
    [counter] = [],
    recentSignups,
    recentMissions,
  ] = await Promise.all([
    db.select({ value: count() }).from(users),
    db
      .select({ value: count() })
      .from(users)
      .where(sql`${users.accountTier} != 'free'`),
    db
      .select({ value: count() })
      .from(users)
      .where(eq(users.accountTier, "lifetime")),
    db
      .select({ value: count() })
      .from(users)
      .where(
        and(
          isNotNull(users.cashappPaymentStatus),
          eq(users.cashappPaymentStatus, "pending"),
        ),
      ),
    db.select({ value: count() }).from(missions).where(gte(missions.createdAt, since30d)),
    db.select({ value: count() }).from(missions).where(gte(missions.createdAt, since7d)),
    db.select({ value: count() }).from(groups),
    db.select().from(lifetimeSlotCounter).where(eq(lifetimeSlotCounter.id, 1)).limit(1),
    db
      .select({ id: users.id, email: users.email, createdAt: users.createdAt, tier: users.accountTier })
      .from(users)
      .orderBy(desc(users.createdAt))
      .limit(10),
    db
      .select({
        id: missions.id,
        userId: missions.userId,
        missionNumber: missions.missionNumber,
        createdAt: missions.createdAt,
        location: missions.location,
      })
      .from(missions)
      .orderBy(desc(missions.createdAt))
      .limit(10),
  ]);

  const slotsLeft = counter
    ? counter.standardSlotsTotal - counter.standardSlotsUsed
    : null;

  return (
    <div className="space-y-8">
      <header className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>
        <p className="text-sm text-gray-500">
          Live counts. Refresh to update.
        </p>
      </header>

      <section className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Stat label="Users" value={totalUsers} />
        <Stat label="Paid users" value={paidUsers} />
        <Stat label="Lifetime users" value={lifetimeUsers} />
        <Stat label="CashApp pending" value={pendingCashApp} accent={pendingCashApp > 0 ? "amber" : undefined} />
        <Stat label="Missions / 7d" value={missionsLast7} />
        <Stat label="Missions / 30d" value={missionsLast30} />
        <Stat label="Groups" value={groupsTotal} />
        <Stat label="Lifetime slots left" value={slotsLeft ?? "—"} />
      </section>

      <section className="grid sm:grid-cols-2 gap-6">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">Recent signups</h2>
            <Link href="/admin/users" className="text-xs text-sky-700 hover:underline">
              All users →
            </Link>
          </div>
          <ul className="space-y-1 text-sm">
            {recentSignups.length === 0 && (
              <li className="text-gray-500 italic">No signups yet.</li>
            )}
            {recentSignups.map((u) => (
              <li key={u.id} className="flex items-center justify-between">
                <span className="truncate">{u.email}</span>
                <span className="text-xs text-gray-500 ml-2 shrink-0">
                  {u.tier} · {new Date(u.createdAt).toLocaleDateString()}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h2 className="font-semibold mb-3">Recent missions</h2>
          <ul className="space-y-1 text-sm">
            {recentMissions.length === 0 && (
              <li className="text-gray-500 italic">No missions yet.</li>
            )}
            {recentMissions.map((m) => (
              <li key={m.id} className="flex items-center justify-between">
                <span className="truncate">
                  {m.missionNumber}{" "}
                  <span className="text-gray-500">
                    {m.location ? `· ${m.location}` : ""}
                  </span>
                </span>
                <span className="text-xs text-gray-500 ml-2 shrink-0">
                  {new Date(m.createdAt).toLocaleDateString()}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number | string;
  accent?: "amber";
}) {
  const accentCls =
    accent === "amber"
      ? "bg-amber-50 border-amber-300"
      : "bg-white border-gray-200";
  return (
    <div className={`border rounded-lg p-4 ${accentCls}`}>
      <div className="text-xs uppercase tracking-wide text-gray-500">{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
    </div>
  );
}
