export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const token = url.searchParams.get('token') || '';
  const authed = Boolean(token && env.ADMIN_TOKEN && token === env.ADMIN_TOKEN);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>aftermeet admin</title>
<link rel="stylesheet" href="/style.css" />
<style>
  main { max-width: 1100px; margin: 0 auto; padding: 40px 28px 80px; }
  .toolbar { display:flex; gap:10px; flex-wrap:wrap; margin: 18px 0 24px; }
  .events { display:grid; gap:12px; }
  .event { display:flex; justify-content:space-between; gap:16px; align-items:flex-start; }
  .meta { min-width:0; }
  .meta strong { display:block; font-size:16px; }
  .meta .sub { margin-top:6px; font-size:12px; color: var(--text-dim); word-break: break-all; }
  .actions { display:flex; gap:8px; flex-wrap:wrap; justify-content:flex-end; }
  .login { max-width: 420px; margin: 80px auto; }
</style>
</head>
<body>
<nav class="nav">
  <a href="/" class="brand"><span class="brand-dot"></span>aftermeet</a>
</nav>
<main>
  ${authed ? `
    <div class="eyebrow">OPERATOR MODE</div>
    <h1 class="heading">Event control</h1>
    <p class="muted">Hide, archive, restore, and inspect live events.</p>
    <div class="toolbar">
      <button class="btn btn-ghost btn-sm" id="reloadBtn">Reload</button>
    </div>
    <div id="events" class="events"></div>
  ` : `
    <div class="login card-flat">
      <div class="eyebrow">OPERATOR MODE</div>
      <h1 class="heading">Admin access</h1>
      <p class="muted">Open this page with <span class="mono">?token=...</span>.</p>
    </div>
  `}
</main>
${authed ? `<script>
const token = ${JSON.stringify(token)};
const eventsEl = document.getElementById('events');
document.getElementById('reloadBtn').addEventListener('click', load);
async function load() {
  eventsEl.innerHTML = '<div class="card-flat muted">Loading…</div>';
  const r = await fetch('/api/admin/events?token=' + encodeURIComponent(token));
  const d = await r.json();
  if (!r.ok) {
    eventsEl.innerHTML = '<div class="card-flat">' + escapeHtml(d.error || 'Failed') + '</div>';
    return;
  }
  eventsEl.innerHTML = d.events.map(renderEvent).join('') || '<div class="card-flat muted">No events</div>';
  bind();
}
function renderEvent(event) {
  return '<div class="card-flat event" data-slug="'+escapeHtml(event.slug)+'">'
    + '<div class="meta">'
    + '<strong>' + escapeHtml(event.title) + '</strong>'
    + '<div class="status-badges">'
    + '<span class="chip">' + escapeHtml(event.status) + '</span>'
    + '<span class="chip">' + escapeHtml(event.source) + '</span>'
    + '<span class="chip">' + escapeHtml(String(event.participantCount)) + ' joined</span>'
    + '<span class="chip">' + escapeHtml(String(event.pendingCount)) + ' pending</span>'
    + '</div>'
    + '<div class="sub">' + escapeHtml(event.slug) + ' · ' + escapeHtml(event.sourceHost || '') + '</div>'
    + '<div class="sub">' + escapeHtml(event.sourceUrl || '') + '</div>'
    + '</div>'
    + '<div class="actions">'
    + '<a class="btn btn-ghost btn-sm" href="/e/' + encodeURIComponent(event.slug) + '" target="_blank">Open</a>'
    + '<a class="btn btn-ghost btn-sm" href="' + escapeHtml(event.hostLink) + '" target="_blank">Host</a>'
    + '<button class="btn btn-ghost btn-sm" data-op="hide">Hide</button>'
    + '<button class="btn btn-ghost btn-sm" data-op="archive">Archive</button>'
    + '<button class="btn btn-primary btn-sm" data-op="restore">Restore</button>'
    + '<button class="btn btn-ghost btn-sm" data-op="rotate_host_token">Rotate host link</button>'
    + '</div>'
    + '</div>';
}
function bind() {
  for (const btn of document.querySelectorAll('[data-op]')) {
    btn.onclick = async () => {
      const card = btn.closest('[data-slug]');
      const slug = card.getAttribute('data-slug');
      const op = btn.getAttribute('data-op');
      btn.disabled = true;
      const r = await fetch('/api/admin/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, slug, op })
      });
      const d = await r.json();
      if (!r.ok) {
        alert(d.error || 'Failed');
        btn.disabled = false;
        return;
      }
      if (op === 'rotate_host_token' && d.hostLink) {
        try { await navigator.clipboard.writeText(location.origin + d.hostLink); } catch {}
      }
      load();
    };
  }
}
function escapeHtml(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
load();
</script>` : ''}
</body>
</html>`;

  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}
