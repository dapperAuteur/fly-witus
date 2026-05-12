# Pre-launch smoke checklist

**Target launch:** 2026-05-25 (Show HN ~9am ET, Product Hunt 00:01 PT)
**Last reviewed:** 2026-05-10

Run end-to-end **after** every Vercel production deploy in the launch week. Mirror of the v3 §"Verification" plan, expanded with the actual paths/test data we have today. Use a fresh incognito window per pass to avoid stale auth cookies and service-worker caches.

## 0. Environment sanity

- [ ] `vercel env pull` clean — no missing required vars
- [ ] `npm run typecheck` clean
- [ ] `npm run lint` clean
- [ ] Latest production deploy is green in the Vercel dashboard
- [ ] DNS: `fly.witus.online` resolves; `mg.witus.online` SPF/DKIM still pass

## 1. Auth — magic link

- [ ] Visit `/login`, enter `tools+smoke@awews.com`
- [ ] Magic link email arrives within 5s in Mailgun logs
- [ ] Click link → land on `/dashboard` signed in
- [ ] Subsequent reload still authed (session cookie set)
- [ ] Sign out → `/dashboard` redirects to `/login`

## 2. Anonymous flow

- [ ] Visit `/` in a fresh incognito; do **not** sign in
- [ ] Click "Continue Without Account"
- [ ] Fill checklist to 100%
- [ ] Save mission → stored in localStorage
- [ ] Export PDF → file downloads (iOS Safari: opens in Files app, no print dialog)
- [ ] PDF QA: pilot/cert/location/weather/checklist/photos render

## 3. Offline — outbox

- [ ] Sign in
- [ ] DevTools → Network → Offline
- [ ] Save a new mission + add a flight + photo
- [ ] DevTools → Application → IndexedDB → outbox row exists
- [ ] Network → Online
- [ ] Within 10s: outbox row drains; mission appears in `/dashboard`

## 4. NOAA reliability

Manual zip pass — paste each into the weather widget; expect a populated forecast within 5s, or a documented fallback message:

- [ ] 90210 (CONUS — CA)
- [ ] 99501 (AK)
- [ ] 96701 (HI)
- [ ] 10001 (NYC)
- [ ] 80401 (CO mountains)

Then run the broader sweep (50 zips) — see `npm run noaa:sweep` in `scripts/noaa-sweep.ts`. All zips should resolve to a forecast OR return a typed `error: 'CENSUS_TIMEOUT'` etc. — never a 500.

## 5. Stripe checkout

- [ ] `/pricing` → click Cloud Annual → land on Stripe Checkout
- [ ] Use test card `4242 4242 4242 4242`, any future expiry, any CVC, any ZIP
- [ ] Land on `/?checkout=success&plan=annual`
- [ ] Webhook fires (Stripe dashboard → Events → `checkout.session.completed`)
- [ ] User row in DB has `accountTier=cloud_annual`, `tierExpiresAt` set
- [ ] Repeat for Lifetime — verify `lifetime_slot_counter.standard_slots_used` increments by 1

## 6. CashApp manual

- [ ] `/cashapp/request` as signed-in user → submit `$Centenarian-test`
- [ ] Admin email arrives at `bam@awews.com` within 5s
- [ ] `/admin/cashapp` shows the row in Pending
- [ ] Activate → user row tier flips to `lifetime`, activation email lands
- [ ] Reject (different test row) → rejection email with reason

## 7. Groups + sharing

- [ ] As paid user A: `/groups/new` → create "Smoke Test Crew"
- [ ] Copy invite link
- [ ] As paid user B in another browser: visit `/join/[code]` → auto-joins, lands on group dashboard
- [ ] User B in Members tab
- [ ] User A: `/dashboard` → "Share to group" on a mission → pick Smoke Test Crew → share
- [ ] User B: group dashboard → Shared Missions tab → mission appears within 5s of refresh

## 8. Flight requests

- [ ] User A in group: Flight Requests → New request → BVC Primary Source → conditional fields appear
- [ ] Fill + post
- [ ] User B: Flight Requests → click "Claim this request"
- [ ] User B: Save a real mission of their own
- [ ] User B: back to request → "Complete request" → pick that mission → submit
- [ ] Mission auto-appears in Shared Missions tab
- [ ] User A receives "Flight request completed" email

## 9. Admin gate

- [ ] Non-admin signed-in user → GET `/admin` → 404
- [ ] `bam@awews.com` → GET `/admin` → KPI dashboard renders
- [ ] `/admin/users` → search works, tier change persists
- [ ] `/admin/lifetime` → counter renders, edit + save works
- [ ] `/admin/promos` → create a discount promo with `LAUNCH50` code
- [ ] Stripe dashboard: coupon + promotion code created
- [ ] `/pricing` → discount banner with `LAUNCH50` shown
- [ ] Test checkout — paste `LAUNCH50` on Stripe page → discount applies

## 10. Cron — CashApp 24h reminder

- [ ] `/admin/cashapp` → "Run reminder now"
- [ ] If queue empty: "Queue empty — nothing sent." (200, no email)
- [ ] Insert a fake pending row aged >20h via DB (or wait): trigger again → admin email arrives + Inbox push if `INBOX_INGEST_*` configured
- [ ] In Vercel dashboard: confirm `cashapp-reminder` cron is registered, last invocation succeeded

## Launch-day cutover

- [ ] All above ✓ on production
- [ ] Demo video uploaded (operator task #12)
- [ ] Hero screenshots in `/public/launch/` (operator task #13)
- [ ] Marketplace posts queued (operator task #14)
- [ ] Subreddit drafts ready (operator task #15)
- [ ] Show HN draft staged in browser tab
- [ ] Product Hunt post scheduled / staged
