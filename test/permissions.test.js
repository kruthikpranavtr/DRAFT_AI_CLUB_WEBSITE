import assert from 'node:assert/strict';
import test from 'node:test';
import { hasPermission,isSuperAdmin,PERMISSIONS } from '../server/permissions.js';

test('students never receive administrator permissions',() => {
  const student = { role:'student',permissions:[PERMISSIONS.SUPER_ADMIN,PERMISSIONS.MANAGE_STUDENTS] };
  assert.equal(isSuperAdmin(student),false);
  assert.equal(hasPermission(student,PERMISSIONS.MANAGE_STUDENTS),false);
});

test('regular admins receive only explicit or domain wildcard permissions',() => {
  const admin = { role:'admin',permissions:[PERMISSIONS.MANAGE_STUDENTS,'content:*'] };
  assert.equal(hasPermission(admin,PERMISSIONS.MANAGE_STUDENTS),true);
  assert.equal(hasPermission(admin,PERMISSIONS.CONTENT_NEWS),true);
  assert.equal(hasPermission(admin,PERMISSIONS.MANAGE_ADMINS),false);
});

test('Super Admin permission grants all administrator capabilities',() => {
  const admin = { role:'admin',permissions:[PERMISSIONS.SUPER_ADMIN] };
  assert.equal(isSuperAdmin(admin),true);
  assert.equal(hasPermission(admin,PERMISSIONS.MANAGE_ADMINS),true);
  assert.equal(hasPermission(admin,PERMISSIONS.RELEASE_ASSESSMENTS),true);
});
