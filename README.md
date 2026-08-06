# Swapp

מסירה ולקיחה של תורנויות בין סטאז'רים.

A סטאז'ר posts a תורנות they need to hand off; others browse a month calendar of
what is available, register interest, and the two settle it over WhatsApp.
Hebrew, RTL, mobile-first, installable to a home screen.

## Stack

| | |
| --- | --- |
| Frontend | Next.js (App Router) as a PWA, deployed on Vercel |
| Data | Firestore — no backend server, no Cloud Functions |
| Auth | Firebase Auth, Google provider |
| Authorization | `firestore.rules`, enforced server-side by Firebase |
| Cleanup | Firestore TTL on `expireAt` |

Everything fits Firebase's free Spark plan; no billing account is required.

## Getting started

```bash
npm install
cp .env.local.example .env.local   # fill in from the Firebase console
npm run dev
```

The app refuses to start against an unconfigured project and says which keys
are missing, rather than failing with an opaque Firebase error.

### Scripts

| Command | Does |
| --- | --- |
| `npm run dev` | Dev server |
| `npm test` | Unit tests (pure logic — no emulator needed) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run emulators` | Auth + Firestore emulators |
| `npm run test:rules` | Security-rules tests (needs the emulator running) |
| `npm run deploy:rules` | Push rules + indexes to Firebase |

## One-time Firebase setup

1. **Create a project** and add a Web app; copy its config into `.env.local`.
2. **Enable Google sign-in** — Authentication → Sign-in method → Google.
3. **Authorize your domains** — Authentication → Settings → Authorized
   domains: add `localhost` and the Vercel domain. Sign-in fails without this.
4. **Deploy rules and indexes**: `npm run deploy:rules`.
5. **Turn on TTL** — Firestore → Time-to-live. Add a policy on the `expireAt`
   field for each of `shifts`, `interests`, and `urgencyLocks`.

Step 5 is what implements the monthly cleanup, and it is easy to forget — no
TTL policy means nothing is ever deleted. Nothing visibly breaks, so check it.

## How the month cycle works

PDR §7 asks for next month's data to be "initialized" on the 15th and the
previous month deleted at month end. Since shifts are created by the interns
themselves there is no roster to import, so this reduces to two things:

- **The 15th** widens the range of dates a shift may be posted for, from "rest
  of this month" to "rest of this month plus all of next". One pure function,
  `getSelectableRange` in [`src/lib/date/monthWindow.ts`](src/lib/date/monthWindow.ts),
  decides this for the whole app.
- **Month end** is handled by TTL: every document carries an `expireAt` set to
  midnight on the first of the following month.

TTL deletion is best-effort and can trail expiry by up to a day, so every query
*also* filters by `monthKey`. TTL keeps the database from growing; the query
filter is what guarantees nothing stale is ever shown.

## Security model

There is no backend, so `firestore.rules` is the entire authorization layer —
a forged request from devtools is evaluated by exactly those rules.

- Any signed-in intern can read the shift board.
- An intern can only create a shift under their own `ownerId`, and only they
  can edit or delete it.
- A non-owner may change exactly one field on someone else's shift —
  `interestCount`, and only by exactly +1. Not to an arbitrary value, not
  downwards, and not alongside any other field.
- An interest document's id is `{shiftId}__{takerId}`, which makes "one
  interest per intern per shift" a database guarantee. Its `shiftOwnerId` is
  verified against the actual shift, so nobody can plant an entry in a
  stranger's inbox.
- Profiles are private to their owner. The board never needs to read them
  because owner contact details are denormalised onto each shift.

### דחיפות is enforced server-side

The PDR expected the once-per-month urgency limit to be a client-side check.
It turned out to be enforceable for free: an urgent shift is written in the
same batch as a lock document at `urgencyLocks/{uid}__{YYYY-MM}`. Batches are
atomic and the rules permit `create` on that collection but never `update`, so
a second urgent shift in the same month hits an existing document and takes
the whole batch down with it.

`npm run test:rules` covers each of these claims.

## Departments

Defined once in [`src/lib/domain/departments.ts`](src/lib/domain/departments.ts).
IDs are stable ASCII keys and are what gets stored; the Hebrew labels are
display-only, so renaming a department never orphans existing shifts.

Only the four top-level מחלקות carry a colour — fourteen hues on one calendar
would be unreadable — and the פנימית unit appears as text on the chip. The
department name is always written out, so colour is never the only thing
carrying meaning.

## Deploying

Push to a Vercel project with the same `NEXT_PUBLIC_FIREBASE_*` env vars set,
then add the deployed domain to Firebase's authorized domains. There is no app
store step — interns get a URL and "Add to Home Screen".

## Notes for whoever picks this up next

- **Sign-in uses a popup, deliberately.** The app is on Vercel while Firebase's
  auth handler is on `*.firebaseapp.com`, so a redirect crosses origins and
  browsers that partition third-party storage drop it. If the popup ever proves
  unworkable inside the installed iOS PWA, proxy `/__/auth/:path*` to the
  Firebase auth domain with a Next rewrite to make redirect viable again.
- **The font is Rubik, not Nunito** as the PDR specified. Nunito ships no
  Hebrew glyphs, so every string in this app would have fallen back to a system
  font. Rubik is the nearest Hebrew-capable match.
- **The handoff form has a date field** the PDR does not list. §6.3 renders a
  month calendar, so a shift cannot exist without one.
- **The service worker caches almost nothing on purpose.** This is a live board
  of who needs cover right now; serving a stale copy could have someone take a
  shift that was handed off yesterday.
- **The emulator script is pinned to firebase-tools@13** because current
  versions require Java 21+ and this was built on a Java 11 machine. If your
  JDK is 21 or newer, drop the `@13` in the `emulators` script. Deploys are
  unaffected — only the emulator needs a JVM.
