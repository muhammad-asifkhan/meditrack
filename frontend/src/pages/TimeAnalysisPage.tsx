import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { Lightbulb } from 'lucide-react';
import { useTimeseriesData } from '../hooks';
import { PageHeader, ChartCard, ErrorBanner } from '../components/ui';
import { DAY_NAMES_FULL, DAY_NAMES } from '../utils/formatters';

const TOOLTIP = {
  contentStyle: {
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: '8px',
    fontSize: '12px',
    color: 'var(--color-text)',
  },
};

function rollingAvg(data: number[], window: number): (number | null)[] {
  return data.map((_, i) => {
    if (i < window - 1) return null;
    const slice = data.slice(i - window + 1, i + 1);
    return slice.reduce((a, b) => a + b, 0) / window;
  });
}

export default function TimeAnalysisPage() {
  const { data, isLoading, isError, refetch } = useTimeseriesData();

  const monthly = (data?.monthly_volume || []).map((m) => ({
    month: m.month,
    count: parseInt(m.appointment_count),
  }));

  const counts = monthly.map((m) => m.count);
  const rolling3 = rollingAvg(counts, 3);

  const monthlyWithRolling = monthly.map((m, i) => ({
    ...m,
    rolling3: rolling3[i] !== null ? Math.round(rolling3[i]!) : undefined,
  }));

  // Day of week
  const dayData = Array.from({ length: 7 }, (_, i) => {
    const found = data?.daily_of_week_volume.find((d) => d.day_of_week === i);
    return { day: DAY_NAMES[i], fullDay: DAY_NAMES_FULL[i], count: found ? parseInt(found.appointment_count) : 0, dow: i };
  });
  const minDayCount = Math.min(...dayData.map((d) => d.count));
  const maxDayCount = Math.max(...dayData.map((d) => d.count));
  const lowestDay = dayData.find((d) => d.count === minDayCount);

  // Hourly heatmap: 7 days × 24 hours
  const hourlyGrid: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
  for (const cell of data?.hourly_distribution || []) {
    hourlyGrid[cell.day_of_week][cell.hour] = parseInt(cell.appointment_count);
  }
  const maxHourly = Math.max(...hourlyGrid.flat());
  const allCells = hourlyGrid.flatMap((row, d) => row.map((v, h) => ({ d, h, v })));
  const busiestCell = allCells.reduce((best, c) => (c.v > best.v ? c : best), { d: 0, h: 0, v: 0 });

  function heatColor(val: number): string {
    const pct = maxHourly > 0 ? val / maxHourly : 0;
    if (pct === 0) return 'var(--color-surface-2)';
    const alpha = 0.15 + pct * 0.85;
    return `rgba(15, 110, 86, ${alpha})`;
  }

  const insight = busiestCell.v > 0
    ? `${DAY_NAMES_FULL[busiestCell.d]}s at ${busiestCell.h}:00 are your busiest slot (${busiestCell.v} appointments).${lowestDay ? ` ${lowestDay.fullDay}s are the quietest day — consider reducing doctor schedules.` : ''}`
    : 'Not enough data to generate insights yet.';

  return (
    <div className="animate-fade-up">
      <PageHeader title="Time Analysis" subtitle="Understand appointment volume patterns across time" />

      {isError && <ErrorBanner message="Failed to load time series data" onRetry={refetch} />}

      {/* Insight callout */}
      {!isLoading && busiestCell.v > 0 && (
        <div className="mb-6 p-4 rounded-xl border flex items-start gap-3"
          style={{ background: 'rgba(15, 110, 86, 0.06)', borderColor: 'rgba(15, 110, 86, 0.2)' }}>
          <Lightbulb className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: '#0F6E56' }} />
          <div>
            <div className="font-semibold text-sm mb-0.5" style={{ color: '#0F6E56' }}>Scheduling Insight</div>
            <div className="text-sm" style={{ color: 'var(--color-text)' }}>{insight}</div>
          </div>
        </div>
      )}

      {/* Monthly with rolling average */}
      <ChartCard
        title="Monthly Appointment Volume"
        subtitle="With 3-month rolling average overlay"
        loading={isLoading}
        className="mb-6"
      >
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={monthlyWithRolling}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }}
              tickFormatter={(v) => v.slice(5)} />
            <YAxis tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} />
            <Tooltip contentStyle={TOOLTIP.contentStyle} />
            <Legend />
            <Line type="monotone" dataKey="count" stroke="#0F6E56" strokeWidth={2} dot={false} name="Monthly Volume" />
            <Line type="monotone" dataKey="rolling3" stroke="#0EA5E9" strokeWidth={2.5}
              dot={false} strokeDasharray="6 3" name="3-Month Avg" connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Day of week */}
      <ChartCard
        title="Appointments by Day of Week"
        subtitle={lowestDay ? `Lowest: ${lowestDay.fullDay} (${lowestDay.count} appointments)` : ''}
        loading={isLoading}
        className="mb-6"
      >
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={dayData}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis dataKey="day" tick={{ fontSize: 12, fill: 'var(--color-text-muted)' }} />
            <YAxis tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} />
            <Tooltip contentStyle={TOOLTIP.contentStyle} />
            <Bar dataKey="count" radius={[4, 4, 0, 0]} name="Appointments">
              {dayData.map((d) => (
                <rect
                  key={d.day}
                  fill={d.count === minDayCount ? '#E24B4A' : d.count === maxDayCount ? '#0F6E56' : '#1D9E75'}
                />
              ))}
              {/* Can't use Cell directly in Bar without import — use fill prop per entry */}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Hourly heatmap */}
      <div className="card p-6">
        <h3 className="font-semibold mb-1" style={{ color: 'var(--color-text)' }}>
          Appointment Heatmap — Day × Hour
        </h3>
        <p className="text-sm mb-5" style={{ color: 'var(--color-text-muted)' }}>
          Darker green = more appointments. Identify peak and dead time slots.
        </p>
        {isLoading ? (
          <div className="skeleton w-full h-56" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr>
                  <th className="py-1 pr-2 text-left w-12" style={{ color: 'var(--color-text-muted)' }}>Hour</th>
                  {Array.from({ length: 24 }, (_, h) => (
                    <th key={h} className="py-1 px-0.5 text-center font-normal" style={{ color: 'var(--color-text-muted)', minWidth: '28px' }}>
                      {h === 0 ? '12a' : h < 12 ? `${h}a` : h === 12 ? '12p' : `${h - 12}p`}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 7 }, (_, d) => (
                  <tr key={d}>
                    <td className="py-0.5 pr-2 font-medium" style={{ color: 'var(--color-text-muted)' }}>
                      {DAY_NAMES[d]}
                    </td>
                    {Array.from({ length: 24 }, (_, h) => {
                      const val = hourlyGrid[d][h];
                      const isBusiest = d === busiestCell.d && h === busiestCell.h;
                      return (
                        <td key={h} className="py-0.5 px-0.5">
                          <div
                            className="rounded h-7 flex items-center justify-center text-xs transition-all"
                            style={{
                              background: heatColor(val),
                              color: val / maxHourly > 0.5 ? '#fff' : 'var(--color-text-muted)',
                              outline: isBusiest ? '2px solid #0F6E56' : 'none',
                            }}
                            title={`${DAY_NAMES_FULL[d]} ${h}:00 — ${val} appointments`}
                          >
                            {val > 0 ? val : ''}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex items-center gap-3 mt-4">
              <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Low</span>
              <div className="flex gap-0.5">
                {[0.1, 0.25, 0.4, 0.55, 0.7, 0.85, 1].map((p) => (
                  <div key={p} className="w-6 h-4 rounded-sm" style={{ background: `rgba(15,110,86,${p})` }} />
                ))}
              </div>
              <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>High</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
