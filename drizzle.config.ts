import { defineConfig } from "drizzle-kit";

// drizzle-kit auto-loads .env but NOT .env.local. Next.js convention is
// .env.local for the developer's local secrets, so load it explicitly here
// before reading process.env. Requires Node 20.12+ (we're on 22.17 per
// package.json engines, but this is graceful: if the file is missing or
// the API isn't available we just fall through to whatever's already in
// process.env — which is the right behavior on CI/Vercel where env is
// injected by the host.
try {
  process.loadEnvFile(".env.local");
} catch {
  // .env.local missing or process.loadEnvFile unsupported — both fine.
}

const databaseUrl =
  process.env.DATABASE_URL_UNPOOLED ??
  process.env.DATABASE_URL ??
  "postgres://placeholder:placeholder@localhost/fly_witus_dev";

export default defineConfig({
  schema: "./src/db/schema/index.ts",
  out: "./src/db/migrations",
  dialect: "postgresql",
  dbCredentials: { url: databaseUrl },
  casing: "snake_case",
  strict: true,
  verbose: true,
});
