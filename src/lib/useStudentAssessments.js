import { useCallback,useEffect,useRef,useState } from 'react';
import { api } from './api';

// Server response is authoritative. Refresh on focus, return to tab, and
// periodic checks so publishing/withdrawal appears without reauthentication.
export function useStudentAssessments(enabled=true) {
  const [items,setItems]=useState([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const mounted=useRef(false);
  const serial=useRef(0);
  const refresh=useCallback(async () => {
    const request=++serial.current;
    try {
      const result=await api('/api/assessments/student');
      if (mounted.current && request===serial.current) {
        setItems(result.items||[]);
        setError('');
      }
    } catch (cause) {
      if (mounted.current && request===serial.current) {
        setItems([]);
        setError(cause.message);
      }
    } finally {
      if (mounted.current && request===serial.current) setLoading(false);
    }
  },[]);
  useEffect(()=>{
    if (!enabled) return;
    mounted.current=true;
    refresh();
    const check=()=>{if(!document.hidden)refresh();};
    window.addEventListener('focus',check);
    document.addEventListener('visibilitychange',check);
    window.addEventListener('aiclub:assessments-changed',check);
    const timer=setInterval(check,45000);
    return ()=>{
      mounted.current=false;
      serial.current++;
      clearInterval(timer);
      window.removeEventListener('focus',check);
      document.removeEventListener('visibilitychange',check);
      window.removeEventListener('aiclub:assessments-changed',check);
    };
  },[refresh,enabled]);
  return {items:enabled?items:[],loading:enabled&&loading,error:enabled?error:'',refresh};
}
