// POST /api/events  { eventUrl, hostProfile? }
// GET  /api/events?slug=xxx

export async function onRequestPost({ request, env }) {
  try {
    const { eventUrl, hostProfile } = await request.json();
    if (!eventUrl) return json({ error: 'eventUrl required' }, 400);

    const parsed = await parseEventUrl(eventUrl);
    const slug = parsed.slug || slugifyFromUrl(eventUrl);

    // Check existing
    const existing = await env.EVENTS.get(`event:${slug}`);
    let event;
    if (existing) {
      event = JSON.parse(existing);
    } else {
      event = {
        slug,
        title: parsed.title,
        description: parsed.description,
        date: parsed.date,
        location: parsed.location,
        source: parsed.source,
        sourceUrl: eventUrl,
        image: parsed.image,
        hostProfileUrl: hostProfile || null,
        createdAt: new Date().toISOString(),
        participantIds: [],
      };
      await env.EVENTS.put(`event:${slug}`, JSON.stringify(event));
    }

    return json({ slug, event });
  } catch (e) {
    return json({ error: e.message || 'Server error' }, 500);
  }
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const slug = url.searchParams.get('slug');
  if (!slug) return json({ error: 'slug required' }, 400);
  const raw = await env.EVENTS.get(`event:${slug}`);
  if (!raw) return json({ error: 'not found' }, 404);
  const event = JSON.parse(raw);
  // Hydrate participants
  const participants = [];
  for (const pid of event.participantIds || []) {
    const p = await env.PROFILES.get(`profile:${pid}`);
    if (p) participants.push(JSON.parse(p));
  }
  return json({ event, participants });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}

function slugifyFromUrl(url) {
  try {
    const u = new URL(url);
    const parts = u.pathname.split('/').filter(Boolean);
    return parts[parts.length - 1] || 'event-' + Math.random().toString(36).slice(2, 8);
  } catch {
    return 'event-' + Math.random().toString(36).slice(2, 8);
  }
}

async function parseEventUrl(url) {
  const u = new URL(url);
  const html = await fetchHtml(url);
  const source = detectSource(u);
  const meta = extractMeta(html);
  const slug = u.pathname.split('/').filter(Boolean).pop() || null;
  return {
    slug,
    source,
    title: meta.title || 'Untitled Event',
    description: meta.description || '',
    image: meta.image || null,
    date: meta.date || null,
    location: meta.location || null,
  };
}

function detectSource(u) {
  if (u.hostname.includes('cerebralvalley')) return 'cerebralvalley';
  if (u.hostname.includes('lu.ma') || u.hostname.includes('luma')) return 'luma';
  return 'web';
}

async function fetchHtml(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; aftermeet/1.0; +https://aftermeet.tmcowork.com)',
      'Accept': 'text/html,application/xhtml+xml',
    },
    cf: { cacheTtl: 300 },
  });
  if (!res.ok) throw new Error(`Failed to fetch event page (${res.status})`);
  return await res.text();
}

function extractMeta(html) {
  const get = (re) => {
    const m = html.match(re);
    return m ? decodeHtml(m[1]) : null;
  };
  const title =
    get(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) ||
    get(/<meta[^>]+name=["']twitter:title["'][^>]+content=["']([^"']+)["']/i) ||
    get(/<title>([^<]+)<\/title>/i);
  const description =
    get(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i) ||
    get(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i);
  const image =
    get(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
    get(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i);

  // JSON-LD for date/location
  let date = null, location = null;
  const ldMatches = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for (const m of ldMatches) {
    try {
      const obj = JSON.parse(m[1]);
      const arr = Array.isArray(obj) ? obj : [obj];
      for (const item of arr) {
        if (item['@type'] === 'Event' || (Array.isArray(item['@type']) && item['@type'].includes('Event'))) {
          date = item.startDate || date;
          if (item.location) {
            location = typeof item.location === 'string' ? item.location :
              (item.location.name || item.location.address?.streetAddress || null);
          }
        }
      }
    } catch {}
  }

  return { title, description, image, date, location };
}

function decodeHtml(s) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'");
}
