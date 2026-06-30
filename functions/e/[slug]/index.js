// Event page — persistent participant grid
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

  const status = event.status || 'active';
  if (status === 'hidden' && !isHost) return new Response('Event not found', { status: 404 });

  const archived = status === 'archived';
  const baseUrl = pageUrl.origin;
  const eventUrl = `${baseUrl}/e/${slug}`;
  const hostLink = isHost ? `${eventUrl}?host=${encodeURIComponent(hostToken)}` : eventUrl;
  const screenUrl = `${eventUrl}/screen${isHost ? `?host=${encodeURIComponent(hostToken)}` : ''}`;
  const joinUrl = `${eventUrl}/join${isHost ? `?host=${encodeURIComponent(hostToken)}` : ''}`;

  const approved = [];
  const pending = [];
  const hidden = [];

  for (const pid of event.participantIds || []) {
    const p = await env.PROFILES.get(`profile:${pid}`);
    if (!p) continue;
    const profile = JSON.parse(p);
    const membership = getMembership(profile, slug);
    const enriched = { ...profile, membership };
    if (membership.joinState === 'pending') pending.push(enriched);
    else if (membership.joinState === 'hidden') hidden.push(enriched);
    else approved.push(enriched);
  }

  approved.sort(sortProfiles);
  pending.sort(sortProfiles);
  hidden.sort(sortProfiles);

  const sourceName = { luma: 'Luma', cerebralvalley: 'Cerebral Valley', linkedin: 'LinkedIn' }[event.source] || null;
  const S = {
    persistent: t(L, { ko: '지속 페이지', en: 'PERSISTENT' }),
    screenBtn: t(L, { ko: '📺 등록하기 (큰 화면 QR)', en: '📺 Register (big-screen QR)' }),
    joinBtn: t(L, { ko: '+ 등록하기', en: '+ Register' }),
    copyJoinBtn: t(L, { ko: '🔗 등록 링크 복사', en: '🔗 Copy register link' }),
    copyEventBtn: t(L, { ko: '📎 행사 링크 복사', en: '📎 Copy event link' }),
    copyHostBtn: t(L, { ko: '🛠 관리 링크 복사', en: '🛠 Copy host link' }),
    copied: t(L, { ko: '복사됨', en: 'Copied' }),
    people: (n) => t(L, { ko: `${n}명`, en: `${n} ${n === 1 ? 'person' : 'people'}` }),
    original: sourceName
      ? t(L, { ko: `${sourceName} 페이지 ↗`, en: `${sourceName} page ↗` })
      : t(L, { ko: '원본 페이지 ↗', en: 'Source page ↗' }),
    materials: t(L, { ko: event.followupLabel || '행사 자료 보기 ↗', en: event.followupLabel || 'View follow-up ↗' }),
    hostTools: t(L, { ko: '호스트 도구', en: 'HOST TOOLS' }),
    hostHint: t(L, { ko: '⚠️ 이 링크를 저장(북마크/QR)해두세요. 이 링크로만 다시 돌아와 참여자를 관리할 수 있어요.', en: '⚠️ Save this link (bookmark/QR). It is the only way back to manage participants.' }),
    autoUntil: t(L, { ko: '자동 승인 마감', en: 'Auto-approve until' }),
    approvedBadge: t(L, { ko: '공개됨', en: 'Approved' }),
    pendingBadge: t(L, { ko: '승인 대기', en: 'Pending' }),
    hiddenBadge: t(L, { ko: '숨김', en: 'Hidden' }),
    archivedBadge: t(L, { ko: '보관됨', en: 'Archived' }),
    screenJoinBadge: t(L, { ko: '현장 QR', en: 'Screen QR' }),
    directJoinBadge: t(L, { ko: '직접 입력', en: 'Direct join' }),
    emptyH: t(L, { ko: '아직 아무도 참여하지 않았어요', en: "No one's joined yet" }),
    emptyP: t(L, { ko: 'QR이나 이 링크를 공유해서 프로필을 모아보세요.', en: 'Share the QR or this link to start collecting profiles.' }),
    emptyCta: t(L, { ko: '큰 화면 QR 열기 →', en: 'Open big-screen QR →' }),
    participants: t(L, { ko: '참여자', en: 'Participants' }),
    pending: t(L, { ko: '승인 대기', en: 'Pending approval' }),
    hidden: t(L, { ko: '숨긴 참가자', en: 'Hidden people' }),
    manageApproved: t(L, { ko: '공개 참여자 관리', en: 'Manage public participants' }),
    manageApprovedHint: t(L, { ko: '공개 중인 참여자를 숨기거나 대기 상태로 보낼 수 있어요.', en: 'Hide a public participant or move them back to pending.' }),
    approve: t(L, { ko: '승인', en: 'Approve' }),
    hide: t(L, { ko: '숨기기', en: 'Hide' }),
    movePending: t(L, { ko: '대기로', en: 'Move to pending' }),
    pendingHint: t(L, { ko: '행사 이후 들어온 사람들을 확인해서 공개할 수 있어요.', en: 'Review people who joined after the auto-approve window.' }),
    archivedNotice: t(L, { ko: '이 이벤트는 보관 상태입니다. 새 참여는 닫혀 있어요.', en: 'This event is archived. New joins are closed.' }),
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
  .subsection { margin-top: 28px; }
  .moderation-grid { display:grid; gap:12px; }
  .moderation-card { display:flex; justify-content:space-between; gap:14px; align-items:flex-start; }
  .moderation-meta { min-width:0; }
  .moderation-meta strong { display:block; font-size:15px; }
  .moderation-meta .tiny { margin-top:6px; }
  .moderation-actions { display:flex; gap:8px; flex-wrap:wrap; justify-content:flex-end; }
  .status-badges { display:flex; gap:6px; flex-wrap:wrap; margin-top:8px; }
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
      <a href="?lang=ko${isHost ? `&host=${encodeURIComponent(hostToken)}` : ''}" class="${L==='ko'?'on':''}">KO</a>
      <a href="?lang=en${isHost ? `&host=${encodeURIComponent(hostToken)}` : ''}" class="${L==='en'?'on':''}">EN</a>
    </span>
    <a href="${escapeAttr(screenUrl)}" class="btn btn-ghost btn-sm">${escapeHtml(S.screenBtn)}</a>
    ${archived ? '' : `<a href="${escapeAttr(joinUrl)}" class="btn btn-primary btn-sm">${escapeHtml(S.joinBtn)}</a>`}
  </div>
</nav>

<main>
  <header class="ev-header rise">
    <div class="eyebrow">${escapeHtml(event.source.toUpperCase())} · ${escapeHtml(S.persistent)}</div>
    <h1 class="ev-title">${escapeHtml(event.title)}</h1>
    ${event.description ? `<p class="ev-desc">${escapeHtml(truncate(event.description, 220))}</p>` : ''}
    <div class="meta-row">
      ${event.location ? `<span class="chip">📍 ${escapeHtml(event.location)}</span>` : ''}
      ${event.date ? `<span class="chip">📅 <time datetime="${escapeAttr(event.date)}" data-fmt="date">${escapeHtml(formatDate(event.date, L))}</time></span>` : ''}
      <span class="chip">👥 ${escapeHtml(S.people(approved.length))}</span>
      ${event.joinAutoApproveUntil ? `<span class="chip">⏳ ${escapeHtml(S.autoUntil)}: <time datetime="${escapeAttr(event.joinAutoApproveUntil)}" data-fmt="datetime">${escapeHtml(formatDateTime(event.joinAutoApproveUntil, L))}</time></span>` : ''}
      ${status !== 'active' ? `<span class="chip">${escapeHtml(status === 'archived' ? S.archivedBadge : S.hiddenBadge)}</span>` : ''}
      <a href="${escapeAttr(event.sourceUrl)}" target="_blank" rel="noopener" class="chip" style="text-decoration:none;">${escapeHtml(S.original)}</a>
    </div>
  </header>

  ${archived ? `<section class="card-flat rise" style="margin-bottom:22px;">${escapeHtml(S.archivedNotice)}</section>` : ''}

  <section class="card-flat host-strip rise">
    <div class="host-strip-top">
      <div>
        <div class="eyebrow">${escapeHtml(S.hostTools)}</div>
        <p>${escapeHtml(S.hostHint)}</p>
      </div>
      <div class="host-strip-actions">
        <a href="${escapeAttr(screenUrl)}" class="btn btn-ghost btn-sm">${escapeHtml(S.screenBtn)}</a>
        ${archived ? '' : `<a href="${escapeAttr(joinUrl)}" class="btn btn-primary btn-sm">${escapeHtml(S.joinBtn)}</a>`}
        ${archived ? '' : `<button type="button" class="btn btn-ghost btn-sm" data-copy="${escapeAttr(joinUrl)}">${escapeHtml(S.copyJoinBtn)}</button>`}
        <button type="button" class="btn btn-ghost btn-sm" data-copy="${escapeAttr(eventUrl)}">${escapeHtml(S.copyEventBtn)}</button>
        ${isHost ? `<button type="button" class="btn btn-ghost btn-sm" data-copy="${escapeAttr(hostLink)}">${escapeHtml(S.copyHostBtn)}</button>` : ''}
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

  ${approved.length === 0 ? `
    <div class="empty rise">
      <div style="font-size: 36px; margin-bottom: 8px;">📭</div>
      <h3>${escapeHtml(S.emptyH)}</h3>
      <p>${escapeHtml(S.emptyP)}</p>
      <a href="${escapeAttr(screenUrl)}" class="btn btn-primary">${escapeHtml(S.emptyCta)}</a>
    </div>
  ` : `
    <section class="rise">
      <div class="section-head">
        <h2>${escapeHtml(S.participants)}</h2>
        <div class="count">${escapeHtml(S.people(approved.length))}</div>
      </div>
      <div class="grid-people rise-stagger">
        ${approved.map((p) => renderCard(p, S)).join('')}
      </div>
    </section>
  `}

  ${isHost ? `
    <section class="subsection rise">
      <div class="section-head">
        <h2>${escapeHtml(S.manageApproved)}</h2>
        <div class="count">${escapeHtml(S.people(approved.length))}</div>
      </div>
      <p class="tiny-note" style="margin-bottom:14px;">${escapeHtml(S.manageApprovedHint)}</p>
      <div class="moderation-grid">
        ${approved.length ? approved.map((p) => renderModerationCard(p, slug, hostToken, S)).join('') : `<div class="card-flat tiny-note">—</div>`}
      </div>
    </section>

    <section class="subsection rise">
      <div class="section-head">
        <h2>${escapeHtml(S.pending)}</h2>
        <div class="count">${escapeHtml(S.people(pending.length))}</div>
      </div>
      <p class="tiny-note" style="margin-bottom:14px;">${escapeHtml(S.pendingHint)}</p>
      <div class="moderation-grid">
        ${pending.length ? pending.map((p) => renderModerationCard(p, slug, hostToken, S)).join('') : `<div class="card-flat tiny-note">—</div>`}
      </div>
    </section>

    <section class="subsection rise">
      <div class="section-head">
        <h2>${escapeHtml(S.hidden)}</h2>
        <div class="count">${escapeHtml(S.people(hidden.length))}</div>
      </div>
      <div class="moderation-grid">
        ${hidden.length ? hidden.map((p) => renderModerationCard(p, slug, hostToken, S)).join('') : `<div class="card-flat tiny-note">—</div>`}
      </div>
    </section>
  ` : ''}
</main>

<footer>
  ${escapeHtml(S.footer)} <span class="dim">${escapeHtml(S.footerSub)}</span>
</footer>

<script>
const hostToken = ${JSON.stringify(hostToken)};
const LOCALE = ${JSON.stringify(L === 'ko' ? 'ko-KR' : 'en-US')};
for (const el of document.querySelectorAll('time[data-fmt]')) {
  const iso = el.getAttribute('datetime');
  const d = new Date(iso);
  if (isNaN(d.getTime())) continue;
  try {
    if (el.getAttribute('data-fmt') === 'date') {
      el.textContent = d.toLocaleDateString(LOCALE, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
    } else {
      el.textContent = d.toLocaleString(LOCALE, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    }
    el.title = d.toLocaleString(LOCALE, { timeZoneName: 'short' });
  } catch {}
}
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
for (const el of document.querySelectorAll('[data-op]')) {
  el.addEventListener('click', async () => {
    const card = el.closest('[data-profile-id]');
    if (!card) return;
    const profileId = card.getAttribute('data-profile-id');
    const op = el.getAttribute('data-op');
    el.disabled = true;
    try {
      const r = await fetch('/api/events?action=membership', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: ${JSON.stringify(slug)}, profileId, op, hostToken })
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Failed');
      window.location.reload();
    } catch (e) {
      el.disabled = false;
      alert(e.message || 'Failed');
    }
  });
}
</script>

</body>
</html>`;

  const headers = { 'Content-Type': 'text/html; charset=utf-8' };
  if (pageUrl.searchParams.get('lang') === 'ko' || pageUrl.searchParams.get('lang') === 'en') {
    headers['Set-Cookie'] = `aftermeet_lang=${pageUrl.searchParams.get('lang')}; Path=/; Max-Age=31536000; SameSite=Lax`;
  }
  return new Response(html, { headers });
}

function renderCard(p, S) {
  const platformIcon = { linkedin: '𝐢𝐧', x: '𝕏', github: '◉', threads: '@', facebook: 'f', web: '🌐' }[p.platform] || '🔗';
  const platformLabel = { linkedin: 'LinkedIn', x: 'X', github: 'GitHub', threads: 'Threads', facebook: 'Facebook', web: 'Website' }[p.platform] || p.platform;
  const fallbackAvatar = `<div class="person-avatar person-avatar-icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21a8 8 0 0 0-16 0"></path><circle cx="12" cy="7" r="4"></circle></svg></div>`;
  return `
    <a class="person" href="${escapeAttr(p.url)}" target="_blank" rel="noopener">
      ${p.avatar ? `
        <img class="person-avatar" src="${escapeAttr(p.avatar)}" alt="" loading="lazy" onerror="this.outerHTML=${JSON.stringify('<div class=\\"person-avatar person-avatar-icon\\" aria-hidden=\\"true\\"><svg viewBox=\\"0 0 24 24\\" width=\\"28\\" height=\\"28\\" fill=\\"none\\" stroke=\\"currentColor\\" stroke-width=\\"1.8\\" stroke-linecap=\\"round\\" stroke-linejoin=\\"round\\"><path d=\\"M20 21a8 8 0 0 0-16 0\\"></path><circle cx=\\"12\\" cy=\\"7\\" r=\\"4\\"></circle></svg></div>')}" />
      ` : `
        ${fallbackAvatar}
      `}
      <div class="person-name">${escapeHtml(p.name || 'Anonymous')}</div>
      ${p.title ? `<div class="person-title">${escapeHtml(p.title)}</div>` : ''}
      ${p.note ? `<div class="person-note">${escapeHtml(p.note)}</div>` : ''}
      <div class="person-platform"><span>${platformIcon}</span><span>${escapeHtml(platformLabel)}</span></div>
    </a>
  `;
}

function renderModerationCard(p, slug, hostToken, S) {
  return `
    <div class="card-flat moderation-card" data-profile-id="${escapeAttr(p.id)}">
      <div class="moderation-meta">
        <strong>${escapeHtml(p.name || 'Anonymous')}</strong>
        <div class="tiny-note">${escapeHtml(stripProtocol(p.url || ''))}</div>
        <div class="status-badges">
          <span class="chip">${escapeHtml(labelForState(p.membership.joinState, S))}</span>
          <span class="chip">${escapeHtml(p.membership.joinSource === 'screen' ? S.screenJoinBadge : S.directJoinBadge)}</span>
          ${p.membership.joinedAt ? `<span class="chip"><time datetime="${escapeAttr(p.membership.joinedAt)}" data-fmt="datetime">${escapeHtml(formatDateTime(p.membership.joinedAt, 'en'))}</time></span>` : ''}
        </div>
      </div>
      <div class="moderation-actions">
        ${p.membership.joinState !== 'approved' ? `<button type="button" class="btn btn-primary btn-sm" data-op="approve">${escapeHtml(S.approve)}</button>` : ''}
        ${p.membership.joinState !== 'pending' ? `<button type="button" class="btn btn-ghost btn-sm" data-op="pending">${escapeHtml(S.movePending)}</button>` : ''}
        ${p.membership.joinState !== 'hidden' ? `<button type="button" class="btn btn-ghost btn-sm" data-op="hide">${escapeHtml(S.hide)}</button>` : ''}
      </div>
    </div>
  `;
}

function getMembership(profile, slug) {
  const membership = profile.memberships?.[slug];
  if (membership) return membership;
  return {
    joinedAt: profile.createdAt || null,
    updatedAt: profile.updatedAt || null,
    joinState: Array.isArray(profile.events) && profile.events.includes(slug) ? 'approved' : 'pending',
    joinSource: 'direct',
  };
}

function sortProfiles(a, b) {
  const ta = new Date(a.membership?.joinedAt || a.createdAt || 0).getTime();
  const tb = new Date(b.membership?.joinedAt || b.createdAt || 0).getTime();
  return tb - ta;
}

function labelForState(state, S) {
  if (state === 'approved') return S.approvedBadge;
  if (state === 'pending') return S.pendingBadge;
  if (state === 'hidden') return S.hiddenBadge;
  if (state === 'archived') return S.archivedBadge;
  return state;
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

function formatDateTime(s, locale) {
  try {
    const d = new Date(s);
    return d.toLocaleString(locale === 'ko' ? 'ko-KR' : 'en-US', {
      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
    });
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
