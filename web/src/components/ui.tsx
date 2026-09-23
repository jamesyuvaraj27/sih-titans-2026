import clsx from 'clsx';
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';
import { AlertTriangle, Info, Loader2 } from 'lucide-react';

export function Button({
  variant = 'primary', size = 'md', className, loading, children, ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md';
  loading?: boolean;
}) {
  return (
    <button
      {...rest}
      disabled={rest.disabled || loading}
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded font-medium transition-colors',
        // 44px min target on the default size; sm is only for dense toolbars
        size === 'md' ? 'min-h-[44px] px-4 text-[15px]' : 'min-h-[36px] px-3 text-[13px]',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        variant === 'primary' && 'bg-primary text-white hover:bg-primary-hover',
        variant === 'secondary' && 'bg-raised text-ink border border-border-strong hover:bg-surface',
        variant === 'ghost' && 'text-muted hover:text-ink hover:bg-surface',
        variant === 'danger' && 'bg-critical text-white hover:opacity-90',
        !rest.disabled && !loading && 'cursor-pointer',
        className,
      )}
    >
      {loading && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
      {children}
    </button>
  );
}

export function Card({ className, children, ...rest }: { className?: string; children: ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  return <div {...rest} className={clsx('card', className)}>{children}</div>;
}

export function CardHeader({ title, subtitle, action, id }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode; id?: string }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-3">
      <div className="min-w-0">
        <h2 id={id} className="text-[15px] font-semibold text-ink">{title}</h2>
        {subtitle && <p className="mt-0.5 text-[13px] text-muted">{subtitle}</p>}
      </div>
      {action && <div className="min-w-0 shrink-0">{action}</div>}
    </div>
  );
}

export function Badge({ tone = 'neutral', icon, children, title }: {
  tone?: 'neutral' | 'primary' | 'critical' | 'moderate' | 'minor' | 'success';
  icon?: ReactNode; children: ReactNode; title?: string;
}) {
  return (
    <span
      title={title}
      className={clsx(
        'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[12px] font-medium leading-tight',
        tone === 'neutral' && 'bg-surface text-muted border border-border',
        tone === 'primary' && 'bg-primary-soft text-primary border border-primary/25',
        tone === 'critical' && 'bg-critical text-white',
        tone === 'moderate' && 'bg-moderate text-white',
        tone === 'minor' && 'bg-minor text-white',
        tone === 'success' && 'bg-success text-white',
      )}
    >
      {icon}
      {children}
    </span>
  );
}

export function Field({ label, hint, error, htmlFor, children, required }: {
  label: string; hint?: string; error?: string; htmlFor: string; children: ReactNode; required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-[13px] font-medium text-ink">
        {label}{required && <span className="text-critical" aria-hidden="true"> *</span>}
        {required && <span className="sr-only"> (required)</span>}
      </label>
      {children}
      {hint && !error && <p id={`${htmlFor}-hint`} className="text-[12px] text-subtle">{hint}</p>}
      {error && (
        <p id={`${htmlFor}-error`} role="alert" className="flex items-center gap-1 text-[12px] text-critical">
          <AlertTriangle size={13} aria-hidden="true" />{error}
        </p>
      )}
    </div>
  );
}

export const Input = ({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) => (
  <input
    {...rest}
    className={clsx(
      'min-h-[44px] w-full rounded border border-border-strong bg-raised px-3 text-[15px] text-ink',
      'placeholder:text-subtle', className,
    )}
  />
);

export const Select = ({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) => (
  <select
    {...rest}
    className={clsx('min-h-[44px] w-full rounded border border-border-strong bg-raised px-3 text-[15px] text-ink', className)}
  >
    {children}
  </select>
);

export function Alert({ tone = 'info', title, children }: { tone?: 'info' | 'warning' | 'critical' | 'success'; title?: string; children: ReactNode }) {
  const Icon = tone === 'info' ? Info : AlertTriangle;
  return (
    <div
      role={tone === 'critical' ? 'alert' : 'status'}
      className={clsx(
        'flex gap-2.5 rounded border p-3 text-[13px]',
        tone === 'info' && 'border-border bg-surface text-muted',
        tone === 'warning' && 'border-moderate/40 bg-moderate/10 text-ink',
        tone === 'critical' && 'border-critical/40 bg-critical/10 text-ink',
        tone === 'success' && 'border-success/40 bg-success/10 text-ink',
      )}
    >
      <Icon size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
      <div className="min-w-0">
        {title && <p className="font-semibold text-ink">{title}</p>}
        <div>{children}</div>
      </div>
    </div>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
      <p className="text-[15px] font-medium text-ink">{title}</p>
      {children && <p className="max-w-md text-[13px] text-muted">{children}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx('animate-pulse rounded bg-surface', className)} aria-hidden="true" />;
}

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <div role="status" className="flex items-center gap-2 px-4 py-8 text-[13px] text-muted">
      <Loader2 size={16} className="animate-spin" aria-hidden="true" />
      {label}…
    </div>
  );
}

export function ProgressBar({ value, max = 100, label }: { value: number; max?: number; label: string }) {
  const pctVal = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-label={label}
      className="h-2 w-full overflow-hidden rounded bg-surface"
    >
      <div className="h-full rounded bg-primary" style={{ width: `${pctVal}%` }} />
    </div>
  );
}

/** Data tables: sortable header cell with aria-sort, per WCAG. */
export function Th({ children, sort, onSort, align = 'left', className }: {
  children?: ReactNode; sort?: 'asc' | 'desc' | null; onSort?: () => void;
  align?: 'left' | 'right' | 'center'; className?: string;
}) {
  const content = (
    <span className={clsx('inline-flex items-center gap-1', onSort && 'hover:text-ink')}>
      {children}
      {onSort && <span aria-hidden="true" className="text-subtle">{sort === 'asc' ? '▲' : sort === 'desc' ? '▼' : '↕'}</span>}
    </span>
  );
  return (
    <th
      scope="col"
      aria-sort={sort ? (sort === 'asc' ? 'ascending' : 'descending') : onSort ? 'none' : undefined}
      className={clsx(
        'border-b border-border px-3 py-2 text-[12px] font-semibold uppercase tracking-wide text-subtle',
        align === 'right' && 'text-right', align === 'center' && 'text-center', className,
      )}
    >
      {onSort ? <button type="button" onClick={onSort} className="cursor-pointer">{content}</button> : content}
    </th>
  );
}

export const Td = ({ children, align = 'left', className }: { children?: ReactNode; align?: 'left' | 'right' | 'center'; className?: string }) => (
  <td className={clsx('border-b border-border px-3 py-2 text-[13px] text-ink',
    align === 'right' && 'text-right', align === 'center' && 'text-center', className)}>
    {children}
  </td>
);
