// Event page — participant grid, persists after the event
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

  const baseUrl = new URL(request.url).origin;
  const joinUrl = `${baseUrl}/e/${slug}/join`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${escapeHtml(event.title)} · aftermeet</title>
<meta property="og:title" content="${escapeHtml(event.title)} · aftermeet" />
<meta property="og:description" content="${escapeHtml(event.description || 'Stay connected after the meet.')}" />
<script src="https://cdn.tailwindcss.com"></script>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Inter', system-ui, sans-serif; }
  .grad { background: radial-gradient(circle at top, #1e1b4b 0%, #0f172a 50%, #000 100%); }
</style>
</head>
<body class="grad text-white min-h-screen">
<nav class="px-6 py-4 flex justify-between items-center max-w-6xl mx-auto">
  <a href="/" class="font-bold text-xl">🤝 aftermeet</a>
  <div class="flex gap-2">
    <a href="/e/${slug}/screen" class="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-full text-sm">📺 Screen mode</a>
    <a href="/e/${slug}/join" class="px-4 py-2 bg-violet-500 hover:bg-violet-400 rounded-full text-sm font-medium">+ Join</a>
  </div>
</nav>

<header class="max-w-5xl mx-auto px-6 pt-6 pb-10">
  <div class="text-xs uppercase tracking-widest text-violet-300 mb-2">${escapeHtml(event.source)}</div>
  <h1 class="text-4xl md:text-5xl font-extrabold mb-3">${escapeHtml(event.title)}</h1>
  ${event.description ? `<p class="text-slate-300 max-w-3xl mb-4">${escapeHtml(event.description)}</p>` : ''}
  <div class="flex flex-wrap gap-4 text-sm text-slate-400">
    ${event.location ? `<span>📍 ${escapeHtml(event.location)}</span>` : ''}
    ${event.date ? `<span>📅 ${escapeHtml(formatDate(event.date))}</span>` : ''}
    <span>👥 ${participants.length} connected</span>
    <a href="${escapeAttr(event.sourceUrl)}" class="underline" target="_blank">Original event ↗</a>
  </div>
</header>

<main class="max-w-5xl mx-auto px-6 pb-24">
  ${participants.length === 0 ? `
    <div class="text-center py-20 bg-white/5 border border-white/10 rounded-2xl">
      <div class="text-5xl mb-4">📭</div>
      <p class="text-slate-300 text-xl mb-2">No one's joined yet</p>
      <p class="text-slate-500 mb-6">Share the QR or this link to start collecting profiles.</p>
      <a href="/e/${slug}/screen" class="inline-block px-6 py-3 bg-violet-500 hover:bg-violet-400 rounded-full font-semibold">
        Open big-screen QR →
      </a>
    </div>
  ` : `
    <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      ${participants.map(renderCard).join('')}
    </div>
  `}
</main>

<footer class="max-w-5xl mx-auto px-6 pb-12 text-center text-slate-500 text-sm">
  Event page persists. Bookmark it. The meet doesn't end after the meet. 🤝
</footer>
</body>
</html>`;

  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

function renderCard(p) {
  const platformIcon = {
    linkedin: '💼', x: '𝕏', github: '🐙', threads: '🧵', web: '🌐'
  }[p.platform] || '🔗';
  return `
    <a href="${escapeAttr(p.url)}" target="_blank" class="group bg-white/5 hover:bg-white/10 border border-white/10 hover:border-violet-400/50 rounded-2xl p-4 transition block">
      ${p.avatar ? `
        <img src="${escapeAttr(p.avatar)}" alt="" class="w-16 h-16 rounded-full mb-3 object-cover bg-white/10" loading="lazy" onerror="this.style.display='none'" />
      ` : `
        <div class="w-16 h-16 rounded-full mb-3 bg-violet-500/30 flex items-center justify-center text-2xl font-bold">
          ${escapeHtml((p.name || '?')[0].toUpperCase())}
        </div>
      `}
      <div class="font-semibold truncate">${escapeHtml(p.name || 'Anonymous')}</div>
      ${p.title ? `<div class="text-xs text-slate-400 truncate">${escapeHtml(p.title)}</div>` : ''}
      ${p.note ? `<div class="text-xs text-violet-300 mt-1 line-clamp-2">${escapeHtml(p.note)}</div>` : ''}
      <div class="text-xs text-slate-500 mt-2">${platformIcon} ${escapeHtml(p.platform)}</div>
    </a>
  `;
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
function escapeAttr(s) {
  return escapeHtml(s);
}
