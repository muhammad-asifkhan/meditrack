import { useState, useMemo } from 'react';
import {
  X, Search, Phone, Mail, MapPin, Star, Clock, Calendar,
  TrendingUp, Users, DollarSign, Award, Languages, Stethoscope,
  ChevronRight, Filter
} from 'lucide-react';
import {
  RadialBarChart, RadialBar, PieChart, Pie, Cell,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar
} from 'recharts';
import { useDoctorProfiles, useDoctorProfile } from '../hooks';
import { PageHeader, SkeletonKpiCard, ErrorBanner } from '../components/ui';
import { ProfileAvatar, Avatar, StarRating } from '../components/ui/Avatar';
import { formatPKR, formatPercent, DEPT_COLORS } from '../utils/formatters';
import type { DoctorProfile } from '../types';
import clsx from 'clsx';

const SENIORITY_CONFIG = {
  junior:     { label: 'Junior',     color: '#0EA5E9', bg: 'rgba(14,165,233,.12)' },
  senior:     { label: 'Senior',     color: '#7C3AED', bg: 'rgba(124,58,237,.12)' },
  consultant: { label: 'Consultant', color: '#BA7517', bg: 'rgba(186,117,23,.12)' },
};

const STATUS_COLORS: Record<string, string> = {
  completed: '#0F6E56',
  cancelled:  '#BA7517',
  no_show:    '#E24B4A',
};

const TOOLTIP_STYLE = {
  contentStyle: {
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: '8px',
    fontSize: '12px',
    color: 'var(--color-text)',
  },
};

function DoctorCard({ doctor, onClick }: { doctor: DoctorProfile; onClick: () => void }) {
  const sen = SENIORITY_CONFIG[doctor.seniority_level];
  const noShow = parseFloat(doctor.no_show_rate);
  const deptColor = DEPT_COLORS[doctor.department] || '#94A3B8';

  return (
    <div
      className="card cursor-pointer group transition-all duration-200 hover:-translate-y-0.5"
      style={{ overflow: 'hidden' }}
      onClick={onClick}
    >
      {/* Dept color bar */}
      <div style={{ height: 4, background: deptColor }} />

      <div style={{ padding: '20px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 16 }}>
          <ProfileAvatar name={doctor.name} seed={doctor.avatar_seed} size={64} isDoctor />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--color-text)', marginBottom: 3 }}
              className="truncate">{doctor.name}</div>
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 6 }}>{doctor.qualification || 'MBBS'}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span style={{
                background: sen.bg, color: sen.color,
                fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20
              }}>{sen.label}</span>
              <span style={{
                background: `${deptColor}15`, color: deptColor,
                fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 20
              }}>{doctor.department}</span>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
            style={{ color: 'var(--color-text-muted)' }} />
        </div>

        {/* Rating */}
        <div style={{ marginBottom: 14 }}>
          <StarRating rating={parseFloat(String(doctor.rating)) || 4.0} />
        </div>

        {/* Stats grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
          {[
            { label: 'Appointments', value: parseInt(doctor.total_appointments).toLocaleString(), icon: Calendar },
            { label: 'Revenue', value: formatPKR(parseFloat(doctor.total_revenue)), icon: DollarSign },
            { label: 'Patients', value: parseInt(doctor.unique_patients).toLocaleString(), icon: Users },
            { label: 'Experience', value: `${doctor.years_experience || 0}y`, icon: Award },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} style={{ background: 'var(--color-surface-2)', borderRadius: 8, padding: '8px 10px' }}>
              <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginBottom: 3, display: 'flex', alignItems: 'center', gap: 4 }}>
                <Icon className="w-3 h-3" /> {label}
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text)' }}>{value}</div>
            </div>
          ))}
        </div>

        {/* No-show rate bar */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
            <span style={{ color: 'var(--color-text-muted)' }}>No-show rate</span>
            <span style={{ fontWeight: 600, color: noShow > 25 ? '#E24B4A' : noShow < 15 ? '#22C55E' : '#BA7517' }}>
              {formatPercent(noShow)}
            </span>
          </div>
          <div style={{ height: 5, background: 'var(--color-surface-2)', borderRadius: 3 }}>
            <div style={{
              height: 5, borderRadius: 3, transition: 'width .6s ease',
              width: `${Math.min(noShow, 100)}%`,
              background: noShow > 25 ? '#E24B4A' : noShow < 15 ? '#22C55E' : '#BA7517',
            }} />
          </div>
        </div>

        {/* Location */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 12, fontSize: 11, color: 'var(--color-text-muted)' }}>
          <MapPin className="w-3 h-3" />
          <span className="truncate">{doctor.clinic}, {doctor.city}</span>
        </div>
      </div>
    </div>
  );
}

function DoctorProfileModal({ doctorId, onClose }: { doctorId: number; onClose: () => void }) {
  const { data, isLoading, isError } = useDoctorProfile(doctorId);
  const [activeTab, setActiveTab] = useState<'overview' | 'appointments' | 'patients'>('overview');

  if (isLoading) return (
    <div style={{ padding: 40, textAlign: 'center' }}>
      <div style={{ width: 48, height: 48, borderRadius: '50%', border: '3px solid var(--color-border)', borderTopColor: '#0F6E56', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
      <div style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>Loading profile...</div>
    </div>
  );

  if (isError || !data) return (
    <div style={{ padding: 40 }}><ErrorBanner message="Failed to load doctor profile" /></div>
  );

  const { profile, monthly_trend, status_breakdown, recent_appointments, patient_types, top_patients } = data;
  const sen = SENIORITY_CONFIG[profile.seniority_level];
  const deptColor = DEPT_COLORS[profile.department] || '#94A3B8';

  const pieData = status_breakdown.map((s) => ({
    name: s.status.replace('_', ' '),
    value: parseInt(s.count),
    color: STATUS_COLORS[s.status] || '#94A3B8',
  }));

  const patientPie = [
    { name: 'Returning', value: parseInt(patient_types.find(p => p.is_returning)?.count || '0'), color: '#0F6E56' },
    { name: 'New', value: parseInt(patient_types.find(p => !p.is_returning)?.count || '0'), color: '#0EA5E9' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Hero header */}
      <div style={{ background: `linear-gradient(135deg, ${deptColor}20, ${deptColor}05)`, borderBottom: '1px solid var(--color-border)', padding: '28px 28px 20px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 20, marginBottom: 20 }}>
          <ProfileAvatar name={profile.name} seed={profile.avatar_seed} size={96} isDoctor />
          <div style={{ flex: 1 }}>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-text)', marginBottom: 4 }}>{profile.name}</h2>
            <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 10 }}>
              {profile.qualification || 'MBBS'} · {profile.years_experience || 0} years experience
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ background: sen.bg, color: sen.color, fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 20 }}>{sen.label}</span>
              <span style={{ background: `${deptColor}18`, color: deptColor, fontSize: 12, fontWeight: 500, padding: '3px 10px', borderRadius: 20 }}>{profile.department}</span>
            </div>
            <div style={{ marginTop: 10 }}>
              <StarRating rating={parseFloat(String(profile.rating)) || 4.0} />
            </div>
          </div>
          <button onClick={onClose}
            style={{ padding: 8, borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-surface)', cursor: 'pointer', color: 'var(--color-text-muted)', flexShrink: 0 }}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
          {[
            { label: 'Total Appointments', value: parseInt(profile.total_appointments).toLocaleString(), color: '#0F6E56' },
            { label: 'Total Revenue', value: formatPKR(parseFloat(profile.total_revenue)), color: '#0EA5E9' },
            { label: 'No-Show Rate', value: formatPercent(parseFloat(profile.no_show_rate)), color: '#E24B4A' },
            { label: 'Unique Patients', value: parseInt(profile.unique_patients).toLocaleString(), color: '#7C3AED' },
          ].map((k) => (
            <div key={k.label} style={{ background: 'var(--color-surface)', borderRadius: 10, padding: '12px 14px', border: '1px solid var(--color-border)' }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: k.color }}>{k.value}</div>
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>{k.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, padding: '12px 28px 0', borderBottom: '1px solid var(--color-border)', flexShrink: 0 }}>
        {(['overview', 'appointments', 'patients'] as const).map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            style={{
              padding: '8px 18px', borderRadius: '8px 8px 0 0', border: 'none', cursor: 'pointer',
              fontFamily: 'inherit', fontSize: 13, fontWeight: 500, textTransform: 'capitalize',
              background: activeTab === tab ? 'var(--color-surface)' : 'transparent',
              color: activeTab === tab ? 'var(--color-text)' : 'var(--color-text-muted)',
              borderBottom: activeTab === tab ? '2px solid #0F6E56' : '2px solid transparent',
              marginBottom: -1,
            }}>
            {tab === 'appointments' ? 'Recent Appointments' : tab === 'patients' ? 'Top Patients' : 'Overview'}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 28px' }}>

        {activeTab === 'overview' && (
          <div>
            {/* Bio */}
            {profile.bio && (
              <div style={{ background: 'var(--color-surface-2)', borderRadius: 10, padding: 16, marginBottom: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>About</div>
                <p style={{ fontSize: 13, color: 'var(--color-text)', lineHeight: 1.7 }}>{profile.bio}</p>
              </div>
            )}

            {/* Info grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
              {[
                { icon: Stethoscope, label: 'Specializations', value: profile.specializations || 'General Practice' },
                { icon: Languages, label: 'Languages', value: profile.languages || 'Urdu, English' },
                { icon: Clock, label: 'Consultation Hours', value: `${profile.consultation_start || '09:00'} – ${profile.consultation_end || '17:00'}` },
                { icon: Calendar, label: 'Available Days', value: profile.available_days || 'Mon–Fri' },
                { icon: Phone, label: 'Phone', value: profile.phone || 'Not provided' },
                { icon: MapPin, label: 'Clinic', value: `${profile.clinic}, ${profile.city}` },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} style={{ display: 'flex', gap: 10, padding: '12px 14px', background: 'var(--color-surface-2)', borderRadius: 9 }}>
                  <Icon className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#0F6E56' }} />
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em' }}>{label}</div>
                    <div style={{ fontSize: 13, color: 'var(--color-text)', marginTop: 2 }}>{value}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Monthly trend chart */}
            <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10, padding: 16, marginBottom: 16 }}>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4, color: 'var(--color-text)' }}>Monthly Appointments (Last 12 Months)</div>
              <div style={{ height: 180 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={monthly_trend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }} tickFormatter={(v) => v.slice(5)} />
                    <YAxis tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }} />
                    <Tooltip contentStyle={TOOLTIP_STYLE.contentStyle} />
                    <Line type="monotone" dataKey="appointments" stroke={deptColor} strokeWidth={2.5} dot={{ r: 3, fill: deptColor }} name="Appointments" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Status + patient type pies */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10, padding: 16 }}>
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4, color: 'var(--color-text)' }}>Appointment Status</div>
                <div style={{ height: 150 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" outerRadius={55} dataKey="value" paddingAngle={3}>
                        {pieData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                      </Pie>
                      <Tooltip contentStyle={TOOLTIP_STYLE.contentStyle} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div style={{ display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
                  {pieData.map((d) => (
                    <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--color-text-muted)' }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: d.color }} />
                      {d.name} ({d.value})
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10, padding: 16 }}>
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4, color: 'var(--color-text)' }}>Patient Types</div>
                <div style={{ height: 150 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={patientPie} cx="50%" cy="50%" innerRadius={35} outerRadius={55} dataKey="value" paddingAngle={4}>
                        {patientPie.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                      </Pie>
                      <Tooltip contentStyle={TOOLTIP_STYLE.contentStyle} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
                  {patientPie.map((d) => (
                    <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--color-text-muted)' }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: d.color }} />
                      {d.name} ({d.value})
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'appointments' && (
          <div>
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 14 }}>Most recent 10 appointments</div>
            {recent_appointments.map((appt) => (
              <div key={appt.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 0', borderBottom: '1px solid var(--color-border)' }}>
                <Avatar name={appt.patient_name} size={36} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--color-text)' }}>{appt.patient_name}</div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                    {new Date(appt.scheduled_at).toLocaleString('en-PK', { dateStyle: 'medium', timeStyle: 'short' })}
                    {appt.is_returning ? ' · Returning' : ' · New patient'}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#0F6E56' }}>{formatPKR(parseFloat(appt.consultation_fee))}</div>
                  <span style={{
                    fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
                    background: appt.status === 'completed' ? 'rgba(15,110,86,.12)' : appt.status === 'no_show' ? 'rgba(226,75,74,.12)' : 'rgba(186,117,23,.12)',
                    color: appt.status === 'completed' ? '#0F6E56' : appt.status === 'no_show' ? '#E24B4A' : '#BA7517',
                  }}>
                    {appt.status.replace('_', ' ')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'patients' && (
          <div>
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 14 }}>Patients with most visits to this doctor</div>
            {top_patients.map((p, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 0', borderBottom: '1px solid var(--color-border)' }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--color-surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#0F6E56' }}>
                  {i + 1}
                </div>
                <Avatar name={p.name} size={36} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--color-text)' }}>{p.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                    {p.phone} · {p.is_returning ? 'Returning' : 'New'}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text)' }}>{p.visits} visits</div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                    Last: {new Date(p.last_visit).toLocaleDateString('en-PK')}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function DoctorProfilesPage() {
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [seniorityFilter, setSeniorityFilter] = useState('');
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const filters = useMemo(() => {
    const f: Record<string, string> = { page: String(page), limit: '12' };
    if (search) f.search = search;
    if (deptFilter) f.department_id = deptFilter;
    if (cityFilter) f.city_id = cityFilter;
    if (seniorityFilter) f.seniority = seniorityFilter;
    return f;
  }, [search, deptFilter, cityFilter, seniorityFilter, page]);

  const { data, isLoading, isError, refetch } = useDoctorProfiles(filters);
  const doctors = data?.data || [];
  const total = data?.meta?.total || 0;

  return (
    <div className="animate-fade-up">
      <PageHeader title="Doctor Profiles" subtitle={`${total} doctors across 5 cities, 15 clinics`} />

      {/* Filters */}
      <div className="card" style={{ padding: '14px 18px', marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: '1 1 220px', minWidth: 200 }}>
            <Search className="w-4 h-4" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
            <input
              type="text"
              placeholder="Search doctors by name..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="form-control"
              style={{ paddingLeft: 34, width: '100%' }}
            />
          </div>
          {[
            { value: deptFilter, onChange: (v: string) => { setDeptFilter(v); setPage(1); }, placeholder: 'All Departments', options: ['General','Cardiology','Orthopaedics','Dermatology','Pediatrics'].map((d,i) => ({ label: d, value: String(i+1) })) },
            { value: cityFilter, onChange: (v: string) => { setCityFilter(v); setPage(1); }, placeholder: 'All Cities', options: ['Karachi','Lahore','Islamabad','Peshawar','Multan'].map((c,i) => ({ label: c, value: String(i+1) })) },
            { value: seniorityFilter, onChange: (v: string) => { setSeniorityFilter(v); setPage(1); }, placeholder: 'All Seniority', options: ['junior','senior','consultant'].map(s => ({ label: s.charAt(0).toUpperCase()+s.slice(1), value: s })) },
          ].map((sel, i) => (
            <select key={i} value={sel.value} onChange={(e) => sel.onChange(e.target.value)}
              className="form-control" style={{ minWidth: 140 }}>
              <option value="">{sel.placeholder}</option>
              {sel.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          ))}
          {(search || deptFilter || cityFilter || seniorityFilter) && (
            <button onClick={() => { setSearch(''); setDeptFilter(''); setCityFilter(''); setSeniorityFilter(''); setPage(1); }}
              className="btn-outline" style={{ fontSize: 12 }}>
              Clear
            </button>
          )}
          <div style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--color-text-muted)' }}>
            {total} doctors
          </div>
        </div>
      </div>

      {isError && <ErrorBanner message="Failed to load doctor profiles" onRetry={refetch} />}

      {/* Grid */}
      {isLoading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px,1fr))', gap: 16 }}>
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="card" style={{ padding: 20 }}>
              <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                <div className="skeleton" style={{ width: 72, height: 72, borderRadius: '50%', flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div className="skeleton" style={{ height: 16, marginBottom: 8 }} />
                  <div className="skeleton" style={{ height: 12, width: '60%' }} />
                </div>
              </div>
              <div className="skeleton" style={{ height: 80, marginBottom: 12 }} />
              <div className="skeleton" style={{ height: 6 }} />
            </div>
          ))}
        </div>
      ) : doctors.length === 0 ? (
        <div className="card" style={{ padding: 60, textAlign: 'center' }}>
          <Stethoscope className="w-12 h-12 mx-auto mb-4" style={{ color: 'var(--color-text-muted)' }} />
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--color-text)', marginBottom: 4 }}>No doctors found</div>
          <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Try adjusting your filters</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px,1fr))', gap: 16 }}>
          {doctors.map((doc) => (
            <DoctorCard key={doc.id} doctor={doc} onClick={() => setSelectedId(doc.id)} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {total > 12 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 24 }}>
          <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page === 1} className="btn-outline">← Prev</button>
          <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Page {page} of {Math.ceil(total/12)}</span>
          <button onClick={() => setPage(p => p+1)} disabled={page >= Math.ceil(total/12)} className="btn-outline">Next →</button>
        </div>
      )}

      {/* Profile Modal */}
      {selectedId !== null && (
        <>
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 50, backdropFilter: 'blur(2px)' }}
            onClick={() => setSelectedId(null)} />
          <div style={{
            position: 'fixed', right: 0, top: 0, bottom: 0, width: '100%', maxWidth: 700,
            background: 'var(--color-surface)', zIndex: 51, overflowY: 'auto',
            boxShadow: '-8px 0 40px rgba(0,0,0,0.2)', animation: 'slideIn .3s ease',
          }}>
            <DoctorProfileModal doctorId={selectedId} onClose={() => setSelectedId(null)} />
          </div>
        </>
      )}
    </div>
  );
}
