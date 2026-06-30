// Mobile join page — what attendees see after scanning the QR
import { detectLocale, t } from '../../_lib/i18n.js';

export async function onRequestGet({ params, env, request }) {
  const slug = params.slug;
  const raw = await env.EVENTS.get(`event:${slug}`);
  if (!raw) return new Response('Event not found', { status: 404 });
  const event = JSON.parse(raw);
  if ((event.status || 'active') === 'hidden') return new Response('Event not found', { status: 404 });
  const archived = (event.status || 'active') === 'archived';
  const L = detectLocale(request);
  const pageUrl = new URL(request.url);
  const hostToken = pageUrl.searchParams.get('host') || '';
  const isHost = Boolean(hostToken && event.hostToken && hostToken === event.hostToken);
  const joinSource = pageUrl.searchParams.get('source') === 'screen' ? 'screen' : 'direct';
  const followupAllowed = !archived && event.followupUrl && Date.now() <= new Date(event.joinAutoApproveUntil || 0).getTime();

  const S = {
    title: t(L, { ko: `${event.title} 참여 · aftermeet`, en: `Join ${event.title} · aftermeet` }),
    youJoining: t(L, { ko: '참여 중인 행사', en: "YOU'RE JOINING" }),
    archived: t(L, { ko: '이 이벤트는 보관 상태라 새 참여가 닫혀 있어요.', en: 'This event is archived, so new joins are closed.' }),
    profileLabel: t(L, { ko: '본인 프로필 링크', en: 'Your profile link' }),
    profilePh: t(L, { ko: 'linkedin.com/in/you · x.com/you · github.com/you', en: 'linkedin.com/in/you · x.com/you · github.com/you' }),
    profileHint: t(L, { ko: 'LinkedIn, X, GitHub, Facebook, 또는 본인 사이트 링크를 넣고, 아래 이름은 직접 확인해서 적어주세요.', en: 'Paste your LinkedIn, X, GitHub, Facebook, or personal site, then confirm your name below.' }),
    nameLabel: t(L, { ko: '표시 이름 (직접 입력)', en: 'Display name (enter manually)' }),
    noteLabel: t(L, { ko: '한 줄 소개', en: 'One-line intro' }),
    namePh: t(L, { ko: '예: John J Heejin', en: 'e.g. John J Heejin' }),
    notePh: t(L, { ko: '요즘 뭐 하고 계세요? (한 줄)', en: "What are you working on? (one line)" }),
    submit: t(L, { ko: '연결하기 →', en: 'Join the meet →' }),
    connecting: t(L, { ko: '연결 중…', en: 'Connecting…' }),
    done: t(L, { ko: '완료! 이동 중…', en: 'Done! Redirecting…' }),
    needUrl: t(L, { ko: '프로필 링크를 입력해 주세요.', en: 'Please enter your profile link.' }),
    timeout: t(L, { ko: '연결이 지연되고 있어요. 네트워크 확인 후 다시 시도해 주세요.', en: 'The request timed out. Check your connection and try again.' }),
    successH: t(L, { ko: '연결됐어요.', en: "You're in." }),
    successP: t(L, { ko: '다른 참여자들도 확인해보세요. 페이지를 북마크해두면 행사 후에도 다시 올 수 있어요.', en: 'See who else is here, and bookmark the page — it stays after the meet.' }),
    pendingH: t(L, { ko: '제출됐어요. 승인 대기 중이에요.', en: 'Submitted. Waiting for host approval.' }),
    pendingP: t(L, { ko: '행사 이후 참여라서 바로 공개되지는 않아요. 호스트가 확인하면 참가자 페이지에 나타납니다.', en: 'Because this join came in after the event window, it will appear once the host approves it.' }),
    alreadyH: t(L, { ko: '이미 참여되어 있어요.', en: 'You were already in.' }),
    alreadyP: t(L, { ko: '같은 프로필 링크로 다시 들어왔어요. 참여자 페이지에서 이어서 보시면 됩니다.', en: 'That profile link was already connected. Continue from the participant page.' }),
    successBtn: t(L, { ko: '참여자 보기 →', en: 'View participants →' }),
    materialsBtn: t(L, { ko: event.followupLabel || '행사 자료 보기 ↗', en: event.followupLabel || 'View follow-up ↗' }),
  };

  const html = `<!DOCTYPE html>
<html lang="${L}">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${escapeHtml(S.title)}</title>
<link rel="stylesheet" href="/style.css" />
<style>
  main { max-width: 460px; margin: 0 auto; padding: 24px 20px 60px; }
  .ev-banner { padding: 18px; border-radius: 16px;
    background: linear-gradient(135deg, rgba(124,45,18,0.4), rgba(67,33,17,0.4));
    border: 1px solid rgba(230,126,92,0.3); margin-bottom: 28px; }
  .ev-banner h1 { font-size: 22px; font-weight: 700; line-height: 1.25; letter-spacing: -0.02em; margin: 4px 0 6px; }
  .ev-banner .meta { font-size: 13px; color: var(--text-muted); margin-top: 6px; }
  .form-stack > * + * { margin-top: 18px; }
  details summary { cursor: pointer; color: var(--text-muted); font-size: 13px; padding: 6px 0; user-select: none; list-style: none; }
  details summary::-webkit-details-marker { display: none; }
  details summary::before { content: "+ "; color: var(--accent); }
  details[open] summary::before { content: "− "; }
  details > div { padding-top: 12px; display: flex; flex-direction: column; gap: 12px; }
  #status { margin-top: 14px; text-align: center; font-size: 13px; }
  #status .err { color: var(--danger); }
  .success { text-align: center; padding: 40px 16px; }
  .success-emoji { font-size: 56px; margin-bottom: 16px; }
  .success h2 { font-size: 28px; font-weight: 700; letter-spacing: -0.02em; margin-bottom: 8px; }
  .success p { color: var(--text-muted); margin-bottom: 18px; }
  .success-actions { display:flex; flex-direction:column; gap:10px; }
  .lang-switch { display: inline-flex; gap: 4px; font-size: 11px; }
  .lang-switch a { padding: 4px 8px; border-radius: 6px; text-decoration: none; color: var(--text-dim); }
  .lang-switch a.on { background: var(--bg-elev); color: var(--accent-hi); }
</style>
</head>
<body>

<nav class="nav">
  <a href="/" class="brand"><span class="brand-dot"></span>aftermeet</a>
  <span class="lang-switch">
    <a href="?lang=ko${isHost ? `&host=${encodeURIComponent(hostToken)}` : ''}" class="${L==='ko'?'on':''}">KO</a>
    <a href="?lang=en${isHost ? `&host=${encodeURIComponent(hostToken)}` : ''}" class="${L==='en'?'on':''}">EN</a>
  </span>
</nav>

<main class="rise">
  <div class="ev-banner">
    <div class="eyebrow">${escapeHtml(S.youJoining)}</div>
    <h1>${escapeHtml(event.title)}</h1>
    ${event.location ? `<p class="meta">📍 ${escapeHtml(event.location)}</p>` : ''}
  </div>

  ${archived ? `<div class="card-flat" style="margin-bottom:18px;">${escapeHtml(S.archived)}</div>` : `
  <form id="joinForm" class="form-stack">
    <div>
      <label class="label" for="profileUrl">${escapeHtml(S.profileLabel)}</label>
      <input id="profileUrl" class="input" type="url" required autofocus inputmode="url"
             placeholder="${escapeAttr(S.profilePh)}" />
      <p class="hint">${escapeHtml(S.profileHint)}</p>
    </div>

    <div>
      <label class="label" for="displayName">${escapeHtml(S.nameLabel)}</label>
      <input id="displayName" class="input" type="text" placeholder="${escapeAttr(S.namePh)}" />
    </div>

    <div>
      <label class="label" for="note">${escapeHtml(S.noteLabel)}</label>
      <input id="note" class="input" type="text" placeholder="${escapeAttr(S.notePh)}" />
    </div>

    <button id="submitBtn" type="submit" class="btn btn-primary" style="width:100%;justify-content:center;">
      ${escapeHtml(S.submit)}
    </button>
  </form>

  <div id="status"></div>`}

  <div id="success" class="success rise" style="display:none;">
    <div class="success-emoji">🤝</div>
    <h2 id="successHeading">${escapeHtml(S.successH)}</h2>
    <p id="successBody">${escapeHtml(S.successP)}</p>
    <div class="success-actions">
      <a href="/e/${slug}${isHost ? `?host=${encodeURIComponent(hostToken)}` : ''}" class="btn btn-primary">${escapeHtml(S.successBtn)}</a>
      ${followupAllowed ? `<a id="followupBtn" href="${escapeAttr(event.followupUrl)}" target="_blank" rel="noopener" class="btn btn-ghost">${escapeHtml(S.materialsBtn)}</a>` : ''}
    </div>
  </div>
</main>

${archived ? '' : `<script>
const form = document.getElementById('joinForm');
const btn = document.getElementById('submitBtn');
const statusEl = document.getElementById('status');
const successEl = document.getElementById('success');
const successHeadingEl = document.getElementById('successHeading');
const successBodyEl = document.getElementById('successBody');
const SUBMIT_LABEL = ${JSON.stringify(S.submit)};
const CONNECTING_LABEL = ${JSON.stringify(S.connecting)};
const SUCCESS_H = ${JSON.stringify(S.successH)};
const SUCCESS_P = ${JSON.stringify(S.successP)};
const PENDING_H = ${JSON.stringify(S.pendingH)};
const PENDING_P = ${JSON.stringify(S.pendingP)};
const ALREADY_H = ${JSON.stringify(S.alreadyH)};
const ALREADY_P = ${JSON.stringify(S.alreadyP)};

const profileUrlEl = document.getElementById('profileUrl');
const displayNameEl = document.getElementById('displayName');
const EVENT_URL = '/e/${slug}${isHost ? `?host=${encodeURIComponent(hostToken)}` : ''}';
let submitting = false;

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (submitting) return;

  let profileUrl = profileUrlEl.value.trim();
  if (!profileUrl) {
    statusEl.innerHTML = '<span class="err">${escapeJs(S.needUrl)}</span>';
    profileUrlEl.focus();
    return;
  }
  if (!/^https?:\/\//i.test(profileUrl)) profileUrl = 'https://' + profileUrl;

  submitting = true;
  btn.disabled = true;
  btn.textContent = CONNECTING_LABEL;
  statusEl.textContent = '';

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch('/api/profiles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      signal: controller.signal,
      body: JSON.stringify({
        eventSlug: '${slug}',
        profileUrl,
        displayName: displayNameEl.value.trim(),
        note: document.getElementById('note').value.trim(),
        joinSource: ${JSON.stringify(joinSource)}
      })
    });
    clearTimeout(timer);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || ('HTTP ' + res.status));

    if (data.joinState === 'pending') {
      successHeadingEl.textContent = PENDING_H;
      successBodyEl.textContent = PENDING_P;
      const followupBtn = document.getElementById('followupBtn');
      if (followupBtn) followupBtn.remove();
      form.style.display = 'none';
      successEl.style.display = 'block';
      submitting = false;
      return;
    }

    btn.textContent = '${escapeJs(S.done)}';
    window.location.assign(EVENT_URL);
  } catch (err) {
    clearTimeout(timer);
    submitting = false;
    const msg = err && err.name === 'AbortError' ? '${escapeJs(S.timeout)}' : (err.message || 'Failed');
    statusEl.innerHTML = '<span class="err">' + msg + '</span>';
    btn.disabled = false;
    btn.textContent = SUBMIT_LABEL;
  }
});
</script>`}
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
function escapeAttr(s) { return escapeHtml(s); }
function escapeJs(s) {
  return String(s == null ? '' : s).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n');
}
