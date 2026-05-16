// Lightweight locale detection for Cloudflare Pages Functions.
// Order of precedence:
//   1. ?lang=ko|en query param  (explicit user choice)
//   2. "aftermeet_lang" cookie   (sticky choice)
//   3. Accept-Language header
//   4. fallback "en"

export function detectLocale(request) {
  const url = new URL(request.url);
  const q = url.searchParams.get('lang');
  if (q === 'ko' || q === 'en') return q;

  const cookie = request.headers.get('Cookie') || '';
  const m = cookie.match(/(?:^|;\s*)aftermeet_lang=(ko|en)/);
  if (m) return m[1];

  const al = (request.headers.get('Accept-Language') || '').toLowerCase();
  if (al.startsWith('ko') || al.includes(',ko') || al.includes('ko-kr')) return 'ko';

  return 'en';
}

// Build a "Set-Cookie" header to make ?lang= sticky for future visits.
export function localeCookie(locale) {
  return `aftermeet_lang=${locale}; Path=/; Max-Age=31536000; SameSite=Lax`;
}

// tiny tagged-template helper:  t(locale, { ko: '안녕', en: 'Hi' })
export function t(locale, dict) {
  return dict[locale] ?? dict.en ?? Object.values(dict)[0] ?? '';
}

// HTML attr for switcher link: appends ?lang=xx to current URL
export function langSwitchUrl(request, target) {
  const url = new URL(request.url);
  url.searchParams.set('lang', target);
  return url.pathname + url.search;
}
