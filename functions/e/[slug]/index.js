// Event page — persistent participant grid
import { detectLocale, t } from '../../_lib/i18n.js';

export async function onRequestGet({ params, env, request }) {
  const slug = params.slug;
  const raw = await env.EVENTS.get(`event:${slug}`);
  if (!raw) return new Response('Event not found', { status: 404 });
  const event = JSON.parse(raw);
  const L = detectLocale(request);
  const baseUrl = new URL(request.url).origin;
  const eventUrl = `${baseUrl}/e/${slug}`;
  const screenUrl = `${eventUrl}/screen`;
  const joinUrl = `${eventUrl}/join`;

  const participants = [];
  for (const pid of event.participantIds || []) {
    const p = await env.PROFILES.get(`profile:${pid}`);
    if (p) participants.push(JSON.parse(p));
  }

  const S = {
    persistent: t(L, { ko: '지속 페이지', en: 'PERSISTENT' }),
    screenBtn: t(L, { ko: '📺 큰 화면', en: '📺 Screen' }),
    joinBtn: t(L, { ko: '+ 참여하기', en: '+ Join' }),
    copyJoinBtn: t(L, { ko: '🔗 참여 링크 복사', en: '🔗 Copy join link' }),
    copyEventBtn: t(L, { ko: '📎 행사 링크 복사', en: '📎 Copy event link' }),
    copied: t(L, { ko: '복사됨', en: 'Copied' }),
    people: (n) => t(L, { ko: `${n}명`, en: `${n} ${n === 1 ? 'person' : 'people'}` }),
    original: t(L, { ko: '원본 행사 ↗', en: 'Original ↗' }),
    materials: t(L, { ko: event.followupLabel || '행사 자료 보기 ↗', en: event.followupLabel || 'View follow-up ↗' }),
    hostTools: t(L, { ko: '호스트 도구', en: 'HOST TOOLS' }),
    hostHint: t(L, { ko: '이 페이지를 북마크해두면 행사 뒤에도 다시 돌아오기 쉬워요.', en: 'Bookmark this page so you can get back here after the event.' }),
    emptyH: t(L, { ko: '아직 아무도 참여하지 않았어요', en: "No one's joined yet" }),
    emptyP: t(L, { ko: 'QR이나 이 링크를 공유해서 프로필을 모아보세요.', en: 'Share the QR or this link to start collecting profiles.' }),
    emptyCta: t(L, { ko: '큰 화면 QR 열기 →', en: 'Open big-screen QR →' }),
    participants: t(L, { ko: '참여자', en: 'Participants' }),
    footer: t(L, { ko: '이 페이지는 계속 살아있어요. 북마크해두세요.', en: 'This page persists. Bookmark it.' }),
    footerSub: t(L, { ko: '행사는 끝나도, 만남은 끝나지 않게.', en: "The meet doesn't end after the meet." }),
  };

  const html = `<!DOCTYPE html>
<html lang="${L}">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${escapeHtml(event.title)} · aftermeet</title>
<meta property="og:title" content="${escapeHtml(event.title)} · aftermeet" />
<meta property="og:description" content="${escapeHtml(event.description || S.footerSub)}" />
<link rel="stylesheet" href="/style.css" />
<style>
  main { max-width: 1100px; margin: 0 auto; padding: 0 28px; }
  .ev-header { padding: 32px 0 26px; }
  .ev-title { font-size: clamp(32px, 4.5vw, 56px); font-weight: 800; line-height: 1.05; letter-spacing: -0.035em; margin: 10px 0 12px; }
  .ev-desc { font-size: 16px; color: var(--text-muted); max-width: 720px; line-height: 1.55; margin-bottom: 18px; }
  .meta-row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
  .toolbar { margin: 18px 0 8px; display:flex; flex-wrap:wrap; gap:10px; }
  .host-strip { margin: 18px 0 28px; display:grid; gap:14px; }
  .host-strip-top { display:flex; justify-content:space-between; gap:16px; align-items:flex-start; flex-wrap:wrap; }
  .host-strip-actions { display:flex; flex-wrap:wrap; gap:10px; }
  .host-strip p { margin: 6px 0 0; color: var(--text-muted); font-size: 14px; }
  .empty { text-align: center; padding: 60px 24px; border: 1px dashed var(--border); border-radius: 20px; }
  .empty h3 { font-size: 22px; font-weight: 700; letter-spacing: -0.02em; margin: 8px 0 6px; }
  .empty p { color: var(--text-muted); margin-bottom: 22px; }
  .section-head { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 18px; }
  .section-head h2 { font-size: 20px; font-weight: 600; letter-spacing: -0.01em; }
  .section-head .count { font-size: 14px; color: var(--text-muted); }
  .followup { margin: 0 0 22px; }
  footer { padding: 60px 28px 40px; text-align: center; font-size: 13px; color: var(--text-dim); }
  .lang-switch { display: inline-flex; gap: 4px; font-size: 11px; }
  .lang-switch a { padding: 4px 8px; border-radius: 6px; text-decoration: none; color: var(--text-dim); }
  .lang-switch a.on { background: var(--bg-elev); color: var(--accent-hi); }
  .tiny-note { font-size:12px; color:var(--text-dim); }
</style>
</head>
<body>

<nav class="nav">
  <a href="/" class="brand"><span class="brand-dot"></span>aftermeet</a>
  <div style="display:flex;gap:8px;align-items:center;">
    <span class="lang-switch">
      <a href="?lang=ko" class="${L==='ko'?'on':''}">KO</a>
      <a href="?lang=en" class="${L==='en'?'on':''}">EN</a>
    </span>
    <a href="/e/${slug}/screen" class="btn btn-ghost btn-sm">${escapeHtml(S.screenBtn)}</a>
    <a href="/e/${slug}/join" class="btn btn-primary btn-sm">${escapeHtml(S.joinBtn)}</a>
  </div>
</nav>

<main>
  <header class="ev-header rise">
    <div class="eyebrow">${escapeHtml(event.source.toUpperCase())} · ${escapeHtml(S.persistent)}</div>
    <h1 class="ev-title">${escapeHtml(event.title)}</h1>
    ${event.description ? `<p class="ev-desc">${escapeHtml(truncate(event.description, 220))}</p>` : ''}
    <div class="meta-row">
      ${event.location ? `<span class="chip">📍 ${escapeHtml(event.location)}</span>` : ''}
      ${event.date ? `<span class="chip">📅 ${escapeHtml(formatDate(event.date, L))}</span>` : ''}
      <span class="chip">👥 ${escapeHtml(S.people(participants.length))}</span>
      <a href="${escapeAttr(event.sourceUrl)}" target="_blank" rel="noopener" class="chip" style="text-decoration:none;">${escapeHtml(S.original)}</a>
    </div>
  </header>

  <section class="card-flat host-strip rise">
    <div class="host-strip-top">
      <div>
        <div class="eyebrow">${escapeHtml(S.hostTools)}</div>
        <p>${escapeHtml(S.hostHint)}</p>
      </div>
      <div class="host-strip-actions">
        <a href="${escapeAttr(screenUrl)}" class="btn btn-ghost btn-sm">${escapeHtml(S.screenBtn)}</a>
        <a href="${escapeAttr(joinUrl)}" class="btn btn-primary btn-sm">${escapeHtml(S.joinBtn)}</a>
        <button type="button" class="btn btn-ghost btn-sm" data-copy="${escapeAttr(joinUrl)}">${escapeHtml(S.copyJoinBtn)}</button>
        <button type="button" class="btn btn-ghost btn-sm" data-copy="${escapeAttr(eventUrl)}">${escapeHtml(S.copyEventBtn)}</button>
      </div>
    </div>
  </section>

  ${event.followupUrl ? `
    <section class="followup rise">
      <a href="${escapeAttr(event.followupUrl)}" target="_blank" rel="noopener" class="card" style="display:block; text-decoration:none; color:inherit;">
        <div class="eyebrow">AFTER THE MEET</div>
        <div style="margin-top:8px; display:flex; justify-content:space-between; gap:16px; align-items:center; flex-wrap:wrap;">
          <div>
            <div style="font-size:20px; font-weight:700; letter-spacing:-0.02em;">${escapeHtml(S.materials)}</div>
            <div class="tiny-note" style="margin-top:6px;">${escapeHtml(stripProtocol(event.followupUrl))}</div>
          </div>
          <div class="btn btn-primary btn-sm">${escapeHtml(S.materials)}</div>
        </div>
      </a>
    </section>
  ` : ''}

  ${participants.length === 0 ? `
    <div class="empty rise">
      <div style="font-size: 36px; margin-bottom: 8px;">📭</div>
      <h3>${escapeHtml(S.emptyH)}</h3>
      <p>${escapeHtml(S.emptyP)}</p>
      <a href="/e/${slug}/screen" class="btn btn-primary">${escapeHtml(S.emptyCta)}</a>
    </div>
  ` : `
    <section class="rise">
      <div class="section-head">
        <h2>${escapeHtml(S.participants)}</h2>
        <div class="count">${escapeHtml(S.people(participants.length))}</div>
      </div>
      <div class="grid-people rise-stagger">
        ${participants.map(renderCard).join('')}
      </div>
    </section>
  `}
</main>

<footer>
  ${escapeHtml(S.footer)} <span class="dim">${escapeHtml(S.footerSub)}</span>
</footer>

<script>
for (const el of document.querySelectorAll('[data-copy]')) {
  el.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(el.getAttribute('data-copy'));
      const original = el.textContent;
      el.textContent = ${JSON.stringify(S.copied)};
      setTimeout(() => { el.textContent = original; }, 1200);
    } catch {}
  });
}
</script>

</body>
</html>`;

  const headers = { 'Content-Type': 'text/html; charset=utf-8' };
  const url = new URL(request.url);
  if (url.searchParams.get('lang') === 'ko' || url.searchParams.get('lang') === 'en') {
    headers['Set-Cookie'] = `aftermeet_lang=${url.searchParams.get('lang')}; Path=/; Max-Age=31536000; SameSite=Lax`;
  }
  return new Response(html, { headers });
}

function renderCard(p) {
  const platformIcon = { linkedin: '𝐢𝐧', x: '𝕏', github: '◉', threads: '@', facebook: 'f', web: '🌐' }[p.platform] || '🔗';
  const platformLabel = { linkedin: 'LinkedIn', x: 'X', github: 'GitHub', threads: 'Threads', facebook: 'Facebook', web: 'Website' }[p.platform] || p.platform;
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
      <div class="person-platform"><span>${platformIcon}</span><span>${escapeHtml(platformLabel)}</span></div>
    </a>
  `;
}

function truncate(s, n) {
  if (!s) return '';
  return s.length > n ? s.slice(0, n).trim() + '…' : s;
}

function formatDate(s, locale) {
  try {
    const d = new Date(s);
    return d.toLocaleDateString(locale === 'ko' ? 'ko-KR' : 'en-US',
      { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  } catch { return s; }
}

function stripProtocol(url) {
  return String(url || '').replace(/^https?:\/\//, '');
}

function escapeHtml(s) {
  if (s == null) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function escapeAttr(s) { return escapeHtml(s); }
