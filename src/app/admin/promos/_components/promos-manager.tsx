"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type PromoType = "lifetime_reopen" | "discount" | "trial";

interface Promo {
  id: string;
  app: string;
  name: string;
  type: PromoType;
  isActive: boolean;
  startsAt: Date | string | null;
  endsAt: Date | string | null;
  bannerText: string | null;
  lifetimePriceCard: number | null;
  lifetimePriceCashapp: number | null;
  lifetimeSlots: number | null;
  lifetimeSlotsUsed: number;
  stripeCouponId: string | null;
  discountKind: "percent" | "fixed" | null;
  discountAmount: number | null;
  appliesTo: "monthly" | "annual" | "both" | null;
  promoCode: string | null;
  maxRedemptions: number | null;
  redemptionsUsed: number;
  createdAt: Date | string;
}

export function PromosManager({
  initialPromos,
  stripeEnabled,
}: {
  initialPromos: Promo[];
  stripeEnabled: boolean;
}) {
  const router = useRouter();
  const [promos, setPromos] = useState(initialPromos);
  const [showForm, setShowForm] = useState(false);

  const refresh = () => router.refresh();

  return (
    <div className="space-y-4">
      {!showForm && (
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-sky-600 text-white rounded text-sm font-semibold hover:bg-sky-700"
        >
          + New promo
        </button>
      )}

      {showForm && (
        <NewPromoForm
          stripeEnabled={stripeEnabled}
          onCreated={() => {
            setShowForm(false);
            refresh();
          }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {promos.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">No promos yet.</p>
      ) : (
        <ul className="space-y-2">
          {promos.map((p) => (
            <PromoRow
              key={p.id}
              promo={p}
              onChange={(updated) =>
                setPromos((prev) => prev.map((x) => (x.id === p.id ? updated : x)))
              }
              onDelete={(id) =>
                setPromos((prev) => prev.filter((x) => x.id !== id))
              }
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function PromoRow({
  promo,
  onChange,
  onDelete,
}: {
  promo: Promo;
  onChange: (p: Promo) => void;
  onDelete: (id: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleActive = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/promos/${promo.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !promo.isActive }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? `Failed (HTTP ${res.status})`);
      }
      onChange({ ...promo, isActive: !promo.isActive });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!confirm(`Delete promo "${promo.name}"?`)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/promos/${promo.id}`, { method: "DELETE" });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? `Failed (HTTP ${res.status})`);
      }
      onDelete(promo.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="bg-card text-card-foreground border border-border rounded-lg p-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold">{promo.name}</h3>
            <TypeBadge type={promo.type} />
            <ActiveBadge active={promo.isActive} />
          </div>
          <p className="text-sm text-card-foreground mt-1">{describePromo(promo)}</p>
          {promo.bannerText && (
            <p className="text-xs text-muted-foreground italic mt-1">
              Banner: &ldquo;{promo.bannerText}&rdquo;
            </p>
          )}
          <p className="text-xs text-muted-foreground mt-2">
            {promo.startsAt && `Starts ${new Date(promo.startsAt).toLocaleDateString()} `}
            {promo.endsAt && `· Ends ${new Date(promo.endsAt).toLocaleDateString()} `}
            {promo.stripeCouponId && (
              <span>
                · Stripe: <code className="font-mono">{promo.stripeCouponId}</code>
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={toggleActive}
            disabled={busy}
            className="px-3 py-1.5 border border-border rounded text-sm hover:bg-muted disabled:opacity-50"
          >
            {promo.isActive ? "Deactivate" : "Activate"}
          </button>
          <button
            onClick={remove}
            disabled={busy}
            className="px-3 py-1.5 border border-red-300 text-red-700 rounded text-sm hover:bg-red-50 disabled:opacity-50"
          >
            Delete
          </button>
        </div>
      </div>
      {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
    </li>
  );
}

function describePromo(p: Promo): string {
  if (p.type === "lifetime_reopen") {
    const card = p.lifetimePriceCard ? `$${p.lifetimePriceCard.toFixed(2)} card` : "";
    const cash = p.lifetimePriceCashapp ? `$${p.lifetimePriceCashapp.toFixed(2)} cash` : "";
    const slots = `${p.lifetimeSlotsUsed}/${p.lifetimeSlots ?? "?"} slots used`;
    return [card, cash, slots].filter(Boolean).join(" · ");
  }
  if (p.type === "discount") {
    const amt = p.discountKind === "percent" ? `${p.discountAmount}%` : `$${p.discountAmount}`;
    const where = p.appliesTo ?? "?";
    const code = p.promoCode ? `code ${p.promoCode}` : "auto-applied";
    const used =
      p.maxRedemptions !== null
        ? ` · ${p.redemptionsUsed}/${p.maxRedemptions} used`
        : ` · ${p.redemptionsUsed} used`;
    return `${amt} off ${where} · ${code}${used}`;
  }
  return p.type;
}

function NewPromoForm({
  stripeEnabled,
  onCreated,
  onCancel,
}: {
  stripeEnabled: boolean;
  onCreated: () => void;
  onCancel: () => void;
}) {
  const [type, setType] = useState<PromoType>("discount");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    const num = (k: string) => {
      const v = (form.get(k) as string).trim();
      return v === "" ? null : Number(v);
    };
    const str = (k: string) => {
      const v = (form.get(k) as string).trim();
      return v === "" ? null : v;
    };

    const payload: Record<string, unknown> = {
      name: str("name"),
      type,
      isActive: form.get("isActive") === "on",
      startsAt: str("startsAt") ? new Date(str("startsAt")!).toISOString() : null,
      endsAt: str("endsAt") ? new Date(str("endsAt")!).toISOString() : null,
      bannerText: str("bannerText"),
    };

    if (type === "lifetime_reopen") {
      payload.lifetimePriceCard = num("lifetimePriceCard");
      payload.lifetimePriceCashapp = num("lifetimePriceCashapp");
      payload.lifetimeSlots = num("lifetimeSlots");
    }
    if (type === "discount") {
      payload.discountKind = str("discountKind");
      payload.discountAmount = num("discountAmount");
      payload.appliesTo = str("appliesTo");
      payload.promoCode = str("promoCode");
      payload.maxRedemptions = num("maxRedemptions");
    }

    try {
      const res = await fetch("/api/admin/promos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const base = json.error ?? `Failed (HTTP ${res.status})`;
        const tail = json.stripeError ? ` (Stripe: ${json.stripeError})` : "";
        throw new Error(`${base}${tail}`);
      }
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      className="bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-900 rounded-lg p-4 space-y-3"
    >
      {error && <p className="text-sm text-red-600">{error}</p>}
      <input
        name="name"
        required
        maxLength={160}
        placeholder="Internal name (e.g. Show HN launch)"
        className="w-full px-3 py-2 border border-border rounded"
      />
      <div className="grid grid-cols-2 gap-3">
        <label>
          <span className="block text-xs font-medium text-card-foreground mb-1">Type</span>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as PromoType)}
            className="w-full px-3 py-2 border border-border rounded"
          >
            <option value="discount">Discount</option>
            <option value="lifetime_reopen">Lifetime re-open</option>
            <option value="trial">Trial (placeholder)</option>
          </select>
        </label>
        <label className="flex items-end gap-2 pb-2">
          <input type="checkbox" name="isActive" defaultChecked />
          <span className="text-sm">Active immediately</span>
        </label>
      </div>
      <input
        name="bannerText"
        maxLength={280}
        placeholder="Banner text shown on /pricing (optional)"
        className="w-full px-3 py-2 border border-border rounded"
      />
      <div className="grid grid-cols-2 gap-3">
        <label>
          <span className="block text-xs font-medium text-card-foreground mb-1">Starts</span>
          <input
            name="startsAt"
            type="datetime-local"
            className="w-full px-3 py-2 border border-border rounded"
          />
        </label>
        <label>
          <span className="block text-xs font-medium text-card-foreground mb-1">Ends</span>
          <input
            name="endsAt"
            type="datetime-local"
            className="w-full px-3 py-2 border border-border rounded"
          />
        </label>
      </div>

      {type === "lifetime_reopen" && (
        <div className="grid grid-cols-3 gap-3 border-t border-sky-200 pt-3">
          <label>
            <span className="block text-xs font-medium text-card-foreground mb-1">Card price</span>
            <input
              name="lifetimePriceCard"
              type="number"
              step="0.01"
              min="0"
              className="w-full px-3 py-2 border border-border rounded"
            />
          </label>
          <label>
            <span className="block text-xs font-medium text-card-foreground mb-1">CashApp price</span>
            <input
              name="lifetimePriceCashapp"
              type="number"
              step="0.01"
              min="0"
              className="w-full px-3 py-2 border border-border rounded"
            />
          </label>
          <label>
            <span className="block text-xs font-medium text-card-foreground mb-1">Slots</span>
            <input
              name="lifetimeSlots"
              type="number"
              min="1"
              required
              className="w-full px-3 py-2 border border-border rounded"
            />
          </label>
        </div>
      )}

      {type === "discount" && (
        <div className="space-y-3 border-t border-sky-200 pt-3">
          {!stripeEnabled && (
            <p className="text-xs text-amber-800 bg-amber-50 px-2 py-1 rounded">
              Stripe is not configured — coupon won&apos;t be created.
            </p>
          )}
          <div className="grid grid-cols-3 gap-3">
            <label>
              <span className="block text-xs font-medium text-card-foreground mb-1">Kind</span>
              <select
                name="discountKind"
                defaultValue="percent"
                className="w-full px-3 py-2 border border-border rounded"
              >
                <option value="percent">Percent</option>
                <option value="fixed">Fixed ($)</option>
              </select>
            </label>
            <label>
              <span className="block text-xs font-medium text-card-foreground mb-1">Amount</span>
              <input
                name="discountAmount"
                type="number"
                step="0.01"
                min="0"
                required
                className="w-full px-3 py-2 border border-border rounded"
              />
            </label>
            <label>
              <span className="block text-xs font-medium text-card-foreground mb-1">Applies to</span>
              <select
                name="appliesTo"
                defaultValue="both"
                className="w-full px-3 py-2 border border-border rounded"
              >
                <option value="both">Monthly + Annual</option>
                <option value="monthly">Monthly only</option>
                <option value="annual">Annual only</option>
              </select>
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label>
              <span className="block text-xs font-medium text-card-foreground mb-1">
                Promo code (optional)
              </span>
              <input
                name="promoCode"
                maxLength={40}
                placeholder="LAUNCH50"
                className="w-full px-3 py-2 border border-border rounded font-mono uppercase"
              />
            </label>
            <label>
              <span className="block text-xs font-medium text-card-foreground mb-1">
                Max redemptions
              </span>
              <input
                name="maxRedemptions"
                type="number"
                min="1"
                placeholder="(no cap)"
                className="w-full px-3 py-2 border border-border rounded"
              />
            </label>
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="px-4 py-2 bg-sky-600 text-white rounded text-sm font-semibold disabled:opacity-50"
        >
          {submitting ? "Creating…" : "Create promo"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 border border-border rounded text-sm font-semibold hover:bg-muted"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function TypeBadge({ type }: { type: PromoType }) {
  const cls: Record<PromoType, string> = {
    lifetime_reopen: "bg-purple-100 text-purple-800",
    discount: "bg-sky-100 text-sky-800",
    trial: "bg-muted text-card-foreground",
  };
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${cls[type]}`}>
      {type.replace(/_/g, " ")}
    </span>
  );
}

function ActiveBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`px-2 py-0.5 rounded text-xs font-semibold ${
        active ? "bg-green-100 text-green-800" : "bg-muted text-muted-foreground"
      }`}
    >
      {active ? "ACTIVE" : "INACTIVE"}
    </span>
  );
}
