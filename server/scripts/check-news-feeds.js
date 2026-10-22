// Read-only source health check. No database connections or persistence.
import { sourceCatalog } from '../news/catalog.js';
import { fetchSource } from '../news/fetch.js';
import { parseFeed,normalizeArticle } from '../news/normalize.js';

const ids=['nasa-technology','nist-information-technology','nist-events'];
let errors=0;
for (const id of ids) {
  const source=sourceCatalog.find(item => item.id===id);
  try {
    const xml=await fetchSource(source);
    const items=parseFeed(xml);
    let accepted=0;
    const categories={};
    const rejected={};
    const publishers={};
    for (const entry of items) {
      try {
        const article=normalizeArticle(entry,source);
        accepted++;
        categories[article.category]=(categories[article.category] || 0)+1;
        publishers[new URL(article.canonicalUrl).hostname]=(publishers[new URL(article.canonicalUrl).hostname] || 0)+1;
      } catch (error) {
        rejected[error.message]=(rejected[error.message] || 0)+1;
      }
    }
    console.log(JSON.stringify({sourceId:id,feedItems:items.length,accepted,rejected,categories,publishers,byteLength:Buffer.byteLength(xml)}));
    if (!accepted) errors++;
  } catch (error) {
    console.error(JSON.stringify({sourceId:id,error:error.message}));
    errors++;
  }
}
if (errors) process.exitCode=1;
