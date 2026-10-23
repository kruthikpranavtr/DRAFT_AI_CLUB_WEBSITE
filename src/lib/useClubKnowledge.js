import { useEffect, useState } from 'react';

const initial={
  content:[],gallery:[],settings:{},
  available:{content:false,gallery:false,settings:false}
};

// Only public, published CMS endpoints. No private profiles or credentials are indexed.
export function useClubKnowledge(enabled=true) {
  const [knowledge,setKnowledge]=useState(initial);
  useEffect(()=>{
    if (!enabled) return;
    let active=true;
    const refresh=async()=>{
      const calls=[
        ['content','/api/public/content'],
        ['gallery','/api/public/gallery'],
        ['settings','/api/public/settings']
      ];
      const results=await Promise.allSettled(calls.map(async ([,url])=>{
        const response=await fetch(url,{credentials:'omit'});
        if(!response.ok)throw Error('Public knowledge unavailable');
        return response.json();
      }));
      if(!active)return;
      setKnowledge(previous=>{
        const next={
          content:previous.content,gallery:previous.gallery,settings:previous.settings,
          available:{...previous.available}
        };
        for(let i=0;i<calls.length;i++){
          const key=calls[i][0],result=results[i];
          if(result.status==='fulfilled'){
            if(key==='settings')next.settings=result.value?.settings||{};
            else next[key]=Array.isArray(result.value?.items)?result.value.items:[];
            next.available[key]=true;
          }else{
            next.available[key]=false;
          }
        }
        return next;
      });
    };
    refresh();
    const onFocus=()=>{if(!document.hidden)refresh();};
    window.addEventListener('focus',onFocus);
    document.addEventListener('visibilitychange',onFocus);
    const timer=window.setInterval(onFocus,120000);
    return ()=>{
      active=false;
      window.clearInterval(timer);
      window.removeEventListener('focus',onFocus);
      document.removeEventListener('visibilitychange',onFocus);
    };
  },[enabled]);
  return knowledge;
}
