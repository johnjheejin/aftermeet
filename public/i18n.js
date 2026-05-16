// Minimal client-side i18n for aftermeet.
// Detects locale, applies translations to [data-i18n] and [data-i18n-html] nodes,
// and wires up the .lang-switch links.

function detectLocale() {
  // 1) explicit ?lang=
  const url = new URL(window.location.href);
  const q = url.searchParams.get('lang');
  if (q === 'ko' || q === 'en') {
    document.cookie = `aftermeet_lang=${q}; path=/; max-age=31536000; samesite=lax`;
    return q;
  }
  // 2) cookie
  const m = document.cookie.match(/(?:^|;\s*)aftermeet_lang=(ko|en)/);
  if (m) return m[1];
  // 3) browser
  const langs = navigator.languages || [navigator.language || 'en'];
  for (const l of langs) {
    if (/^ko\b/i.test(l)) return 'ko';
    if (/^en\b/i.test(l)) return 'en';
  }
  return 'en';
}

function applyI18n(dict) {
  const locale = detectLocale();
  document.documentElement.lang = locale;
  document.documentElement.dataset.locale = locale;

  const strings = dict[locale] || dict.en || {};

  // <title> + meta keyed by data-i18n on <title>
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    if (strings[key] != null) {
      if (el.tagName === 'TITLE') el.textContent = strings[key];
      else el.textContent = strings[key];
    }
  });
  document.querySelectorAll('[data-i18n-html]').forEach((el) => {
    const key = el.getAttribute('data-i18n-html');
    if (strings[key] != null) el.innerHTML = strings[key];
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (strings[key] != null) el.placeholder = strings[key];
  });

  // language switcher visual state
  document.querySelectorAll('.lang-switch a[data-lang]').forEach((a) => {
    a.classList.toggle('on', a.getAttribute('data-lang') === locale);
  });
}

// expose for inline scripts
window.applyI18n = applyI18n;
window.detectLocale = detectLocale;
