"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "@/lib/auth-client";

// Self-service account management: change email (magic-link style
// verification), export data, sign out of Fly WitUS on all devices, and delete account.
// Login is passwordless, so there's no password to manage here.
export function AccountSection() {
  const { data: session } = useSession();
  const router = useRouter();
  const [newEmail, setNewEmail] = useState("");
  const [emailMsg, setEmailMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [emailBusy, setEmailBusy] = useState(false);

  const [confirmDelete, setConfirmDelete] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [signOutBusy, setSignOutBusy] = useState(false);
  // Inline confirm step for the all-devices sign-out (zero-alert rule: no window.confirm()).
  const [confirmAllDevices, setConfirmAllDevices] = useState(false);

  // Surface the result of the email-change verification redirect
  // (/dashboard?email=changed|taken|invalid|error).
  const [verifyNotice, setVerifyNotice] = useState<string | null>(null);
  useEffect(() => {
    const status = new URLSearchParams(window.location.search).get("email");
    if (!status) return;
    const map: Record<string, string> = {
      changed: "Your email was updated.",
      taken: "That email was taken before you confirmed it.",
      invalid: "That email-change link was invalid or expired.",
      error: "Something went wrong applying the email change.",
    };
    setVerifyNotice(map[status] ?? null);
    // Clean the query so a refresh doesn't re-show it.
    window.history.replaceState({}, "", "/dashboard");
  }, []);

  const requestEmailChange = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!newEmail.trim()) return;
    setEmailBusy(true);
    setEmailMsg(null);
    try {
      const res = await fetch("/api/account/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newEmail: newEmail.trim() }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? `Failed (HTTP ${res.status})`);
      setEmailMsg({
        ok: true,
        text: `Check ${newEmail.trim()} for a confirmation link.`,
      });
      setNewEmail("");
    } catch (err) {
      setEmailMsg({ ok: false, text: err instanceof Error ? err.message : String(err) });
    } finally {
      setEmailBusy(false);
    }
  };

  // Ends every FLY session (every device), not the WitUS session: BAM, 2026-10-29, witus task
  // 128 option (b). Ending WitUS is the nav's separate "Sign out of WitUS everywhere"; this
  // control's name must not collide with it.
  const signOutAllDevices = async () => {
    setConfirmAllDevices(false);
    setSignOutBusy(true);
    setActionError(null);
    try {
      const res = await fetch("/api/account/sessions", { method: "DELETE" });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? `Failed (HTTP ${res.status})`);
      }
      await signOut();
      router.push("/login");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err));
      setSignOutBusy(false);
    }
  };

  const deleteAccount = async () => {
    setDeleteBusy(true);
    setActionError(null);
    try {
      const res = await fetch("/api/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: "DELETE" }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? `Failed (HTTP ${res.status})`);
      }
      await signOut();
      router.push("/");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err));
      setDeleteBusy(false);
    }
  };

  return (
    <section>
      <h2 className="text-lg font-semibold mb-3">Account</h2>

      {verifyNotice && (
        <p className="text-sm mb-3 bg-muted border border-border rounded-lg p-3">
          {verifyNotice}
        </p>
      )}

      <div className="space-y-4 bg-card text-card-foreground border border-border rounded-lg p-4">
        {/* Change email */}
        <form onSubmit={requestEmailChange} className="space-y-2">
          <label className="block text-sm font-medium">Change email</label>
          <p className="text-xs text-muted-foreground">
            Login is passwordless — we&apos;ll email a confirmation link to the new
            address. Current: <span className="font-mono">{session?.user.email}</span>
          </p>
          <div className="flex gap-2">
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="new@email.com"
              maxLength={320}
              className="flex-1 px-3 py-2 border border-border rounded text-sm"
            />
            <button
              type="submit"
              disabled={emailBusy || !newEmail.trim()}
              className="px-3 py-2 bg-sky-600 text-white rounded text-sm font-semibold hover:bg-sky-700 disabled:opacity-50"
            >
              {emailBusy ? "Sending…" : "Send link"}
            </button>
          </div>
          {emailMsg && (
            <p className={`text-sm ${emailMsg.ok ? "text-green-700" : "text-red-600"}`}>
              {emailMsg.text}
            </p>
          )}
        </form>

        <hr className="border-border" />

        {/* Export + sign out of Fly WitUS on all devices */}
        <div className="flex flex-wrap gap-2">
          <a
            href="/api/account/export"
            className="px-3 py-2 border border-border rounded text-sm font-semibold hover:bg-muted"
          >
            Export my data (JSON)
          </a>
          {!confirmAllDevices && (
            <button
              type="button"
              onClick={() => setConfirmAllDevices(true)}
              disabled={signOutBusy}
              className="px-3 py-2 border border-border rounded text-sm font-semibold hover:bg-muted disabled:opacity-50"
            >
              {signOutBusy ? "Signing out…" : "Sign out of Fly WitUS on all devices"}
            </button>
          )}
        </div>
        {confirmAllDevices && (
          <div
            role="group"
            aria-labelledby="confirm-all-devices-text"
            className="space-y-2 bg-muted border border-border rounded-lg p-3"
          >
            <p id="confirm-all-devices-text" className="text-sm">
              Sign out of Fly WitUS on all devices? Every device you use Fly WitUS on will need
              a fresh sign-in. Your WitUS account and other WitUS apps stay signed in.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void signOutAllDevices()}
                className="px-3 py-2 bg-sky-600 text-white rounded text-sm font-semibold hover:bg-sky-700"
              >
                Yes, sign out on all devices
              </button>
              <button
                type="button"
                onClick={() => setConfirmAllDevices(false)}
                className="px-3 py-2 border border-border rounded text-sm font-semibold hover:bg-card"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <hr className="border-border" />

        {/* Delete account */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-red-700">
            Delete account
          </label>
          <p className="text-xs text-muted-foreground">
            Permanently deletes your account and cloud data (missions, photos,
            aircraft, and any groups you own). This can&apos;t be undone. Type{" "}
            <span className="font-mono font-semibold">DELETE</span> to confirm.
          </p>
          <div className="flex gap-2">
            <input
              value={confirmDelete}
              onChange={(e) => setConfirmDelete(e.target.value)}
              placeholder="DELETE"
              className="flex-1 px-3 py-2 border border-border rounded text-sm"
            />
            <button
              onClick={deleteAccount}
              disabled={deleteBusy || confirmDelete !== "DELETE"}
              className="px-3 py-2 border border-red-300 text-red-700 rounded text-sm font-semibold hover:bg-red-50 disabled:opacity-50"
            >
              {deleteBusy ? "Deleting…" : "Delete account"}
            </button>
          </div>
        </div>

        {actionError && <p className="text-sm text-red-600">{actionError}</p>}
      </div>
    </section>
  );
}
