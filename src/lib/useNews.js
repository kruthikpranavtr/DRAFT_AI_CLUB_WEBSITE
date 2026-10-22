import { useEffect,useState } from 'react';
import { api } from './api';

export function useNews({filter,search,archived}) {
  const queryKey=JSON.stringify([filter,search,archived]);
  const [state,setState]=useState({key:queryKey,items:[],total:0,loading:true,error:'',offset:0});
  const [pagination,setPagination]=useState({key:queryKey,page:0});
  const [retry,setRetry]=useState(0);
  const page=pagination.key===queryKey?pagination.page:0;
  useEffect(() => {
    const controller=new AbortController();
    const timer=setTimeout(async() => {
      setState(current => ({...current,key:queryKey,loading:true,error:'',...(page===0?{items:[],total:0}: {})}));
      const params=new URLSearchParams({limit:'20',offset:String(page*20),archived:String(archived)});
      if (filter!=='All') params.set('category',filter);
      if (search.trim()) params.set('search',search.trim());
      try {
        const data=await api('/api/public/news?'+params,{signal:controller.signal});
        if (!controller.signal.aborted) setState(current => ({key:queryKey,items:page===0?data.items:[...new Map([...current.items,...data.items].map(item => [item.id,item])).values()],total:data.total,loading:false,error:'',offset:page*20}));
      } catch(error) { if (!controller.signal.aborted) setState(current => ({...current,loading:false,error:error.message})); }
    },search?250:0);
    return () => { clearTimeout(timer); controller.abort(); };
  },[filter,search,archived,page,retry,queryKey]);
  return {...(state.key===queryKey?state:{items:[],total:0,loading:true,error:''}),more:() => {
    setState(current=>({...current,loading:true}));
    setPagination(current=>({key:queryKey,page:current.key===queryKey?current.page+1:1}));
  },retry:() => setRetry(current => current+1)};
}
