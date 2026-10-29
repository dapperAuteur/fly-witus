# Account management

How users manage their own Fly WitUS account — no admin or dev required. This
is the repo reference; the user-facing version is in the in-app help center at
[`/help/account-management`](https://fly.witus.online/help/account-management)
(source: `src/content/help/docs.ts`).

All actions live under **Dashboard → Account** (`src/app/dashboard/_components/account-section.tsx`).

## Sign-in is passwordless

Fly WitUS uses Better Auth **magic links**. The user enters their email and we
send a one-time sign-in link (15-minute expiry, single use). There is **no
password** to set, reset, or store — so account management is about email,
sessions, data, and deletion rather than credentials.

## Change email

- **UI:** Dashboard → Account → "Change email" → enter the new address → "Send link".
- **API:** `POST /api/account/email` → emails a **signed, 30-minute verification
  link to the new address**; clicking it hits `GET /api/account/email/verify`,
  which applies the change and redirects to `/dashboard?email=changed`.
- The account email does **not** change until the new address is confirmed, so a
  typo can't lock anyone out. The token is a stateless HMAC over
  `userId + newEmail + exp` (`src/lib/account-tokens.ts`) — no DB table needed.
- Guards: rejects the current email, and rejects an address already in use.

## Export my data

- **UI:** Dashboard → Account → "Export my data (JSON)".
- **API:** `GET /api/account/export` → a JSON download (`fly-witus-export.json`)
  containing the user's profile, missions (with flights + photos), aircraft
  profiles, and group memberships.

## Sign out of Fly WitUS on all devices

- **UI:** Dashboard → Account → "Sign out of Fly WitUS on all devices", then
  "Yes, sign out on all devices" in the inline confirm step.
- **API:** `DELETE /api/account/sessions` → deletes every session row for the
  user (all devices), then the client signs out locally. Next sign-in needs a
  fresh magic link. Use on a lost or shared device.
- It ends Fly WitUS sessions only. The WitUS session and other WitUS apps stay
  signed in; to end WitUS too, use "Sign out of WitUS everywhere" in the nav
  (BAM, 2026-10-29, witus task 128 option (b)).

## Delete account

- **UI:** Dashboard → Account → "Delete account" → type `DELETE` to confirm.
- **API:** `DELETE /api/account` (body `{ "confirm": "DELETE" }`).
- Deletes the account and **all cloud data**: missions, flights, photos,
  aircraft, group memberships, authored flight requests/comments, and **any
  groups the user owns** (owned groups are deleted first because
  `groups.ownerId` is RESTRICT; everything else cascades off `users.id`).
- **Irreversible.** Locally-stored (anonymous/offline) missions on the user's
  own device are not affected — those never left the device.

## Getting help

- **Help bubble** (bottom-right on every page, `src/components/help-bubble.tsx`)
  — submit a bug, feedback, or question. Works signed-in or signed-out. Each
  submission is stored (`feedback_submissions`), emailed to the admin, and
  pushed to the WitUS Inbox/Triage bus.
- **Help center** at [`/help`](https://fly.witus.online/help) — searchable docs
  (fuzzy search, `src/lib/help-search.ts`).

## Related

- In-app guide source: `src/content/help/docs.ts` (slug `account-management`)
- Routes: `src/app/api/account/**`
- Auth: `src/lib/auth.ts` (magic-link config)
