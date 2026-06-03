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
- **Account self-service** — change email (verified), export your data (JSON), sign out everywhere, delete account — all from **Dashboard → Account**
- **Groups** *(paid)* — invite a crew, share missions to a feed, post flight requests for footage
- **Group meetups** *(paid)* — Doodle-style scheduling: propose times, collect availability, finalize, add to calendar (ICS) + email reminders
- **Help center** — searchable in-app docs at `/help` + a floating help bubble for bug reports/feedback (stored, emailed to admin, and pushed to the WitUS Inbox/Triage bus)
- **Dark mode** — follows your OS color scheme across the whole app
- **BVC fields** — episode, course slug, partner institution, academic purpose for primary-source flights
- **Stripe + CashApp** — card subscription/lifetime via Stripe; manual CashApp activation flow
- **Admin panel** — KPI dashboard, user/tier management, lifetime slot counter, promo CRUD with auto-created Stripe coupons, feedback triage queue

## Plans

- **Free** — solo, localStorage-only, full checklist + PDF + offline. No sign-in required.
- **Cloud Monthly** — $10.60/mo. Multi-device sync + groups + flight requests.
- **Cloud Annual** — $103.29/yr. Same as Monthly, save ~$24.
- **Lifetime** — $103.29 one-time (100 standard slots, then closed unless re-opened by promo). Card via Stripe or `$Centenarian` on CashApp.

See [pricing](https://fly.witus.online/pricing).

## Managing your account (self-service)

Everything below is self-serve from **Dashboard → Account** — no need to email an admin. Full walkthrough lives in the in-app help: [/help/account-management](https://fly.witus.online/help/account-management).

- **Sign-in is passwordless.** Enter your email, click the magic link we send (expires in 15 min). There's no password to set or reset.
- **Change email** — request a change and confirm via a link sent to the *new* address; your old email stays active until you click it.
- **Export my data** — download a JSON file of your profile, missions (with flights + photos), aircraft profiles, and group memberships.
- **Sign out everywhere** — invalidate every active session (use this on a lost/shared device); sign back in with a fresh magic link.
- **Delete account** — type `DELETE` to confirm; permanently removes your account and cloud data (missions, photos, aircraft, and any groups you own). Locally-stored missions on your device are unaffected.

Need help or hit a bug? Use the **help bubble** (bottom-right on any page) — works signed-in or out — or browse the searchable docs at [/help](https://fly.witus.online/help).

Reference (endpoints + data-deletion semantics): [docs/account-management.md](docs/account-management.md).

## Tech

- **Framework**: Next.js 15 (App Router) on Vercel
- **DB**: Neon Postgres + Drizzle ORM
- **Auth**: Better Auth (magic-link)
- **Email**: Mailgun via `mg.witus.online`
- **Payments**: Stripe (card) + CashApp (manual)
- **Media**: Cloudinary (unsigned widget)
- **PDF**: jsPDF
- **PWA**: Serwist + IndexedDB outbox
- **Cron**: Vercel Cron (daily CashApp SLA reminder + meetup reminders)
- **Theme**: OS-driven light/dark via semantic CSS tokens (Tailwind v4)

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
| POST | `/api/account/email` | Request email change (verification link to new address) |
| GET | `/api/account/email/verify` | Apply a verified email change |
| GET | `/api/account/export` | Download all your data as JSON |
| DELETE | `/api/account/sessions` | Sign out everywhere |
| DELETE | `/api/account` | Delete account + cloud data (typed confirm) |
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
| GET / POST | `/api/groups/[id]/meetups` *(member)* | List / create meetups |
| GET / PATCH / DELETE | `/api/groups/[id]/meetups/[m]` *(member; manage = creator/owner/admin)* | Detail / finalize-cancel-edit / delete |
| POST / DELETE | `/api/groups/[id]/meetups/[m]/options[/[o]]` *(member)* | Propose / remove a candidate time |
| PUT | `/api/groups/[id]/meetups/[m]/responses` *(member)* | Mark availability (yes/maybe/no) |
| GET | `/api/groups/[id]/meetups/[m]/ics` *(member)* | Calendar download for a confirmed meetup |
| POST | `/api/feedback` | Submit bug/feedback/question (auth optional) |
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
| `/admin/feedback` | Help-bubble submission queue with inline status triage |

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
│   │   ├── account/              # email change / export / sessions / delete
│   │   ├── feedback/             # help-bubble submissions
│   │   ├── cashapp/request/      # CashApp manual activation
│   │   └── cron/                 # cashapp-reminder + meetup-reminders
│   ├── dashboard/                # user dashboard (incl. Account section)
│   ├── groups/                   # group list/create/dashboard (+ meetups tab)
│   ├── help/                     # searchable help center (/help + /help/[slug])
│   ├── join/[inviteCode]/        # invite landing
│   ├── pricing/                  # /pricing
│   ├── cashapp/request/          # CashApp request form
│   └── page.tsx                  # checklist (anon-friendly)
├── components/
│   ├── app-nav.tsx               # persistent global nav
│   ├── help-bubble.tsx           # floating feedback/help widget
│   └── site-footer.tsx
├── content/help/                 # help-doc source (typed, fuzzy-searchable)
├── db/
│   ├── client.ts                 # pg pool + drizzle
│   ├── schema/                   # auth, missions, commerce, groups, aircraft-profiles, feedback, meetups
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
    ├── meetups-api.ts / -queries.ts  # group meetup scheduling
    ├── feedback-api.ts / -notify.ts  # help-bubble validation + fan-out
    ├── account-api.ts / account-tokens.ts  # self-service + signed email-change tokens
    ├── help-search.ts             # dependency-free fuzzy doc search
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
