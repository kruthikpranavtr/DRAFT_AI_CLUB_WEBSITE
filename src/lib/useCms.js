import { useEffect, useState } from 'react';
import { get } from './api';

export function usePublishedContent({ page,type } = {}) {
  const [items,setItems] = useState([]);
  const [loading,setLoading] = useState(true);
  useEffect(() => {
    const params = new URLSearchParams();
    if (page) params.set('page',page);
    if (type) params.set('type',type);
    let active = true;
    get('/api/public/content?'+params)
      .then(data => { if (active) setItems(data.items); })
      .catch(() => { if (active) setItems([]); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  },[page,type]);
  return { items,loading };
}

export function usePublicSettings() {
  const [settings,setSettings] = useState({});
  useEffect(() => {
    let active = true;
    get('/api/public/settings').then(data => { if (active) setSettings(data.settings); }).catch(() => {});
    return () => { active = false; };
  },[]);
  return settings;
}
