// Apply Drizzle migrations to whichever Postgres DATABASE_URL points at.
//
// Local dev:        npm run db:migrate          (loads .env.local via tsx --env-file)
// CI / Vercel:      npm run db:migrate:prod     (expects env injected by host)
//
// Neon recommends the direct (unpooled) connection for DDL — we prefer
// DATABASE_URL_UNPOOLED if both are set, falling back to DATABASE_URL.

import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";

const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;

if (!url || url.includes("placeholder")) {
  console.error(
    "DATABASE_URL_UNPOOLED or DATABASE_URL must be a real Neon connection string. " +
      "Run `vercel env pull .env.local` first.",
  );
  process.exit(1);
}

const pool = new Pool({ connectionString: url });
const db = drizzle(pool);

async function main() {
  console.log("Applying migrations from ./src/db/migrations …");
  await migrate(db, { migrationsFolder: "./src/db/migrations" });
  console.log("✓ Migrations applied.");
  await pool.end();
}

main().catch((error) => {
  console.error("Migration failed:", error);
  pool.end().finally(() => process.exit(1));
});
