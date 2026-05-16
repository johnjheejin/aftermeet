# 🤝 aftermeet

> The meet doesn't end after the meet.

QR-based event networking that persists. Hosts paste a Luma/Cerebral Valley URL → big-screen QR appears → attendees scan, paste their profile link, and they're in. Event page lives on forever so people can stay connected after the lights go down.

Built at a hackathon in Seoul. Demo target: [Genspark Meetup Seoul](https://cerebralvalley.ai/e/genspark-meetup-seoul).

## Stack

- **Cloudflare Pages** + **Pages Functions** (edge runtime)
- **Cloudflare KV** for events & profiles
- **Tailwind CDN** + vanilla JS (no build step — ship fast)
- **qrcode.js** for QR generation

## Pages

- `/` — Landing
- `/host` — Host creates an event from a Luma/CV URL
- `/e/[slug]` — Persistent event page with participant grid
- `/e/[slug]/screen` — Big-screen QR for projector (live participant count)
- `/e/[slug]/join` — Mobile join page (paste profile link)

## API

- `POST /api/events` — Create/upsert event from URL (scrapes OG tags + JSON-LD)
- `GET /api/events?slug=...` — Fetch event + participants
- `POST /api/profiles` — Add a profile to an event (auto-parses LinkedIn/X/GitHub/personal sites via OG tags; GitHub uses public API)

## Local dev

```bash
npm install
# Create KV namespaces (one-time)
wrangler kv namespace create EVENTS
wrangler kv namespace create PROFILES
# Paste returned IDs into wrangler.toml

npm run dev
# Open http://localhost:8788
```

## Deploy

```bash
npm run deploy
# Then in Cloudflare dashboard: Pages → aftermeet → Custom domains
# Add: aftermeet.tmcowork.com
```

## Roadmap (post-hackathon)

- [ ] DMs between participants
- [ ] Group chat per event
- [ ] Re-import event for refreshed details
- [ ] LinkedIn-friendly profile parsing (LinkedIn blocks scrapers — needs OAuth)
- [ ] "I want to follow up with X" reminders
- [ ] Multi-event profile (your aftermeet identity across events you've attended)

## License

MIT
