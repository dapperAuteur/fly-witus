"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "@/lib/auth-client";
import { useEndWitusSession } from "@/lib/witus-ecosystem";
import { SignOutEverywhereButton } from "@/components/sign-out-everywhere-button";

// Persistent top navigation shown on every route (rendered once in the
// root layout). Replaces the ad-hoc per-page nav snippets that used to
// live inside the dashboard / groups / checklist pages. Reads the session
// client-side so the auth affordance (Sign in vs Sign out + admin link)
// stays in sync without a server round-trip per navigation.

interface NavLink {
  href: string;
  label: string;
}

const PRIMARY_LINKS: NavLink[] = [
  { href: "/", label: "Checklist" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/groups", label: "Groups" },
  { href: "/pricing", label: "Pricing" },
  { href: "/help", label: "Help" },
];

export function AppNav() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  // "Sign out" ends ONLY Fly's session and never visits the IdP, so the WitUS session and every
  // other WitUS app stay signed in (BAM, 2026-10-29, witus task 128 option (b)). Its label is
  // always exactly "Sign out" (shared UI rule: the header sign-in/sign-out control is never
  // renamed). Ending WitUS too is the separate SignOutEverywhereButton, which renders only when
  // this deploy is a configured ecosystem OIDC client (non-null end-session URL).
  const endWitusSession = useEndWitusSession();

  const handleSignOut = async () => {
    await signOut();
  };

  // isAdmin rides the session via better-auth additionalFields. Cast
  // because the generated session type doesn't surface custom fields.
  const isAdmin = Boolean(
    (session?.user as { isAdmin?: boolean } | undefined)?.isAdmin,
  );

  // accountTier also rides the session (additionalFields). Free signed-in
  // users get an explicit "Upgrade" CTA in addition to the Pricing link.
  const tier =
    (session?.user as { accountTier?: string } | undefined)?.accountTier ?? "free";
  const showUpgrade = Boolean(session) && tier === "free";

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  const linkClass = (href: string) =>
    `px-3 py-2 rounded-md text-sm font-semibold transition ${
      isActive(href)
        ? "text-sky-700 bg-muted"
        : "text-card-foreground hover:bg-muted"
    }`;

  const close = () => setMenuOpen(false);

  return (
    <nav className="sticky top-0 z-40 bg-card text-card-foreground border-b border-border">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="flex h-14 items-center justify-between gap-2">
          <Link href="/" onClick={close} className="flex items-center gap-2 shrink-0">
            <Image
              src="/flywitus-platypus-logo.png"
              alt="Fly WitUS"
              width={32}
              height={32}
              className="h-8 w-auto"
            />
            <span className="font-extrabold tracking-tight hidden sm:inline">
              FLY WIT US
            </span>
          </Link>

          {/* Desktop links */}
          <div className="hidden md:flex items-center gap-1">
            {PRIMARY_LINKS.map((l) => (
              <Link key={l.href} href={l.href} className={linkClass(l.href)}>
                {l.label}
              </Link>
            ))}
            {isAdmin && (
              <Link href="/admin" className={linkClass("/admin")}>
                Admin
              </Link>
            )}
          </div>

          {/* Desktop auth */}
          <div className="hidden md:flex items-center gap-2 shrink-0">
            {session ? (
              <>
                {showUpgrade && (
                  <Link
                    href="/pricing"
                    className="px-3 py-2 bg-sky-600 text-white rounded-md text-sm font-semibold hover:bg-sky-700 transition"
                  >
                    Upgrade
                  </Link>
                )}
                {endWitusSession ? (
                  // The account menu: the email opens a small panel holding the secondary
                  // "Sign out of WitUS everywhere" and its help text, which do not fit the bar.
                  <details className="relative">
                    <summary className="list-none cursor-pointer px-2 py-2 rounded-md text-xs text-muted-foreground hover:bg-muted max-w-[10rem] lg:max-w-[14rem] truncate">
                      {session.user.email} <span aria-hidden="true">▾</span>
                    </summary>
                    <div className="absolute right-0 mt-2 w-72 rounded-md border border-border bg-card p-3 shadow-lg z-50">
                      <SignOutEverywhereButton />
                    </div>
                  </details>
                ) : (
                  <span className="text-xs text-muted-foreground max-w-[14rem] truncate hidden lg:inline">
                    {session.user.email}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => void handleSignOut()}
                  className="px-3 py-2 border border-border rounded-md text-sm font-semibold hover:bg-muted transition"
                >
                  Sign out
                </button>
              </>
            ) : (
              <Link
                href="/login"
                className="px-4 py-2 bg-sky-600 text-white rounded-md text-sm font-semibold hover:bg-sky-700 transition"
              >
                Sign in
              </Link>
            )}
          </div>

          {/* Mobile toggle */}
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Toggle navigation menu"
            aria-expanded={menuOpen}
            className="md:hidden p-2 rounded-md border border-border hover:bg-muted"
          >
            <span className="block w-5 h-0.5 bg-current mb-1" />
            <span className="block w-5 h-0.5 bg-current mb-1" />
            <span className="block w-5 h-0.5 bg-current" />
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden border-t border-border px-4 py-3 space-y-1">
          {PRIMARY_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={close}
              className={`block ${linkClass(l.href)}`}
            >
              {l.label}
            </Link>
          ))}
          {isAdmin && (
            <Link
              href="/admin"
              onClick={close}
              className={`block ${linkClass("/admin")}`}
            >
              Admin
            </Link>
          )}
          {showUpgrade && (
            <Link
              href="/pricing"
              onClick={close}
              className="block px-3 py-2 bg-sky-600 text-white rounded-md text-sm font-semibold text-center"
            >
              Upgrade
            </Link>
          )}
          <div className="pt-2 border-t border-border mt-2">
            {session ? (
              <div className="space-y-1">
                {/* The email sits outside the button so its accessible name is exactly "Sign out". */}
                <p className="px-3 text-xs text-muted-foreground truncate">
                  {session.user.email}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    close();
                    void handleSignOut();
                  }}
                  className="w-full text-left px-3 py-2 rounded-md text-sm font-semibold hover:bg-muted"
                >
                  Sign out
                </button>
                <SignOutEverywhereButton
                  onBeforeSignOut={close}
                  className="w-full text-left px-3 py-2 rounded-md text-sm font-medium text-muted-foreground underline underline-offset-2 hover:bg-muted disabled:opacity-50"
                />
              </div>
            ) : (
              <Link
                href="/login"
                onClick={close}
                className="block px-3 py-2 bg-sky-600 text-white rounded-md text-sm font-semibold text-center"
              >
                Sign in
              </Link>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
