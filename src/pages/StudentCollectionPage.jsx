import { ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import DashboardShell from '../components/DashboardShell';
import GalleryPage from './GalleryPage';

// Both student views reuse the public site's published gallery and achievement data.
export default function StudentCollectionPage({ mode }) {
  const isAchievements = mode === 'achievements';
  const title = isAchievements ? 'Achievements' : 'Gallery';
  const publicDestination = isAchievements ? '/gallery?tab=achievements' : '/gallery';
  return <DashboardShell section={title}>
    <div className="dash-page-head">
      <div><span className="portal-eyebrow">STUDENT WORKSPACE</span><h1>{title}</h1></div>
      <div className="portal-head-action"><Link className="dash-action" to={publicDestination}>View on main website <ArrowUpRight size={16} aria-hidden="true"/></Link></div>
    </div>
    <GalleryPage embedded initialMode={mode} />
  </DashboardShell>;
}
