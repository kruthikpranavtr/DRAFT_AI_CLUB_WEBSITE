import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const root=new URL('../',import.meta.url);
const source=readFileSync(new URL('server/scripts/portable-demo.js',root),'utf8');
const scripts=JSON.parse(readFileSync(new URL('package.json',root),'utf8')).scripts;

test('portable demo uses isolated PGlite, not any configured production database',()=>{
  assert.match(source,/process\.env\.NODE_ENV === 'production'/);
  assert.match(source,/process\.env\.DATABASE_URL \|\| process\.env\.TEST_DATABASE_URL/);
  assert.match(source,/new PGLiteSocketServer\(\{db:database,host:'127\.0\.0\.1'/);
  assert.match(source,/server','data','portable-demo-postgres'/);
  assert.match(source,/runPostgresMigrations\(pool\)/);
});

test('clone demo starts its own API/frontend and ships student/admin examples',()=>{
  assert.equal(scripts['demo:setup'],'node server/scripts/portable-demo.js --setup-only');
  assert.equal(scripts['demo:dev'],'node server/scripts/portable-demo.js');
  assert.match(source,/BOOTSTRAP_ADMIN_ID:'DEMO-ADMIN'/);
  assert.match(source,/BOOTSTRAP_STUDENT_ID:'DEMO-STUDENT'/);
  assert.match(source,/assessment_questions\(id,assessment_id,source_question_id/);
  assert.match(source,/ON CONFLICT\(id\) DO NOTHING/);
  assert.match(source,/app\.listen\(3003,'127\.0\.0\.1'/);
  assert.match(source,/VITE_WEB_PORT:'5175'/);
});
