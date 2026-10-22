import fs from 'node:fs';
export const sourceCatalog=JSON.parse(fs.readFileSync(new URL('./sources.json',import.meta.url),'utf8'));
export const approvedSourceIds=sourceCatalog.filter(source => source.verified).map(source => source.id);
