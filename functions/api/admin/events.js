export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  if (!isAdmin(url.searchParams.get('token'), env)) return forbidden();

  const list = await env.EVENTS.list({ prefix: 'event:' });
  const events = [];

  for (const key of list.keys) {
    const raw = await env.EVENTS.get(key.name);
    if (!raw) continue;
    const event = JSON.parse(raw);
    const participantIds = event.participantIds || [];
    let pendingCount = 0;
    for (const pid of participantIds) {
      const p = await env.PROFILES.get(`profile:${pid}`);
      if (!p) continue;
      const profile = JSON.parse(p);
      const state = profile.memberships?.[event.slug]?.joinState || (Array.isArray(profile.events) && profile.events.includes(event.slug) ? 'approved' : 'pending');
      if (state === 'pending') pendingCount++;
    }

    events.push({
      slug: event.slug,
      title: event.title || event.slug,
      status: event.status || 'active',
      source: event.source || 'web',
      sourceHost: event.sourceHost || safeHost(event.sourceUrl),
      sourceUrl: event.sourceUrl || '',
      participantCount: participantIds.length,
      pendingCount,
      createdAt: event.createdAt || null,
      followupUrl: event.followupUrl || null,
      hostLink: `/e/${event.slug}?host=${encodeURIComponent(event.hostToken || '')}`,
    });
  }

  events.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  return json({ events });
}

export async function onRequestPost({ request, env }) {
  const { token, slug, op } = await request.json();
  if (!isAdmin(token, env)) return forbidden();
  if (!slug || !op) return json({ error: 'slug + op required' }, 400);

  const raw = await env.EVENTS.get(`event:${slug}`);
  if (!raw) return json({ error: 'event not found' }, 404);
  const event = JSON.parse(raw);

  if (op === 'hide') event.status = 'hidden';
  else if (op === 'archive') event.status = 'archived';
  else if (op === 'restore') event.status = 'active';
  else if (op === 'rotate_host_token') event.hostToken = generateHostToken();
  else return json({ error: 'unsupported op' }, 400);

  event.updatedAt = new Date().toISOString();
  await env.EVENTS.put(`event:${slug}`, JSON.stringify(event));

  return json({ ok: true, slug, status: event.status || 'active', hostLink: `/e/${event.slug}?host=${encodeURIComponent(event.hostToken || '')}` });
}

function isAdmin(token, env) {
  return Boolean(token && env.ADMIN_TOKEN && token === env.ADMIN_TOKEN);
}

function forbidden() {
  return json({ error: 'forbidden' }, 403);
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}

function safeHost(url) {
  try { return new URL(url).hostname.toLowerCase(); } catch { return ''; }
}

function generateHostToken() {
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}
