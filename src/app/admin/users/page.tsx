import Link from "next/link";
import { desc, like, or } from "drizzle-orm";
import { db } from "@/db/client";
import { users } from "@/db/schema/auth";
import { UsersTable } from "./_components/users-table";

export const metadata = { title: "Users — Admin" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

export default async function AdminUsersPage(props: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const sp = await props.searchParams;
  const q = (sp.q ?? "").trim();
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);

  // LIKE match on email + display name. Cheap for the size of the user
  // table at launch; swap to FTS later if we ever cross 100k users.
  const where = q
    ? or(like(users.email, `%${q}%`), like(users.displayName, `%${q}%`))
    : undefined;

  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      displayName: users.displayName,
      accountTier: users.accountTier,
      tierExpiresAt: users.tierExpiresAt,
      isAdmin: users.isAdmin,
      createdAt: users.createdAt,
      cashappPaymentStatus: users.cashappPaymentStatus,
    })
    .from(users)
    .where(where)
    .orderBy(desc(users.createdAt))
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE);

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold">Users</h1>
        <form className="flex gap-2" action="">
          <input
            name="q"
            defaultValue={q}
            placeholder="Search email or name…"
            className="px-3 py-2 border border-gray-300 rounded text-sm w-64"
          />
          <button
            type="submit"
            className="px-3 py-2 bg-gray-800 text-white rounded text-sm font-semibold"
          >
            Search
          </button>
        </form>
      </header>

      <UsersTable users={rows} />

      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-500">
          Page {page} · {rows.length} row{rows.length === 1 ? "" : "s"}
        </span>
        <div className="flex gap-2">
          {page > 1 && (
            <Link
              href={`?${new URLSearchParams({ q, page: String(page - 1) }).toString()}`}
              className="px-3 py-1.5 border border-gray-300 rounded hover:bg-gray-50"
            >
              ← Prev
            </Link>
          )}
          {rows.length === PAGE_SIZE && (
            <Link
              href={`?${new URLSearchParams({ q, page: String(page + 1) }).toString()}`}
              className="px-3 py-1.5 border border-gray-300 rounded hover:bg-gray-50"
            >
              Next →
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
