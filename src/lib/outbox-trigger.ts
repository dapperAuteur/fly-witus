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
export function fireOutboxDrafts(args: {
  triggerUserId: string;
  externalRefBase: string;
  caption: string;
  mediaUrls?: string[];
  platforms?: readonly OutboxPlatform[];
  scheduledAt?: Date;
  asDraft?: boolean;
}) {
  if (process.env.OUTBOX_TRIGGER_ENABLED !== "true") return;
  if (args.triggerUserId !== OWNER_USER_ID) return;

  const platforms = args.platforms ?? (["twitter", "bluesky", "linkedin"] as const);
  const placeholderTime =
    args.scheduledAt ??
    new Date(Date.now() + 7 * 24 * 60 * 60_000);
  const asDraft = args.asDraft ?? true;

  after(async () => {
    for (const platform of platforms) {
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
