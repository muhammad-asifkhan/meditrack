// Pakistani Rupee formatter (lakh notation)
export function formatPKR(amount: number | string): string {
  const n = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(n)) return 'PKR 0';
  if (n >= 10000000) return `PKR ${(n / 10000000).toFixed(1)}Cr`;
  if (n >= 100000) return `PKR ${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `PKR ${(n / 1000).toFixed(1)}K`;
  return `PKR ${n.toFixed(0)}`;
}

export function formatPKRFull(amount: number | string): string {
  const n = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(n)) return 'PKR 0';
  // Pakistani lakh notation: 1,23,456
  const parts = Math.round(n).toString().split('');
  if (parts.length <= 3) return `PKR ${parts.join('')}`;
  const last3 = parts.splice(-3).join('');
  const rest = parts.reverse().reduce((acc, d, i) => {
    return i % 2 === 0 ? [d, ...acc] : [...acc.slice(0, -1), acc[acc.length-1] + d];
  }, [] as string[]);
  return `PKR ${rest.reverse().join(',')},${last3}`;
}

export function formatNumber(n: number | string): string {
  const num = typeof n === 'string' ? parseFloat(n) : n;
  if (isNaN(num)) return '0';
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return Math.round(num).toString();
}

export function formatPercent(n: number | string): string {
  const num = typeof n === 'string' ? parseFloat(n) : n;
  if (isNaN(num)) return '0.0%';
  return `${num.toFixed(1)}%`;
}

export function classifyNoShowRisk(rate: number | string): 'healthy' | 'watch' | 'underperforming' {
  const r = typeof rate === 'string' ? parseFloat(rate) : rate;
  if (r < 15) return 'healthy';
  if (r < 25) return 'watch';
  return 'underperforming';
}

export const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const DAY_NAMES_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const DEPT_COLORS: Record<string, string> = {
  'General':       '#0F6E56',
  'Cardiology':    '#E24B4A',
  'Orthopaedics':  '#BA7517',
  'Dermatology':   '#7C3AED',
  'Pediatrics':    '#0EA5E9',
};

export const CITY_COLORS = ['#0F6E56', '#1D9E75', '#0EA5E9', '#7C3AED', '#E24B4A'];

export function getDeptColor(dept: string): string {
  return DEPT_COLORS[dept] || '#94A3B8';
}

export function buildDateRange(months: number): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  from.setMonth(from.getMonth() - months);
  return {
    from: from.toISOString().split('T')[0],
    to: to.toISOString().split('T')[0],
  };
}

export function roleScopeFilter(role: string, cityId: number | null, cityData: unknown[]): unknown[] {
  if (role === 'superadmin') return cityData;
  return (cityData as { city_id: number }[]).filter((d) => d.city_id === cityId);
}
