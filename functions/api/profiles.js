// POST /api/profiles  { eventSlug, profileUrl, displayName?, note?, joinSource? }

export async function onRequestPost({ request, env }) {
  try {
    const { eventSlug, profileUrl, displayName, note, joinSource } = await request.json();
    if (!eventSlug || !profileUrl) return json({ error: 'eventSlug + profileUrl required' }, 400);

    const eventRaw = await env.EVENTS.get(`event:${eventSlug}`);
    if (!eventRaw) return json({ error: 'event not found' }, 404);
    const event = JSON.parse(eventRaw);

    const rawUrl = normalizeInputUrl(profileUrl);
    const canonicalUrl = canonicalizeProfileUrl(rawUrl);
    const profileId = hashId(canonicalUrl);

    let profile = await findExistingProfile(env, event, rawUrl, canonicalUrl, profileId);
    const now = new Date().toISOString();
    const autoApprove = isAutoApproveOpen(event, now);

    if (profile) {
      profile.id = profileId;
      profile.url = profile.url || rawUrl;
      profile.canonicalUrl = canonicalUrl;
      if (displayName) profile.name = displayName;
      if (note) profile.note = note;
      if (!profile.platform) profile.platform = detectPlatform(canonicalUrl);
      if (!Array.isArray(profile.events)) profile.events = [];
      if (!profile.events.includes(eventSlug)) profile.events.push(eventSlug);
      if (!profile.memberships) profile.memberships = {};

      const membership = ensureMembership(profile, eventSlug);
      const alreadyJoined = Boolean(membership.joinedAt);
      if (!alreadyJoined) membership.joinedAt = now;
      membership.joinState = alreadyJoined ? membership.joinState : (autoApprove ? 'approved' : 'pending');
      membership.joinSource = normalizeJoinSource(joinSource);
      membership.updatedAt = now;
      profile.updatedAt = now;

      await env.PROFILES.put(`profile:${profileId}`, JSON.stringify(profile));
      if (!event.participantIds.includes(profileId)) {
        event.participantIds.push(profileId);
        event.updatedAt = now;
        await env.EVENTS.put(`event:${eventSlug}`, JSON.stringify(event));
      }

      return json({ profile, eventSlug, joinStatus: alreadyJoined ? 'already_joined' : 'joined', joinState: membership.joinState });
    }

    const parsed = await parseProfile(canonicalUrl);
    profile = {
      id: profileId,
      url: rawUrl,
      canonicalUrl,
      name: displayName || parsed.name || extractHandle(canonicalUrl),
      title: parsed.title || '',
      bio: parsed.bio || '',
      avatar: parsed.avatar || null,
      platform: parsed.platform,
      note: note || '',
      createdAt: now,
      updatedAt: now,
      events: [eventSlug],
      memberships: {
        [eventSlug]: {
          joinedAt: now,
          updatedAt: now,
          joinState: autoApprove ? 'approved' : 'pending',
          joinSource: normalizeJoinSource(joinSource),
        }
      },
    };

    await env.PROFILES.put(`profile:${profileId}`, JSON.stringify(profile));

    if (!event.participantIds.includes(profileId)) {
      event.participantIds.push(profileId);
      event.updatedAt = now;
      await env.EVENTS.put(`event:${eventSlug}`, JSON.stringify(event));
    }

    return json({ profile, eventSlug, joinStatus: 'joined', joinState: profile.memberships[eventSlug].joinState });
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

async function findExistingProfile(env, event, rawUrl, canonicalUrl, profileId) {
  const idsToTry = [profileId, hashId(rawUrl)];
  for (const id of idsToTry) {
    const existing = await env.PROFILES.get(`profile:${id}`);
    if (existing) return JSON.parse(existing);
  }

  for (const pid of event.participantIds || []) {
    const raw = await env.PROFILES.get(`profile:${pid}`);
    if (!raw) continue;
    const profile = JSON.parse(raw);
    const currentCanonical = canonicalizeProfileUrl(profile.canonicalUrl || profile.url || '');
    if (currentCanonical && currentCanonical === canonicalUrl) return profile;
  }

  return null;
}

function hashId(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36) + s.length.toString(36);
}

function normalizeInputUrl(url) {
  const value = String(url || '').trim();
  if (!value) throw new Error('profileUrl required');
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

function canonicalizeProfileUrl(url) {
  const u = new URL(normalizeInputUrl(url));
  let host = u.hostname.toLowerCase().replace(/^www\./, '');
  if (host === 'twitter.com' || host === 'mobile.twitter.com') host = 'x.com';
  if (host === 'm.facebook.com') host = 'facebook.com';

  let path = u.pathname.replace(/\/+$/, '') || '/';
  const parts = path.split('/').filter(Boolean);

  if (host === 'github.com' && parts[0]) {
    path = `/${parts[0].toLowerCase()}`;
  } else if (host === 'x.com' && parts[0]) {
    path = `/${parts[0].replace(/^@/, '').toLowerCase()}`;
  } else if (host.includes('linkedin.com')) {
    if (parts[0] === 'in' && parts[1]) path = `/in/${parts[1].toLowerCase()}`;
    else if (parts[0] === 'company' && parts[1]) path = `/company/${parts[1].toLowerCase()}`;
  } else if (host.includes('facebook.com')) {
    if (parts[0] === 'profile.php') {
      const id = u.searchParams.get('id');
      path = id ? `/profile.php?id=${id}` : '/profile.php';
    } else if (parts[0]) {
      path = `/${parts[0].toLowerCase()}`;
    }
  }

  return `https://${host}${path === '/' ? '' : path}`;
}

function extractHandle(url) {
  try {
    const u = new URL(url);
    if (u.pathname === '/profile.php' && u.searchParams.get('id')) return `facebook:${u.searchParams.get('id')}`;
    const parts = u.pathname.split('/').filter(Boolean);
    const handle = parts[parts.length - 1] || u.hostname;
    return prettifyHandle(handle);
  } catch {
    return url;
  }
}

function prettifyHandle(value) {
  const raw = String(value || '').replace(/^@/, '').trim();
  if (!raw) return raw;
  const spaced = raw
    .replace(/[._-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/(\D)(\d)/g, '$1 $2')
    .replace(/(\d)(\D)/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();
  return spaced
    .split(' ')
    .map((part) => part ? part[0].toUpperCase() + part.slice(1) : part)
    .join(' ');
}

function detectPlatform(url) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    if (host.includes('linkedin')) return 'linkedin';
    if (host.includes('twitter') || host === 'x.com') return 'x';
    if (host.includes('github')) return 'github';
    if (host.includes('threads')) return 'threads';
    if (host.includes('facebook') || host === 'fb.com') return 'facebook';
  } catch {}
  return 'web';
}

function normalizeJoinSource(joinSource) {
  return joinSource === 'screen' ? 'screen' : 'direct';
}

function isAutoApproveOpen(event, nowIso) {
  if (!event.joinAutoApproveUntil) return true;
  return new Date(nowIso).getTime() <= new Date(event.joinAutoApproveUntil).getTime();
}

function ensureMembership(profile, eventSlug) {
  if (!profile.memberships) profile.memberships = {};
  if (!profile.memberships[eventSlug]) {
    const fallbackApproved = Array.isArray(profile.events) && profile.events.includes(eventSlug);
    profile.memberships[eventSlug] = {
      joinedAt: null,
      updatedAt: null,
      joinState: fallbackApproved ? 'approved' : 'pending',
      joinSource: 'direct',
    };
  }
  return profile.memberships[eventSlug];
}

async function parseProfile(url) {
  const u = new URL(url);
  const platform = detectPlatform(url);

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
      return { platform, name: cleanName(name), title: '', bio, avatar };
    }
  } catch {}

  return { platform, name: null, title: '', bio: '', avatar: null };
}

function cleanName(n) {
  if (!n) return null;
  let s = String(n).trim();
  s = s.replace(/\s*\(@[^)]+\)\s*\/?\s*X?\s*$/, '');
  s = s.replace(/\s*[\|\u00B7·-]\s*(LinkedIn|GitHub|Overview|X|Twitter|Threads|Facebook)\s*$/i, '');
  s = s.replace(/\s*-\s*Overview\s*$/i, '');
  return s.trim() || null;
}

function decodeHtml(s) {
  return s
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#x27;/g, "'");
}
