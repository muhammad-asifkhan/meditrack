import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, PieChart, Pie, Cell, ResponsiveContainer
} from 'recharts';
import { DollarSign, Calendar, UserX, XCircle, TrendingUp } from 'lucide-react';
import { useKpiSummary, useDepartmentStats, useDoctorStats, useRevenueData, useTimeseriesData } from '../hooks';
import { KpiCard, PageHeader, ChartCard, ErrorBanner, SkeletonTable } from '../components/ui';
import { formatPKR, formatNumber, formatPercent, DEPT_COLORS, CITY_COLORS, DAY_NAMES } from '../utils/formatters';

const CUSTOM_TOOLTIP_STYLE = {
  contentStyle: {
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: '8px',
    fontSize: '12px',
    color: 'var(--color-text)',
  },
};

export default function OverviewPage() {
  const kpi = useKpiSummary();
  const depts = useDepartmentStats();
  const doctors = useDoctorStats();
  const revenue = useRevenueData();
  const timeseries = useTimeseriesData();

  const top5ByRevenue = doctors.data?.slice(0, 5) || [];
  const top5ByNoShow = [...(doctors.data || [])].sort((a, b) => parseFloat(b.no_show_rate) - parseFloat(a.no_show_rate)).slice(0, 5);

  const monthlyData = timeseries.data?.monthly_volume.map((m) => ({
    month: m.month.slice(5),
    appointments: parseInt(m.appointment_count),
    revenue: parseFloat(m.revenue) / 1000,
  })) || [];

  const cityData = revenue.data?.by_city.map((c, i) => ({
    city: c.city,
    revenue: parseFloat(c.revenue) / 1000,
    appointments: parseInt(c.appointment_count),
    color: CITY_COLORS[i % CITY_COLORS.length],
  })) || [];

  const deptPieData = depts.data?.map((d) => ({
    name: d.department,
    value: parseInt(d.appointment_count),
    color: DEPT_COLORS[d.department] || '#94A3B8',
  })) || [];

  return (
    <div className="animate-fade-up">
      <PageHeader title="Overview" subtitle="Platform-wide performance summary" />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8 stagger">
        <KpiCard
          title="Total Revenue"
          value={kpi.data ? formatPKR(parseFloat(kpi.data.total_revenue)) : '—'}
          subtitle={`Top: ${kpi.data?.top_city || '...'}`}
          icon={<DollarSign className="w-5 h-5" />}
          color="#0F6E56"
          loading={kpi.isLoading}
        />
        <KpiCard
          title="Total Appointments"
          value={kpi.data ? formatNumber(parseInt(kpi.data.total_appointments)) : '—'}
          subtitle={`Top dept: ${kpi.data?.top_department || '...'}`}
          icon={<Calendar className="w-5 h-5" />}
          color="#0EA5E9"
          loading={kpi.isLoading}
        />
        <KpiCard
          title="No-Show Rate"
          value={kpi.data ? formatPercent(parseFloat(kpi.data.no_show_rate)) : '—'}
          subtitle="Target: < 15%"
          icon={<UserX className="w-5 h-5" />}
          color="#E24B4A"
          loading={kpi.isLoading}
        />
        <KpiCard
          title="Cancellation Rate"
          value={kpi.data ? formatPercent(parseFloat(kpi.data.cancellation_rate)) : '—'}
          subtitle={`Avg fee: ${kpi.data ? formatPKR(parseFloat(kpi.data.avg_fee)) : '...'}`}
          icon={<XCircle className="w-5 h-5" />}
          color="#BA7517"
          loading={kpi.isLoading}
        />
      </div>

      {kpi.isError && <ErrorBanner message="Failed to load KPIs" onRetry={kpi.refetch} />}

      {/* Monthly Trend */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
        <ChartCard
          title="Monthly Appointments & Revenue"
          subtitle="Last 24 months"
          loading={timeseries.isLoading}
          className="xl:col-span-2"
        >
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={monthlyData} {...CUSTOM_TOOLTIP_STYLE}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} />
              <YAxis yAxisId="left" tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} tickFormatter={(v) => `${v}K`} />
              <Tooltip contentStyle={CUSTOM_TOOLTIP_STYLE.contentStyle} />
              <Legend />
              <Line yAxisId="left" type="monotone" dataKey="appointments" stroke="#0F6E56" strokeWidth={2.5} dot={false} name="Appointments" />
              <Line yAxisId="right" type="monotone" dataKey="revenue" stroke="#0EA5E9" strokeWidth={2.5} dot={false} name="Revenue (K PKR)" />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Appointments by Department" loading={depts.isLoading}>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={deptPieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={3} dataKey="value">
                {deptPieData.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip contentStyle={CUSTOM_TOOLTIP_STYLE.contentStyle} />
              <Legend formatter={(val) => <span style={{ fontSize: 12, color: 'var(--color-text)' }}>{val}</span>} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* City Comparison */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
        <ChartCard title="City Revenue Comparison" subtitle="Completed appointments only" loading={revenue.isLoading}>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={cityData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} tickFormatter={(v) => `${v}K`} />
              <YAxis dataKey="city" type="category" width={90} tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} />
              <Tooltip contentStyle={CUSTOM_TOOLTIP_STYLE.contentStyle} formatter={(v: number) => [`${v.toFixed(0)}K PKR`, 'Revenue']} />
              <Bar dataKey="revenue" radius={[0, 6, 6, 0]}>
                {cityData.map((c) => <Cell key={c.city} fill={c.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Appointments by Day of Week" loading={timeseries.isLoading}>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={timeseries.data?.daily_of_week_volume.map((d) => ({
              day: DAY_NAMES[d.day_of_week],
              count: parseInt(d.appointment_count),
            })) || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} />
              <Tooltip contentStyle={CUSTOM_TOOLTIP_STYLE.contentStyle} />
              <Bar dataKey="count" fill="#0F6E56" radius={[4, 4, 0, 0]} name="Appointments" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Top Doctors Tables */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="card p-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-green-500" />
            <h3 className="font-semibold" style={{ color: 'var(--color-text)' }}>Top 5 Doctors by Revenue</h3>
          </div>
          {doctors.isLoading ? <SkeletonTable rows={5} /> : (
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <th className="text-left py-2 pr-4 font-medium text-xs uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Doctor</th>
                  <th className="text-left py-2 pr-4 font-medium text-xs uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Dept</th>
                  <th className="text-right py-2 font-medium text-xs uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Revenue</th>
                </tr>
              </thead>
              <tbody>
                {top5ByRevenue.map((d) => (
                  <tr key={d.id} className="border-t" style={{ borderColor: 'var(--color-border)' }}>
                    <td className="py-2.5 pr-4" style={{ color: 'var(--color-text)' }}>
                      <div className="font-medium text-sm">{d.doctor}</div>
                      <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{d.city}</div>
                    </td>
                    <td className="py-2.5 pr-4 text-xs" style={{ color: 'var(--color-text-muted)' }}>{d.department}</td>
                    <td className="py-2.5 text-right font-semibold text-sm" style={{ color: '#0F6E56' }}>{formatPKR(parseFloat(d.revenue))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="card p-6">
          <div className="flex items-center gap-2 mb-4">
            <UserX className="w-5 h-5 text-red-500" />
            <h3 className="font-semibold" style={{ color: 'var(--color-text)' }}>Top 5 Doctors by No-Show Rate</h3>
          </div>
          {doctors.isLoading ? <SkeletonTable rows={5} /> : (
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <th className="text-left py-2 pr-4 font-medium text-xs uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Doctor</th>
                  <th className="text-left py-2 pr-4 font-medium text-xs uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Dept</th>
                  <th className="text-right py-2 font-medium text-xs uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>No-Show %</th>
                </tr>
              </thead>
              <tbody>
                {top5ByNoShow.map((d) => (
                  <tr key={d.id} className="border-t" style={{ borderColor: 'var(--color-border)' }}>
                    <td className="py-2.5 pr-4" style={{ color: 'var(--color-text)' }}>
                      <div className="font-medium text-sm">{d.doctor}</div>
                      <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{d.city}</div>
                    </td>
                    <td className="py-2.5 pr-4 text-xs" style={{ color: 'var(--color-text-muted)' }}>{d.department}</td>
                    <td className="py-2.5 text-right font-semibold text-sm text-red-500">{formatPercent(parseFloat(d.no_show_rate))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
