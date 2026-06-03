"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "@/lib/auth-client";

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
  { href: "/help", label: "Help" },
];

export function AppNav() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  // isAdmin rides the session via better-auth additionalFields. Cast
  // because the generated session type doesn't surface custom fields.
  const isAdmin = Boolean(
    (session?.user as { isAdmin?: boolean } | undefined)?.isAdmin,
  );

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
                <span className="text-xs text-muted-foreground max-w-[14rem] truncate hidden lg:inline">
                  {session.user.email}
                </span>
                <button
                  onClick={() => signOut()}
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
          <div className="pt-2 border-t border-border mt-2">
            {session ? (
              <button
                onClick={() => {
                  close();
                  signOut();
                }}
                className="w-full text-left px-3 py-2 rounded-md text-sm font-semibold hover:bg-muted"
              >
                Sign out
                <span className="block text-xs text-muted-foreground truncate">
                  {session.user.email}
                </span>
              </button>
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
