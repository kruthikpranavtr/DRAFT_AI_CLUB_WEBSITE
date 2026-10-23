import DashboardShell from '../components/DashboardShell';
import GalleryPage from './GalleryPage';

// Reuse the existing published gallery and achievement views in the student workspace.
export default function StudentCollectionPage({ mode }) {
  const title = mode === 'achievements' ? 'Achievements' : 'Gallery';
  return <DashboardShell section={title}>
    <div className="dash-page-head"><div><span className="portal-eyebrow">STUDENT WORKSPACE</span><h1>{title}</h1></div></div>
    <GalleryPage embedded initialMode={mode} />
  </DashboardShell>;
}
