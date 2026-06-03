import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users } from "@/db/schema/auth";
import { auth } from "@/lib/auth";

export const metadata = { title: "Admin — Fly WitUS" };

// Force-dynamic so the auth check runs per request. Static generation
// would bake "not admin" into the page during build for /admin/*.
export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Server-side admin gate. Returns 404 (not 403) so the existence of
  // /admin isn't advertised to non-admins — matches the v3 §5 intent
  // that only BAM ever sees this surface.
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) notFound();

  const [me] = await db
    .select({ isAdmin: users.isAdmin })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  if (!me?.isAdmin) notFound();

  return (
    <div className="min-h-screen bg-background font-sans">
      <nav className="bg-gray-900 text-white px-4 sm:px-8 py-3 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4 flex-wrap">
          <Link href="/admin" className="font-extrabold text-lg">
            Fly WitUS · Admin
          </Link>
          <div className="flex items-center gap-4 text-sm">
            <Link href="/admin" className="hover:text-amber-300">
              Dashboard
            </Link>
            <Link href="/admin/users" className="hover:text-amber-300">
              Users
            </Link>
            <Link href="/admin/cashapp" className="hover:text-amber-300">
              CashApp
            </Link>
            <Link href="/admin/lifetime" className="hover:text-amber-300">
              Lifetime
            </Link>
            <Link href="/admin/promos" className="hover:text-amber-300">
              Promos
            </Link>
            <Link href="/admin/groups" className="hover:text-amber-300">
              Groups
            </Link>
            <Link href="/" className="text-gray-400 hover:text-white">
              ← Site
            </Link>
          </div>
        </div>
      </nav>
      <main className="max-w-6xl mx-auto p-4 sm:p-8">{children}</main>
    </div>
  );
}
