// Big-screen QR page for hosts to project
export async function onRequestGet({ params, env, request }) {
  const slug = params.slug;
  const raw = await env.EVENTS.get(`event:${slug}`);
  if (!raw) return new Response('Event not found', { status: 404 });
  const event = JSON.parse(raw);

  const baseUrl = new URL(request.url).origin;
  const joinUrl = `${baseUrl}/e/${slug}/join`;

  const participantCount = (event.participantIds || []).length;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${escapeHtml(event.title)} · aftermeet</title>
<script src="https://cdn.tailwindcss.com"></script>
<script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js"></script>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Inter', system-ui, sans-serif; }
  .grad { background: radial-gradient(circle at top, #1e1b4b 0%, #0f172a 50%, #000 100%); }
  .pulse { animation: pulse 2s ease-in-out infinite; }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.6} }
</style>
</head>
<body class="grad text-white min-h-screen flex flex-col items-center justify-center p-8">
<div class="text-center mb-6">
  <div class="text-xs uppercase tracking-widest text-violet-300 mb-2">aftermeet · ${escapeHtml(event.source)}</div>
  <h1 class="text-5xl md:text-6xl font-extrabold mb-2">${escapeHtml(event.title)}</h1>
  ${event.location ? `<p class="text-slate-400 text-xl">${escapeHtml(event.location)}</p>` : ''}
</div>

<div class="bg-white p-8 rounded-3xl shadow-2xl mb-6">
  <canvas id="qr" width="420" height="420"></canvas>
</div>

<p class="text-2xl text-slate-200 mb-2">📱 Scan to join</p>
<p class="text-slate-400 mb-8 text-sm font-mono">${joinUrl}</p>

<div class="bg-white/10 backdrop-blur px-6 py-3 rounded-full text-lg">
  <span class="pulse">🟢</span>
  <span id="count">${participantCount}</span> connected
</div>

<a href="/e/${slug}" class="mt-8 text-slate-400 underline text-sm">View participant list →</a>

<script>
QRCode.toCanvas(document.getElementById('qr'), ${JSON.stringify(joinUrl)}, {
  width: 420,
  margin: 1,
  color: { dark: '#000', light: '#fff' }
});

// Live participant count
async function refresh() {
  try {
    const r = await fetch('/api/events?slug=${slug}');
    if (r.ok) {
      const d = await r.json();
      document.getElementById('count').textContent = (d.event.participantIds || []).length;
    }
  } catch {}
}
setInterval(refresh, 3000);
</script>
</body>
</html>`;
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

function escapeHtml(s) {
  if (!s) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
