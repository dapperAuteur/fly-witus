import type { ErrorEvent } from "@sentry/nextjs";

/**
 * Sentry `beforeSend` scrubber for Fly.WitUS.
 *
 * Why this file exists
 * --------------------
 * A crash report is a copy of app state handed to a third party. Several things this app touches
 * routinely are, in effect, working credentials or personal data:
 *   - the magic-link sign-in URL and the WitUS OIDC callback under `/api/auth/...` (takeover);
 *   - `/join/<inviteCode>` - an 8-char code that grants membership of someone's flight group;
 *   - `/api/account/email/verify?token=...` - an HMAC-signed token whose payload base64-encodes
 *     the pilot's requested email address;
 *   - the pilot's email, the session cookie, and the Authorization header;
 *   - `DATABASE_URL`-shaped connection strings and Stripe / Mailgun keys, which the `pg` driver
 *     and vendor SDKs quote verbatim inside their own error messages.
 * None of that belongs in an error tracker. This pass strips it and keeps everything else.
 *
 * The bias when unsure is REDACT. A slightly over-redacted crash costs a look at the server log;
 * an under-redacted one hands a stranger a working session.
 *
 * The deliberate exception is RESOURCE IDS. Mission, group, meetup, aircraft-profile, and feedback
 * ids are 21-character `nanoid()` values - random-looking, but not bearer secrets (every route
 * re-checks ownership or membership before serving them). Redacting them would strip exactly the
 * detail that makes a report actionable, so segments of nanoid length or shorter survive unless
 * their path prefix or their query-param name says otherwise.
 *
 * Pure and dependency-free (no `server-only`, no `env` import) so it is directly runnable by
 * `npm run check:scrub` - see `scripts/check-sentry-scrub.ts`.
 */

/** Query-param names that carry (or plausibly carry) a bearer secret. Matched case-insensitively
 *  as a substring, so `callbackToken`, `access_token`, `otp_code`, and `state` all trip it. */
const SECRET_PARAM_RE =
  /(token|secret|code|otp|passcode|password|pwd|pin|key|jwt|sig|signature|hash|auth|credential|session|magic|invite|nonce|state)/i;

/** Path prefixes that are token-redemption endpoints by construction. Everything after the prefix
 *  is masked whether or not it "looks" random: `/join/ABCD1234` is short but it IS the key. */
const SECRET_PATH_RE =
  /^\/(api\/auth|api\/account\/email\/verify|join|invite|accept|reset|reset-password|set-password|magic-link|confirm|activate|unsubscribe)(\/|$)/i;

/** A path segment long enough to be a generated token rather than one of our ids. The threshold sits
 *  deliberately ABOVE nanoid's 21 characters: 24+ chars of base64url/hex is a Better Auth token, a
 *  signed email-change token, or a hex digest, and none of those are ids worth keeping. */
const TOKENISH_SEGMENT_RE = /^[A-Za-z0-9_-]{24,}$/;

/** Absolute http(s) URLs. Trailing punctuation is excluded so the prose around a URL survives. */
const URL_RE = /https?:\/\/[^\s<>"')\]]+/g;

/** Root-relative paths in free text - `POST /api/account/email/verify?token=...` is how a
 *  breadcrumb records a request, and it is every bit as leaky as the absolute form. The lookbehind
 *  keeps prose intact: "and/or", "50/50", and the tail of an already-masked absolute URL are all
 *  preceded by a word char, a colon, or a slash, so none of them match. */
const RELATIVE_URL_RE = /(?<![\w:/])\/[A-Za-z0-9._~%-]+(?:\/[A-Za-z0-9._~%-]*)*(?:\?[^\s<>"')\]]*)?/g;

/** `postgres://user:pass@host/db` and friends - the `pg` driver quotes these in full, password
 *  included, when a connection fails. Handled before the URL pass so the userinfo never leaks. */
const CONNECTION_STRING_RE = /\b[a-z][a-z0-9+.-]*:\/\/[^\s:/@]+:[^\s@/]+@[^\s<>"')\]]+/gi;

/** Bare email addresses anywhere in the text. */
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

/** A base64url payload with a signature appended. Covers BOTH the three-part JWT (the WitUS OIDC
 *  id_token) and the TWO-part `payload.signature` shape that src/lib/account-tokens.ts mints for an
 *  email change - whose payload literally base64-encodes the pilot's requested address. */
const JWT_RE = /\beyJ[A-Za-z0-9_-]{4,}(?:\.[A-Za-z0-9_-]{4,}){1,2}\b/g;

/** Vendor key prefixes this app actually holds: Stripe secret/publishable/restricted + webhook. */
const VENDOR_KEY_RE = /\b(?:sk|pk|rk)_(?:live|test)_[A-Za-z0-9]{8,}|\bwhsec_[A-Za-z0-9]{8,}/g;

/** `Authorization: Bearer <token>` and Basic. */
const BEARER_RE = /\b(bearer|basic)\s+[A-Za-z0-9._~+/=-]{8,}/gi;

/** A labelled raw secret: `password: hunter2`, `one-time code is 998812`. The separator is
 *  required, so ordinary prose ("pin down the cause") is left alone. */
const SECRET_LABEL_RE =
  /\b(pin|password|passcode|api[-_\s]?key|secret|auth[-_\s]?token|access[-_\s]?token|one[-\s]?time code|access code|security code|verification code)\b\s*(?:is|:|=)\s*("[^"]{3,}"|'[^']{3,}'|[^\s.,;)]{3,})/gi;

/** An env-var-shaped assignment: `CRON_SECRET=abc123`, `BETTER_AUTH_SECRET: xyz`,
 *  `MAILGUN_API_KEY = k-1234`. A plain `\bsecret\b` does NOT fire on `CRON_SECRET` (the underscore is a
 *  word character, so there is no boundary before `SECRET`), which is exactly how a real secret
 *  slips past a naive label rule - hence this second, prefix-tolerant pass. */
const ENV_SECRET_RE =
  /\b([A-Za-z0-9]*[A-Za-z0-9_]*(?:secret|token|api[_-]?key|password|passwd|credentials?|dsn))\s*[:=]\s*("[^"]{3,}"|'[^']{3,}'|[^\s,;)]{3,})/gi;

export const REDACTED = "[redacted]";
export const REDACTED_URL = "[redacted url]";

/** True when a path is one of the token-redemption endpoints above. Exported for the check script. */
export function isSecretPath(pathname: string): boolean {
  return SECRET_PATH_RE.test(pathname);
}

function maskPathname(pathname: string): string {
  // Under a redemption endpoint, every segment PAST THE MATCHED PREFIX is the key itself, whatever
  // it looks like. We keep the prefix (`/api/auth`, `/join`) so a report still says which family of
  // flow broke, and drop the rest. `onRequestError` reports the Next route path separately, so
  // triage keeps the route even when the tail is masked here.
  const match = pathname.match(SECRET_PATH_RE);
  const keepUpTo = match ? match[0].replace(/\/$/, "").split("/").length : 0;

  return pathname
    .split("/")
    .map((seg, i) => {
      if (!seg) return seg;
      if (keepUpTo && i >= keepUpTo) return REDACTED;
      return TOKENISH_SEGMENT_RE.test(seg) ? REDACTED : seg;
    })
    .join("/");
}

function maskQuery(search: string): string {
  if (!search) return "";
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const kept: string[] = [];
  for (const [key, value] of params.entries()) {
    // A value holding an `@` is an address however its param is named - so `?email=changed` (a
    // status flag this app really does redirect with) survives, `?email=pilot@x.com` does not.
    const sensitive = SECRET_PARAM_RE.test(key) || value.includes("@");
    kept.push(`${key}=${sensitive ? REDACTED : value}`);
  }
  return kept.length ? `?${kept.join("&")}` : "";
}

/** Mask one URL down to something safe to keep: origin + path with secret segments replaced and a
 *  scrubbed query. Unparseable input is dropped entirely - redact when unsure. Root-relative URLs
 *  (`/api/...`, which is what `event.request.url` often is) are handled too. */
export function maskUrl(raw: string): string {
  if (raw.startsWith("/")) {
    const [path, ...rest] = raw.split("?");
    return `${maskPathname(path)}${maskQuery(rest.join("?"))}`;
  }
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return REDACTED_URL;
  }
  const hash = url.hash ? `#${REDACTED}` : "";
  return `${url.origin}${maskPathname(url.pathname)}${maskQuery(url.search)}${hash}`;
}

/** Remove every credential and every piece of personal data from a free-text string. */
export function redactText(input: string): string {
  return input
    .replace(CONNECTION_STRING_RE, REDACTED)
    .replace(URL_RE, (m) => maskUrl(m))
    .replace(RELATIVE_URL_RE, (m) => maskUrl(m))
    .replace(JWT_RE, REDACTED)
    .replace(VENDOR_KEY_RE, REDACTED)
    .replace(BEARER_RE, (_m, scheme: string) => `${scheme} ${REDACTED}`)
    .replace(ENV_SECRET_RE, (_m, label: string) => `${label}=${REDACTED}`)
    .replace(SECRET_LABEL_RE, (_m, label: string) => `${label}: ${REDACTED}`)
    .replace(EMAIL_RE, REDACTED);
}

/**
 * Sentry `beforeSend`. It never returns null: we still want the crash signal, just with the
 * credentials and the pilot's identity stripped out of it.
 */
export function scrubEvent(event: ErrorEvent): ErrorEvent {
  const scrub = (s: string | undefined): string | undefined => (s ? redactText(s) : s);

  if (event.message) event.message = scrub(event.message);
  for (const ex of event.exception?.values ?? []) {
    if (ex.value) ex.value = scrub(ex.value);
  }
  for (const crumb of event.breadcrumbs ?? []) {
    if (crumb.message) crumb.message = scrub(crumb.message);
    const data = crumb.data as Record<string, unknown> | undefined;
    if (data) {
      for (const [k, v] of Object.entries(data)) {
        if (typeof v === "string") data[k] = redactText(v);
      }
    }
  }

  // Never ship the account identity or the network origin.
  if (event.user) {
    delete event.user.email;
    delete event.user.ip_address;
    delete event.user.username;
  }

  // Request context: keep a scrubbed URL for triage, drop the credential-bearing parts outright.
  if (event.request) {
    if (typeof event.request.url === "string") event.request.url = maskUrl(event.request.url);
    if (typeof event.request.query_string === "string") {
      event.request.query_string = maskQuery(event.request.query_string);
    }
    delete event.request.cookies;
    // Request bodies here are mission notes, feedback text, and account payloads - all of which
    // carry either PII or an email address. Triage does not need them.
    delete event.request.data;
    const headers = event.request.headers as Record<string, unknown> | undefined;
    if (headers) {
      for (const key of Object.keys(headers)) {
        const lower = key.toLowerCase();
        if (lower === "cookie" || lower === "set-cookie" || lower === "authorization") {
          delete headers[key];
          continue;
        }
        const value = headers[key];
        if (typeof value === "string") headers[key] = redactText(value);
      }
    }
  }

  return event;
}
