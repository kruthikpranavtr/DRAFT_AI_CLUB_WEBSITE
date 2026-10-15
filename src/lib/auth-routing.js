// Presentation routing only. Every API request is still authorized server-side.
export function workspacePath(user) {
  if (!user || !['student','admin'].includes(user.role)) return '/login';
  if (user.must_change_password) return '/change-password';
  return user.role === 'admin' ? '/admin/dashboard' : '/student/dashboard';
}
