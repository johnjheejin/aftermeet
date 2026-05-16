// Event page — persistent participant grid
export async function onRequestGet({ params, env, request }) {
  const slug = params.slug;
  const raw = await env.EVENTS.get(`event:${slug}`);
  if (!raw) return new Response('Event not found', { status: 404 });
  const event = JSON.parse(raw);

  const participants = [];
  for (const pid of event.participantIds || []) {
    const p = await env.PROFILES.get(`profile:${pid}`);
    if (p) participants.push(JSON.parse(p));
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${escapeHtml(event.title)} · aftermeet</title>
<meta property="og:title" content="${escapeHtml(event.title)} · aftermeet" />
<meta property="og:description" content="${escapeHtml(event.description || "The meet doesn't end after the meet.")}" />
<link rel="stylesheet" href="/style.css" />
<style>
  main { max-width: 1100px; margin: 0 auto; padding: 0 28px; }
  .ev-header { padding: 32px 0 40px; }
  .ev-title { font-size: clamp(32px, 4.5vw, 56px); font-weight: 800; line-height: 1.05; letter-spacing: -0.035em; margin: 10px 0 12px; }
  .ev-desc { font-size: 16px; color: var(--text-muted); max-width: 720px; line-height: 1.55; margin-bottom: 18px; }
  .meta-row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
  .empty { text-align: center; padding: 60px 24px; border: 1px dashed var(--border); border-radius: 20px; }
  .empty h3 { font-size: 22px; font-weight: 700; letter-spacing: -0.02em; margin: 8px 0 6px; }
  .empty p { color: var(--text-muted); margin-bottom: 22px; }
  .section-head { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 18px; }
  .section-head h2 { font-size: 20px; font-weight: 600; letter-spacing: -0.01em; }
  .section-head .count { font-size: 14px; color: var(--text-muted); }
  footer { padding: 60px 28px 40px; text-align: center; font-size: 13px; color: var(--text-dim); }
</style>
</head>
<body>

<nav class="nav">
  <a href="/" class="brand"><span class="brand-dot"></span>aftermeet</a>
  <div style="display:flex;gap:8px;align-items:center;">
    <a href="/e/${slug}/screen" class="btn btn-ghost btn-sm">📺 Screen</a>
    <a href="/e/${slug}/join" class="btn btn-primary btn-sm">+ Join</a>
  </div>
</nav>

<main>
  <header class="ev-header rise">
    <div class="eyebrow">${escapeHtml(event.source.toUpperCase())} · PERSISTENT</div>
    <h1 class="ev-title">${escapeHtml(event.title)}</h1>
    ${event.description ? `<p class="ev-desc">${escapeHtml(truncate(event.description, 220))}</p>` : ''}
    <div class="meta-row">
      ${event.location ? `<span class="chip">📍 ${escapeHtml(event.location)}</span>` : ''}
      ${event.date ? `<span class="chip">📅 ${escapeHtml(formatDate(event.date))}</span>` : ''}
      <span class="chip">👥 ${participants.length} ${participants.length === 1 ? 'person' : 'people'}</span>
      <a href="${escapeAttr(event.sourceUrl)}" target="_blank" class="chip" style="text-decoration:none;">Original ↗</a>
    </div>
  </header>

  ${participants.length === 0 ? `
    <div class="empty rise">
      <div style="font-size: 36px; margin-bottom: 8px;">📭</div>
      <h3>No one's joined yet</h3>
      <p>Share the QR or this link to start collecting profiles.</p>
      <a href="/e/${slug}/screen" class="btn btn-primary">Open big-screen QR →</a>
    </div>
  ` : `
    <section class="rise">
      <div class="section-head">
        <h2>Participants</h2>
        <div class="count">${participants.length} ${participants.length === 1 ? 'person' : 'people'}</div>
      </div>
      <div class="grid-people rise-stagger">
        ${participants.map(renderCard).join('')}
      </div>
    </section>
  `}
</main>

<footer>
  This page persists. Bookmark it. <span class="dim">The meet doesn't end after the meet.</span>
</footer>

</body>
</html>`;

  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

function renderCard(p) {
  const platformIcon = { linkedin: '𝐢𝐧', x: '𝕏', github: '◉', threads: '@', web: '🌐' }[p.platform] || '🔗';
  const initial = ((p.name || '?')[0] || '?').toUpperCase();
  return `
    <a class="person" href="${escapeAttr(p.url)}" target="_blank" rel="noopener">
      ${p.avatar ? `
        <img class="person-avatar" src="${escapeAttr(p.avatar)}" alt="" loading="lazy" onerror="this.outerHTML='<div class=\\'person-avatar\\'>${initial}</div>'" />
      ` : `
        <div class="person-avatar">${initial}</div>
      `}
      <div class="person-name">${escapeHtml(p.name || 'Anonymous')}</div>
      ${p.title ? `<div class="person-title">${escapeHtml(p.title)}</div>` : ''}
      ${p.note ? `<div class="person-note">${escapeHtml(p.note)}</div>` : ''}
      <div class="person-platform"><span>${platformIcon}</span><span>${escapeHtml(p.platform)}</span></div>
    </a>
  `;
}

function truncate(s, n) {
  if (!s) return '';
  return s.length > n ? s.slice(0, n).trim() + '…' : s;
}

function formatDate(s) {
  try {
    const d = new Date(s);
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  } catch { return s; }
}

function escapeHtml(s) {
  if (!s) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function escapeAttr(s) { return escapeHtml(s); }
