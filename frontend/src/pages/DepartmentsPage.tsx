import { useState } from 'react';
import { X, ChevronUp, ChevronDown } from 'lucide-react';
import { useDepartmentStats } from '../hooks';
import { PageHeader, StatusBadge, ErrorBanner, SkeletonTable } from '../components/ui';
import { formatPKR, formatPercent, DEPT_COLORS } from '../utils/formatters';
import type { DepartmentStat } from '../types';
import clsx from 'clsx';

type SortKey = keyof Pick<DepartmentStat, 'appointment_count' | 'revenue' | 'no_show_rate' | 'cancellation_rate' | 'avg_fee'>;

export default function DepartmentsPage() {
  const { data, isLoading, isError, refetch } = useDepartmentStats();
  const [sortKey, setSortKey] = useState<SortKey>('revenue');
  const [sortAsc, setSortAsc] = useState(false);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<DepartmentStat | null>(null);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  };

  const sorted = [...(data || [])]
    .filter((d) => d.department.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      const aVal = parseFloat(a[sortKey]);
      const bVal = parseFloat(b[sortKey]);
      return sortAsc ? aVal - bVal : bVal - aVal;
    });

  const SortIcon = ({ col }: { col: SortKey }) => (
    sortKey === col
      ? (sortAsc ? <ChevronUp className="w-3 h-3 inline ml-1" /> : <ChevronDown className="w-3 h-3 inline ml-1" />)
      : <ChevronDown className="w-3 h-3 inline ml-1 opacity-30" />
  );

  const COLUMNS: { label: string; key: SortKey; align: string }[] = [
    { label: 'Appointments', key: 'appointment_count', align: 'right' },
    { label: 'Revenue', key: 'revenue', align: 'right' },
    { label: 'No-Show %', key: 'no_show_rate', align: 'right' },
    { label: 'Cancellation %', key: 'cancellation_rate', align: 'right' },
    { label: 'Avg Fee', key: 'avg_fee', align: 'right' },
  ];

  return (
    <div className="animate-fade-up">
      <PageHeader title="Departments" subtitle="Performance breakdown by department" />

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
        {(data || []).map((d) => (
          <button
            key={d.id}
            onClick={() => setSelected(d)}
            className="card p-4 text-left transition-all hover:shadow-md"
          >
            <div className="w-3 h-3 rounded-full mb-2" style={{ background: DEPT_COLORS[d.department] || '#94A3B8' }} />
            <div className="font-semibold text-sm" style={{ color: 'var(--color-text)' }}>{d.department}</div>
            <div className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>{formatPKR(parseFloat(d.revenue))}</div>
            <div className="mt-2">
              <StatusBadge rate={d.no_show_rate} />
            </div>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search departments..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="px-4 py-2.5 rounded-xl border text-sm w-full max-w-xs focus:outline-none focus:ring-2 focus:ring-primary-500"
          style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
        />
      </div>

      {isError && <ErrorBanner message="Failed to load department data" onRetry={refetch} />}

      {isLoading ? <SkeletonTable rows={5} /> : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'var(--color-surface-2)', borderBottom: '1px solid var(--color-border)' }}>
                <th className="text-left px-5 py-3.5 font-semibold text-xs uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Department</th>
                {COLUMNS.map((col) => (
                  <th key={col.key}
                    className={`${col.align === 'right' ? 'text-right' : 'text-left'} px-5 py-3.5 font-semibold text-xs uppercase tracking-wider cursor-pointer hover:text-primary-500 select-none`}
                    style={{ color: 'var(--color-text-muted)' }}
                    onClick={() => handleSort(col.key)}
                  >
                    {col.label}<SortIcon col={col.key} />
                  </th>
                ))}
                <th className="text-center px-5 py-3.5 font-semibold text-xs uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((d) => (
                <tr
                  key={d.id}
                  className="border-t cursor-pointer transition-colors hover:bg-primary-50 dark:hover:bg-primary-900/10"
                  style={{ borderColor: 'var(--color-border)' }}
                  onClick={() => setSelected(d)}
                >
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: DEPT_COLORS[d.department] || '#94A3B8' }} />
                      <span className="font-semibold" style={{ color: 'var(--color-text)' }}>{d.department}</span>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-right" style={{ color: 'var(--color-text)' }}>{parseInt(d.appointment_count).toLocaleString()}</td>
                  <td className="px-5 py-4 text-right font-semibold" style={{ color: '#0F6E56' }}>{formatPKR(parseFloat(d.revenue))}</td>
                  <td className={clsx('px-5 py-4 text-right font-semibold', parseFloat(d.no_show_rate) > 25 ? 'text-red-500' : parseFloat(d.no_show_rate) < 15 ? 'text-green-500' : 'text-amber-500')}>
                    {formatPercent(parseFloat(d.no_show_rate))}
                  </td>
                  <td className="px-5 py-4 text-right" style={{ color: 'var(--color-text-muted)' }}>{formatPercent(parseFloat(d.cancellation_rate))}</td>
                  <td className="px-5 py-4 text-right" style={{ color: 'var(--color-text)' }}>{formatPKR(parseFloat(d.avg_fee))}</td>
                  <td className="px-5 py-4 text-center"><StatusBadge rate={d.no_show_rate} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail Drawer */}
      {selected && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/50" onClick={() => setSelected(null)} />
          <div className="w-full max-w-lg shadow-2xl overflow-y-auto animate-slide-in" style={{ background: 'var(--color-surface)' }}>
            <div className="p-6">
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full" style={{ background: DEPT_COLORS[selected.department] || '#94A3B8' }} />
                  <div>
                    <h2 className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>{selected.department}</h2>
                    <StatusBadge rate={selected.no_show_rate} />
                  </div>
                </div>
                <button onClick={() => setSelected(null)} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5">
                  <X className="w-5 h-5" style={{ color: 'var(--color-text-muted)' }} />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6">
                {[
                  { label: 'Total Appointments', value: parseInt(selected.appointment_count).toLocaleString() },
                  { label: 'Total Revenue', value: formatPKR(parseFloat(selected.revenue)) },
                  { label: 'No-Show Rate', value: formatPercent(parseFloat(selected.no_show_rate)) },
                  { label: 'Cancellation Rate', value: formatPercent(parseFloat(selected.cancellation_rate)) },
                  { label: 'Completion Rate', value: formatPercent(parseFloat(selected.completion_rate)) },
                  { label: 'Avg Consultation Fee', value: formatPKR(parseFloat(selected.avg_fee)) },
                ].map((stat) => (
                  <div key={stat.label} className="p-4 rounded-xl" style={{ background: 'var(--color-surface-2)' }}>
                    <div className="text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>{stat.label}</div>
                    <div className="text-lg font-bold" style={{ color: 'var(--color-text)' }}>{stat.value}</div>
                  </div>
                ))}
              </div>

              {/* Thresholds */}
              <div className="p-4 rounded-xl border" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface-2)' }}>
                <h4 className="font-semibold text-sm mb-3" style={{ color: 'var(--color-text)' }}>Performance Thresholds</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span style={{ color: 'var(--color-text-muted)' }}>No-show rate target</span>
                    <span className="font-medium" style={{ color: 'var(--color-text)' }}>{'< 15% (healthy), < 25% (watch)'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span style={{ color: 'var(--color-text-muted)' }}>Current status</span>
                    <StatusBadge rate={selected.no_show_rate} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
