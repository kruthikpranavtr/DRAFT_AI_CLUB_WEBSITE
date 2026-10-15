import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, clearClientCsrfToken } from '../lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  const refreshSession = useCallback(async () => {
    try {
      const data = await api('/api/auth/me');
      setSession(data.user);
      return data.user;
    } catch {
      setSession(null);
      return null;
    }
  }, []);

  useEffect(() => {
    let active = true;
    const expireSession = () => setSession(null);
    window.addEventListener('aiclub:session-expired',expireSession);
    api('/api/auth/me')
      .then(data => { if (active) setSession(data.user); })
      .catch(() => { if (active) setSession(null); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; window.removeEventListener('aiclub:session-expired',expireSession); };
  }, []);

  const signIn = useCallback(async (identifier,password,remember = true) => {
    try {
      const data = await api('/api/auth/login', {
        method:'POST',
        body:JSON.stringify({ identifier,password,remember }),
      });
      setSession(data.user);
      return { ok:true,user:data.user };
    } catch (error) {
      return { ok:false,message:error.message };
    }
  }, []);

  const signOut = useCallback(async () => {
    try { await api('/api/auth/logout',{ method:'POST' }); }
    finally { clearClientCsrfToken(); setSession(null); }
  }, []);

  const changePassword = useCallback(async (currentPassword,newPassword) => {
    try {
      await api('/api/auth/change-password',{
        method:'POST',body:JSON.stringify({ currentPassword,newPassword }),
      });
      const user = await refreshSession();
      if (!user) return { ok:false,message:'Password updated. Sign in again to continue.' };
      return { ok:true,user };
    } catch (error) {
      return { ok:false,message:error.message,issues:error.issues };
    }
  },[refreshSession]);

  const value = useMemo(() => ({
    session,loading,signIn,signOut,changePassword,refreshSession,
  }), [session,loading,signIn,signOut,changePassword,refreshSession]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
