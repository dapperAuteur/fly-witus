"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "@/lib/auth-client";
import { useEndWitusSession } from "@/lib/witus-ecosystem";

// Self-service account management: change email (magic-link style
// verification), export data, sign out everywhere, and delete account.
// Login is passwordless, so there's no password to manage here.
export function AccountSection() {
  const { data: session } = useSession();
  const router = useRouter();
  // Non-null only when this deploy is a configured ecosystem OIDC client. "Sign out
  // everywhere" that leaves the shared WitUS session alive is the worst version of this
  // button: the very next visit to /login would offer "Continue as <you>".
  const endWitusSession = useEndWitusSession();

  const [newEmail, setNewEmail] = useState("");
  const [emailMsg, setEmailMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [emailBusy, setEmailBusy] = useState(false);

  const [confirmDelete, setConfirmDelete] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [signOutBusy, setSignOutBusy] = useState(false);

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

  const signOutEverywhere = async () => {
    const question = endWitusSession
      ? "Sign out of Fly WitUS on all devices? This also signs you out of every WitUS app in this browser."
      : "Sign out of Fly WitUS on all devices?";
    if (!confirm(question)) return;
    setSignOutBusy(true);
    setActionError(null);
    try {
      const res = await fetch("/api/account/sessions", { method: "DELETE" });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? `Failed (HTTP ${res.status})`);
      }
      await signOut();
      // ORDER IS THE SAFETY PROPERTY: every local session is already revoked above, so an
      // unreachable or refusing IdP still leaves the person signed out here. Never hand off
      // first. The handoff is a full navigation off this origin, so nothing after it runs.
      if (endWitusSession) {
        endWitusSession();
        return;
      }
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

        {/* Export + sign out everywhere */}
        <div className="flex flex-wrap gap-2">
          <a
            href="/api/account/export"
            className="px-3 py-2 border border-border rounded text-sm font-semibold hover:bg-muted"
          >
            Export my data (JSON)
          </a>
          <button
            onClick={signOutEverywhere}
            disabled={signOutBusy}
            className="px-3 py-2 border border-border rounded text-sm font-semibold hover:bg-muted disabled:opacity-50"
          >
            {signOutBusy
              ? "Signing out…"
              : endWitusSession
                ? "Sign out of WitUS everywhere"
                : "Sign out everywhere"}
          </button>
        </div>

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
