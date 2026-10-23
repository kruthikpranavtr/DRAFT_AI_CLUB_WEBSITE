import { Trophy } from 'lucide-react';
import DashboardShell from '../components/DashboardShell';
import { PageHead } from './StudentDashboardPage';
import './StudentCollections.css';

export default function StudentAchievementsPage() {
  return <DashboardShell section="Achievements">
    <PageHead
      eyebrow="STUDENT WORKSPACE"
      title="Achievements"
      text="Your student achievements, awards and milestones have their own space here."
    />
    <section className="dash-card student-collection-empty" aria-label="Student achievements">
      <span className="student-collection-empty__icon" aria-hidden="true"><Trophy size={30}/></span>
      <h2>No student achievements yet</h2>
      <p>Student-specific achievements will appear here when they become available. This page is separate from the public website.</p>
    </section>
  </DashboardShell>;
}
