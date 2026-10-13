import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const AuthContext = createContext(null);

async function request(path, options = {}) {
  const response = await fetch(path, {
    credentials:'include',
    headers:options.body instanceof FormData ? options.headers : { 'Content-Type':'application/json', ...options.headers },
    ...options,
  });
  const body = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.error || 'The request could not be completed.');
  return body;
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    request('/api/auth/me')
      .then(data => { if (active) setSession(data.user); })
      .catch(() => { if (active) setSession(null); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function signIn(identifier, password, remember = true) {
    try {
      const data = await request('/api/auth/login', {
        method:'POST',
        body:JSON.stringify({ identifier,password,remember }),
      });
      setSession(data.user);
      return { ok:true,user:data.user };
    } catch (error) {
      return { ok:false,message:error.message };
    }
  }

  async function signOut() {
    try { await request('/api/auth/logout', { method:'POST' }); }
    finally { setSession(null); }
  }

  const value = useMemo(() => ({ session,loading,signIn,signOut }), [session,loading]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
