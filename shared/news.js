export const NEWS_CATEGORIES = ['AI News','Technology News','Hackathons','Events and Opportunities'];
export const LEGACY_NEWS_CATEGORIES = ['Announcements','Events','Workshops','Achievements'];
export function newsCategory(value) {
  const text = String(value || '').toLowerCase();
  const exact = [...NEWS_CATEGORIES,...LEGACY_NEWS_CATEGORIES].find(item => item.toLowerCase() === text);
  if (exact) return exact;
  if (/hackathon|competition|coding contest/.test(text)) return 'Hackathons';
  if (/workshop|webinar|conference|opportunit/.test(text)) return 'Events and Opportunities';
  if (/cs\.(ai|lg)|machine learning|generative|artificial intelligence/.test(text)) return 'AI News';
  if (/cs\.se|software|cybersecurity|cloud|robotics|open.source/.test(text)) return 'Technology News';
  if (/achiev|award|contest/.test(text)) return 'Achievements';
  if (/announc|update/.test(text)) return 'Announcements';
  return 'Events';
}
export function safeNewsUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443')) return null;
    const host = url.hostname.toLowerCase();
    if (host.endsWith('.') || !host.includes('.') || /^[\d.]+$/.test(host) || host.includes(':') || /(^|\.)(localhost|local|internal|test|invalid)$/.test(host)) return null;
    url.hash = '';
    const tracking=Array.from(url.searchParams.keys()).filter(key=>/^(utm_|fbclid$|gclid$)/i.test(key));
    for (const key of tracking) url.searchParams.delete(key);
    url.searchParams.sort();
    return url.toString();
  } catch { return null; }
}
export function opportunityState(details, clock = Date.now()) {
  const event = details?.opportunity || {};
  const deadline = event.registrationDeadline;
  const end = event.endDate || details?.expires_at;
  return {
    expired: Boolean(deadline && Date.parse(deadline) <= clock),
    completed: Boolean(end && Date.parse(end) <= clock),
    verified: event.verificationStatus === 'verified',
  };
}
