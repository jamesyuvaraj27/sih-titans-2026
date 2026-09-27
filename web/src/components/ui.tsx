import clsx from 'clsx';
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';
import { AlertTriangle, Info, Loader2 } from 'lucide-react';

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  loading,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}) {
  return (
    <button
      {...rest}
      disabled={rest.disabled || loading}
      className={clsx(
        'inline-flex items-center justify-center gap-1.5 rounded font-medium transition-colors cursor-pointer select-none',
        // Compact, clean heights
        size === 'sm' && 'min-h-[32px] px-2.5 text-[12px]',
        size === 'md' && 'min-h-[38px] px-3.5 text-[13px]',
        size === 'lg' && 'min-h-[44px] px-5 text-[14px]',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        variant === 'primary' && 'bg-[#0284C7] text-white hover:bg-[#0369A1] active:bg-[#075985]',
        variant === 'secondary' && 'bg-white text-[#111827] border border-[#E5E7EB] hover:bg-[#F8FAFC] active:bg-[#F1F5F9]',
        variant === 'ghost' && 'text-[#4B5563] hover:text-[#111827] hover:bg-[#F8FAFC]',
        variant === 'danger' && 'bg-[#DC2626] text-white hover:bg-[#B91C1C]',
        className,
      )}
    >
      {loading && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
      {children}
    </button>
  );
}

export function Card({
  className,
  children,
  ...rest
}: { className?: string; children: ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...rest} className={clsx('bg-white border border-[#E5E7EB] rounded-lg', className)}>
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
  id,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  id?: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E5E7EB] px-5 py-3.5 bg-white rounded-t-lg">
      <div className="min-w-0">
        <h3 id={id} className="text-[14px] font-semibold text-[#111827] leading-tight">
          {title}
        </h3>
        {subtitle && <p className="mt-0.5 text-[12px] text-[#6B7280] leading-snug">{subtitle}</p>}
      </div>
      {action && <div className="min-w-0 shrink-0">{action}</div>}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  badge,
  action,
}: {
  title: ReactNode;
  description?: ReactNode;
  badge?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="border-b border-[#E5E7EB] pb-4 mb-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <h1 className="text-[20px] font-bold tracking-tight text-[#111827]">{title}</h1>
            {badge}
          </div>
          {description && (
            <p className="text-[13px] text-[#4B5563] max-w-3xl leading-relaxed">{description}</p>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    </div>
  );
}

export function MetricCard({
  title,
  value,
  subtext,
  icon,
  className,
}: {
  title: string;
  value: ReactNode;
  subtext?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div className={clsx('bg-white border border-[#E5E7EB] rounded-lg p-4 transition-colors', className)}>
      <div className="flex items-center justify-between text-[#6B7280]">
        <p className="text-[11.5px] font-medium uppercase tracking-wider text-[#6B7280]">{title}</p>
        {icon && <div className="text-[#0284C7]">{icon}</div>}
      </div>
      <p className="tnum mt-1.5 text-[26px] font-bold leading-none text-[#111827]">{value}</p>
      {subtext && <p className="mt-1.5 text-[12px] text-[#6B7280]">{subtext}</p>}
    </div>
  );
}

export function Badge({
  tone = 'neutral',
  icon,
  children,
  title,
}: {
  tone?: 'neutral' | 'primary' | 'critical' | 'moderate' | 'minor' | 'success';
  icon?: ReactNode;
  children: ReactNode;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={clsx(
        'inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-medium leading-tight',
        tone === 'neutral' && 'bg-[#F8FAFC] text-[#4B5563] border border-[#E5E7EB]',
        tone === 'primary' && 'bg-[#F0F9FF] text-[#0284C7] border border-[#BAE6FD]',
        tone === 'success' && 'bg-[#F0FDF4] text-[#15803D] border border-[#BBF7D0]',
        tone === 'critical' && 'bg-[#FEF2F2] text-[#B91C1C] border border-[#FECACA]',
        tone === 'moderate' && 'bg-[#F8FAFC] text-[#4B5563] border border-[#E5E7EB]',
        tone === 'minor' && 'bg-[#F0F9FF] text-[#0284C7] border border-[#BAE6FD]',
      )}
    >
      {icon}
      {children}
    </span>
  );
}

export function Field({
  label,
  hint,
  error,
  htmlFor,
  children,
  required,
}: {
  label: string;
  hint?: string;
  error?: string;
  htmlFor: string;
  children: ReactNode;
  required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-[13px] font-medium text-[#111827]">
        {label}
        {required && <span className="text-[#DC2626]" aria-hidden="true"> *</span>}
        {required && <span className="sr-only"> (required)</span>}
      </label>
      {children}
      {hint && !error && <p id={`${htmlFor}-hint`} className="text-[12px] text-[#6B7280]">{hint}</p>}
      {error && (
        <p id={`${htmlFor}-error`} role="alert" className="flex items-center gap-1 text-[12px] text-[#DC2626]">
          <AlertTriangle size={13} aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  );
}

export const Input = ({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) => (
  <input
    {...rest}
    className={clsx(
      'min-h-[38px] w-full rounded border border-[#E5E7EB] bg-white px-3 text-[13.5px] text-[#111827]',
      'placeholder:text-[#9CA3AF] focus:border-[#0284C7] focus:ring-1 focus:ring-[#0284C7] focus:outline-none transition-colors',
      className,
    )}
  />
);

export const Select = ({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) => (
  <select
    {...rest}
    className={clsx(
      'min-h-[38px] w-full rounded border border-[#E5E7EB] bg-white px-3 text-[13.5px] text-[#111827]',
      'focus:border-[#0284C7] focus:ring-1 focus:ring-[#0284C7] focus:outline-none transition-colors cursor-pointer',
      className,
    )}
  >
    {children}
  </select>
);

export function Alert({
  tone = 'info',
  title,
  children,
}: {
  tone?: 'info' | 'warning' | 'critical' | 'success';
  title?: string;
  children: ReactNode;
}) {
  const Icon = tone === 'info' ? Info : AlertTriangle;
  return (
    <div
      role={tone === 'critical' ? 'alert' : 'status'}
      className={clsx(
        'flex gap-2.5 rounded-lg border p-3.5 text-[13px]',
        tone === 'info' && 'border-[#BAE6FD] bg-[#F0F9FF] text-[#0369A1]',
        tone === 'warning' && 'border-[#E5E7EB] bg-[#F8FAFC] text-[#374151]',
        tone === 'critical' && 'border-[#FECACA] bg-[#FEF2F2] text-[#991B1B]',
        tone === 'success' && 'border-[#BBF7D0] bg-[#F0FDF4] text-[#166534]',
      )}
    >
      <Icon size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
      <div className="min-w-0">
        {title && <p className="font-semibold text-[#111827] mb-0.5">{title}</p>}
        <div className="leading-relaxed">{children}</div>
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  children,
  action,
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
      <p className="text-[14px] font-semibold text-[#111827]">{title}</p>
      {children && <p className="max-w-md text-[13px] text-[#6B7280] leading-relaxed">{children}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx('animate-pulse rounded bg-[#F1F5F9]', className)} aria-hidden="true" />;
}

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <div role="status" className="flex items-center gap-2 px-4 py-8 text-[13px] text-[#6B7280]">
      <Loader2 size={16} className="animate-spin text-[#0284C7]" aria-hidden="true" />
      <span>{label}…</span>
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
      className="h-2 w-full overflow-hidden rounded bg-[#E5E7EB]"
    >
      <div className="h-full rounded bg-[#0284C7] transition-all duration-300" style={{ width: `${pctVal}%` }} />
    </div>
  );
}

export function Th({
  children,
  sort,
  onSort,
  align = 'left',
  className,
}: {
  children?: ReactNode;
  sort?: 'asc' | 'desc' | null;
  onSort?: () => void;
  align?: 'left' | 'right' | 'center';
  className?: string;
}) {
  const content = (
    <span className={clsx('inline-flex items-center gap-1', onSort && 'hover:text-[#111827]')}>
      {children}
      {onSort && (
        <span aria-hidden="true" className="text-[#9CA3AF]">
          {sort === 'asc' ? '▲' : sort === 'desc' ? '▼' : '↕'}
        </span>
      )}
    </span>
  );
  return (
    <th
      scope="col"
      aria-sort={sort ? (sort === 'asc' ? 'ascending' : 'descending') : onSort ? 'none' : undefined}
      className={clsx(
        'border-b border-[#E5E7EB] bg-[#F8FAFC] px-3.5 py-2.5 text-[12px] font-semibold text-[#4B5563]',
        align === 'right' && 'text-right',
        align === 'center' && 'text-center',
        className,
      )}
    >
      {onSort ? <button type="button" onClick={onSort} className="cursor-pointer">{content}</button> : content}
    </th>
  );
}

export const Td = ({
  children,
  align = 'left',
  className,
}: {
  children?: ReactNode;
  align?: 'left' | 'right' | 'center';
  className?: string;
}) => (
  <td
    className={clsx(
      'border-b border-[#E5E7EB] px-3.5 py-3 text-[13px] text-[#111827]',
      align === 'right' && 'text-right',
      align === 'center' && 'text-center',
      className,
    )}
  >
    {children}
  </td>
);
