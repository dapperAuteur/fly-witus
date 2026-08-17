import { notFound } from "next/navigation";
import Link from "next/link";
import { env } from "@/lib/env";
import { DocumentsLocker } from "./_components/documents-locker";

// Documents locker (plans/08 Phase 2b), behind NEXT_PUBLIC_FEATURE_DOCUMENTS_LOCKER.
//
// The gate is a 404, not a "coming soon" page. A route that announces a hidden
// feature invites people to ask for it before it has been reviewed, and this
// one asserts which documents an operation requires — regulatory logic no
// qualified human has read yet (plans/user-tasks/27).
export const metadata = {
  title: "Documents · Fly WitUS",
  description: "Track pilot credentials and aircraft documents with expiry reminders.",
};

export default function DocumentsPage() {
  if (env.NEXT_PUBLIC_FEATURE_DOCUMENTS_LOCKER !== "true") notFound();

  return (
    <div className="min-h-screen bg-background font-sans p-4 sm:p-8">
      <div className="max-w-4xl mx-auto">
        <header className="mb-6">
          <h1 className="text-4xl font-extrabold text-card-foreground">
            Documents
          </h1>
          <p className="text-muted-foreground mt-2">
            Track what you carry and when it lapses — for you and for each aircraft.
          </p>
        </header>

        <div className="mb-6 p-4 rounded-lg border border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30">
          <p className="text-sm text-amber-900 dark:text-amber-200">
            <strong>This is a reminder tool, not a compliance check.</strong> It tracks
            dates you enter and warns you before they pass. It does not decide which
            documents your operation requires, and a full list here does not mean a
            legal flight — requirements vary by operation, by aircraft, and by the
            certificate you are exercising. Check the current regulations.
          </p>
        </div>

        <DocumentsLocker />

        <p className="text-xs text-muted-foreground mt-8">
          <Link href="/dashboard" className="underline hover:no-underline">
            Back to dashboard
          </Link>
        </p>
      </div>
    </div>
  );
}
