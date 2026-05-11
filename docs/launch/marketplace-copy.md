# Marketplace submission copy

Reusable templates for AlternativeTo, SaaSHub, devhunt, BetaList. Pre-filled with the Track E launch positioning. Edit the metrics + screenshot URLs before submitting; everything else is launch-ready.

## Tagline (60 chars)

> Offline-first Part 107 pre-flight checklist for drone pilots.

## One-liner (140 chars)

> Pre-flight checklist + flight log for FAA Part 107 drone operators. Offline PWA. Free for solo pilots; paid plans add cloud sync + crew sharing.

## Short description (~280 chars)

> Built by a Part 107 pilot for Part 107 pilots. Complete the FAA pre-flight checklist on your phone, log the flight, export an audit-ready PDF — all without a network connection. Sync across devices and share missions with your crew on Cloud / Lifetime plans.

## Long description

Fly WitUS is the only FAA Part 107 pre-flight checklist that survives a dead-zone takeoff site. It's an offline-first PWA: the checklist, flight log, weather snapshot, and PDF export all work without a network. Sign in (magic link only — no passwords) to sync across devices and unlock crew features.

**Free tier**

- 8-section, 50+ item checklist aligned to 14 CFR Part 107
- Flight log with battery voltage, takeoff/landing times
- Weather snapshot: NOAA gridpoint forecast, ZIP→lat/lon via free Census geocoder
- Audit-ready PDF export (jsPDF — no print dialog, works in iOS Safari)
- localStorage-only — no account required

**Cloud / Lifetime adds**

- Multi-device cloud sync (Postgres backend)
- Photo attachments (Cloudinary, embedded in PDF)
- Aircraft profiles
- Groups: invite a crew, share missions to a feed
- Flight requests: post a mission for a crew member to fly (BVC episode footage, location scouting, condition checks)
- BVC fields: episode, partner institution, academic purpose for primary-source flights

**Pricing**: free forever for solo. $10.60/mo, $103.29/yr, or $103.29 lifetime (100 standard slots; CashApp accepted at `$Centenarian`).

**No tracking, no ads, no algorithm**. Built by [Brand Anthony McDonald](https://brandanthonymcdonald.com) — independent founder, Part 107 pilot, ed-tech.

🌐 <https://fly.witus.online>

## Categories / tags

`drones` · `aviation` · `part-107` · `faa` · `pre-flight-checklist` · `flight-log` · `pwa` · `offline-first` · `nextjs` · `pilots` · `uav` · `uas`

## Per-platform notes

### AlternativeTo

- **Listing type:** Web App + PWA + Self-Hosted (open source)
- **Alternative to:** AirData UAV, Kittyhawk, Drone Logbook, AirHub Logbook
- **Key differentiators to emphasize:**
  - Free tier is fully usable (not a 14-day trial)
  - Offline-first; competitors require a network for the checklist
  - Open source on GitHub
- **License:** MIT
- **Social proof to attach:** GitHub repo, screenshots × 3, demo video

### SaaSHub

- **Categories:** Aviation Tools, Productivity, Field Operations
- **Pricing model:** Freemium
- **Stack disclosure (they ask):** Next.js / Vercel / Neon Postgres / Better Auth / Stripe
- **Self-hosted option:** Yes (clone + Vercel deploy)

### devhunt

- **Submitter blurb (1st person):**
  > I built this because I kept missing checklist items at flight sites with bad cell coverage. Existing logbook apps either need network for the checklist or charge $20/mo for what should be a free utility. Fly WitUS keeps the core flow free forever, and adds crew/cloud sync as a paid extra for teams that need it. Open source, MIT, real PDF export that passes the Part 107 rubric.
- **Tech tags:** `nextjs`, `react`, `tailwindcss`, `postgres`, `drizzle`, `better-auth`, `stripe`

### BetaList

- **Status:** "Launched" (skip if BetaList only takes pre-launch — file under their "post-launch" alternative)
- **Tagline:** Same as above
- **Why now:** Public launch 2026-05-25, after 25-day full v3 build

## Common follow-up Qs (paste verbatim)

> **Why magic link only? No Google login?**
> Pilots don't trust the same OAuth surfaces as a generic SaaS audience — flight data is sensitive enough that I deliberately avoided social login at v1. Magic link via Mailgun is enough friction and zero password-storage risk.

> **Why both Stripe and CashApp?**
> A meaningful slice of indie pilots prefer to send payment outside card networks. CashApp (manual activation by admin) is a 24-hour-SLA flow — submit username, admin verifies the transaction in CashApp, account flips to Lifetime.

> **Is this affiliated with FAA / NOAA?**
> No. Checklist content is aligned to 14 CFR Part 107 but is not endorsed by the FAA. Weather data is sourced directly from the National Weather Service public API.

> **Can I self-host?**
> Yes. The repo is MIT. You'll need a Neon (or any Postgres) database, a Mailgun account for magic links, optionally Stripe + CashApp for payments. README has a 5-line install.
