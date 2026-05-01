import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { env } from "@/lib/env";
import * as schema from "./schema";

const globalForPool = globalThis as unknown as { __flyWitusPool?: Pool };

const pool =
  globalForPool.__flyWitusPool ??
  new Pool({
    connectionString: env.DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 30_000,
  });

if (process.env.NODE_ENV !== "production") {
  globalForPool.__flyWitusPool = pool;
}

export const db = drizzle(pool, { schema });
export type DB = typeof db;
