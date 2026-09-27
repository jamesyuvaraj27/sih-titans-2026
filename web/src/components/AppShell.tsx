import { Link, NavLink, useLocation } from 'react-router-dom';
import clsx from 'clsx';
import {
  BarChart3, Bot, BookOpen, ClipboardCheck, FileSpreadsheet, FileText, FlaskConical, GaugeCircle, GitBranch,
  GraduationCap, LayoutDashboard, Lightbulb, ListChecks, Route, ShieldCheck, Sparkles,
  TrendingUp, Users,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useAuth } from '../lib/auth.js';
import { normalizeRole } from '../lib/format.js';
import { useTranslation, type TranslationKey } from '../lib/i18n/index.js';
import { AppHeader } from './AppHeader.js';

interface NavItem {
  to: string;
  label: string;
  labelKey?: TranslationKey;
  icon: ReactNode;
}

const LEARNER_NAV: NavItem[] = [
  { to: '/', label: 'Dashboard', labelKey: 'nav.dashboard', icon: <LayoutDashboard size={17} aria-hidden="true" /> },
  { to: '/graph', label: 'Skill Dependency Graph', labelKey: 'nav.competencyMap', icon: <GitBranch size={17} aria-hidden="true" /> },
  { to: '/gaps', label: 'Skill Gaps', labelKey: 'nav.skillGaps', icon: <GaugeCircle size={17} aria-hidden="true" /> },
  { to: '/path', label: 'Learning Path', labelKey: 'nav.learningPath', icon: <Route size={17} aria-hidden="true" /> },
  { to: '/learner/recommendations', label: 'iGOT & NSSTA Recommendations', labelKey: 'nav.recommendations', icon: <Lightbulb size={17} aria-hidden="true" /> },
  { to: '/learner/training', label: 'Learning / Training', icon: <BookOpen size={17} aria-hidden="true" /> },
  { to: '/learner/assignments', label: 'Assignments & Practice', icon: <FileText size={17} aria-hidden="true" /> },
  { to: '/learner/virtual-lab', label: 'Virtual Labs', labelKey: 'nav.virtualLab', icon: <FlaskConical size={17} aria-hidden="true" /> },
  { to: '/assess', label: 'Assessment & Quizzes', labelKey: 'nav.assessment', icon: <ClipboardCheck size={17} aria-hidden="true" /> },
  { to: '/learner/chat', label: 'Learning Assistant', labelKey: 'nav.learningAssistant', icon: <Bot size={17} aria-hidden="true" /> },
  { to: '/learner/progress', label: 'Progress & Continuous Learning', icon: <TrendingUp size={17} aria-hidden="true" /> },
  { to: '/learner/future-skills', label: 'Future Skills', labelKey: 'nav.futureSkills', icon: <Sparkles size={17} aria-hidden="true" /> },
];

const TRAINER_NAV: NavItem[] = [
  { to: '/trainer?tab=overview', label: 'Dashboard', labelKey: 'nav.dashboard', icon: <LayoutDashboard size={17} aria-hidden="true" /> },
  { to: '/trainer?tab=assignments', label: 'Assignments & Publishing', icon: <FileText size={17} aria-hidden="true" /> },
  { to: '/trainer?tab=materials', label: 'Learning Materials', icon: <BookOpen size={17} aria-hidden="true" /> },
  { to: '/trainer?tab=generate', label: 'AI Assessment Generator', labelKey: 'nav.uploadGenerate', icon: <Sparkles size={17} aria-hidden="true" /> },
  { to: '/trainer?tab=review', label: 'Question Bank', icon: <ListChecks size={17} aria-hidden="true" /> },
  { to: '/trainer?tab=assessments', label: 'Assessments', icon: <ClipboardCheck size={17} aria-hidden="true" /> },
  { to: '/trainer?tab=results', label: 'Assessment Results', icon: <GraduationCap size={17} aria-hidden="true" /> },
];

const ADMIN_NAV: NavItem[] = [
  { to: '/admin', label: 'Overview', labelKey: 'nav.dashboard', icon: <LayoutDashboard size={17} aria-hidden="true" /> },
  { to: '/admin/workforce-data', label: 'Workforce Dataset (CSV)', icon: <FileSpreadsheet size={17} aria-hidden="true" /> },
  { to: '/admin/analytics?tab=demand', label: 'Training Demand', icon: <TrendingUp size={17} aria-hidden="true" /> },
  { to: '/admin/analytics?tab=readiness', label: 'Readiness by Designation', icon: <Users size={17} aria-hidden="true" /> },
  { to: '/admin/analytics?tab=gaps', label: 'Skill Gap Analytics', icon: <GaugeCircle size={17} aria-hidden="true" /> },
  { to: '/admin/analytics?tab=coverage', label: 'Training / Course Coverage', icon: <BookOpen size={17} aria-hidden="true" /> },
  { to: '/admin/workforce', label: 'Workforce Competency (Heatmap)', labelKey: 'nav.workforce', icon: <BarChart3 size={17} aria-hidden="true" /> },
  { to: '/admin/capacity-building', label: 'Capacity Building & Future Skills', icon: <Sparkles size={17} aria-hidden="true" /> },
  { to: '/admin/effectiveness', label: 'Training Effectiveness', labelKey: 'nav.trainingEffectiveness', icon: <GraduationCap size={17} aria-hidden="true" /> },
  { to: '/admin/audit', label: 'Audit Log', labelKey: 'nav.auditLog', icon: <ShieldCheck size={17} aria-hidden="true" /> },
];

function NavSection({
  title,
  titleKey,
  items,
}: {
  title?: string;
  titleKey?: TranslationKey;
  items: NavItem[];
}) {
  const { t } = useTranslation();
  const location = useLocation();
  const currentPath = location.pathname;
  const currentFull = location.pathname + location.search;

  return (
    <div className="mb-5">
      {title && (
        <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-subtle">
          {titleKey ? t(titleKey, title) : title}
        </p>
      )}
      <ul className="space-y-0.5">
        {items.map((item) => {
          const isExplicitTab = item.to.includes('?');
          const isActive = isExplicitTab
            ? currentFull === item.to || (item.to.endsWith('tab=overview') && currentPath === item.to.split('?')[0] && !location.search)
            : currentPath === item.to;

          return (
            <li key={item.to}>
              <Link
                to={item.to}
                className={clsx(
                  'flex min-h-[38px] items-center gap-2.5 rounded px-3 text-[13px] transition-colors',
                  isActive
                    ? 'bg-primary-soft font-semibold text-primary'
                    : 'text-muted hover:bg-surface hover:text-ink',
                )}
              >
                {item.icon}
                <span className="truncate">{item.labelKey ? t(item.labelKey, item.label) : item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { me } = useAuth();
  const { t } = useTranslation();
  const location = useLocation();
  if (!me) return null;

  const normRole = normalizeRole(me.role);
  const activeNav = normRole === 'LEARNER' ? LEARNER_NAV : normRole === 'TRAINER' ? TRAINER_NAV : ADMIN_NAV;
  const mobileNav = activeNav.slice(0, 5);

  return (
    <div className="min-h-dvh bg-bg">
      <a href="#main" className="skip-link">Skip to main content</a>

      <div className="lg:grid lg:grid-cols-[264px_1fr]">
        {/* sidebar — desktop only; ≥1024px prefers a persistent sidebar */}
        <aside className="sticky top-0 hidden h-dvh flex-col border-r border-border bg-surface lg:flex">
          <div className="border-b border-border px-4 py-4 flex items-center justify-between">
            <div>
              <p className="text-[17px] font-bold tracking-tight text-ink">STATINTEL</p>
              <p className="mt-0.5 text-[11px] leading-snug text-subtle">
                Competency &amp; Learning Intelligence · NSSTA
              </p>
            </div>
          </div>

          <nav aria-label="Main" className="flex-1 overflow-y-auto px-2 py-4">
            {normRole === 'LEARNER' && (
              <NavSection title="Learner Journey" titleKey="nav.myDevelopment" items={LEARNER_NAV} />
            )}
            {normRole === 'TRAINER' && (
              <NavSection title="Trainer Hub" titleKey="nav.trainer" items={TRAINER_NAV} />
            )}
            {normRole === 'ADMINISTRATOR' && (
              <NavSection title="Administration &amp; Governance" titleKey="nav.administration" items={ADMIN_NAV} />
            )}
          </nav>

          {/* Clean sidebar footer — no duplicate profile item */}
          <div className="border-t border-border px-4 py-3 bg-surface text-center">
            <span className="text-[11px] font-medium text-subtle">
              MoSPI · Official Statistical System
            </span>
          </div>
        </aside>

        <div className="flex min-h-dvh min-w-0 flex-col">
          {/* Universal Authenticated Header with consistent top-right profile menu across all roles & pages */}
          <AppHeader />

          <main id="main" tabIndex={-1} key={location.pathname} className="flex-1 overflow-x-hidden px-4 pb-24 pt-4 lg:px-6 lg:pb-10 lg:pt-6">
            <div className="mx-auto w-full max-w-[1440px]">{children}</div>
          </main>
        </div>
      </div>

      {/* mobile bottom nav */}
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-10 grid border-t border-border bg-bg lg:hidden"
        style={{ gridTemplateColumns: `repeat(${mobileNav.length}, minmax(0, 1fr))` }}
      >
        {mobileNav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              clsx(
                'flex min-h-[56px] flex-col items-center justify-center gap-0.5 px-1 text-[10px]',
                isActive ? 'font-semibold text-primary' : 'text-muted',
              )
            }
          >
            {item.icon}
            <span className="truncate">{(item.labelKey ? t(item.labelKey, item.label) : item.label).split(' ')[0]}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
