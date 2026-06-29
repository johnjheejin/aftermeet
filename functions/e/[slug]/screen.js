// Big-screen QR page — designed to project at events
import { detectLocale, t } from '../../_lib/i18n.js';

export async function onRequestGet({ params, env, request }) {
  const slug = params.slug;
  const raw = await env.EVENTS.get(`event:${slug}`);
  if (!raw) return new Response('Event not found', { status: 404 });
  const event = JSON.parse(raw);
  const L = detectLocale(request);
  const pageUrl = new URL(request.url);
  const hostToken = pageUrl.searchParams.get('host') || '';
  const isHost = Boolean(hostToken && event.hostToken && hostToken === event.hostToken);

  const baseUrl = pageUrl.origin;
  const joinUrl = `${baseUrl}/e/${slug}/join?source=screen${isHost ? `&host=${encodeURIComponent(hostToken)}` : ''}`;
  const count = (event.participantIds || []).length;

  const S = {
    live: t(L, { ko: '진행중', en: 'LIVE' }),
    scan: t(L, { ko: '📱 QR을 스캔하세요', en: '📱 Scan to join' }),
    connected: t(L, { ko: '명 연결됨', en: 'connected' }),
    seeAll: t(L, { ko: '참여자 보기 →', en: 'See participants →' }),
    hostBack: t(L, { ko: '호스트 페이지로 →', en: 'Back to event →' }),
  };

  const html = `<!DOCTYPE html>
<html lang="${L}">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${escapeHtml(event.title)} · aftermeet</title>
<link rel="stylesheet" href="/style.css" />
<style>
  html, body { height: 100%; overflow: hidden; }
  .screen { min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 32px; gap: 28px; }
  .ev-head { text-align: center; max-width: 1000px; }
  .ev-title { font-size: clamp(40px, 6vw, 72px); font-weight: 800; line-height: 1.05; letter-spacing: -0.035em; margin: 12px 0 8px; }
  .ev-loc { font-size: 18px; color: var(--text-muted); }
  .qr-wrap { background: white; padding: 28px; border-radius: 32px; box-shadow: 0 0 100px -10px var(--accent-glow), 0 0 0 1px rgba(230,126,92,0.25); }
  .scan-cta { font-size: clamp(20px, 2vw, 28px); color: var(--text); }
  .url { font-family: ui-monospace, monospace; color: var(--text-muted); font-size: 16px; }
  .live-pill { font-size: 16px; padding: 10px 18px; }
  .live-num { font-size: 22px; font-weight: 700; color: var(--accent-hi); margin: 0 4px; }
  .footer-link { position: fixed; bottom: 20px; right: 24px; font-size: 12px; color: var(--text-dim); text-decoration: none; }
  .footer-link:hover { color: var(--text-muted); }
  .footer-link.left { right: auto; left: 24px; }
  .top-brand { position: fixed; top: 20px; left: 24px; }
</style>
</head>
<body>
<a href="/" class="brand top-brand"><span class="brand-dot"></span>aftermeet</a>

<div class="screen rise-stagger">
  <div class="ev-head">
    <div class="eyebrow">${escapeHtml(event.source.toUpperCase())} · ${escapeHtml(S.live)}</div>
    <h1 class="ev-title">${escapeHtml(event.title)}</h1>
    ${event.location ? `<p class="ev-loc">📍 ${escapeHtml(event.location)}</p>` : ''}
  </div>

  <div class="qr-wrap">
    <img id="qr" width="420" height="420"
         alt="QR code to join"
         src="https://api.qrserver.com/v1/create-qr-code/?size=420x420&margin=8&data=${encodeURIComponent(joinUrl)}" />
  </div>

  <div style="text-align:center;display:flex;flex-direction:column;align-items:center;gap:8px;">
    <p class="scan-cta">${escapeHtml(S.scan)}</p>
    <p class="url">${escapeHtml(joinUrl.replace(/^https?:\/\//, ''))}</p>
  </div>

  <div class="chip chip-live live-pill">
    <span class="dot-live"></span>
    <span class="live-num" id="count">${count}</span>
    <span>${escapeHtml(S.connected)}</span>
  </div>
</div>

<a href="/e/${slug}${isHost ? `?host=${encodeURIComponent(hostToken)}` : ''}" class="footer-link left">${escapeHtml(S.hostBack)}</a>
<a href="/e/${slug}${isHost ? `?host=${encodeURIComponent(hostToken)}` : ''}" class="footer-link">${escapeHtml(S.seeAll)}</a>

<script>
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

  const headers = { 'Content-Type': 'text/html; charset=utf-8' };
  if (pageUrl.searchParams.get('lang') === 'ko' || pageUrl.searchParams.get('lang') === 'en') {
    headers['Set-Cookie'] = `aftermeet_lang=${pageUrl.searchParams.get('lang')}; Path=/; Max-Age=31536000; SameSite=Lax`;
  }
  return new Response(html, { headers });
}

function escapeHtml(s) {
  if (!s) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
