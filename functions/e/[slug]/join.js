// Mobile join page — what attendees see after scanning the QR
export async function onRequestGet({ params, env }) {
  const slug = params.slug;
  const raw = await env.EVENTS.get(`event:${slug}`);
  if (!raw) return new Response('Event not found', { status: 404 });
  const event = JSON.parse(raw);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Join ${escapeHtml(event.title)} · aftermeet</title>
<link rel="stylesheet" href="/style.css" />
<style>
  main { max-width: 460px; margin: 0 auto; padding: 24px 20px 60px; }
  .ev-banner { padding: 18px; border-radius: 16px;
    background: linear-gradient(135deg, rgba(76,29,149,0.4), rgba(30,27,75,0.4));
    border: 1px solid rgba(167,139,250,0.3); margin-bottom: 28px; }
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
  .success p { color: var(--text-muted); margin-bottom: 28px; }
</style>
</head>
<body>

<nav class="nav">
  <a href="/" class="brand"><span class="brand-dot"></span>aftermeet</a>
</nav>

<main class="rise">
  <div class="ev-banner">
    <div class="eyebrow">YOU'RE JOINING</div>
    <h1>${escapeHtml(event.title)}</h1>
    ${event.location ? `<p class="meta">📍 ${escapeHtml(event.location)}</p>` : ''}
  </div>

  <form id="joinForm" class="form-stack">
    <div>
      <label class="label" for="profileUrl">Your profile link</label>
      <input id="profileUrl" class="input" type="url" required autofocus inputmode="url"
             placeholder="linkedin.com/in/you · x.com/you · github.com/you" />
      <p class="hint">LinkedIn, X, GitHub, or your personal site. We auto-fill the rest.</p>
    </div>

    <details>
      <summary>Add a custom name or one-liner</summary>
      <div>
        <input id="displayName" class="input" type="text" placeholder="Display name (optional)" />
        <input id="note" class="input" type="text" placeholder='What are you working on? (one line)' />
      </div>
    </details>

    <button id="submitBtn" type="submit" class="btn btn-primary" style="width:100%;justify-content:center;">
      Join the meet →
    </button>
  </form>

  <div id="status"></div>

  <div id="success" class="success rise" style="display:none;">
    <div class="success-emoji">🤝</div>
    <h2>You're in.</h2>
    <p>See who else is here, and bookmark the page — it stays after the meet.</p>
    <a href="/e/${slug}" class="btn btn-primary">View participants →</a>
  </div>
</main>

<script>
const form = document.getElementById('joinForm');
const btn = document.getElementById('submitBtn');
const statusEl = document.getElementById('status');
const successEl = document.getElementById('success');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  let profileUrl = document.getElementById('profileUrl').value.trim();
  if (profileUrl && !/^https?:\\/\\//i.test(profileUrl)) profileUrl = 'https://' + profileUrl;

  btn.disabled = true;
  btn.textContent = 'Connecting…';
  statusEl.textContent = '';

  try {
    const res = await fetch('/api/profiles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventSlug: '${slug}',
        profileUrl,
        displayName: document.getElementById('displayName').value.trim(),
        note: document.getElementById('note').value.trim(),
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed');
    form.style.display = 'none';
    successEl.style.display = 'block';
  } catch (err) {
    statusEl.innerHTML = '<span class="err">' + err.message + '</span>';
    btn.disabled = false;
    btn.textContent = 'Join the meet →';
  }
});
</script>
</body>
</html>`;
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

function escapeHtml(s) {
  if (!s) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
