// scripts/noaa-sweep.ts — pre-launch NOAA reliability sweep.
//
// Hits the deployed weather endpoint with 50 ZIPs across CONUS + AK + HI
// + edge cases. For each: report status, latency, fallback path taken.
// Exits non-zero if any zip surfaces a 5xx or unhandled timeout (4xx is
// allowed — that's the typed "no station" path).
//
// Usage:
//   tsx scripts/noaa-sweep.ts                           # hits production
//   BASE=http://localhost:3000 tsx scripts/noaa-sweep.ts  # local dev
//
// Note: this script intentionally has no DB / env dependency. It only
// needs a base URL and HTTP. Fits Phase-6 launch-artifacts spec
// "NOAA sweep: 50 zips across CONUS + AK + HI; document fallbacks."

const BASE = process.env.BASE ?? "https://fly.witus.online";

// 50 ZIPs — CONUS spread across all FAA regions, plus AK + HI + edge
// cases (military APO, PO box prefix, not-yet-assigned ZCTA).
const ZIPS = [
  // West coast
  "90210", "94103", "97201", "98101", "92101",
  // Mountain
  "80401", "84101", "85001", "87101", "59601",
  // Plains
  "73101", "67101", "68101", "55401", "50301",
  // South
  "75201", "77001", "70112", "32801", "33101",
  // Mid-Atlantic
  "20001", "21201", "23219", "27601", "29201",
  // Northeast
  "10001", "11201", "02108", "06103", "19101",
  // Midwest
  "60601", "44101", "48201", "53201", "63101",
  // Mountain North
  "82001", "57101", "58501", "83702", "99201",
  // AK
  "99501", "99701", "99801",
  // HI
  "96701", "96801", "96720",
  // Edges
  "00501",   // Holtsville NY — the lowest ZCTA
  "96860",   // PO box (Pearl Harbor)
  "09001",   // APO Europe — should fail gracefully
  "99950",   // Ketchikan, AK — northern edge
];

interface Result {
  zip: string;
  status: number;
  latencyMs: number;
  ok: boolean;
  payload: unknown;
  error: string | null;
}

async function probe(zip: string): Promise<Result> {
  const url = `${BASE}/api/weather?zip=${zip}`;
  const start = Date.now();
  try {
    const res = await fetch(url, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(15_000),
    });
    const latencyMs = Date.now() - start;
    const payload = await res.json().catch(() => null);
    return {
      zip,
      status: res.status,
      latencyMs,
      ok: res.status < 500,
      payload,
      error: null,
    };
  } catch (err) {
    return {
      zip,
      status: 0,
      latencyMs: Date.now() - start,
      ok: false,
      payload: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function main() {
  console.log(`# NOAA sweep — ${BASE}`);
  console.log(`# ${new Date().toISOString()}\n`);
  console.log("ZIP\tStatus\tLatency\tNotes");

  const results: Result[] = [];
  // Run in batches of 5 — friendly to the upstream NOAA grid endpoint
  // and to Vercel function concurrency on the cheap end.
  for (let i = 0; i < ZIPS.length; i += 5) {
    const batch = await Promise.all(ZIPS.slice(i, i + 5).map(probe));
    for (const r of batch) {
      results.push(r);
      const note =
        r.error ??
        (r.status >= 500
          ? "5XX — investigate"
          : r.status === 200
            ? "ok"
            : `${r.status} (typed fallback)`);
      console.log(`${r.zip}\t${r.status}\t${r.latencyMs}ms\t${note}`);
    }
  }

  const failed = results.filter((r) => !r.ok);
  const slow = results.filter((r) => r.ok && r.latencyMs > 5000);
  console.log(`\n# Summary: ${results.length - failed.length}/${results.length} passing.`);
  if (slow.length) {
    console.log(`# ⚠ Slow (>5s): ${slow.map((r) => r.zip).join(", ")}`);
  }
  if (failed.length) {
    console.log(
      `# ❌ Failed: ${failed.map((r) => `${r.zip}(${r.status || r.error})`).join(", ")}`,
    );
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("[noaa-sweep] unhandled error", err);
  process.exit(1);
});
