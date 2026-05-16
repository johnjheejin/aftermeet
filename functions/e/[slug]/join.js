// Mobile join page — scanned via QR
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
<script src="https://cdn.tailwindcss.com"></script>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Inter', system-ui, sans-serif; }
  .grad { background: radial-gradient(circle at top, #1e1b4b 0%, #0f172a 50%, #000 100%); }
</style>
</head>
<body class="grad text-white min-h-screen">
<nav class="px-5 py-4">
  <a href="/" class="font-bold text-lg">🤝 aftermeet</a>
</nav>

<main class="max-w-md mx-auto px-5 pt-6 pb-12">
  <div class="mb-6 p-4 bg-violet-500/10 border border-violet-500/30 rounded-2xl">
    <div class="text-xs uppercase tracking-widest text-violet-300 mb-1">You're joining</div>
    <h1 class="text-2xl font-bold">${escapeHtml(event.title)}</h1>
    ${event.location ? `<p class="text-slate-400 text-sm mt-1">📍 ${escapeHtml(event.location)}</p>` : ''}
  </div>

  <form id="joinForm" class="space-y-4">
    <div>
      <label class="block text-sm font-medium mb-2 text-slate-300">Your profile link</label>
      <input
        id="profileUrl" type="url" required autofocus
        placeholder="linkedin.com/in/you · x.com/you · your-site.com"
        class="w-full px-4 py-4 bg-white/5 border border-white/10 rounded-xl text-base focus:border-violet-400 focus:bg-white/10 outline-none"
      />
      <p class="text-xs text-slate-500 mt-2">LinkedIn, X, GitHub, or your personal site. We auto-fill the rest.</p>
    </div>

    <details class="text-sm">
      <summary class="text-slate-400 cursor-pointer py-2">Optional: add a custom name / note</summary>
      <div class="space-y-3 pt-2">
        <input id="displayName" type="text" placeholder="Display name (optional)"
          class="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-base focus:border-violet-400 outline-none" />
        <input id="note" type="text" placeholder="What are you working on? (one line)"
          class="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-base focus:border-violet-400 outline-none" />
      </div>
    </details>

    <button type="submit" id="submitBtn"
      class="w-full px-6 py-4 bg-violet-500 hover:bg-violet-400 rounded-xl font-semibold text-lg transition disabled:opacity-50">
      Join the meet →
    </button>
  </form>

  <div id="status" class="mt-4 text-center text-slate-400 text-sm"></div>

  <div id="success" class="hidden mt-8 text-center">
    <div class="text-6xl mb-4">🎉</div>
    <h2 class="text-2xl font-bold mb-2">You're in!</h2>
    <p class="text-slate-400 mb-6">See who else is here.</p>
    <a id="viewBtn" href="/e/${slug}" class="inline-block px-6 py-3 bg-white text-black rounded-full font-semibold">
      View participants →
    </a>
  </div>
</main>

<script>
const form = document.getElementById('joinForm');
const btn = document.getElementById('submitBtn');
const status = document.getElementById('status');
const success = document.getElementById('success');

// Paste shortcut — if clipboard contains a URL, auto-fill on focus
const urlInput = document.getElementById('profileUrl');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  let profileUrl = urlInput.value.trim();
  if (profileUrl && !/^https?:\\/\\//i.test(profileUrl)) profileUrl = 'https://' + profileUrl;

  btn.disabled = true;
  btn.textContent = 'Connecting…';
  status.textContent = '';

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
    form.classList.add('hidden');
    success.classList.remove('hidden');
  } catch (err) {
    status.innerHTML = '<span class="text-red-400">' + err.message + '</span>';
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
