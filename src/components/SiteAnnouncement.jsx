import { Megaphone } from 'lucide-react';
import { usePublicSettings } from '../lib/useCms';

export default function SiteAnnouncement() {
  const settings = usePublicSettings();
  if (!settings['announcement.enabled'] || !settings['announcement.text']) return null;
  return <div className="site-announcement"><Megaphone size={14}/><span>{settings['announcement.text']}</span></div>;
}
