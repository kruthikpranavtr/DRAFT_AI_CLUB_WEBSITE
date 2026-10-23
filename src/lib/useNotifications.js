import { useCallback,useEffect,useState } from 'react';
import { api } from './api';

export const notifyInboxChanged = () => window.dispatchEvent(new Event('aiclub:notifications-changed'));

// Server-persisted alerts. Polling is used rather than claiming push delivery.
// A user only sees notifications after signing in and while connected.
export function useUnreadNotifications(userId) {
  const [unread,setUnread] = useState(0);
  const refresh = useCallback(async () => {
    if (!userId) { setUnread(0); return; }
    try {
      const result = await api('/api/notifications/unread');
      setUnread(Math.max(0,Number(result.unread)||0));
    } catch { setUnread(0); }
  },[userId]);
  useEffect(() => {
    if (!userId) return;
    const handleVisibility = () => { if (!document.hidden) refresh(); };
    const handleChanged = () => refresh();
    const initial = window.setTimeout(refresh,0);
    const timer = window.setInterval(refresh,30000);
    document.addEventListener('visibilitychange',handleVisibility);
    window.addEventListener('aiclub:notifications-changed',handleChanged);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange',handleVisibility);
      window.removeEventListener('aiclub:notifications-changed',handleChanged);
    };
  },[userId,refresh]);
  return {unread,refresh};
}

export function notificationDestination(item,role) {
  const raw = item?.link || '/notifications';
  if (raw.startsWith('/community/posts/')) {
    const postId=raw.slice('/community/posts/'.length);
    if (/^[0-9a-f-]{36}$/i.test(postId)) return role === 'admin'
      ? '/admin/community/posts/'+postId : '/student/community/posts/'+postId;
  }
  if (raw === '/assessments') return role === 'admin' ? '/admin/assessments' : '/student/assessments';
  return ['/', '/news', '/gallery', '/about', '/notifications'].includes(raw) ? raw : '/notifications';
}
