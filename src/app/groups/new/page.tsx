"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/auth-client";

export default function NewGroupPage() {
  const { data: session, isPending } = useSession();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    const payload = {
      name: (form.get("name") as string).trim(),
      description: (form.get("description") as string).trim() || undefined,
    };
    try {
      const res = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (res.status === 403 && json.code === "TIER_REQUIRED") {
        router.push("/pricing");
        return;
      }
      if (!res.ok) throw new Error(json.error ?? `Create failed (HTTP ${res.status})`);
      router.push(`/groups/${json.group.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSaving(false);
    }
  };

  if (isPending) {
    return (
      <main className="max-w-2xl mx-auto p-6">
        <div className="h-8 w-48 bg-muted rounded animate-pulse" />
      </main>
    );
  }

  if (!session) {
    return (
      <main className="max-w-2xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-4">Create a Group</h1>
        <p className="text-muted-foreground mb-4">Sign in to create a group.</p>
        <Link
          href="/login"
          className="inline-block px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 text-sm font-semibold"
        >
          Sign In
        </Link>
      </main>
    );
  }

  return (
    <main className="max-w-2xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Create a Group</h1>
        <Link href="/groups" className="text-sm text-sky-700 hover:underline">
          ← Back to groups
        </Link>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-4 bg-card text-card-foreground border border-border rounded-lg p-5"
      >
        {error && <p className="text-sm text-red-600">{error}</p>}
        <label className="block">
          <span className="block text-sm font-medium text-card-foreground mb-1">
            Group name (required)
          </span>
          <input
            name="name"
            required
            maxLength={80}
            placeholder="High Desert Flyers"
            className="w-full px-3 py-2 border border-border rounded"
          />
        </label>
        <label className="block">
          <span className="block text-sm font-medium text-card-foreground mb-1">Description</span>
          <textarea
            name="description"
            maxLength={500}
            rows={3}
            placeholder="What is this group about?"
            className="w-full px-3 py-2 border border-border rounded"
          />
        </label>
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 text-sm font-semibold disabled:opacity-50"
        >
          {saving ? "Creating…" : "Create group"}
        </button>
      </form>
    </main>
  );
}
