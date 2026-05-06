import { after } from "next/server";
import { createHash } from "node:crypto";
import { sendToOutbox, type OutboxPlatform } from "../../lib/sender-outbox";

const OWNER_USER_ID = process.env.PRODUCT_OWNER_USER_ID;

/**
 * Fire one outbox draft per platform. Caller decides:
 *   - what triggered (caption + external_ref + platforms)
 *   - whether the trigger should fire at all (passes triggerUserId)
 *
 * Three layered gates run BEFORE any network call:
 *   1. Master kill-switch (OUTBOX_TRIGGER_ENABLED env) — BAM can mute the
 *      whole app instantly without a code deploy.
 *   2. BAM-only smoke gate — only triggers from BAM's account fire while
 *      we're proving the integration. Removed (replaced by per-user
 *      opt-in) after BAM confirms smoke.
 *   3. Per-user opt-in (later) — see plans/future/per-user-opt-in.md.
 *
 * `as_draft: true` always — operator reviews + schedules from /outbox/[id]
 * before anything goes live. Override only for time-sensitive triggers
 * like "going live" where the post must fire immediately.
 */
// Diagnostic logging strategy:
//   - Admin (matches OWNER_USER_ID) saves: ALWAYS log entry + gate-skip
//     reasons + after() lifecycle. Admin is the only person who needs to
//     see the diagnostic during smoke and shouldn't have to flip a switch.
//   - Non-admin saves: only log when OUTBOX_TRIGGER_DEBUG=true, since
//     once the BAM-only gate is removed (post-smoke) every non-admin save
//     would otherwise spam logs.
// Either way: metadata only — never caption/URLs/secret/signature.

export function fireOutboxDrafts(args: {
  triggerUserId: string;
  externalRefBase: string;
  caption: string;
  mediaUrls?: string[];
  platforms?: readonly OutboxPlatform[];
  scheduledAt?: Date;
  asDraft?: boolean;
}) {
  const isAdmin = args.triggerUserId === OWNER_USER_ID;
  const debug = process.env.OUTBOX_TRIGGER_DEBUG === "true";
  const shouldLog = isAdmin || debug;

  if (shouldLog) {
    console.log("[outbox-trigger] called", {
      external_ref_base: args.externalRefBase,
      user_prefix: args.triggerUserId.slice(0, 6),
      is_admin: isAdmin,
      enabled: process.env.OUTBOX_TRIGGER_ENABLED === "true",
      owner_set: Boolean(OWNER_USER_ID),
      url: process.env.OUTBOX_INGEST_URL ?? "(unset)",
      slug: process.env.OUTBOX_SOURCE_SLUG ?? "(unset)",
      secret_set: Boolean(process.env.OUTBOX_INGEST_SECRET),
    });
  }

  if (process.env.OUTBOX_TRIGGER_ENABLED !== "true") {
    if (shouldLog) console.log("[outbox-trigger] skipped: kill-switch off");
    return;
  }
  if (!isAdmin) {
    if (debug) {
      console.log("[outbox-trigger] skipped: triggerUserId !== OWNER_USER_ID", {
        user_prefix: args.triggerUserId.slice(0, 6),
        owner_prefix: OWNER_USER_ID?.slice(0, 6) ?? "(unset)",
      });
    }
    return;
  }

  // Past gates → user is admin → always log from here on.
  const platforms = args.platforms ?? (["twitter", "bluesky", "linkedin"] as const);
  const placeholderTime =
    args.scheduledAt ??
    new Date(Date.now() + 7 * 24 * 60 * 60_000);
  const asDraft = args.asDraft ?? true;

  console.log("[outbox-trigger] gates passed, scheduling after()", {
    platforms,
    external_ref_base: args.externalRefBase,
    as_draft: asDraft,
  });

  after(async () => {
    console.log("[outbox-trigger] after() running", {
      external_ref_base: args.externalRefBase,
    });
    for (const platform of platforms) {
      try {
        const result = await sendToOutbox({
          outboxUrl: process.env.OUTBOX_INGEST_URL!,
          sourceSlug: process.env.OUTBOX_SOURCE_SLUG!,
          hmacSecret: process.env.OUTBOX_INGEST_SECRET!,
          submission: {
            external_ref: `${args.externalRefBase}-${platform}`,
            platform,
            caption: args.caption,
            media_urls: args.mediaUrls ?? [],
            scheduled_at: placeholderTime.toISOString(),
            as_draft: asDraft,
          },
        });
        if (!result.ok) {
          console.error("[outbox-trigger] failed", {
            source: process.env.OUTBOX_SOURCE_SLUG,
            platform,
            external_ref_base: args.externalRefBase,
            http_status: result.status,
          });
        } else {
          console.log("[outbox-trigger] sent", {
            platform,
            external_ref_base: args.externalRefBase,
            http_status: result.status,
            record_status: result.recordStatus,
          });
        }
      } catch (err) {
        // sendToOutbox throws on connect errors (DNS / ECONNREFUSED / TLS) —
        // without this catch, after()'s rejected promise is silent in some
        // runtimes. Log metadata only.
        console.error("[outbox-trigger] threw", {
          source: process.env.OUTBOX_SOURCE_SLUG,
          platform,
          external_ref_base: args.externalRefBase,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  });
}

/** Stable user-id hash for external_ref. SHA-256 truncated to 8 chars. */
export function hashUserId(userId: string): string {
  return createHash("sha256").update(userId).digest("hex").slice(0, 8);
}

/**
 * Anonymized handle for captions when posting about another user's event.
 * NEVER full email or full name. Use the user's chosen handle if any;
 * otherwise initials + 4-char hash. Charter §3 PII rule.
 */
export function anonymizedHandle(user: {
  handle?: string | null;
  email: string;
}): string {
  if (user.handle) return `@${user.handle}`;
  const local = user.email.split("@")[0] ?? "user";
  const initials = local
    .split(/[._-]/)
    .map((s) => s.charAt(0).toUpperCase())
    .filter((c) => c.length > 0)
    .join("") || "U";
  const hash = createHash("sha256")
    .update(user.email)
    .digest("hex")
    .slice(0, 4);
  return `${initials}-${hash}`;
}
