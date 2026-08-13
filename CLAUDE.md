@AGENTS.md

# Swapp

A Hebrew, RTL, mobile-first PWA where **סטאז'רים at Ichilov** hand over and take
on-call shifts (תורנויות). One posts a shift they need covered; others browse a
month calendar and open WhatsApp straight from a shift to settle it directly
with whoever posted it. The owner marks it handed off by hand once it's
settled — the app never learns who took it.

Built from a PDR the user supplied; section references like "PDR §6.3" appear
throughout the code and mean that document.

## Current state

| | |
| --- | --- |
| Firebase project | `swapp-ddc27` (Spark/free tier) |
| Rules + indexes | Deployed and live |
| Auth | Google provider, initialized; `localhost` authorized |
| GitHub | `github.com/Tghez/Swapp` (branch `master`) |
| Public URL | **None yet.** Not deployed to Vercel or anywhere else |
| TTL policies | **Probably not set up yet** — verify before assuming cleanup works |

`.env.local` holds the real Firebase config and is gitignored. `.env.local.example`
is the template and is committed.

## Commands

```bash
npm run dev            # dev server
npm test               # 67 unit tests, pure logic, no emulator
npm run typecheck      # tsc --noEmit
npm run lint           # eslint
npm run emulators      # pinned to firebase-tools@13 — see note below
npm run test:rules     # 32 rules tests, needs emulators running first
npm run deploy:rules   # push firestore.rules + indexes
```

**The emulator is pinned to `firebase-tools@13`** because current versions
require Java 21 and this machine has Java 11. Deploys are unaffected — only the
emulator needs a JVM. If the JDK gets upgraded, drop the `@13`.

Always run `npm test && npm run typecheck && npm run lint` before declaring work
done. Rules changes additionally require `npm run test:rules`.

## Architecture

```
src/lib/domain/    departments, zod schemas, shared types — pure, no Firebase
src/lib/date/      monthWindow (the whole of PDR §7), calendar grid — pure
src/lib/data/      the ONLY place that touches Firestore
src/hooks/         onSnapshot subscriptions wrapping lib/data
src/components/    UI
```

**No component may import from `firebase/firestore`.** Collection names and
document shapes live in `src/lib/data/` alone. `lib/domain` and `lib/date` are
pure and heavily unit-tested — put logic there when you can.

## Data model

```
users/{uid}                     displayName, phone, email, updatedAt
shifts/{auto}                   ownerId + denormalised owner contact, date,
                                monthKey, department, internalUnit, note,
                                urgent, status, expireAt
quotas/{uid}__{YYYY-MM}         uid, monthKey, dates (map<date,true>),
                                urgentShiftId (string|null), expireAt
```

One deliberate choice worth not "fixing":

- **Owner contact is denormalised onto each shift.** The board renders it and
  builds the wa.me link for every visible shift; reading `users/{uid}` per shift
  would be an N+1 *and* would force rules to expose every profile to everyone.

## Invariants — do not break these

1. **Composite ids are the enforcement mechanism.** Firestore refuses a `create`
   on an existing document, so deriving the id from its data turns "one דחיפות
   per month" and "one shift per date" into database guarantees. Never switch
   these to auto-ids with a client-side check.

2. **דחיפות is enforced server-side.** An urgent shift is written in the same
   batch as an update to `quotas/{uid}__{monthKey}` that moves its
   `urgentShiftId` field from `null` to the shift's id. Rules only allow that
   transition (or the reverse, on release) — never one value to a different
   one — so a second urgent shift in a month hits a doc whose `urgentShiftId`
   is already set and the atomic batch dies with it. The doc is keyed by the
   **shift's** month, not the posting month — that is what lets `deleteShift`
   release it.

3. **An intern may hold at most one shift per date and 4 a month, counting
   shifts still on the books.** The daily limit is per **shift date**, not per
   day of posting — an intern can post several shifts in one sitting as long
   as no two land on the same date. Both limits live on the same
   `quotas/{uid}__{monthKey}` doc: `createShift` claims the shift's date as a
   key in its `dates` map (re-claiming an already-claimed date is a no-op
   change the rules reject, enforcing the daily limit) in the same batch as
   the shift; the four-a-month cap needs no separate counter, since one shift
   always claims exactly one date, so `dates.size()` *is* the count, capped
   at 4 by the rules. `deleteShift` removes the date key again, so the cap and
   the per-date limit track shifts currently posted rather than shifts ever
   posted — a shift marked handed off via `markShiftHandedOff` stays on the
   books (and counted) since only deletion frees the slot, and deleting a
   shift lets the intern immediately re-post on that same date.

4. **`monthKey` must equal `date[0:7]`** — rules enforce it. A shift whose keys
   disagree would be invisible in the month it belongs to.

5. **Every query also filters by month.** Firestore TTL is best-effort and can
   trail expiry by ~24h. TTL keeps the database small; the query filter is what
   guarantees nothing stale is ever rendered. Both are needed.

## Gotchas

- **WhatsApp must open via a real `<a href>`, never `window.open` after an
  await.** Safari blocks a popup once the click's user gesture is consumed.
- **Sign-in uses `signInWithPopup` deliberately.** Redirect crosses origins to
  `*.firebaseapp.com` and breaks under third-party-storage partitioning. If it
  ever needs fixing, proxy `/__/auth/:path*` via a Next rewrite.
- **Tailwind v4 only sees literal class strings.** Department colours are
  written out in full in `departments.ts`; never compose them at runtime.
- **ESLint enforces `react-hooks/set-state-in-effect`.** Derive state during
  render instead of syncing it in an effect. The subscription hooks tag results
  with the query key so `loading` is derived, not stored — follow that pattern.
- **Dates are handled in local time via date-fns.** `new Date('2026-08-01')`
  parses as UTC and lands a day early for anyone behind UTC.

## Deviations from the PDR (intentional)

- **Font is Rubik, not Nunito.** Nunito ships no Hebrew glyphs, so every string
  would fall back to a system font.
- **The handoff form has a date field** the PDR does not list — §6.3 is a
  calendar, so a shift cannot exist without one.
- **Sidebar "Add" goes to `/handoff`**, not the take-a-shift page as §6.1
  literally says; read as a typo.
- **Only the four top-level מחלקות carry a colour.** Fourteen hues on one
  calendar would be unreadable; the פנימית unit shows as text. Department names
  are always written out, so colour is never the sole carrier of meaning.

## Conventions

- **All user-facing copy is Hebrew.** Code, comments and identifiers are English.
- **Say סטאז'ר / סטאז'רים, never מתמחה / מתמחים.** The users are סטאז'רים at
  Ichilov. This is consistent across the codebase — keep it that way in new
  copy. Use the ASCII apostrophe `'` (U+0027), as the existing strings do. (The
  geresh `׳` U+05F3 in `departments.ts` is a different thing — Hebrew letter
  numbering, פנימית א׳ — and is correct there.)
  **An apostrophe in raw JSX text fails `react/no-unescaped-entities`.** Inside
  a string literal it is fine; in JSX body text, wrap the copy in `{"..."}`
  rather than escaping to `&apos;`, which makes the Hebrew unreadable in source.
- **Departments:** IDs are stable ASCII keys and are what gets stored; Hebrew
  labels are display-only, so renaming never orphans data. There is no פנימית ז׳
  — that is correct, not an omission.
- Colours come from the `@theme` block in `globals.css`. No ad-hoc hex values.
  Coral `--color-urgent` is reserved for דחיפות and destructive actions; it is
  never a normal button fill.

## Known gaps

- Not deployed anywhere; no public URL.
- The signed-in UI has been verified to build, typecheck, and ship its strings
  to the client bundles, but the rendered calendar has never been reviewed in a
  browser. Visual issues are likely and unexamined.
- Taking a shift opens WhatsApp directly — there is no in-app record of who
  is interested or who ends up taking it. The owner manages that entirely
  outside the app and marks it handed off by hand ("מסרתי") once settled.
- TTL policies must be added by hand in the console (`expireAt` on `shifts`
  and `quotas`). Nothing breaks visibly if they are missing; data just
  accumulates forever.
