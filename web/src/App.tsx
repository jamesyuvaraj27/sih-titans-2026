import { Link, Navigate, Route, Routes } from 'react-router-dom';
import { ArrowLeft, ShieldAlert } from 'lucide-react';
import { AuthProvider, useAuth } from './lib/auth.js';
import { TranslationProvider } from './lib/i18n/index.js';
import { AppShell } from './components/AppShell.js';
import { Spinner } from './components/ui.js';
import { normalizeRole, roleLabel, type CanonicalRole } from './lib/format.js';
import { Login } from './pages/Login.js';
import { Dashboard } from './pages/Dashboard.js';
import { CompetencyDetail } from './pages/CompetencyDetail.js';
import { Gaps } from './pages/Gaps.js';
import { Path } from './pages/Path.js';
import { Assess } from './pages/Assess.js';
import { Trainer } from './pages/Trainer.js';
import { AdminDashboard } from './pages/AdminDashboard.js';
import { AdminCapacityBuilding } from './pages/AdminCapacityBuilding.js';
import { AdminWorkforce } from './pages/AdminWorkforce.js';
import { AdminWorkforceData } from './pages/AdminWorkforceData.js';
import { AdminAnalytics } from './pages/AdminAnalytics.js';
import { AdminAudit, AdminEffectiveness } from './pages/AdminOther.js';
import { Graph } from './pages/Graph.js';
import { Profile } from './pages/Profile.js';
import { LearnerChat } from './pages/LearnerChat.js';
import { VirtualLab } from './pages/VirtualLab.js';
import { FutureSkills } from './pages/FutureSkills.js';
import { Recommendations } from './pages/Recommendations.js';
import { LearnerTraining } from './pages/LearnerTraining.js';
import { LearnerProgress } from './pages/LearnerProgress.js';
import { LearnerAssignments } from './pages/LearnerAssignments.js';
import type { Me } from './lib/api.js';
import type { ReactNode } from 'react';

function RequireRole({ roles, children }: { roles: (Me['role'] | CanonicalRole | string)[]; children: ReactNode }) {
  const { me, can } = useAuth();
  if (!me) return null;
  if (!can(...roles)) {
    const norm = normalizeRole(me.role);
    const returnDashboardPath = norm === 'TRAINER' ? '/trainer' : norm === 'ADMINISTRATOR' ? '/admin' : '/';

    return (
      <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-critical/10 text-critical mb-3">
          <ShieldAlert size={20} />
        </div>
        <h1 className="text-[20px] font-bold text-ink">Access Denied</h1>
        <p className="mt-2 max-w-md text-[14px] text-muted leading-relaxed">
          You do not have permission to access this page. This section is restricted to authorized roles only.
        </p>
        <div className="mt-3 rounded border border-border bg-surface px-3 py-1.5 text-[12px] text-subtle">
          Your current role: <strong className="text-ink">{roleLabel(me.role)}</strong>
        </div>
        <div className="mt-6">
          <Link
            to={returnDashboardPath}
            className="inline-flex items-center gap-2 rounded bg-primary px-4 py-2.5 text-[14px] font-medium text-white hover:bg-primary-hover transition-colors"
          >
            <ArrowLeft size={16} /> Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}

function Shell() {
  const { me, loading } = useAuth();
  if (loading) return <Spinner label="Signing you in" />;
  if (!me) return <Login />;

  const norm = normalizeRole(me.role);

  return (
    <AppShell>
      <Routes>
        <Route
          path="/"
          element={
            norm === 'TRAINER' ? <Navigate to="/trainer" replace /> :
            norm === 'ADMINISTRATOR' ? <Navigate to="/admin" replace /> :
            <Dashboard />
          }
        />
        <Route path="/profile" element={<Profile />} />
        <Route path="/competency/:id" element={<CompetencyDetail />} />
        <Route path="/graph" element={<Graph />} />

        {/* Learner routes */}
        <Route
          path="/gaps"
          element={<RequireRole roles={['LEARNER']}><Gaps /></RequireRole>}
        />
        <Route
          path="/path"
          element={<RequireRole roles={['LEARNER']}><Path /></RequireRole>}
        />
        <Route
          path="/assess"
          element={<RequireRole roles={['LEARNER']}><Assess /></RequireRole>}
        />
        <Route
          path="/learner/chat"
          element={<RequireRole roles={['LEARNER']}><LearnerChat /></RequireRole>}
        />
        <Route
          path="/learner/virtual-lab"
          element={<RequireRole roles={['LEARNER']}><VirtualLab /></RequireRole>}
        />
        <Route
          path="/learner/recommendations"
          element={<RequireRole roles={['LEARNER']}><Recommendations /></RequireRole>}
        />
        <Route
          path="/learner/training"
          element={<RequireRole roles={['LEARNER']}><LearnerTraining /></RequireRole>}
        />
        <Route
          path="/learner/assignments"
          element={<RequireRole roles={['LEARNER']}><LearnerAssignments /></RequireRole>}
        />
        <Route
          path="/learner/progress"
          element={<RequireRole roles={['LEARNER']}><LearnerProgress /></RequireRole>}
        />
        <Route
          path="/learner/future-skills"
          element={<RequireRole roles={['LEARNER']}><FutureSkills /></RequireRole>}
        />

        {/* Trainer routes */}
        <Route
          path="/trainer"
          element={<RequireRole roles={['TRAINER']}><Trainer /></RequireRole>}
        />

        {/* Administrator routes */}
        <Route
          path="/admin"
          element={<RequireRole roles={['ADMINISTRATOR']}><AdminDashboard /></RequireRole>}
        />
        <Route
          path="/admin/workforce-data"
          element={<RequireRole roles={['ADMINISTRATOR']}><AdminWorkforceData /></RequireRole>}
        />
        <Route
          path="/admin/analytics"
          element={<RequireRole roles={['ADMINISTRATOR']}><AdminAnalytics /></RequireRole>}
        />
        <Route
          path="/admin/demand"
          element={<RequireRole roles={['ADMINISTRATOR']}><Navigate to="/admin/analytics?tab=demand" replace /></RequireRole>}
        />
        <Route
          path="/admin/readiness"
          element={<RequireRole roles={['ADMINISTRATOR']}><Navigate to="/admin/analytics?tab=readiness" replace /></RequireRole>}
        />
        <Route
          path="/admin/gaps"
          element={<RequireRole roles={['ADMINISTRATOR']}><Navigate to="/admin/analytics?tab=gaps" replace /></RequireRole>}
        />
        <Route
          path="/admin/course-coverage"
          element={<RequireRole roles={['ADMINISTRATOR']}><Navigate to="/admin/analytics?tab=coverage" replace /></RequireRole>}
        />
        <Route
          path="/admin/capacity-building"
          element={<RequireRole roles={['ADMINISTRATOR']}><AdminCapacityBuilding /></RequireRole>}
        />
        <Route
          path="/admin/workforce"
          element={<RequireRole roles={['ADMINISTRATOR']}><AdminWorkforce /></RequireRole>}
        />
        <Route
          path="/admin/effectiveness"
          element={<RequireRole roles={['ADMINISTRATOR']}><AdminEffectiveness /></RequireRole>}
        />
        <Route
          path="/admin/audit"
          element={<RequireRole roles={['ADMINISTRATOR']}><AdminAudit /></RequireRole>}
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <TranslationProvider>
        <Shell />
      </TranslationProvider>
    </AuthProvider>
  );
}
