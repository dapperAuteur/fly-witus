"use client";

import { useId, useState } from "react";
import { signOut } from "@/lib/auth-client";
import { useEndWitusSession } from "@/lib/witus-ecosystem";

/**
 * "Sign out of WitUS everywhere": the SECOND, secondary sign-out control, shown beside the
 * plain "Sign out" in the nav (desktop and mobile). BAM, 2026-10-29, witus task 128 option (b):
 * "Sign out" ends only Fly's session; this one ends Fly's session on this device AND the shared
 * WitUS session at the IdP. Other WitUS apps keep their own sessions, which the help text says.
 *
 * Renders nothing when the server-resolved end-session URL is null (no ecosystem OIDC client
 * configured), so a deploy without SSO never shows a control it cannot complete.
 */
export const SIGN_OUT_EVERYWHERE_LABEL = "Sign out of WitUS everywhere";
export const SIGN_OUT_EVERYWHERE_HELP =
  "Also signs you out of WitUS. Other WitUS apps you are signed in to stay signed in until you sign out of them.";

export function SignOutEverywhereButton({
  className,
  onBeforeSignOut,
}: {
  className?: string;
  /** e.g. close the mobile menu before the page navigates away. */
  onBeforeSignOut?: () => void;
}) {
  const endWitusSession = useEndWitusSession();
  const helpId = useId();
  const [busy, setBusy] = useState(false);
  if (!endWitusSession) return null;

  // ORDER IS THE SAFETY PROPERTY: destroy the LOCAL session first, then hand off to the IdP.
  // If the IdP is unreachable or refuses, the person is still signed out here. Handing off
  // first would turn any IdP failure into "I clicked sign out and I'm still signed in". The
  // local sign-out is awaited, and an error from it is swallowed so the WitUS handoff the
  // person asked for still happens; "Sign out" stays available here if Fly's call failed.
  const handleClick = async () => {
    onBeforeSignOut?.();
    setBusy(true);
    try {
      await signOut();
    } catch {
      // Swallowed: see the comment above. The handoff below must still happen.
    }
    endWitusSession();
  };

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={() => void handleClick()}
        disabled={busy}
        aria-describedby={helpId}
        className={
          className ??
          "px-3 py-2 rounded-md text-sm font-medium text-muted-foreground underline underline-offset-2 hover:bg-muted disabled:opacity-50"
        }
      >
        {busy ? "Signing out…" : SIGN_OUT_EVERYWHERE_LABEL}
      </button>
      <p id={helpId} className="text-xs text-muted-foreground max-w-[18rem]">
        {SIGN_OUT_EVERYWHERE_HELP}
      </p>
    </div>
  );
}
