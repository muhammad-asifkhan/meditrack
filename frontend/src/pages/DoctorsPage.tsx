import { useState, useMemo } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useDoctorStats, useReferenceData } from '../hooks';
import { PageHeader, ErrorBanner, SkeletonTable } from '../components/ui';
import { formatPKR, formatPercent } from '../utils/formatters';
import type { DoctorStat } from '../types';
import clsx from 'clsx';

const SENIORITY_BADGE: Record<string, string> = {
  junior: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  senior: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  consultant: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
};

type SortKey = keyof Pick<DoctorStat, 'appointment_count' | 'revenue' | 'no_show_rate' | 'completion_rate' | 'avg_fee'>;

export default function DoctorsPage() {
  const ref = useReferenceData();
  const [cityId, setCityId] = useState('');
  const [clinicId, setClinicId] = useState('');
  const [deptId, setDeptId] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('revenue');
  const [sortAsc, setSortAsc] = useState(false);
  const [noShowThreshold, setNoShowThreshold] = useState<number | null>(null);

  const filters = useMemo(() => {
    const f: Record<string, string> = {};
    if (cityId) f.city_id = cityId;
    if (clinicId) f.clinic_id = clinicId;
    if (deptId) f.department_id = deptId;
    return f;
  }, [cityId, clinicId, deptId]);

  const { data, isLoading, isError, refetch } = useDoctorStats(filters);

  // Cascading dropdowns
  const filteredClinics = ref.data?.clinics.filter((c) => !cityId || c.city_id === parseInt(cityId)) || [];
  const filteredDepts = ref.data?.departments || [];

  // Compute no-show 75th percentile
  const noShowValues = (data || []).map((d) => parseFloat(d.no_show_rate)).sort((a, b) => a - b);
  const p75 = noShowValues[Math.floor(noShowValues.length * 0.75)] || 0;

  const sorted = [...(data || [])].sort((a, b) => {
    const av = parseFloat(a[sortKey]);
    const bv = parseFloat(b[sortKey]);
    return sortAsc ? av - bv : bv - av;
  });

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  };

  const SortIcon = ({ col }: { col: SortKey }) =>
    sortKey === col
      ? (sortAsc ? <ChevronUp className="w-3 h-3 inline ml-1" /> : <ChevronDown className="w-3 h-3 inline ml-1" />)
      : <ChevronDown className="w-3 h-3 inline ml-1 opacity-30" />;

  const COLUMNS: { label: string; key: SortKey }[] = [
    { label: 'Appointments', key: 'appointment_count' },
    { label: 'Revenue', key: 'revenue' },
    { label: 'No-Show %', key: 'no_show_rate' },
    { label: 'Completion %', key: 'completion_rate' },
    { label: 'Avg Fee', key: 'avg_fee' },
  ];

  return (
    <div className="animate-fade-up">
      <PageHeader title="Doctor Performance" subtitle="Drill into performance by city, clinic, or department" />

      {/* Filters */}
      <div className="card p-4 mb-6">
        <div className="flex flex-wrap gap-3">
          <select
            value={cityId}
            onChange={(e) => { setCityId(e.target.value); setClinicId(''); }}
            className="px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            style={{ background: 'var(--color-surface-2)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
          >
            <option value="">All Cities</option>
            {ref.data?.cities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>

          <select
            value={clinicId}
            onChange={(e) => setClinicId(e.target.value)}
            className="px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            style={{ background: 'var(--color-surface-2)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
            disabled={!cityId}
          >
            <option value="">All Clinics</option>
            {filteredClinics.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>

          <select
            value={deptId}
            onChange={(e) => setDeptId(e.target.value)}
            className="px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            style={{ background: 'var(--color-surface-2)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
          >
            <option value="">All Departments</option>
            {filteredDepts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>

          {cityId || clinicId || deptId ? (
            <button
              onClick={() => { setCityId(''); setClinicId(''); setDeptId(''); }}
              className="px-3 py-2 rounded-lg text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 border border-red-200 dark:border-red-900/30"
            >
              Clear Filters
            </button>
          ) : null}

          <div className="ml-auto flex items-center gap-2 text-sm" style={{ color: 'var(--color-text-muted)' }}>
            <span className="w-3 h-3 bg-red-100 dark:bg-red-900/30 inline-block rounded" />
            High no-show ({'>'}{p75.toFixed(0)}%) highlighted
          </div>
        </div>
      </div>

      {isError && <ErrorBanner message="Failed to load doctor data" onRetry={refetch} />}

      {isLoading ? <SkeletonTable rows={8} /> : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'var(--color-surface-2)', borderBottom: '1px solid var(--color-border)' }}>
                <th className="text-left px-5 py-3.5 font-semibold text-xs uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Doctor</th>
                <th className="text-left px-5 py-3.5 font-semibold text-xs uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Department</th>
                <th className="text-left px-5 py-3.5 font-semibold text-xs uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Location</th>
                {COLUMNS.map((col) => (
                  <th
                    key={col.key}
                    className="text-right px-5 py-3.5 font-semibold text-xs uppercase tracking-wider cursor-pointer hover:text-primary-500 select-none"
                    style={{ color: 'var(--color-text-muted)' }}
                    onClick={() => handleSort(col.key)}
                  >
                    {col.label}<SortIcon col={col.key} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((d) => {
                const isHighRisk = parseFloat(d.no_show_rate) >= p75;
                return (
                  <tr
                    key={d.id}
                    className={clsx(
                      'border-t transition-colors',
                      isHighRisk
                        ? 'bg-red-50/50 dark:bg-red-900/5 hover:bg-red-50 dark:hover:bg-red-900/10'
                        : 'hover:bg-gray-50 dark:hover:bg-white/2'
                    )}
                    style={{ borderColor: 'var(--color-border)' }}
                  >
                    <td className="px-5 py-3.5">
                      <div className="font-semibold" style={{ color: 'var(--color-text)' }}>{d.doctor}</div>
                      <span className={clsx('text-xs px-2 py-0.5 rounded-full', SENIORITY_BADGE[d.seniority])}>
                        {d.seniority}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-sm" style={{ color: 'var(--color-text-muted)' }}>{d.department}</td>
                    <td className="px-5 py-3.5">
                      <div className="text-sm" style={{ color: 'var(--color-text)' }}>{d.clinic}</div>
                      <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{d.city}</div>
                    </td>
                    <td className="px-5 py-3.5 text-right" style={{ color: 'var(--color-text)' }}>{parseInt(d.appointment_count).toLocaleString()}</td>
                    <td className="px-5 py-3.5 text-right font-semibold" style={{ color: '#0F6E56' }}>{formatPKR(parseFloat(d.revenue))}</td>
                    <td className={clsx('px-5 py-3.5 text-right font-semibold', isHighRisk ? 'text-red-500' : 'text-green-500')}>
                      {formatPercent(parseFloat(d.no_show_rate))}
                    </td>
                    <td className="px-5 py-3.5 text-right text-green-500">{formatPercent(parseFloat(d.completion_rate))}</td>
                    <td className="px-5 py-3.5 text-right" style={{ color: 'var(--color-text-muted)' }}>{formatPKR(parseFloat(d.avg_fee))}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {sorted.length === 0 && (
            <div className="py-12 text-center" style={{ color: 'var(--color-text-muted)' }}>
              No doctors found for the selected filters.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
