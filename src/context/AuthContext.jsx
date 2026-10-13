import { createContext, useContext, useMemo, useState } from 'react';

const SESSION_KEY = 'ai-club-mock-session';

export const MOCK_ACCOUNTS = {
  student: {
    email: 'student@srishakthi.ac.in',
    password: 'Student@123',
    name: 'AI Club Student',
    id: 'SSAC-2026-014',
  },
  admin: {
    email: 'admin@srishakthi.ac.in',
    password: 'Admin@123',
    name: 'Club Administrator',
    id: 'ADMIN-01',
  },
};

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY) || 'null'); }
    catch { return null; }
  });

  function signIn(role, email, password, remember = true) {
    const account = MOCK_ACCOUNTS[role];
    if (!account || email !== account.email || password !== account.password) {
      return { ok:false, message:'These details do not match the selected mock account.' };
    }
    const nextSession = { role, name:account.name, email:account.email, id:account.id };
    setSession(nextSession);
    localStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_KEY);
    if (remember) localStorage.setItem(SESSION_KEY, JSON.stringify(nextSession));
    else sessionStorage.setItem(SESSION_KEY, JSON.stringify(nextSession));
    return { ok:true, user:nextSession };
  }

  function signOut() {
    setSession(null);
    localStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_KEY);
  }

  const value = useMemo(() => ({ session, signIn, signOut }), [session]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
