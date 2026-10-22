import https from 'node:https';
import dns from 'node:dns/promises';
import { isIP } from 'node:net';
import { safeNewsUrl } from '../../shared/news.js';
import { sourceCatalog } from './catalog.js';

export function isPublicAddress(address) {
  // Fail closed for IPv6 (including IPv4-mapped forms) until explicitly supported.
  if (isIP(address) !== 4) return false;
  const [a,b,c] = address.split('.').map(Number);
  return !(a===0 || a===10 || a===127 || a>=224 || (a===100 && b>=64 && b<=127) ||
    (a===169 && b===254) || (a===172 && b>=16 && b<=31) ||
    (a===192 && ((b===0 && [0,2].includes(c)) || b===168 || (b===88 && c===99))) ||
    (a===198 && (b===18 || b===19 || (b===51 && c===100))) || (a===203 && b===0 && c===113));
}
export async function fetchSource(source,{ lookup=dns.lookup }={}) {
  if (!source.verified || !source.url || !safeNewsUrl(source.url) || !sourceCatalog.some(item => item.id===source.id && item.verified && item.url===source.url)) throw new Error('Source is not approved.');
  const url = new URL(source.url);
  let dnsTimer;
  const addresses = await Promise.race([lookup(url.hostname,{ family:4,all:true,verbatim:true }),new Promise((_,reject) => { dnsTimer=setTimeout(() => reject(new Error('Source DNS timeout.')),3000); })]).finally(() => clearTimeout(dnsTimer));
  if (!addresses.length || addresses.some(item => !isPublicAddress(item.address))) throw new Error('Source DNS is not public.');
  const address = addresses.find(item => item.family===4);
  if (!address) throw new Error('No permitted source address.');
  return new Promise((resolve,reject) => {
    const request = https.get(url,{
      // Pin the validated DNS result to prevent DNS-rebinding TOCTOU attacks.
      lookup:(_host,options,callback) => options?.all
        ? callback(null,[address]) : callback(null,address.address,address.family),
      headers:{ Accept:'application/atom+xml,application/rss+xml,application/xml,text/xml', 'User-Agent':'AIClubNews/1.0 (metadata discovery; six-hour polling)', 'Accept-Encoding':'identity' },
    },response => {
      if (response.statusCode!==200) {
        response.destroy();
        const error=new Error(`Source HTTP ${response.statusCode}; redirects are not followed.`);
        const retry=response.headers['retry-after'];
        error.retryAfterSeconds=retry ? Math.max(0,Number(retry) || Math.ceil((Date.parse(retry)-Date.now())/1000) || 0) : 0;
        reject(error); return;
      }
      if (!/(xml|rss|atom)/i.test(response.headers['content-type'] || '') || Number(response.headers['content-length'])>1048576) {
        response.destroy(); reject(new Error('Source content type or length rejected.')); return;
      }
      let size=0;
      const chunks=[];
      response.on('data',chunk => {
        size+=chunk.length;
        if (size>1048576) { response.destroy(new Error('Source body exceeds limit.')); return; }
        chunks.push(chunk);
      });
      response.on('error',reject);
      response.on('end',() => resolve(Buffer.concat(chunks).toString('utf8')));
    });
    const timer=setTimeout(() => request.destroy(new Error('Source request timeout.')),12000);
    request.on('close',() => clearTimeout(timer));
    request.on('error',reject);
  });
}
