import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users } from "@/db/schema/auth";
import { lifetimeSlotCounter } from "@/db/schema/commerce";
import { count } from "drizzle-orm";
import { LifetimeForm } from "./_components/lifetime-form";

export const metadata = { title: "Lifetime Slots — Admin" };
export const dynamic = "force-dynamic";

export default async function AdminLifetimePage() {
  const [counterRow, [{ value: actualLifetime }]] = await Promise.all([
    db.select().from(lifetimeSlotCounter).where(eq(lifetimeSlotCounter.id, 1)).limit(1),
    db.select({ value: count() }).from(users).where(eq(users.accountTier, "lifetime")),
  ]);

  // The counter row is seeded by the commerce migration (id=1); if it's
  // missing we surface that explicitly rather than silently rendering 0/0.
  const counter = counterRow[0] ?? null;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Lifetime Slots</h1>

      {!counter && (
        <div className="bg-amber-50 border border-amber-300 rounded-lg p-4 text-sm text-amber-900">
          The lifetime_slot_counter row (id=1) hasn&apos;t been seeded. The
          commerce migration should insert it; check the DB or re-run
          migrations.
        </div>
      )}

      {counter && (
        <>
          <section className="grid sm:grid-cols-3 gap-4">
            <Stat label="Standard total" value={counter.standardSlotsTotal} />
            <Stat label="Standard used (counter)" value={counter.standardSlotsUsed} />
            <Stat
              label="Slots remaining"
              value={counter.standardSlotsTotal - counter.standardSlotsUsed}
              accent={
                counter.standardSlotsTotal - counter.standardSlotsUsed <= 5
                  ? "amber"
                  : undefined
              }
            />
          </section>

          <section className="bg-white border border-gray-200 rounded-lg p-4">
            <h2 className="font-semibold mb-3">Reconcile</h2>
            <p className="text-sm text-gray-600 mb-2">
              Counter says {counter.standardSlotsUsed} standard lifetime sales used.
              Database currently has{" "}
              <strong>{actualLifetime}</strong> users on the lifetime tier (includes
              promo-reopen + manual grants).
            </p>
            {actualLifetime !== counter.standardSlotsUsed && (
              <p className="text-sm text-amber-800">
                ⚠ Counter and tier-count differ. The counter only tracks the
                standard 100-slot offering — promo-reopen lifetime grants are tracked
                on the promo row (lifetimeSlotsUsed) and are not reflected here.
                Verify against /admin/users before adjusting.
              </p>
            )}
          </section>

          <LifetimeForm counter={counter} />
        </>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
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
