// POST /api/events  { eventUrl, hostProfile?, followupUrl?, followupLabel?, joinAutoApproveUntil? }
// GET  /api/events?slug=xxx
// POST /api/events?action=membership  { slug, profileId, op, hostToken }

export async function onRequestPost(ctx) {
  const url = new URL(ctx.request.url);
  if (url.searchParams.get('action') === 'membership') {
    return handleMembershipUpdate(ctx);
  }
  return handleEventUpsert(ctx);
}

async function handleEventUpsert({ request, env }) {
  try {
    const { eventUrl, hostProfile, followupUrl, followupLabel, joinAutoApproveUntil } = await request.json();
    if (!eventUrl) return json({ error: 'eventUrl required' }, 400);

    const normalizedEventUrl = normalizeUrl(eventUrl);
    const parsed = await parseEventUrl(normalizedEventUrl);
    const slug = parsed.slug || slugifyFromUrl(normalizedEventUrl);

    const existing = await env.EVENTS.get(`event:${slug}`);
    let event;
    if (existing) {
      event = JSON.parse(existing);
      if (hostProfile) event.hostProfileUrl = normalizeOptionalUrl(hostProfile);
      if (followupUrl) event.followupUrl = normalizeOptionalUrl(followupUrl);
      if (followupLabel) event.followupLabel = String(followupLabel).trim();
      if (joinAutoApproveUntil) event.joinAutoApproveUntil = normalizeJoinDeadline(joinAutoApproveUntil);
      if (!event.hostToken) event.hostToken = generateHostToken();
      event.updatedAt = new Date().toISOString();
      await env.EVENTS.put(`event:${slug}`, JSON.stringify(event));
    } else {
      event = {
        slug,
        title: parsed.title,
        description: parsed.description,
        date: parsed.date,
        location: parsed.location,
        source: parsed.source,
        sourceUrl: normalizedEventUrl,
        image: parsed.image,
        hostProfileUrl: normalizeOptionalUrl(hostProfile),
        followupUrl: normalizeOptionalUrl(followupUrl),
        followupLabel: cleanOptionalText(followupLabel),
        joinAutoApproveUntil: normalizeJoinDeadline(joinAutoApproveUntil || defaultJoinDeadline(parsed.date)),
        hostToken: generateHostToken(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        participantIds: [],
      };
      await env.EVENTS.put(`event:${slug}`, JSON.stringify(event));
    }

    return json({ slug, event, hostLink: `/e/${slug}?host=${encodeURIComponent(event.hostToken)}` });
  } catch (e) {
    return json({ error: e.message || 'Server error' }, 500);
  }
}

async function handleMembershipUpdate({ request, env }) {
  try {
    const { slug, profileId, op, hostToken } = await request.json();
    if (!slug || !profileId || !op || !hostToken) return json({ error: 'slug + profileId + op + hostToken required' }, 400);

    const eventRaw = await env.EVENTS.get(`event:${slug}`);
    if (!eventRaw) return json({ error: 'event not found' }, 404);
    const event = JSON.parse(eventRaw);
    if (!event.hostToken || event.hostToken !== hostToken) return json({ error: 'forbidden' }, 403);

    const profileRaw = await env.PROFILES.get(`profile:${profileId}`);
    if (!profileRaw) return json({ error: 'profile not found' }, 404);
    const profile = JSON.parse(profileRaw);
    const membership = ensureMembership(profile, slug);
    const now = new Date().toISOString();

    if (op === 'approve') membership.joinState = 'approved';
    else if (op === 'hide') membership.joinState = 'hidden';
    else if (op === 'pending') membership.joinState = 'pending';
    else return json({ error: 'unsupported op' }, 400);

    membership.updatedAt = now;
    profile.updatedAt = now;
    await env.PROFILES.put(`profile:${profileId}`, JSON.stringify(profile));

    return json({ ok: true, profileId, joinState: membership.joinState });
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

function normalizeUrl(url) {
  const value = String(url || '').trim();
  if (!value) throw new Error('eventUrl required');
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

function normalizeOptionalUrl(url) {
  const value = String(url || '').trim();
  if (!value) return null;
  return normalizeUrl(value);
}

function cleanOptionalText(value) {
  const text = String(value || '').trim();
  return text || null;
}

function normalizeJoinDeadline(value) {
  const iso = new Date(value).toISOString();
  if (iso === 'Invalid Date') throw new Error('invalid joinAutoApproveUntil');
  return iso;
}

function defaultJoinDeadline(eventDate) {
  const base = eventDate ? new Date(eventDate) : new Date();
  if (Number.isNaN(base.getTime())) return new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const utc = new Date(base.getTime() + 9 * 60 * 60 * 1000);
  utc.setUTCHours(23, 59, 59, 999);
  return utc.toISOString();
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

function generateHostToken() {
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

function ensureMembership(profile, slug) {
  if (!profile.memberships) profile.memberships = {};
  if (!profile.memberships[slug]) {
    profile.memberships[slug] = {
      joinedAt: null,
      updatedAt: null,
      joinState: 'pending',
      joinSource: 'direct',
    };
  }
  return profile.memberships[slug];
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
