import { XMLParser,XMLValidator } from 'fast-xml-parser';
import { newsCategory,safeNewsUrl,opportunityState } from '../../shared/news.js';
export { newsCategory,safeNewsUrl,opportunityState };
export const plainText = (value,limit=600) => Array.from(String(value ?? '').replace(/<[^>]*>/g,' ')).map(char=>char.charCodeAt(0)<32 || char.charCodeAt(0)===127?' ':char).join('').replace(/\s+/g,' ').trim().slice(0,limit);
const list = value => value == null ? [] : Array.isArray(value) ? value : [value];
const text = value => typeof value === 'object' ? value?.['#text'] || '' : value;
export function normalizeDate(value) {
  if (!value || typeof value !== 'string') return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}
export function parseFeed(xml) {
  if (Buffer.byteLength(xml) > 1024*1024 || /<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error('Unsafe or oversized XML.');
  if (XMLValidator.validate(xml) !== true) throw new Error('Malformed XML.');
  const root = new XMLParser({ ignoreAttributes:false,removeNSPrefix:true,parseTagValue:false,processEntities:true,htmlEntities:false }).parse(xml);
  const isAtom = Boolean(root.feed);
  if (!isAtom && !root.rss?.channel && !root.RDF) throw new Error('Not an RSS/Atom feed.');
  return list(isAtom ? root.feed.entry : root.rss?.channel?.item || root.RDF?.item).slice(0,100).map(entry => {
    const links = list(entry.link);
    const link = isAtom ? links.find(item => item['@_rel'] === 'alternate' && (!item['@_type'] || item['@_type'] === 'text/html')) || links.find(item => !item['@_rel']) : null;
    return {
      title:text(entry.title),url:isAtom ? link?.['@_href'] || text(entry.id) : text(entry.link),
      externalId:text(entry.id || entry.guid),publishedAt:text(entry.published || entry.pubDate || entry.date || entry.updated),
      categories:list(entry.category).map(item => item['@_term'] || text(item)),
    };
  });
}
export function normalizeArticle(entry,source,clock=Date.now()) {
  const title = plainText(entry.title,220);
  let rawUrl = entry.url;
  // arXiv's API historically returns http abstract links; upgrade only its known host.
  if (source.id === 'arxiv-research' && String(rawUrl).startsWith('http://arxiv.org/abs/')) rawUrl = rawUrl.replace('http:','https:');
  let canonicalUrl = safeNewsUrl(rawUrl);
  // Some official event feeds place the EVENT START, not publication date,
  // in RSS pubDate. Treat first collection as discovery/publication timestamp,
  // and preserve the dated event information separately for admin review.
  const eventStart = source.feedDateMeaning==='event-start' ? normalizeDate(entry.publishedAt) : null;
  const publishedAt = source.feedDateMeaning==='event-start'
    ? new Date(clock).toISOString()
    : normalizeDate(entry.publishedAt);
  if (source.feedDateMeaning==='event-start' &&
      (source.contentType!=='event' || !eventStart ||
       Date.parse(eventStart)>clock+3*366*24*60*60*1000)) throw new Error('Invalid feed event date.');
  if (!title || !canonicalUrl || !publishedAt || Date.parse(publishedAt) > clock+300000) throw new Error('Missing or invalid article metadata.');
  if (!source.articleHosts?.includes(new URL(canonicalUrl).hostname)) throw new Error('Article publisher is not allowlisted.');
  if (source.id === 'arxiv-research' && !/^\/abs\/[\w./-]+$/.test(new URL(canonicalUrl).pathname)) throw new Error('Only arXiv abstract links are permitted.');
  if (source.id === 'arxiv-research') {
    const canonical=new URL(canonicalUrl);
    canonical.pathname=canonical.pathname.replace(/v\d+$/,'');canonical.search='';canonicalUrl=canonical.toString();
  }
  const category = newsCategory([...entry.categories,title].join(' '));
  // Reviewed feeds use a fixed category; event listings cannot be
  // auto-published as AI or technology news because of a title keyword.
  const finalCategory = source.contentType==='event' ? 'Events and Opportunities'
    : source.contentType==='hackathon' ? 'Hackathons'
    : source.categoryPolicy==='fixed' ? source.category
    : ['AI News','Technology News','Hackathons','Events and Opportunities'].includes(category) ? category : source.category;
  if (!['research-metadata','metadata'].includes(source.summaryMode)) throw new Error('No reviewed summary adapter for source.');
  // Only metadata-based, independent summaries; no descriptions, abstracts,
  // complete articles, images or third-party publisher logos.
  const summary = source.summaryMode==='research-metadata'
    ? `Research preprint published on ${publishedAt.slice(0,10)}. Source classification: ${plainText(entry.categories.join(', '),100) || 'not supplied'}. Review the original research and its limitations at the source; preprints may not be peer reviewed.`
    : source.contentType==='event' && eventStart
    ? `Event listing discovered on ${publishedAt.slice(0,10)}. The official ${plainText(source.name,100)} feed lists a scheduled start of ${eventStart.slice(0,10)}. Registration and eligibility need administrator verification. Check the organizer's original listing.`
    : source.contentType==='event'
    ? `Event listing discovered on ${publishedAt.slice(0,10)}. Registration dates, eligibility and event details require administrator verification at the original organizer's listing.`
    : `Update published by ${plainText(source.name,100)} on ${publishedAt.slice(0,10)}. Read the original publisher's announcement for the full details.`;
  return {
    title,summary,canonicalUrl,externalId:plainText(entry.externalId || canonicalUrl,500),
    publishedAt,category:finalCategory,contentType:source.contentType || 'article',
    ...(eventStart ? { opportunity:{startDate:eventStart,verificationStatus:'unverified'} } : {}),
  };
}
