import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');

function readEnv(filePath) {
  return Object.fromEntries(fs.readFileSync(filePath,'utf8')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#'))
    .map(line => {
      const separator = line.indexOf('=');
      return [line.slice(0,separator),line.slice(separator + 1)];
    }));
}

test('development configuration isolates the experimental UI, API, database, and uploads',async () => {
  const env = readEnv(path.join(projectRoot,'.env.development'));
  assert.equal(env.VITE_WEB_PORT,'5174');
  assert.equal(env.VITE_WEB_HOST,'127.0.0.1');
  assert.equal(env.VITE_API_PORT,'3002');
  assert.equal(env.PORT,'3002');
  assert.equal(env.DATABASE_PATH,'server/data/ai-club-member-platform.db');
  assert.equal(env.UPLOAD_DIR,'server/member-platform-uploads');
  assert.deepEqual(new Set(env.ALLOWED_ORIGINS.split(',')),new Set([
    'http://127.0.0.1:5174',
    'http://localhost:5174',
  ]));
  assert.equal(env.ALLOWED_ORIGINS.includes('5173'),false);

  const previous = { ...process.env };
  Object.assign(process.env,env);
  const { default:createViteConfig } = await import('../vite.config.js');
  const config = await createViteConfig({ mode:'development',command:'serve' });
  assert.equal(config.server.port,5174);
  assert.equal(config.server.host,'127.0.0.1');
  assert.equal(config.server.strictPort,true);
  assert.equal(config.server.proxy['/api'].target,'http://127.0.0.1:3002');
  for (const key of Object.keys(process.env)) if (!(key in previous)) delete process.env[key];
  Object.assign(process.env,previous);
});
