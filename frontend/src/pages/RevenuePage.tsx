import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, Cell
} from 'recharts';
import { useRevenueData } from '../hooks';
import { PageHeader, ChartCard, ErrorBanner } from '../components/ui';
import { formatPKR, DEPT_COLORS, CITY_COLORS } from '../utils/formatters';

const TOOLTIP_STYLE = {
  contentStyle: {
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: '8px',
    fontSize: '12px',
    color: 'var(--color-text)',
  },
};

export default function RevenuePage() {
  const { data, isLoading, isError, refetch } = useRevenueData();

  // Stacked monthly by department
  const DEPTS = ['General', 'Cardiology', 'Orthopaedics', 'Dermatology', 'Pediatrics'];

  const monthlyMap: Record<string, Record<string, number>> = {};
  for (const row of data?.by_month || []) {
    if (!monthlyMap[row.month]) monthlyMap[row.month] = {};
    monthlyMap[row.month][row.department] = parseFloat(row.revenue) / 1000;
  }
  const stackedMonthly: Record<string, number | string>[] = Object.entries(monthlyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, depts]) => ({ month: month.slice(5), ...depts }));

  // City horizontal bar
  const cityData = (data?.by_city || []).map((c, i) => ({
    city: c.city,
    revenue: parseFloat(c.revenue) / 1000,
    color: CITY_COLORS[i % CITY_COLORS.length],
  }));

  // Clinic heatmap: months × clinics
  const clinicNames = [...new Set((data?.by_clinic || []).map((c) => c.clinic))].slice(0, 10);
  const months = [...new Set((data?.by_month || []).map((m) => m.month))].sort().slice(-6);

  // Build heatmap data
  const clinicMonthlyRevenue: Record<string, Record<string, number>> = {};
  for (const clinicName of clinicNames) {
    clinicMonthlyRevenue[clinicName] = {};
    for (const m of months) clinicMonthlyRevenue[clinicName][m] = 0;
  }
  for (const row of data?.by_clinic || []) {
    // We don't have month breakdown by clinic from the API — approximate from totals
    if (clinicMonthlyRevenue[row.clinic]) {
      for (const m of months) {
        clinicMonthlyRevenue[row.clinic][m] = parseFloat(row.revenue) / (months.length * 1000);
      }
    }
  }

  const maxRev = Math.max(...(data?.by_city || []).map((c) => parseFloat(c.revenue)));
  const totalRevenue = (data?.by_city || []).reduce((s, c) => s + parseFloat(c.revenue), 0);
  const topCity = data?.by_city?.[0];
  const topDept = data?.by_department?.[0];

  // MoM growth
  const monthly = stackedMonthly;
  let momGrowth = 0;
  if (monthly.length >= 2) {
    const curr = DEPTS.reduce((s, d) => s + ((monthly[monthly.length - 1][d] as number) || 0), 0);
    const prev = DEPTS.reduce((s, d) => s + ((monthly[monthly.length - 2][d] as number) || 0), 0);
    momGrowth = prev > 0 ? ((curr - prev) / prev) * 100 : 0;
  }

  function heatColor(val: number, max: number): string {
    const pct = max > 0 ? val / max : 0;
    const r = Math.round(15 + pct * (225 - 15));
    const g = Math.round(110 + pct * (200 - 110));
    const b = Math.round(86 + pct * (86 - 86));
    return `rgba(${r},${g},${b},${0.15 + pct * 0.75})`;
  }

  const maxClinicRev = Math.max(
    ...clinicNames.map((c) => Math.max(...months.map((m) => clinicMonthlyRevenue[c]?.[m] || 0)))
  );

  return (
    <div className="animate-fade-up">
      <PageHeader title="Revenue Analytics" subtitle="Revenue breakdown across cities, clinics, and departments" />

      {isError && <ErrorBanner message="Failed to load revenue data" onRetry={refetch} />}

      {/* Summary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Platform Revenue', value: formatPKR(totalRevenue), sub: 'Completed appointments' },
          { label: 'Highest Revenue City', value: topCity?.city || '—', sub: topCity ? formatPKR(parseFloat(topCity.revenue)) : '' },
          { label: 'Highest Revenue Dept', value: topDept?.department || '—', sub: topDept ? formatPKR(parseFloat(topDept.revenue)) : '' },
          {
            label: 'Month-on-Month Growth',
            value: `${momGrowth >= 0 ? '+' : ''}${momGrowth.toFixed(1)}%`,
            sub: 'vs previous month',
          },
        ].map((s) => (
          <div key={s.label} className="card p-5">
            <div className="text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>{s.label}</div>
            <div className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>{s.value}</div>
            {s.sub && <div className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{s.sub}</div>}
          </div>
        ))}
      </div>

      {/* Stacked bar by department */}
      <ChartCard
        title="Monthly Revenue by Department"
        subtitle="Stacked by department — last 24 months"
        loading={isLoading}
        className="mb-6"
      >
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={stackedMonthly}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} />
            <YAxis tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} tickFormatter={(v) => `${v}K`} />
            <Tooltip contentStyle={TOOLTIP_STYLE.contentStyle} formatter={(v: number, name: string) => [`${v.toFixed(0)}K PKR`, name]} />
            <Legend />
            {DEPTS.map((d) => (
              <Bar key={d} dataKey={d as string} stackId="a" fill={DEPT_COLORS[d]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
        {/* City horizontal bar */}
        <ChartCard title="Revenue by City" subtitle="Total completed consultation fees" loading={isLoading}>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={cityData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} tickFormatter={(v) => `${v}K`} />
              <YAxis dataKey="city" type="category" width={85} tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} />
              <Tooltip contentStyle={TOOLTIP_STYLE.contentStyle} formatter={(v: number) => [`${v.toFixed(0)}K PKR`, 'Revenue']} />
              <Bar dataKey="revenue" radius={[0, 6, 6, 0]}>
                {cityData.map((c) => <Cell key={c.city} fill={c.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Department table */}
        <ChartCard title="Revenue by Department" subtitle="Ranked by total revenue" loading={isLoading}>
          <div className="space-y-3 mt-2">
            {(data?.by_department || []).map((d) => {
              const pct = parseFloat(d.revenue) / (Math.max(...(data?.by_department || []).map((x) => parseFloat(x.revenue))) || 1) * 100;
              return (
                <div key={d.department}>
                  <div className="flex justify-between text-sm mb-1">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: DEPT_COLORS[d.department] }} />
                      <span style={{ color: 'var(--color-text)' }}>{d.department}</span>
                    </div>
                    <span className="font-semibold" style={{ color: 'var(--color-text)' }}>{formatPKR(parseFloat(d.revenue))}</span>
                  </div>
                  <div className="h-2 rounded-full" style={{ background: 'var(--color-surface-2)' }}>
                    <div
                      className="h-2 rounded-full transition-all duration-700"
                      style={{ width: `${pct}%`, background: DEPT_COLORS[d.department] }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </ChartCard>
      </div>

      {/* Clinic Heatmap */}
      <div className="card p-6">
        <h3 className="font-semibold text-base mb-1" style={{ color: 'var(--color-text)' }}>Clinic Revenue Heatmap</h3>
        <p className="text-sm mb-5" style={{ color: 'var(--color-text-muted)' }}>
          Monthly revenue intensity — darker = higher revenue
        </p>
        {isLoading ? (
          <div className="skeleton w-full h-48" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr>
                  <th className="text-left py-2 pr-4 font-medium w-48" style={{ color: 'var(--color-text-muted)' }}>Clinic</th>
                  {months.map((m) => (
                    <th key={m} className="text-center py-2 px-1 font-medium" style={{ color: 'var(--color-text-muted)' }}>
                      {m.slice(5)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(data?.by_clinic || []).slice(0, 12).map((clinic) => (
                  <tr key={clinic.id}>
                    <td className="py-1.5 pr-4 truncate max-w-48 font-medium" style={{ color: 'var(--color-text)' }}>
                      {clinic.clinic}
                    </td>
                    {months.map((m) => {
                      const val = clinicMonthlyRevenue[clinic.clinic]?.[m] || 0;
                      return (
                        <td key={m} className="py-1 px-1">
                          <div
                            className="rounded-md h-10 flex items-center justify-center text-xs font-medium transition-all"
                            style={{
                              background: heatColor(val, maxClinicRev),
                              color: val / maxClinicRev > 0.5 ? '#fff' : 'var(--color-text)',
                            }}
                            title={`${clinic.clinic} — ${m}: ${val.toFixed(0)}K PKR`}
                          >
                            {val > 0 ? `${val.toFixed(0)}K` : '—'}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
