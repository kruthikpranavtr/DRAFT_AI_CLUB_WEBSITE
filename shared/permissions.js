// Shared capability vocabulary; the server remains the authorization authority.
export const PERMISSIONS = Object.freeze({
  SUPER_ADMIN:'platform:super-admin',
  MANAGE_ADMINS:'admins:manage',
  MANAGE_STUDENTS:'users:manage-students',
  MODERATE_COMMUNITY:'community:moderate',
  SEND_NOTIFICATIONS:'notifications:send',
  MANAGE_ASSESSMENTS:'assessments:manage',
  GRADE_ASSESSMENTS:'assessments:grade',
  RELEASE_ASSESSMENTS:'assessments:release',
  VERIFY_AWARDS:'awards:verify',
  CONTENT_NEWS:'content:news',
  CONTENT_GALLERY:'content:gallery',
  CONTENT_ABOUT:'content:about',
  CONTENT_SITE:'content:site',
  READ_AUDIT:'audit:read',
  MANAGE_SETTINGS:'settings:manage',
});

export function permissionList(user) {
  return Array.isArray(user?.permissions) ? user.permissions : [];
}

export function isSuperAdmin(user) {
  return user?.role === 'admin' && permissionList(user).includes(PERMISSIONS.SUPER_ADMIN);
}

export function hasPermission(user, permission) {
  if (user?.role !== 'admin') return false;
  if (isSuperAdmin(user)) return true;
  const permissions = permissionList(user);
  if (permissions.includes(permission)) return true;
  const separator = permission.indexOf(':');
  return separator > 0 && permissions.includes(`${permission.slice(0,separator)}:*`);
}
