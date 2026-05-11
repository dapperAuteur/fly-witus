# Fly WitUS

Pre-flight checklist + flight log for Part 107 drone operators. Offline-first PWA, free for solo pilots, paid plans add cloud sync, groups, and shared mission feeds for crews and BVC partners.

🌐 **Live**: <https://fly.witus.online>

![Fly WitUS](https://res.cloudinary.com/devdash54321/image/upload/v1760659304/logos/flywitus-platypus-logo.png)

## What it does

- **Pre-flight checklist** — 8 sections, 50+ items aligned to 14 CFR Part 107
- **Flight log** — multi-flight per mission, battery voltage, takeoff/landing, free-text notes
- **PDF export** — jsPDF, FAA-rubric-ready, no print dialog (works in iOS Safari)
- **Offline-first** — service worker + IndexedDB outbox; flush on reconnect
- **Live weather** — NOAA gridpoint forecast, ZIP→lat/lon via free Census geocoder
- **Photo attachments** — Cloudinary unsigned upload, embedded in PDF
- **Aircraft profiles** — per-pilot inventory, quick-load on new mission
- **Magic-link auth** — no passwords, no OAuth (Better Auth + Mailgun)
- **Cloud sync** — signed-in missions persist to Postgres (Neon)
- **Groups** *(paid)* — invite a crew, share missions to a feed, post flight requests for footage
- **BVC fields** — episode, course slug, partner institution, academic purpose for primary-source flights
- **Stripe + CashApp** — card subscription/lifetime via Stripe; manual CashApp activation flow
- **Admin panel** — KPI dashboard, user/tier management, lifetime slot counter, promo CRUD with auto-created Stripe coupons

## Plans

- **Free** — solo, localStorage-only, full checklist + PDF + offline. No sign-in required.
- **Cloud Monthly** — $10.60/mo. Multi-device sync + groups + flight requests.
- **Cloud Annual** — $103.29/yr. Same as Monthly, save ~$24.
- **Lifetime** — $103.29 one-time (100 standard slots, then closed unless re-opened by promo). Card via Stripe or `$Centenarian` on CashApp.

See [pricing](https://fly.witus.online/pricing).

## Tech

- **Framework**: Next.js 15 (App Router) on Vercel
- **DB**: Neon Postgres + Drizzle ORM
- **Auth**: Better Auth (magic-link)
- **Email**: Mailgun via `mg.witus.online`
- **Payments**: Stripe (card) + CashApp (manual)
- **Media**: Cloudinary (unsigned widget)
- **PDF**: jsPDF
- **PWA**: Serwist + IndexedDB outbox
- **Cron**: Vercel Cron (24h CashApp SLA reminder)

## Local development

```bash
git clone https://github.com/dapperAuteur/fly-witus.git
cd fly-witus
npm install
cp .env.example .env.local        # fill in real values
vercel env pull                    # if linked to Vercel project
npm run db:migrate                 # apply Drizzle migrations
npm run dev                        # http://localhost:3000
```

Required env: `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `ADMIN_EMAIL`. Stripe / Mailgun / Cloudinary / CashApp env are optional for local dev — features they back surface a friendly fallback when their env is absent.

## API surface (signed-in users)

| Method | Path | Purpose |
|---|---|---|
| GET / POST | `/api/missions` | List user missions / save new |
| PUT / DELETE | `/api/missions/[id]` | Update / delete |
| GET / PATCH | `/api/profile` | Read / edit display name, cert, home location |
| GET / POST | `/api/aircraft-profiles` | List / create aircraft |
| PATCH / DELETE | `/api/aircraft-profiles/[id]` | Edit / remove |
| GET / POST | `/api/groups` *(paid)* | List user's groups / create |
| GET / PATCH / DELETE | `/api/groups/[id]` *(member)* | Dashboard payload / owner edit / delete |
| POST | `/api/groups/join` *(paid)* | Accept invite code |
| POST | `/api/groups/[id]/share-mission` *(member)* | Share own mission to group |
| GET / POST | `/api/groups/[id]/requests` *(member)* | List / create flight requests |
| POST | `/api/groups/[id]/requests/[r]/claim` *(member)* | Claim open request |
| POST | `/api/groups/[id]/requests/[r]/complete` *(claimant)* | Link mission, auto-share, notify requester |
| GET / POST | `/api/groups/[id]/requests/[r]/comments` *(member)* | Thread |
| POST | `/api/checkout` | Stripe Checkout session |
| POST | `/api/cashapp/request` | Submit CashApp activation request |
| POST | `/api/stripe/webhook` | Stripe event handler |
| GET | `/api/weather` | NOAA forecast for ZIP/lat-lon |

## Admin (gated by `users.isAdmin`)

| Path | Purpose |
|---|---|
| `/admin` | KPI dashboard + recent activity |
| `/admin/users` | Search, paginate, change tier / admin flag |
| `/admin/cashapp` | Activate / reject CashApp queue + manual reminder trigger |
| `/admin/lifetime` | Standard 100-slot counter + reconcile against actual lifetime users |
| `/admin/promos` | CRUD lifetime-reopen + discount promos; Stripe coupon auto-created on save |
| `/admin/groups` | Read-only group inventory |

Non-admins see 404 on `/admin/*` (no existence leak).

## Project structure

```
src/
├── app/
│   ├── (auth)/login/             # magic-link sign-in
│   ├── admin/                    # gated admin panel
│   ├── api/
│   │   ├── auth/[...all]/        # Better Auth
│   │   ├── missions/             # mission CRUD
│   │   ├── groups/               # groups + flight requests
│   │   ├── checkout/             # Stripe Checkout
│   │   ├── stripe/webhook/       # Stripe events
│   │   ├── cashapp/request/      # CashApp manual activation
│   │   └── cron/cashapp-reminder/  # daily 24h SLA sweep
│   ├── dashboard/                # user dashboard
│   ├── groups/                   # group list/create/dashboard
│   ├── join/[inviteCode]/        # invite landing
│   ├── pricing/                  # /pricing
│   ├── cashapp/request/          # CashApp request form
│   └── page.tsx                  # checklist (anon-friendly)
├── components/site-footer.tsx
├── db/
│   ├── client.ts                 # pg pool + drizzle
│   ├── schema/                   # auth, missions, commerce, groups, aircraft-profiles
│   └── migrations/
└── lib/
    ├── env.ts                    # zod-validated env
    ├── auth.ts                   # Better Auth + magic-link
    ├── auth-client.ts
    ├── api-auth.ts               # requireUser / requireAdmin
    ├── tier.ts                   # requirePaidUser
    ├── mailer.ts                 # Mailgun + RFC-5322 normalization
    ├── stripe.ts                 # Stripe client + slot counter helpers
    ├── promos.ts                 # Stripe coupon + promotion-code sync
    ├── pdf.ts                    # jsPDF mission export
    ├── noaa.ts                   # NOAA + Census ZIP fallback
    ├── offline-outbox.ts         # IDB outbox for offline writes
    ├── checklist-data.ts
    ├── missions-store.ts         # auth-aware read/write
    ├── missions-api.ts / -queries.ts
    ├── groups-api.ts / -queries.ts
    ├── aircraft-profiles-api.ts
    ├── profile-api.ts
    ├── outbox-trigger.ts         # WitUS Outbox social-draft fan-out
    ├── outbox-mission-caption.ts
    ├── inbox.ts                  # WitUS Inbox push
    └── admin-notify.ts
```

## Verification before launch

See [docs/launch/smoke-checklist.md](docs/launch/smoke-checklist.md) for the end-to-end pre-launch verification.

## Contributing

[CONTRIBUTING.md](https://i.witus.online/fly-witus-contributing)

## Issues

[GitHub issues](https://i.witus.online/fly-witus-issues-tracker)

## License

MIT — see [LICENSE](LICENSE).

## Acknowledgments

- Checklist aligned to 14 CFR Part 107
- Weather: NWS gridpoint forecasts (NOAA) + Census ZCTA geocoder
- Built by [BAM](https://brandanthonymcdonald.com) — Part 107 pilot, ed-tech founder
