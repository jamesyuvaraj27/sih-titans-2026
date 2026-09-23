import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/auth.js';
import { AppShell } from './components/AppShell.js';
import { Alert, Spinner } from './components/ui.js';
import { Login } from './pages/Login.js';
import { Dashboard } from './pages/Dashboard.js';
import { CompetencyDetail } from './pages/CompetencyDetail.js';
import { Gaps } from './pages/Gaps.js';
import { Path } from './pages/Path.js';
import { Assess } from './pages/Assess.js';
import { Trainer } from './pages/Trainer.js';
import { AdminWorkforce } from './pages/AdminWorkforce.js';
import { AdminAudit, AdminEffectiveness } from './pages/AdminOther.js';
import { Graph } from './pages/Graph.js';
import type { Me } from './lib/api.js';
import type { ReactNode } from 'react';

function RequireRole({ roles, children }: { roles: Me['role'][]; children: ReactNode }) {
  const { me } = useAuth();
  if (!me) return null;
  if (!roles.includes(me.role)) {
    return (
      <Alert tone="critical" title="Not permitted for your role">
        This area requires one of: {roles.join(', ')}. You are signed in as {me.role}.
      </Alert>
    );
  }
  return <>{children}</>;
}

function Shell() {
  const { me, loading } = useAuth();
  if (loading) return <Spinner label="Signing you in" />;
  if (!me) return <Login />;

  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/competency/:id" element={<CompetencyDetail />} />
        <Route path="/gaps" element={<Gaps />} />
        <Route path="/path" element={<Path />} />
        <Route path="/assess" element={<Assess />} />
        <Route path="/graph" element={<Graph />} />
        <Route
          path="/trainer"
          element={<RequireRole roles={['MANAGER', 'DEPT_ADMIN', 'SUPER_ADMIN']}><Trainer /></RequireRole>}
        />
        <Route
          path="/admin/workforce"
          element={<RequireRole roles={['DEPT_ADMIN', 'SUPER_ADMIN', 'AUDITOR']}><AdminWorkforce /></RequireRole>}
        />
        <Route
          path="/admin/effectiveness"
          element={<RequireRole roles={['DEPT_ADMIN', 'SUPER_ADMIN', 'AUDITOR']}><AdminEffectiveness /></RequireRole>}
        />
        <Route
          path="/admin/audit"
          element={<RequireRole roles={['DEPT_ADMIN', 'SUPER_ADMIN', 'AUDITOR']}><AdminAudit /></RequireRole>}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Shell />
    </AuthProvider>
  );
}
