import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function readEnv(filePath) {
  return Object.fromEntries(fs.readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#'))
    .map(line => {
      const separator = line.indexOf('=');
      return [line.slice(0, separator), line.slice(separator + 1)];
    }));
}

test('original development configuration uses isolated local web/API ports and PostgreSQL', async () => {
  const env = readEnv(path.join(projectRoot, '.env.development'));

  // The original project relies on Vite defaults for optional VITE_* values.
  // Do not require the separate experimental worktree's SQLite/upload settings.
  assert.equal(Number(env.VITE_WEB_PORT || 5174), 5174);
  assert.equal(env.VITE_WEB_HOST || '127.0.0.1', '127.0.0.1');
  assert.equal(Number(env.VITE_API_PORT || 3002), 3002);
  assert.equal(env.VITE_API_ORIGIN || 'http://127.0.0.1:3002', 'http://127.0.0.1:3002');
  assert.equal(env.PORT, '3002');

  const databaseUrl = new URL(env.DATABASE_URL);
  assert.equal(databaseUrl.protocol, 'postgresql:');
  assert.equal(databaseUrl.hostname, '127.0.0.1');
  assert.equal(databaseUrl.port, '5434');
  assert.equal(databaseUrl.pathname, '/aiclub_db');
  assert.equal(env.DATABASE_SSL, 'false');

  assert.deepEqual(new Set(env.ALLOWED_ORIGINS.split(',')), new Set([
    'http://127.0.0.1:5174',
    'http://localhost:5174',
  ]));
  assert.equal(env.ALLOWED_ORIGINS.includes('5173'), false);

  const { default: createViteConfig } = await import('../vite.config.js');
  const config = await createViteConfig({ mode: 'development', command: 'serve' });
  assert.equal(config.server.port, 5174);
  assert.equal(config.server.host, '127.0.0.1');
  assert.equal(config.server.strictPort, true);
  assert.equal(config.server.proxy['/api'].target, 'http://127.0.0.1:3002');
});
