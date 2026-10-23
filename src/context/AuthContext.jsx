import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, clearClientCsrfToken } from '../lib/api';

const AuthContext = createContext(null);

// Render's free preview can take time to wake up. A temporary network error
// must not be confused with a wrong password or an expired saved session.
async function checkSavedSession() {
  let lastError;
  for (let attempt=0;attempt<5;attempt++) {
    try {
      const data=await api('/api/auth/me');
      return {user:data.user,error:null};
    } catch(error) {
      if (error.status===401) return {user:null,error:null};
      lastError=error;
      if (attempt<4) await new Promise(resolve=>setTimeout(resolve,1500*(attempt+1)));
    }
  }
  return {user:null,error:lastError?.message || 'The service is temporarily unavailable.'};
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [connectionError, setConnectionError] = useState('');

  const refreshSession = useCallback(async () => {
    const state=await checkSavedSession();
    setConnectionError(state.error || '');
    if (!state.error) setSession(state.user);
    return state.user;
  }, []);

  useEffect(() => {
    let active=true;
    const expireSession=()=>{ if(active) setSession(null); };
    window.addEventListener('aiclub:session-expired',expireSession);
    checkSavedSession().then(state=>{
      if (!active) return;
      setConnectionError(state.error || '');
      if(!state.error) setSession(state.user);
    }).finally(()=>{if(active)setLoading(false);});
    return ()=>{ active=false;window.removeEventListener('aiclub:session-expired',expireSession); };
  },[]);

  const signIn = useCallback(async (identifier,password,remember = true) => {
    try {
      const data=await api('/api/auth/login',{
        method:'POST',body:JSON.stringify({identifier,password,remember}),
      });
      setConnectionError('');
      setSession(data.user);
      return {ok:true,user:data.user};
    } catch(error) {
      return {ok:false,message:error.message};
    }
  },[]);

  const signOut = useCallback(async () => {
    try { await api('/api/auth/logout',{method:'POST'}); }
    finally { clearClientCsrfToken();setSession(null); }
  },[]);

  const changePassword = useCallback(async (currentPassword,newPassword) => {
    try {
      await api('/api/auth/change-password',{
        method:'POST',body:JSON.stringify({currentPassword,newPassword}),
      });
      const user=await refreshSession();
      if(!user)return {ok:false,message:'Password updated. Sign in again to continue.'};
      return {ok:true,user};
    }catch(error){return {ok:false,message:error.message,issues:error.issues};}
  },[refreshSession]);

  const value=useMemo(()=>({
    session,loading,connectionError,signIn,signOut,changePassword,refreshSession,
  }),[session,loading,connectionError,signIn,signOut,changePassword,refreshSession]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value=useContext(AuthContext);
  if(!value)throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
