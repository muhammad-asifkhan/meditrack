import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { classifyNoShowRisk } from '../../utils/formatters';
import clsx from 'clsx';

// ─── KPI Card ──────────────────────────────────────────────────────────────
interface KpiCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: number;
  color?: string;
  loading?: boolean;
}

export function KpiCard({ title, value, subtitle, icon, trend, color = '#0F6E56', loading }: KpiCardProps) {
  if (loading) return <SkeletonKpiCard />;
  return (
    <div className="card p-6 animate-fade-up">
      <div className="flex items-start justify-between mb-4">
        <div className="p-3 rounded-xl" style={{ background: `${color}18` }}>
          <div style={{ color }}>{icon}</div>
        </div>
        {trend !== undefined && (
          <span className={clsx(
            'text-xs font-semibold px-2 py-1 rounded-full',
            trend >= 0 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                       : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
          )}>
            {trend >= 0 ? '↑' : '↓'} {Math.abs(trend).toFixed(1)}%
          </span>
        )}
      </div>
      <div className="text-2xl font-bold tracking-tight mb-1" style={{ color: 'var(--color-text)' }}>
        {value}
      </div>
      <div className="text-sm font-medium" style={{ color: 'var(--color-text-muted)' }}>{title}</div>
      {subtitle && <div className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>{subtitle}</div>}
    </div>
  );
}

// ─── Skeleton Loaders ──────────────────────────────────────────────────────
export function SkeletonKpiCard() {
  return (
    <div className="card p-6">
      <div className="skeleton w-12 h-12 rounded-xl mb-4" />
      <div className="skeleton w-32 h-7 mb-2" />
      <div className="skeleton w-24 h-4" />
    </div>
  );
}

export function SkeletonChart({ height = 300 }: { height?: number }) {
  return (
    <div className="card p-6">
      <div className="skeleton w-48 h-5 mb-2" />
      <div className="skeleton w-32 h-4 mb-6" />
      <div className="skeleton w-full rounded-lg" style={{ height }} />
    </div>
  );
}

export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="card p-6">
      <div className="skeleton w-48 h-5 mb-6" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4 mb-4">
          <div className="skeleton w-1/4 h-4" />
          <div className="skeleton w-1/6 h-4" />
          <div className="skeleton w-1/6 h-4" />
          <div className="skeleton w-1/6 h-4" />
          <div className="skeleton w-1/6 h-4" />
        </div>
      ))}
    </div>
  );
}

// ─── Error Banner ──────────────────────────────────────────────────────────
export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="card p-6 border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/10">
      <div className="flex items-center gap-3">
        <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
        <p className="text-red-700 dark:text-red-400 text-sm flex-1">{message}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="flex items-center gap-1.5 text-sm text-red-600 hover:text-red-800 dark:text-red-400 font-medium"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Retry
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Status Badge ──────────────────────────────────────────────────────────
export function StatusBadge({ rate }: { rate: number | string }) {
  const status = classifyNoShowRisk(rate);
  return (
    <span className={clsx(
      'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold',
      status === 'healthy'         && 'badge-healthy',
      status === 'watch'           && 'badge-watch',
      status === 'underperforming' && 'badge-danger',
    )}>
      {status === 'healthy' ? '● Healthy' : status === 'watch' ? '● Watch' : '● Underperforming'}
    </span>
  );
}

// ─── Section Header ────────────────────────────────────────────────────────
export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-8">
      <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>{title}</h1>
      {subtitle && <p className="mt-1 text-sm" style={{ color: 'var(--color-text-muted)' }}>{subtitle}</p>}
    </div>
  );
}

// ─── Chart Card ────────────────────────────────────────────────────────────
export function ChartCard({ title, subtitle, children, loading, className = '' }: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  loading?: boolean;
  className?: string;
}) {
  if (loading) return <SkeletonChart />;
  return (
    <div className={clsx('card p-6', className)}>
      <div className="mb-4">
        <h3 className="font-semibold text-base" style={{ color: 'var(--color-text)' }}>{title}</h3>
        {subtitle && <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

// ─── Risk Gauge ────────────────────────────────────────────────────────────
export function RiskGauge({ probability }: { probability: number }) {
  const pct = Math.round(probability * 100);
  const color = pct < 30 ? '#22C55E' : pct < 60 ? '#BA7517' : '#E24B4A';
  const label = pct < 30 ? 'Low Risk' : pct < 60 ? 'Medium Risk' : 'High Risk';

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-40 h-20 overflow-hidden">
        <svg viewBox="0 0 160 80" className="w-full">
          {/* Track */}
          <path d="M 10 80 A 70 70 0 0 1 150 80" fill="none" stroke="#E2E8F0" strokeWidth="16" strokeLinecap="round" />
          {/* Fill */}
          <path
            d="M 10 80 A 70 70 0 0 1 150 80"
            fill="none"
            stroke={color}
            strokeWidth="16"
            strokeLinecap="round"
            strokeDasharray={`${(pct / 100) * 220} 220`}
          />
        </svg>
        <div className="absolute inset-x-0 bottom-0 text-center">
          <div className="text-3xl font-bold" style={{ color }}>{pct}%</div>
        </div>
      </div>
      <div className="mt-2 text-sm font-semibold" style={{ color }}>{label}</div>
    </div>
  );
}

// ─── Empty State ───────────────────────────────────────────────────────────
export function EmptyState({ title, message }: { title: string; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-white/5 flex items-center justify-center mb-4">
        <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-3-3v6M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <h3 className="text-base font-semibold mb-1" style={{ color: 'var(--color-text)' }}>{title}</h3>
      <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{message}</p>
    </div>
  );
}
