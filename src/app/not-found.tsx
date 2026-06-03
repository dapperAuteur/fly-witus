import Image from "next/image";
import Link from "next/link";

// Custom 404. Renders inside the root layout, so the global nav is still
// there — but we also give explicit routes back into the app.
export const metadata = { title: "Not found — Fly WitUS" };

export default function NotFound() {
  return (
    <main className="max-w-xl mx-auto px-6 py-16 text-center">
      <Image
        src="/flywitus-platypus-logo.png"
        alt="Fly WitUS"
        width={64}
        height={64}
        className="h-14 w-auto mx-auto mb-4"
      />
      <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        404
      </p>
      <h1 className="text-2xl font-bold mt-1">This page took an unplanned landing</h1>
      <p className="text-sm text-muted-foreground mt-2">
        The page you&apos;re looking for doesn&apos;t exist or may have moved.
      </p>
      <div className="mt-6 flex flex-wrap gap-2 justify-center">
        <Link
          href="/"
          className="px-4 py-2 bg-sky-600 text-white rounded-lg text-sm font-semibold hover:bg-sky-700"
        >
          Back to checklist
        </Link>
        <Link
          href="/dashboard"
          className="px-4 py-2 border border-border rounded-lg text-sm font-semibold hover:bg-muted"
        >
          Dashboard
        </Link>
        <Link
          href="/help"
          className="px-4 py-2 border border-border rounded-lg text-sm font-semibold hover:bg-muted"
        >
          Help center
        </Link>
      </div>
    </main>
  );
}
