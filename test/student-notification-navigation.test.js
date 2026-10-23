import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const shell=fs.readFileSync(new URL('../src/components/DashboardShell.jsx',import.meta.url),'utf8');
const app=fs.readFileSync(new URL('../src/App.jsx',import.meta.url),'utf8');
const page=fs.readFileSync(new URL('../src/pages/NotificationsPage.jsx',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../src/components/Dashboard.css',import.meta.url),'utf8');
const notifications=fs.readFileSync(new URL('../src/lib/useNotifications.js',import.meta.url),'utf8');

test('student sidebar keeps the five existing sections in the original order without notifications',()=>{
  const student=shell.match(/student:\[(.*?)\],\s*admin:/s)?.[1];
  assert.ok(student,'Student navigation is defined');
  assert.deepEqual(Array.from(student.matchAll(/\['([^']+)','([^']+)'/g),x=>[x[1],x[2]]),[
    ['/student/dashboard','Overview'],
    ['/student/community','Community'],
    ['/student/assessments','Assessments'],
    ['/student/profile','My profile'],
    ['/student/members','Member directory'],
  ]);
  assert.doesNotMatch(student,/['"]Notifications['"]/);
  assert.match(shell,/admin:\[.*\['\/notifications','Notifications',Bell\]/);
});

test('dashboard header bell uses a router link, accessible label, active state, and real unread count',()=>{
  assert.match(shell,/<Link to="\/notifications" className=\{/);
  assert.match(shell,/aria-current=\{location\.pathname === '\/notifications' \? 'page' : undefined\}/);
  assert.match(shell,/Open notifications/);
  assert.match(shell,/unread>0&&<span className="dash-notification-badge"/);
  assert.match(shell,/\{unread>99\?'99\+':unread\}/);
  assert.match(css,/\.dash-notification-link\.is-active/);
  assert.match(css,/\.dash-notification-badge/);
  assert.doesNotMatch(shell,/<button[^>]+aria-label="Open notifications"/);
});

test('existing notifications route, dashboard wrapper, inbox and unread refresh remain functional',()=>{
  assert.match(app,/<Route path="\/notifications" element=\{<ProtectedRoute><NotificationsPage/);
  assert.match(page,/<DashboardShell section="Notifications">/);
  assert.match(page,/<h1>Notifications<\/h1>/);
  assert.match(page,/You're all caught up/);
  assert.match(page,/notifyInboxChanged\(\)/);
  assert.match(page,/\/api\/notifications\/read-all/);
  assert.match(notifications,/aiclub:notifications-changed/);
  assert.match(notifications,/\/api\/notifications\/unread/);
});
