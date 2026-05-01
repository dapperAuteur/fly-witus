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

// Stubs we know ship in .env.example / drizzle.config.ts dev fallback.
// Anything matching these is almost certainly a "you forgot to pull live env" mistake,
// not a real connection target — fail loudly before pg's DNS resolver does.
const STUB_HOSTNAMES = new Set(["host", "host-direct", "host-pooled"]);
const STUB_USERPASS = new Set(["user:pass", "username:password", "placeholder:placeholder"]);

type Source = "DATABASE_URL_UNPOOLED" | "DATABASE_URL";

function pickConnectionString(): { source: Source; url: string } | null {
  if (process.env.DATABASE_URL_UNPOOLED) {
    return { source: "DATABASE_URL_UNPOOLED", url: process.env.DATABASE_URL_UNPOOLED };
  }
  if (process.env.DATABASE_URL) {
    return { source: "DATABASE_URL", url: process.env.DATABASE_URL };
  }
  return null;
}

// `postgres://` isn't a special scheme in WHATWG URL — temporarily swap to
// `https://` so URL parsing exposes hostname/username/password the normal way.
function parsePgUrl(raw: string): URL {
  return new URL(raw.replace(/^postgres(ql)?:\/\//, "https://"));
}

function fail(message: string): never {
  console.error(`✗ ${message}`);
  process.exit(1);
}

const pick = pickConnectionString();
if (!pick) {
  fail(
    "DATABASE_URL_UNPOOLED or DATABASE_URL must be set. Run `vercel env pull .env.local` first.",
  );
}

const { source, url } = pick;

if (url.includes("placeholder")) {
  fail(
    `${source} contains "placeholder" — that's the dev fallback from drizzle.config.ts. ` +
      `Replace it with your real Neon connection string in .env.local.`,
  );
}

let parsed: URL;
try {
  parsed = parsePgUrl(url);
} catch (err) {
  fail(`Could not parse ${source} as a URL: ${(err as Error).message}`);
}

if (STUB_HOSTNAMES.has(parsed.hostname)) {
  fail(
    `${source} hostname is "${parsed.hostname}" — that's the placeholder from .env.example, not a real Neon endpoint.\n` +
      `  Fix:    run \`vercel env pull .env.local\`\n` +
      `  Or:     paste the connection string from Vercel → Storage → Neon → "Direct connection".`,
  );
}

const userPass = `${parsed.username}:${parsed.password}`;
if (STUB_USERPASS.has(userPass)) {
  fail(
    `${source} credentials are placeholders ("${parsed.username}:${parsed.password}").\n` +
      `  Fix:    run \`vercel env pull .env.local\` to get the real Neon credentials.`,
  );
}

// Fly.WitUS targets Neon — single-word hostnames are always wrong here. Catch
// them before pg's DNS error obscures what was actually attempted.
if (!parsed.hostname.includes(".") && parsed.hostname !== "localhost") {
  fail(
    `${source} hostname "${parsed.hostname}" looks malformed — Neon endpoints always have a dotted name like ep-cool-bird-12345.us-east-1.aws.neon.tech.`,
  );
}

console.log(`→ Connecting to ${parsed.hostname} as ${parsed.username} (DDL via ${source})`);

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
