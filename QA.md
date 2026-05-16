# QA.md — aftermeet test plan

> For human and AI QA agents. Run this top-to-bottom to validate a deploy.

**Live URL:** https://aftermeet.pages.dev
**Repo:** https://github.com/johnjheejin/aftermeet
**Stack:** Cloudflare Pages + Pages Functions + KV (see `AGENTS.md` style notes in `DESIGN.md`)

---

## 0. Quick automated smoke test

```bash
cd aftermeet
./tests/smoke.sh                          # against production
BASE=http://localhost:8788 ./tests/smoke.sh   # against local dev
```

Exit code 0 = all green. The script tests every endpoint listed in §2.

---

## 1. Pages & flows (manual)

For each page: load URL, check that the listed elements render, then exercise the listed interactions.

### 1.1 `/` — Landing
- [ ] Headline "The meet doesn't end after the meet." renders, glow visible
- [ ] Eyebrow shows `PERSISTENT NETWORKING · v0.1`
- [ ] Two CTAs in hero: "🎤 Host an event" → `/host`, "How it works" → `#how`
- [ ] Three feature cards (01/02/03) visible
- [ ] Footer has Pitch + GitHub links
- [ ] Brand dot (top-left) glows softly violet
- [ ] No horizontal scroll on mobile (≤375px)

### 1.2 `/host` — Host mode
- [ ] Two inputs: Event URL (required), Profile URL (optional)
- [ ] "Create event page" disabled state shows "Parsing event…" while submitting
- [ ] Submitting a Cerebral Valley URL (e.g. `https://cerebralvalley.ai/e/genspark-meetup-seoul`) redirects to `/e/<slug>/screen`
- [ ] Submitting an invalid URL shows red error text
- [ ] Submitting a URL without `https://` auto-prepends it

### 1.3 `/e/[slug]/screen` — Big-screen QR
- [ ] Page renders with event title, location chip, eyebrow `<SOURCE> · LIVE`
- [ ] Large QR (~420px) renders inside a white rounded card
- [ ] URL printed below QR in monospace
- [ ] "🟢 N connected" chip pulses; number updates within ~3s when a new profile joins
- [ ] "See participants →" link (bottom-right) works
- [ ] 404 if slug doesn't exist

### 1.4 `/e/[slug]/join` — Mobile join
- [ ] Event banner at top (title + location) renders
- [ ] Input auto-focuses on load (desktop) — irrelevant on mobile
- [ ] "Add a custom name or one-liner" details toggle expands/collapses
- [ ] Submitting profile URL shows success state with 🤝 emoji and "View participants →" button
- [ ] Submitting a duplicate profile URL still succeeds (idempotent — same profileId)
- [ ] Invalid profile URL → red error message
- [ ] URL without `https://` auto-prepends

### 1.5 `/e/[slug]` — Event page
- [ ] Eyebrow shows source in uppercase + `PERSISTENT`
- [ ] Title, description (truncated to ~220 chars), meta chips
- [ ] Empty state shows when no participants yet
- [ ] Participants grid: cards 180px min width, responsive
- [ ] Person card shows avatar (or letter avatar fallback), name, optional title/note, platform tag
- [ ] Card click opens profile URL in new tab (`target="_blank"`)
- [ ] Hover lift + violet glow visible (desktop)

### 1.6 `/pitch` — Pitch deck
- [ ] Slide 1 renders on load, dot indicator at slide 1
- [ ] `→` / Space / click-right advances; `←` / click-left goes back
- [ ] `Home` / `End` jump to first/last slide
- [ ] `F` toggles fullscreen
- [ ] Slide 6 has a live QR (same as `/screen` mode)
- [ ] Slide 6 live counter updates with new participants
- [ ] URL hash updates as you navigate (`#1`, `#2`, …)
- [ ] Reload at `/pitch#5` lands on slide 5

---

## 2. API contract

All endpoints return JSON; non-2xx responses include `{ "error": string }`.

### POST `/api/events`
**Body:** `{ "eventUrl": string, "hostProfile"?: string }`
**Returns:** `{ "slug": string, "event": Event }`

Edge cases:
- [ ] Missing `eventUrl` → 400 `{ error: "eventUrl required" }`
- [ ] Bad URL → 500 with error message
- [ ] Duplicate eventUrl returns the same slug (upsert)
- [ ] Event fields populated: `title`, `description`, `image` for Luma/CV pages
- [ ] `participantIds` is an array (possibly empty)

### GET `/api/events?slug=...`
**Returns:** `{ "event": Event, "participants": Profile[] }`

Edge cases:
- [ ] Missing `slug` → 400
- [ ] Unknown `slug` → 404
- [ ] `participants` length matches `event.participantIds.length`

### POST `/api/profiles`
**Body:** `{ "eventSlug": string, "profileUrl": string, "displayName"?: string, "note"?: string }`
**Returns:** `{ "profile": Profile, "eventSlug": string }`

Edge cases:
- [ ] Missing field → 400
- [ ] Unknown `eventSlug` → 404
- [ ] Duplicate profileUrl on same event → idempotent (no duplicate participant)
- [ ] Same profileUrl on different events → profile.events grows
- [ ] GitHub URLs hit the GH API: returns `avatar`, `bio`, `name` when public
- [ ] LinkedIn URLs: best-effort OG scrape; falls back to handle if blocked

---

## 3. Data integrity (KV)

- [ ] Event keys formatted `event:<slug>`
- [ ] Profile keys formatted `profile:<hashId>`
- [ ] `Event.participantIds` only contains IDs that exist as `profile:*` keys (no orphans)
- [ ] No PII stored that isn't on the public URL the user pasted

---

## 4. Performance & cost

- [ ] Cold load < 1.5s on Chrome desktop / good network
- [ ] No requests to third-party domains besides:
  - `cdn.jsdelivr.net` (qrcode.js)
  - whichever event/profile host the user enters (server-side fetch)
- [ ] Each page load: ≤1 KV read per slug + ≤N reads for N participants on `/e/[slug]`
- [ ] `/screen` polls `/api/events` every 3s = 1200 reads/hr per open screen — within 100K/day free tier

---

## 5. Security & abuse

- [ ] No auth means anyone can add a profile to any event — **expected for v0.1, document this**
- [ ] Output escaping on every server-rendered field (see `escapeHtml` in all functions)
- [ ] `target="_blank"` links have `rel="noopener"`
- [ ] Server-side fetch uses a `User-Agent` and never follows redirects to local addresses (Cloudflare blocks this by default in Workers fetch)
- [ ] Future: rate-limit `/api/profiles` per IP (Cloudflare Turnstile or simple KV counter)

---

## 6. Known gaps / non-goals (v0.1)

- ❌ No authentication — anyone can join any event
- ❌ No DMs/chat — listed in roadmap
- ❌ No moderation / participant removal
- ❌ LinkedIn often blocks scrapers — name/bio may be empty
- ❌ Luma sometimes serves JS-only pages; description may be sparse
- ❌ No image hosting — we use whatever the source OG image is

---

## 7. Test data

Reference event used during the hackathon demo:

- **Event URL:** `https://cerebralvalley.ai/e/genspark-meetup-seoul`
- **Expected slug:** `genspark-meetup-seoul`
- **Expected title:** `Genspark Meetup Seoul`

Sample profile URLs you can use:

- GitHub: `https://github.com/torvalds` (avatar + bio populate)
- GitHub: `https://github.com/sindresorhus`
- Personal site: any OG-tagged blog
- LinkedIn: usually returns just the title — fine for testing the empty-bio branch
