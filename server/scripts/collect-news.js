// Railway cron worker: authenticated request, finite lifetime, no DB credentials
// or migration/seed side effects. Default schedule: 0 */6 * * * (UTC).
const origin=process.env.NEWS_API_ORIGIN;
const secret=process.env.NEWS_CRON_SECRET;
try {
  const url=new URL(origin);
  if (url.protocol!=='https:' || url.username || url.password || url.pathname!=='/' || url.search || url.hash || !secret || secret.length<32) throw new Error('Set an HTTPS NEWS_API_ORIGIN and a NEWS_CRON_SECRET of at least 32 characters.');
  const response=await fetch(new URL('/api/internal/news/collect',url),{
    method:'POST',headers:{Authorization:`Bearer ${secret}`},redirect:'error',signal:AbortSignal.timeout(90000),
  });
  if (!response.ok) throw new Error(`Collection endpoint HTTP ${response.status}.`);
  const result=await response.json();
  console.log(JSON.stringify({event:'news.collection',runId:result.id,status:result.status}));
  if (['failed','partial'].includes(result.status)) process.exitCode=1;
} catch(error) {
  console.error(JSON.stringify({event:'news.collection.failed',error:error.message}));
  process.exitCode=1;
}
