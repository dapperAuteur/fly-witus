// scripts/check-sentry-scrub.ts - proves the Sentry beforeSend scrubber leaks nothing.
//
// This repo has no test runner (no vitest / jest), and the scrubber is the one piece of the error
// pipeline where a mistake ships a working credential to a third party. So it gets an executable
// assertion in the repo's existing `scripts/` + tsx convention instead:
//
//   npm run check:scrub
//
// The check builds one deliberately worst-case Sentry event - magic link, group invite code,
// signed email-change token, pilot email, session cookie, Authorization header, Stripe key, and a
// full Postgres connection string - serialises the SCRUBBED result, and fails if any of those
// literals survives anywhere in the payload. It also asserts the opposite direction: a 21-char
// nanoid mission id must SURVIVE, because over-redaction makes a report useless for triage.
//
// Exits non-zero on the first failure so it can gate a future CI step.

import assert from "node:assert/strict";
import type { ErrorEvent } from "@sentry/nextjs";
import { scrubEvent, redactText, maskUrl, isSecretPath } from "../src/lib/sentry-scrub";

// --- The secrets that must never appear in a serialized event -------------------------------
const PILOT_EMAIL = "pilot.jane@example.com";
const MAGIC_TOKEN = "Xq7rTv9LmZa2BdCe4FgH6JkN8PsQ1WuY";
const INVITE_CODE = "K7M2QPZ4";
const EMAIL_CHANGE_TOKEN =
  "eyJ1c2VySWQiOiJhYmMiLCJuZXdFbWFpbCI6InBpbG90QGV4LmNvbSJ9.9Fk2Lq8ZzWv1Xr6Tn4Yb3Cd5Ge7Hj0Kl2Mn4Op6Qr8";
const SESSION_VALUE = "s3cr3tSessionValue.signaturePart";
const SESSION_COOKIE = `better-auth.session_token=${SESSION_VALUE}`;
// Assembled at runtime, NOT written as one literal: GitHub secret-scanning push protection blocks
// any push containing a contiguous `sk_live_...` string, even an obviously fake one, which makes
// the whole branch unpushable. The joined value is byte-identical, so VENDOR_KEY_RE still sees a
// real-shaped Stripe secret key and the assertion below is exactly as strong as before.
const STRIPE_KEY = ["sk", "live", "51QabcdEFGHijklMNOPqrstUVWX"].join("_");
const DB_PASSWORD = "n30nSup3rSecret";
const DB_URL = `postgres://flywitus:${DB_PASSWORD}@ep-cool-lab-123456.us-east-2.aws.neon.tech/flydb?sslmode=require`;
const BEARER = "Bearer abcdefghijklmnop1234567890";
const CRON_SECRET = "vY8xQ2mL0pRt5Wn7Zb3Kd1Fh6Jc4Sg9A";

// A real resource id: nanoid() default, 21 chars. This one must SURVIVE.
const MISSION_ID = "V1StGXR8_Z5jdHi6B-myT";

const secretsThatMustNotLeak: Array<[string, string]> = [
  ["pilot email", PILOT_EMAIL],
  ["magic-link token", MAGIC_TOKEN],
  ["group invite code", INVITE_CODE],
  ["email-change token", EMAIL_CHANGE_TOKEN],
  ["session cookie value", SESSION_VALUE],
  ["stripe secret key", STRIPE_KEY],
  ["database password", DB_PASSWORD],
  ["bearer token", BEARER.split(" ")[1]],
  ["cron secret", CRON_SECRET],
  ["client ip", "203.0.113.42"],
];

function buildEvent(): ErrorEvent {
  return {
    // `type: undefined` is what makes this an ERROR event rather than a transaction; the Sentry
    // types require the discriminant to be present even when it is undefined.
    type: undefined,
    message: `Sign-in failed for ${PILOT_EMAIL} at https://fly.witus.online/api/auth/magic-link/verify?token=${MAGIC_TOKEN}`,
    exception: {
      values: [
        {
          type: "Error",
          value: `connect ECONNREFUSED for ${DB_URL} while loading mission ${MISSION_ID}`,
        },
        {
          type: "Error",
          value: `invite redemption failed at https://fly.witus.online/join/${INVITE_CODE} (CRON_SECRET=${CRON_SECRET})`,
        },
      ],
    },
    user: {
      id: "usr_123",
      email: PILOT_EMAIL,
      username: "janepilot",
      ip_address: "203.0.113.42",
    },
    breadcrumbs: [
      {
        message: `POST /api/account/email/verify?token=${EMAIL_CHANGE_TOKEN}`,
        data: { stripe: STRIPE_KEY, note: `notified ${PILOT_EMAIL}` },
      },
    ],
    request: {
      url: `https://fly.witus.online/api/missions/${MISSION_ID}?token=${MAGIC_TOKEN}&email=${encodeURIComponent(PILOT_EMAIL)}`,
      query_string: `token=${MAGIC_TOKEN}&email=${encodeURIComponent(PILOT_EMAIL)}&status=ok`,
      cookies: { "better-auth.session_token": SESSION_VALUE },
      data: { email: PILOT_EMAIL, note: "changing my address" },
      headers: {
        Cookie: SESSION_COOKIE,
        Authorization: BEARER,
        "set-cookie": SESSION_COOKIE,
        "user-agent": "Mozilla/5.0",
        referer: `https://fly.witus.online/join/${INVITE_CODE}`,
      },
    },
  } as ErrorEvent;
}

let failures = 0;
function check(label: string, fn: () => void) {
  try {
    fn();
    console.log(`  ok   ${label}`);
  } catch (err) {
    failures++;
    console.error(`  FAIL ${label}`);
    console.error(`       ${err instanceof Error ? err.message : String(err)}`);
  }
}

console.log("check-sentry-scrub - Sentry beforeSend leak check\n");

const scrubbed = scrubEvent(buildEvent());
const serialized = JSON.stringify(scrubbed);

console.log("no secret survives serialization:");
for (const [label, secret] of secretsThatMustNotLeak) {
  check(`${label} is gone`, () => {
    assert.ok(
      !serialized.includes(secret),
      `"${label}" survived the scrub. Serialized event:\n${serialized}`,
    );
  });
}

console.log("\ncredential-bearing containers are dropped outright:");
check("request.cookies removed", () => assert.equal(scrubbed.request?.cookies, undefined));
check("request.data removed", () => assert.equal(scrubbed.request?.data, undefined));
check("Cookie header removed", () => {
  const h = scrubbed.request?.headers as Record<string, unknown> | undefined;
  assert.equal(h?.Cookie, undefined);
  assert.equal(h?.["set-cookie"], undefined);
});
check("Authorization header removed", () => {
  const h = scrubbed.request?.headers as Record<string, unknown> | undefined;
  assert.equal(h?.Authorization, undefined);
});
check("user identity fields removed", () => {
  assert.equal(scrubbed.user?.email, undefined);
  assert.equal(scrubbed.user?.username, undefined);
  assert.equal(scrubbed.user?.ip_address, undefined);
  assert.equal(scrubbed.user?.id, "usr_123", "opaque user id should survive for correlation");
});

console.log("\ntriage detail is preserved (no over-redaction):");
check("nanoid mission id survives", () =>
  assert.ok(
    serialized.includes(MISSION_ID),
    "a 21-char nanoid resource id must survive - it is not a bearer secret",
  ),
);
check("route path survives", () =>
  assert.ok(serialized.includes("/api/missions/"), "the route is the whole point of the report"),
);
check("non-secret query flag survives", () =>
  assert.ok(
    (scrubbed.request?.query_string as string).includes("status=ok"),
    "a harmless status flag should not be redacted",
  ),
);
check("email-status redirect flag survives", () =>
  assert.equal(maskUrl("/dashboard?email=changed"), "/dashboard?email=changed"),
);
check("user-agent survives", () => {
  const h = scrubbed.request?.headers as Record<string, unknown> | undefined;
  assert.equal(h?.["user-agent"], "Mozilla/5.0");
});

console.log("\nunit checks on redactText / maskUrl:");
check("join path is masked even though the code is short", () =>
  assert.ok(!maskUrl(`https://fly.witus.online/join/${INVITE_CODE}`).includes(INVITE_CODE)),
);
check("unparseable url is dropped", () =>
  assert.equal(maskUrl("http://[not a url"), "[redacted url]"),
);
check("plain prose is untouched", () =>
  assert.equal(
    redactText("Could not pin down the cause of the mission save failure."),
    "Could not pin down the cause of the mission save failure.",
  ),
);
check("redemption endpoints are classified as secret paths", () => {
  for (const p of [
    "/join/K7M2QPZ4",
    "/api/auth/magic-link/verify",
    "/api/auth",
    "/api/account/email/verify",
  ]) {
    assert.ok(isSecretPath(p), `${p} should be treated as a token-redemption path`);
  }
  for (const p of ["/api/missions/abc", "/groups/abc/meetups", "/help/getting-started", "/"]) {
    assert.ok(!isSecretPath(p), `${p} is an ordinary route and should not be blanket-masked`);
  }
});
check("labelled secret is redacted", () =>
  assert.ok(!redactText("password: hunter2sekrit").includes("hunter2sekrit")),
);

if (failures > 0) {
  console.error(`\n${failures} check(s) FAILED - the scrubber leaks. Do not ship.`);
  process.exit(1);
}
console.log("\nAll checks passed. The scrubbed event carries no credential and no pilot PII.");
