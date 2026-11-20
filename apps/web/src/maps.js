/* روابط الخرائط: Google Maps وWaze (الأكثر استخداماً في العراق).
   نقبل رابط أي منهما، ونبني الآخر من الإحداثيات إن وُجدت في الرابط، وإلا من نص العنوان. */
const COORDS = [/@(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/, /[?&](?:ll|q|query|destination|daddr)=(-?\d{1,3}\.\d+)(?:,|%2C)(-?\d{1,3}\.\d+)/i, /!3d(-?\d{1,3}\.\d+)!4d(-?\d{1,3}\.\d+)/];
export function mapKind(url) {
  try {
    const h = new URL(url).hostname.toLowerCase();
    if (h === 'waze.com' || h.endsWith('.waze.com')) return 'waze';
    if (/(^|\.)google\.[a-z.]+$/.test(h) || h === 'goo.gl' || h.endsWith('.goo.gl') || h === 'maps.app.goo.gl') return 'google';
  } catch { /* رابط غير صالح */ }
  return url ? 'other' : '';
}
export function mapLinks(url, address) {
  const kind = mapKind(url);
  let ll = null;
  let dec = url || '';
  try { dec = decodeURIComponent(dec); } catch { /* ترميز % تالف: نستخدم النص كما هو */ }
  for (const re of COORDS) { const m = dec && re.exec(dec); if (m) { ll = `${m[1]},${m[2]}`; break; } }
  const q = encodeURIComponent((address || '').trim());
  const google = kind === 'google' ? url : ll ? `https://www.google.com/maps/search/?api=1&query=${ll}` : q ? `https://www.google.com/maps/search/?api=1&query=${q}` : '';
  const waze = kind === 'waze' ? url : ll ? `https://waze.com/ul?ll=${ll}&navigate=yes` : q ? `https://waze.com/ul?q=${q}&navigate=yes` : '';
  return { kind, google, waze, other: kind === 'other' ? url : '' };
}
