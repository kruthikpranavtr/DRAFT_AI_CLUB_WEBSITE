import { Images } from 'lucide-react';
import DashboardShell from '../components/DashboardShell';
import { PageHead } from './StudentDashboardPage';
import './StudentCollections.css';

export default function StudentGalleryPage() {
  return <DashboardShell section="Gallery">
    <PageHead
      eyebrow="STUDENT WORKSPACE"
      title="Gallery"
      text="A dedicated gallery within your student portal."
    />
    <section className="dash-card student-collection-empty" aria-label="Student gallery">
      <span className="student-collection-empty__icon" aria-hidden="true"><Images size={30}/></span>
      <h2>No student gallery photos yet</h2>
      <p>Photos added to the student gallery will appear here when this collection is available. Public website photos are not shown here.</p>
    </section>
  </DashboardShell>;
}
