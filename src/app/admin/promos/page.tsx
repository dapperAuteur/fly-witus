import { desc } from "drizzle-orm";
import { db } from "@/db/client";
import { promos } from "@/db/schema/commerce";
import { hasStripe } from "@/lib/env";
import { PromosManager } from "./_components/promos-manager";

export const metadata = { title: "Promos — Admin" };
export const dynamic = "force-dynamic";

export default async function AdminPromosPage() {
  const rows = await db.select().from(promos).orderBy(desc(promos.createdAt));

  // Pass plain JSON to the client component — Date columns serialize
  // through Next's RSC boundary as ISO strings.
  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold">Promos</h1>
        {!hasStripe && (
          <span className="text-xs px-2 py-1 bg-amber-100 text-amber-800 rounded">
            Stripe not configured — discount promos can&apos;t auto-create coupons
          </span>
        )}
      </header>
      <PromosManager initialPromos={rows} stripeEnabled={hasStripe} />
    </div>
  );
}
