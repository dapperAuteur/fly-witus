import { desc, eq, isNotNull } from "drizzle-orm";
import { db } from "@/db/client";
import { users } from "@/db/schema/auth";
import { CashAppQueue } from "./_components/cashapp-queue";

// Admin gate is enforced by app/admin/layout.tsx; this page can assume
// the requester is an admin.
export const metadata = { title: "CashApp Queue — Admin" };
export const dynamic = "force-dynamic";

type FilterParam = "pending" | "verified" | "rejected" | "all";

const FILTERS: ReadonlyArray<{ key: FilterParam; label: string }> = [
  { key: "pending", label: "Pending" },
  { key: "verified", label: "Verified" },
  { key: "rejected", label: "Rejected" },
  { key: "all", label: "All" },
];

export default async function AdminCashAppPage(props: {
  searchParams: Promise<{ status?: string }>;
}) {
  const sp = await props.searchParams;
  const filter: FilterParam =
    sp.status === "verified" || sp.status === "rejected" || sp.status === "all"
      ? sp.status
      : "pending";

  // The schema only writes cashapp_payment_status when a request comes
  // in; rows where the column is null are users who never used the
  // CashApp flow. Filter those out unconditionally.
  const baseWhere = isNotNull(users.cashappPaymentStatus);
  const where =
    filter === "all" ? baseWhere : eq(users.cashappPaymentStatus, filter);

  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      cashappUsername: users.cashappUsername,
      cashappPaymentStatus: users.cashappPaymentStatus,
      cashappRequestedAt: users.cashappRequestedAt,
      cashappActivatedAt: users.cashappActivatedAt,
      cashappRejectionReason: users.cashappRejectionReason,
      accountTier: users.accountTier,
    })
    .from(users)
    .where(where)
    .orderBy(desc(users.cashappRequestedAt));

  const pendingCount = rows.filter(
    (r) => r.cashappPaymentStatus === "pending",
  ).length;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-extrabold text-gray-900">
          CashApp Activation Queue
        </h1>
        {pendingCount > 0 && (
          <p className="mt-1 text-sm text-amber-700">
            ⚠️ {pendingCount} pending — 24-hour SLA.
          </p>
        )}
      </header>

      <nav className="flex gap-2 flex-wrap">
        {FILTERS.map((f) => {
          const href =
            f.key === "pending" ? "/admin/cashapp" : `/admin/cashapp?status=${f.key}`;
          const active = filter === f.key;
          return (
            <a
              key={f.key}
              href={href}
              className={`px-3 py-1.5 rounded-full text-sm font-semibold transition ${
                active
                  ? "bg-gray-900 text-white"
                  : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
              }`}
            >
              {f.label}
            </a>
          );
        })}
      </nav>

      {rows.length === 0 ? (
        <div className="bg-white rounded-2xl shadow p-8 text-center text-gray-500">
          {filter === "pending"
            ? "No pending CashApp requests. Inbox zero."
            : `No ${filter} CashApp requests.`}
        </div>
      ) : (
        <CashAppQueue
          rows={rows.map((r) => ({
            id: r.id,
            email: r.email,
            cashappUsername: r.cashappUsername ?? "",
            status: r.cashappPaymentStatus,
            requestedAtIso: r.cashappRequestedAt
              ? r.cashappRequestedAt.toISOString()
              : null,
            activatedAtIso: r.cashappActivatedAt
              ? r.cashappActivatedAt.toISOString()
              : null,
            rejectionReason: r.cashappRejectionReason ?? null,
            tier: r.accountTier,
          }))}
        />
      )}
    </div>
  );
}
