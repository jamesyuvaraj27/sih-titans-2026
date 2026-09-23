import { NavLink, useLocation } from 'react-router-dom';
import clsx from 'clsx';
import {
  BarChart3, ClipboardCheck, FileUp, GaugeCircle, GitBranch, LayoutDashboard,
  LogOut, Route, ShieldCheck, TrendingUp,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useAuth } from '../lib/auth.js';

interface NavItem { to: string; label: string; icon: ReactNode; roles?: string[] }

const LEARNER_NAV: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: <LayoutDashboard size={18} aria-hidden="true" /> },
  { to: '/gaps', label: 'Skill gaps', icon: <GaugeCircle size={18} aria-hidden="true" /> },
  { to: '/path', label: 'Learning path', icon: <Route size={18} aria-hidden="true" /> },
  { to: '/assess', label: 'Assessment', icon: <ClipboardCheck size={18} aria-hidden="true" /> },
];

const TRAINER_NAV: NavItem[] = [
  { to: '/trainer', label: 'Upload & generate', icon: <FileUp size={18} aria-hidden="true" />, roles: ['MANAGER', 'DEPT_ADMIN', 'SUPER_ADMIN'] },
];

const ADMIN_NAV: NavItem[] = [
  { to: '/admin/workforce', label: 'Workforce', icon: <BarChart3 size={18} aria-hidden="true" />, roles: ['DEPT_ADMIN', 'SUPER_ADMIN', 'AUDITOR'] },
  { to: '/admin/effectiveness', label: 'Training effectiveness', icon: <TrendingUp size={18} aria-hidden="true" />, roles: ['DEPT_ADMIN', 'SUPER_ADMIN', 'AUDITOR'] },
  { to: '/admin/audit', label: 'Audit log', icon: <ShieldCheck size={18} aria-hidden="true" />, roles: ['DEPT_ADMIN', 'SUPER_ADMIN', 'AUDITOR'] },
];

function NavSection({ title, items, role }: { title: string; items: NavItem[]; role: string }) {
  const visible = items.filter((i) => !i.roles || i.roles.includes(role));
  if (visible.length === 0) return null;
  return (
    <div className="mb-5">
      <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-subtle">{title}</p>
      <ul className="space-y-0.5">
        {visible.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) => clsx(
                'flex min-h-[40px] items-center gap-2.5 rounded px-3 text-[14px]',
                isActive
                  ? 'bg-primary-soft font-semibold text-primary'
                  : 'text-muted hover:bg-surface hover:text-ink',
              )}
            >
              {item.icon}
              <span>{item.label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { me, logout } = useAuth();
  const location = useLocation();
  if (!me) return null;

  const mobileNav = [...LEARNER_NAV, ...TRAINER_NAV, ...ADMIN_NAV]
    .filter((i) => !i.roles || i.roles.includes(me.role))
    .slice(0, 5);

  return (
    <div className="min-h-dvh bg-bg">
      <a href="#main" className="skip-link">Skip to main content</a>

      <div className="lg:grid lg:grid-cols-[264px_1fr]">
        {/* sidebar — desktop only; ≥1024px prefers a persistent sidebar */}
        <aside className="sticky top-0 hidden h-dvh flex-col border-r border-border bg-surface lg:flex">
          <div className="border-b border-border px-4 py-4">
            <p className="text-[17px] font-bold tracking-tight text-ink">SAMIKSHA</p>
            <p className="mt-0.5 text-[11px] leading-snug text-subtle">
              समीक्षा · Competency intelligence for<br />India’s Official Statistical System
            </p>
          </div>

          <nav aria-label="Main" className="flex-1 overflow-y-auto px-2 py-4">
            <NavSection title="My development" items={LEARNER_NAV} role={me.role} />
            <NavSection title="Trainer" items={TRAINER_NAV} role={me.role} />
            <NavSection title="Administration" items={ADMIN_NAV} role={me.role} />
            <div className="mb-2">
              <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-subtle">Explore</p>
              <NavLink
                to="/graph"
                className={({ isActive }) => clsx(
                  'flex min-h-[40px] items-center gap-2.5 rounded px-3 text-[14px]',
                  isActive ? 'bg-primary-soft font-semibold text-primary' : 'text-muted hover:bg-surface hover:text-ink',
                )}
              >
                <GitBranch size={18} aria-hidden="true" />
                <span>Competency map</span>
              </NavLink>
            </div>
          </nav>

          {/* destructive/session actions kept spatially separate from navigation */}
          <div className="border-t border-border p-3">
            <p className="truncate text-[13px] font-medium text-ink">{me.nameEn}</p>
            <p className="truncate text-[12px] text-subtle">{me.designation}</p>
            <p className="mt-0.5 truncate text-[11px] text-subtle">{me.department.nameEn}</p>
            <button
              onClick={logout}
              className="mt-2.5 flex min-h-[36px] w-full cursor-pointer items-center gap-2 rounded px-2 text-[13px] text-muted hover:bg-surface hover:text-ink"
            >
              <LogOut size={15} aria-hidden="true" />Sign out
            </button>
          </div>
        </aside>

        <div className="flex min-h-dvh min-w-0 flex-col">
          {/* mobile top bar */}
          <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-bg px-4 py-3 lg:hidden">
            <div>
              <p className="text-[15px] font-bold text-ink">SAMIKSHA</p>
              <p className="text-[11px] text-subtle">{me.nameEn}</p>
            </div>
            <button onClick={logout} className="cursor-pointer p-2 text-muted" aria-label="Sign out">
              <LogOut size={18} aria-hidden="true" />
            </button>
          </header>

          <main id="main" tabIndex={-1} key={location.pathname} className="flex-1 overflow-x-hidden px-4 pb-24 pt-4 lg:px-6 lg:pb-10 lg:pt-6">
            <div className="mx-auto w-full max-w-[1440px]">{children}</div>
          </main>
        </div>
      </div>

      {/* mobile bottom nav — max 5 items, icon + label, per the navigation rules */}
      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-10 grid grid-cols-5 border-t border-border bg-bg lg:hidden">
        {mobileNav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) => clsx(
              'flex min-h-[56px] flex-col items-center justify-center gap-0.5 px-1 text-[10px]',
              isActive ? 'font-semibold text-primary' : 'text-muted',
            )}
          >
            {item.icon}
            <span className="truncate">{item.label.split(' ')[0]}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
