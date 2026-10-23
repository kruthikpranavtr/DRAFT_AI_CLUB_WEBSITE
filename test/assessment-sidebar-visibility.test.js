import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(new URL(path,import.meta.url),'utf8');
const sidebar=read('../src/components/DashboardShell.jsx');
const hook=read('../src/lib/useStudentAssessments.js');
const api=read('../server/routes/assessments.js');
const studentPage=read('../src/pages/StudentAssessmentsPage.jsx');

test('student sidebar hides assessments until an eligible published item is fetched',()=>{
  assert.match(sidebar,/useStudentAssessments\(role==='student'\)/);
  assert.match(sidebar,/!assessmentsLoading&&!assessmentsError&&availableAssessments\.some/);
  assert.match(sidebar,/a\.status==='published'&&a\.availability!=='closed'/);
  assert.match(sidebar,/to!=='\/student\/assessments'\|\|showAssessments/);
  assert.match(sidebar,/role==='student'&&assessmentsLoading/);
  assert.match(sidebar,/<SidebarContent \{\.\.\.sidebarProps\}\/\>/);
  assert.match(hook,/if \(!enabled\) return;/);
  assert.match(hook,/\[refresh,enabled\]/);
});

test('visibility reflects the server-authorized listing and refreshes without signing in again',()=>{
  assert.match(hook,/api\('\/api\/assessments\/student'\)/);
  assert.match(hook,/window\.addEventListener\('focus',check\)/);
  assert.match(hook,/document\.addEventListener\('visibilitychange',check\)/);
  assert.match(hook,/setInterval\(check,45000\)/);
  assert.match(api,/WHERE status='published' AND \(end_at IS NULL OR end_at > \?\)/);
  assert.match(api,/await studentEligible\(a, req\.user\.id\)/);
  assert.match(studentPage,/No assessments available yet\. New assessments will appear here once published\./);
  assert.match(studentPage,/a\.instructions&&/);
});
