import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const navbar = fs.readFileSync(new URL('../src/components/Navbar.jsx', import.meta.url), 'utf8');
const loginPage = fs.readFileSync(new URL('../src/pages/LoginPage.jsx', import.meta.url), 'utf8');
const app = fs.readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');

test('the public navbar uses the shared auth session instead of always asking for login', () => {
  assert.match(navbar, /useAuth\(\)/);
  assert.match(navbar, /loading\s*\?/);
  assert.match(navbar, /session\s*\?/);
  assert.match(navbar, /session\.member_id/);
  assert.match(navbar, /site-nav__profile-trigger/);
  assert.match(navbar, /<Link to="\/login"/);
  assert.match(navbar, /workspacePath\(session\)/);
});

test('public account menu offers member profile, workspace and sign out', () => {
  assert.match(navbar, /session\.role === 'student'/);
  assert.match(navbar, /to="\/student\/profile"/);
  assert.match(navbar, /My dashboard/);
  assert.match(navbar, /await signOut\(\)/);
  assert.match(navbar, /aria-expanded=\{accountOpen\}/);
});

test('already authenticated members bypass the login form', () => {
  assert.match(loginPage, /if \(loading\)/);
  assert.match(loginPage, /if \(session\) return <Navigate to=\{workspacePath\(session\)\} replace/);
});

test('public notifications remain mounted on every public route', () => {
  assert.match(app, /!standalone && <><Navbar\/><SiteAnnouncement\/><\/>/);
  const banner = fs.readFileSync(new URL('../src/components/SiteAnnouncement.jsx', import.meta.url), 'utf8');
  assert.match(banner, /announcement\.enabled/);
  assert.match(banner, /announcement\.text/);
});
