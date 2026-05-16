// POST /api/profiles  { eventSlug, profileUrl, displayName?, note? }

export async function onRequestPost({ request, env }) {
  try {
    const { eventSlug, profileUrl, displayName, note } = await request.json();
    if (!eventSlug || !profileUrl) return json({ error: 'eventSlug + profileUrl required' }, 400);

    const eventRaw = await env.EVENTS.get(`event:${eventSlug}`);
    if (!eventRaw) return json({ error: 'event not found' }, 404);
    const event = JSON.parse(eventRaw);

    const profileId = hashId(profileUrl);
    const existing = await env.PROFILES.get(`profile:${profileId}`);
    let profile;
    if (existing) {
      profile = JSON.parse(existing);
    } else {
      const parsed = await parseProfile(profileUrl);
      profile = {
        id: profileId,
        url: profileUrl,
        name: displayName || parsed.name || extractHandle(profileUrl),
        title: parsed.title || '',
        bio: parsed.bio || '',
        avatar: parsed.avatar || null,
        platform: parsed.platform,
        note: note || '',
        createdAt: new Date().toISOString(),
        events: [],
      };
    }

    if (!profile.events.includes(eventSlug)) profile.events.push(eventSlug);
    await env.PROFILES.put(`profile:${profileId}`, JSON.stringify(profile));

    if (!event.participantIds.includes(profileId)) {
      event.participantIds.push(profileId);
      await env.EVENTS.put(`event:${eventSlug}`, JSON.stringify(event));
    }

    return json({ profile, eventSlug });
  } catch (e) {
    return json({ error: e.message || 'Server error' }, 500);
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}

function hashId(s) {
  // simple deterministic id from URL
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36) + s.length.toString(36);
}

function extractHandle(url) {
  try {
    const u = new URL(url);
    const parts = u.pathname.split('/').filter(Boolean);
    return parts[parts.length - 1] || u.hostname;
  } catch {
    return url;
  }
}

async function parseProfile(url) {
  const u = new URL(url);
  const host = u.hostname.replace('www.', '');
  let platform = 'web';
  if (host.includes('linkedin')) platform = 'linkedin';
  else if (host.includes('twitter') || host === 'x.com') platform = 'x';
  else if (host.includes('github')) platform = 'github';
  else if (host.includes('threads')) platform = 'threads';

  // GitHub has a proper API — way better than scraping
  if (platform === 'github') {
    const handle = u.pathname.split('/').filter(Boolean)[0];
    if (handle) {
      try {
        const r = await fetch(`https://api.github.com/users/${handle}`, {
          headers: {
            'User-Agent': 'aftermeet (+https://github.com/johnjheejin/aftermeet)',
            'Accept': 'application/vnd.github+json',
          },
          cf: { cacheTtl: 300 },
        });
        if (r.ok) {
          const d = await r.json();
          return {
            platform,
            name: d.name || d.login,
            title: d.company || '',
            bio: d.bio || '',
            avatar: d.avatar_url || null,
          };
        }
      } catch {}
    }
  }

  // Generic OG/meta scrape (works for personal sites, sometimes for X/LinkedIn public pages)
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; aftermeet-bot/1.0)',
        'Accept': 'text/html',
      },
      cf: { cacheTtl: 300 },
    });
    if (res.ok) {
      const html = await res.text();
      const get = (re) => {
        const m = html.match(re);
        return m ? decodeHtml(m[1]) : null;
      };
      const name =
        get(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) ||
        get(/<meta[^>]+name=["']twitter:title["'][^>]+content=["']([^"']+)["']/i) ||
        get(/<title>([^<]+)<\/title>/i);
      const bio =
        get(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i) ||
        get(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i);
      const avatar =
        get(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
        get(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i);
      return { platform, name: cleanName(name, platform), title: '', bio, avatar };
    }
  } catch {}

  return { platform, name: null, title: '', bio: '', avatar: null };
}

function cleanName(n, platform) {
  if (!n) return null;
  let s = String(n).trim();
  // Strip common platform-suffix junk:
  //  "Jane Doe (@jane) / X"  →  "Jane Doe"
  //  "Jane Doe | LinkedIn"   →  "Jane Doe"
  //  "torvalds - Overview"   →  "torvalds"   (GitHub OG title)
  //  "Jane Doe · GitHub"     →  "Jane Doe"
  s = s.replace(/\s*\(@[^)]+\)\s*\/?\s*X?\s*$/, '');
  s = s.replace(/\s*[\|\u00B7·-]\s*(LinkedIn|GitHub|Overview|X|Twitter|Threads)\s*$/i, '');
  s = s.replace(/\s*-\s*Overview\s*$/i, '');
  return s.trim() || null;
}

function decodeHtml(s) {
  return s
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#x27;/g, "'");
}
