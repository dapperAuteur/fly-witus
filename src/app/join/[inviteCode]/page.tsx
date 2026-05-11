"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "@/lib/auth-client";

export default function JoinByInvitePage() {
  const params = useParams<{ inviteCode: string }>();
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const [status, setStatus] = useState<"idle" | "joining" | "error" | "tier">("idle");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isPending || !session) return;
    let cancelled = false;
    (async () => {
      setStatus("joining");
      setMessage(null);
      try {
        const res = await fetch("/api/groups/join", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ inviteCode: params.inviteCode }),
        });
        const json = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (res.status === 403 && json.code === "TIER_REQUIRED") {
          setStatus("tier");
          return;
        }
        if (!res.ok) {
          setStatus("error");
          setMessage(json.error ?? `Join failed (HTTP ${res.status})`);
          return;
        }
        router.replace(`/groups/${json.groupId}`);
      } catch (err) {
        if (cancelled) return;
        setStatus("error");
        setMessage(err instanceof Error ? err.message : String(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isPending, session, params.inviteCode, router]);

  if (isPending) {
    return (
      <main className="max-w-md mx-auto p-6">
        <div className="h-8 w-48 bg-gray-100 rounded animate-pulse" />
      </main>
    );
  }

  if (!session) {
    const next = `/join/${params.inviteCode}`;
    return (
      <main className="max-w-md mx-auto p-6">
        <h1 className="text-2xl font-bold mb-3">Join group</h1>
        <p className="text-gray-600 mb-4">
          You&apos;ve been invited with code{" "}
          <span className="font-mono font-semibold">{params.inviteCode}</span>. Sign in
          to accept.
        </p>
        <Link
          href={`/login?next=${encodeURIComponent(next)}`}
          className="inline-block px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 text-sm font-semibold"
        >
          Sign in to join
        </Link>
      </main>
    );
  }

  if (status === "tier") {
    return (
      <main className="max-w-md mx-auto p-6">
        <h1 className="text-2xl font-bold mb-3">Paid plan required</h1>
        <p className="text-gray-700 mb-4">
          Joining groups requires Cloud or Lifetime. Your invite code is saved — once you
          upgrade, paste it back at /groups.
        </p>
        <Link
          href="/pricing"
          className="inline-block px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 text-sm font-semibold"
        >
          See pricing
        </Link>
      </main>
    );
  }

  if (status === "error") {
    return (
      <main className="max-w-md mx-auto p-6">
        <h1 className="text-2xl font-bold mb-3">Couldn&apos;t join</h1>
        <p className="text-sm text-red-600 mb-4">{message}</p>
        <Link href="/groups" className="text-sm text-sky-700 hover:underline">
          Go to groups
        </Link>
      </main>
    );
  }

  return (
    <main className="max-w-md mx-auto p-6">
      <p className="text-gray-600">Joining group…</p>
    </main>
  );
}
