import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { workspacePath } from '../src/lib/auth-routing.js';

test('verified server roles select their own workspace',() => {
  assert.equal(workspacePath({role:'student',must_change_password:false}),'/student/dashboard');
  assert.equal(workspacePath({role:'admin',must_change_password:false}),'/admin/dashboard');
  assert.equal(workspacePath(null),'/login');
  assert.equal(workspacePath({role:'super-admin'}),'/login');
});
test('temporary passwords take precedence over either workspace',() => {
  for (const role of ['student','admin']) assert.equal(workspacePath({role,must_change_password:true}),'/change-password');
});
test('only one frontend login exists and legacy login is a redirect',() => {
  const app = fs.readFileSync(new URL('../src/App.jsx',import.meta.url),'utf8');
  assert.match(app,/<Route path="\/login" element=\{<LoginPage \/>\}/);
  assert.match(app,/<Route path="\/admin\/login" element=\{<Navigate to="\/login" replace \/>\}/);
  const context = fs.readFileSync(new URL('../src/context/AuthContext.jsx',import.meta.url),'utf8');
  assert.doesNotMatch(context,/signInAdmin|\/api\/auth\/admin\/login/);
  for (const file of ['StudentLoginPage.jsx','AdminLoginPage.jsx']) assert.equal(fs.existsSync(new URL(`../src/pages/${file}`,import.meta.url)),false);
  for (const file of ['../src/pages/LoginPage.jsx','../src/components/PortalAuth.jsx']) {
    const source = fs.readFileSync(new URL(file,import.meta.url),'utf8');
    assert.doesNotMatch(source,/role="tab"|<select|Administrator access|Student sign in|setRole/);
  }
});
