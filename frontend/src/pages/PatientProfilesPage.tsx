import { useState, useMemo } from 'react';
import {
  X, Search, Phone, Mail, MapPin, Heart, AlertTriangle,
  Calendar, DollarSign, Activity, User, Clock, Shield,
  Thermometer, ChevronRight
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import { usePatientProfiles, usePatientProfile } from '../hooks';
import { PageHeader, ErrorBanner } from '../components/ui';
import { ProfileAvatar, Avatar } from '../components/ui/Avatar';
import { formatPKR, formatPercent, DEPT_COLORS } from '../utils/formatters';
import type { PatientProfile } from '../types';

const BLOOD_COLORS: Record<string, string> = {
  'A+': '#E24B4A', 'A-': '#f87171', 'B+': '#7C3AED', 'B-': '#a78bfa',
  'O+': '#0F6E56', 'O-': '#34d399', 'AB+': '#0EA5E9', 'AB-': '#38bdf8',
};

const STATUS_COLORS: Record<string, string> = {
  completed: '#0F6E56', cancelled: '#BA7517', no_show: '#E24B4A',
};

const TOOLTIP_STYLE = {
  contentStyle: {
    background: 'var(--color-surface)', border: '1px solid var(--color-border)',
    borderRadius: '8px', fontSize: '12px', color: 'var(--color-text)',
  },
};

function getAge(dob: string | null): string {
  if (!dob) return '—';
  const age = Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
  return `${age} yrs`;
}

function PatientCard({ patient, onClick }: { patient: PatientProfile; onClick: () => void }) {
  const noShow = parseFloat(patient.no_show_rate) || 0;
  const visits = parseInt(patient.total_visits) || 0;

  return (
    <div className="card cursor-pointer group transition-all duration-200 hover:-translate-y-0.5"
      style={{ overflow: 'hidden' }} onClick={onClick}>
      {/* Returning indicator stripe */}
      <div style={{ height: 3, background: patient.is_returning ? '#0F6E56' : '#0EA5E9' }} />

      <div style={{ padding: '18px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
          <ProfileAvatar name={patient.name} seed={patient.avatar_seed} size={56} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--color-text)', marginBottom: 3 }}
              className="truncate">{patient.name}</div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 5, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{
                fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
                background: patient.is_returning ? 'rgba(15,110,86,.12)' : 'rgba(14,165,233,.12)',
                color: patient.is_returning ? '#0F6E56' : '#0EA5E9',
              }}>
                {patient.is_returning ? '↩ Returning' : '✦ New'}
              </span>
              {patient.gender && (
                <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                  {patient.gender} · {getAge(patient.dob)}
                </span>
              )}
            </div>
            {patient.blood_group && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{
                  background: `${BLOOD_COLORS[patient.blood_group] || '#94A3B8'}20`,
                  color: BLOOD_COLORS[patient.blood_group] || '#94A3B8',
                  fontSize: 11, fontWeight: 700, padding: '1px 7px', borderRadius: 6,
                  border: `1px solid ${BLOOD_COLORS[patient.blood_group] || '#94A3B8'}40`,
                }}>
                  {patient.blood_group}
                </div>
              </div>
            )}
          </div>
          <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
            style={{ color: 'var(--color-text-muted)' }} />
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6, marginBottom: 12 }}>
          {[
            { label: 'Visits', value: visits, icon: Calendar },
            { label: 'Spent', value: formatPKR(parseFloat(patient.total_spent)), icon: DollarSign },
            { label: 'No-Show', value: formatPercent(noShow), icon: Activity },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} style={{ background: 'var(--color-surface-2)', borderRadius: 7, padding: '8px' }}>
              <div style={{ fontSize: 9, color: 'var(--color-text-muted)', marginBottom: 2, display: 'flex', alignItems: 'center', gap: 3, textTransform: 'uppercase', letterSpacing: '.05em', fontWeight: 600 }}>
                <Icon className="w-3 h-3" /> {label}
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text)' }}>{value}</div>
            </div>
          ))}
        </div>

        {/* Allergies / conditions warning */}
        {(patient.allergies || patient.chronic_conditions) && (
          <div style={{ background: 'rgba(186,117,23,.08)', border: '1px solid rgba(186,117,23,.2)', borderRadius: 7, padding: '7px 10px', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#BA7517' }}>
              <AlertTriangle className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">{patient.allergies || patient.chronic_conditions}</span>
            </div>
          </div>
        )}

        {/* Location & phone */}
        <div style={{ fontSize: 11, color: 'var(--color-text-muted)', display: 'flex', flexDirection: 'column', gap: 3 }}>
          {patient.phone && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <Phone className="w-3 h-3" /> {patient.phone}
            </div>
          )}
          {patient.city && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <MapPin className="w-3 h-3" /> {patient.city}
            </div>
          )}
          {patient.last_visit && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <Clock className="w-3 h-3" />
              Last visit: {new Date(patient.last_visit).toLocaleDateString('en-PK')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PatientProfileModal({ patientId, onClose }: { patientId: number; onClose: () => void }) {
  const { data, isLoading, isError } = usePatientProfile(patientId);
  const [activeTab, setActiveTab] = useState<'overview' | 'history' | 'doctors'>('overview');

  if (isLoading) return (
    <div style={{ padding: 40, textAlign: 'center' }}>
      <div style={{ width: 48, height: 48, borderRadius: '50%', border: '3px solid var(--color-border)', borderTopColor: '#0F6E56', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
      <div style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>Loading profile...</div>
    </div>
  );

  if (isError || !data) return (
    <div style={{ padding: 40 }}><ErrorBanner message="Failed to load patient profile" /></div>
  );

  const { profile, visit_history, department_breakdown, doctors_seen, monthly_visits } = data;

  const deptPie = department_breakdown.map((d) => ({
    name: d.department,
    value: parseInt(d.visits),
    color: DEPT_COLORS[d.department] || '#94A3B8',
  }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Hero */}
      <div style={{ background: `linear-gradient(135deg, rgba(15,110,86,.12), rgba(14,165,233,.05))`, borderBottom: '1px solid var(--color-border)', padding: '28px 28px 20px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 20, marginBottom: 20 }}>
          <ProfileAvatar name={profile.name} seed={profile.avatar_seed} size={88} />
          <div style={{ flex: 1 }}>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-text)', marginBottom: 4 }}>{profile.name}</h2>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 }}>
              {profile.gender && <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>{profile.gender} · {getAge(profile.dob)}</span>}
              {profile.blood_group && (
                <span style={{
                  fontSize: 12, fontWeight: 700, padding: '2px 9px', borderRadius: 6,
                  background: `${BLOOD_COLORS[profile.blood_group] || '#94A3B8'}20`,
                  color: BLOOD_COLORS[profile.blood_group] || '#94A3B8',
                  border: `1px solid ${BLOOD_COLORS[profile.blood_group] || '#94A3B8'}40`,
                }}>
                  {profile.blood_group}
                </span>
              )}
              <span style={{
                fontSize: 12, fontWeight: 600, padding: '2px 9px', borderRadius: 20,
                background: profile.is_returning ? 'rgba(15,110,86,.12)' : 'rgba(14,165,233,.12)',
                color: profile.is_returning ? '#0F6E56' : '#0EA5E9',
              }}>
                {profile.is_returning ? '↩ Returning Patient' : '✦ New Patient'}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--color-text-muted)', flexWrap: 'wrap' }}>
              {profile.phone && <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Phone className="w-3 h-3" />{profile.phone}</span>}
              {profile.email && <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Mail className="w-3 h-3" />{profile.email}</span>}
              {profile.city && <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><MapPin className="w-3 h-3" />{profile.city}</span>}
            </div>
          </div>
          <button onClick={onClose}
            style={{ padding: 8, borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-surface)', cursor: 'pointer', color: 'var(--color-text-muted)', flexShrink: 0 }}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
          {[
            { label: 'Total Visits', value: parseInt(profile.total_visits).toLocaleString(), color: '#0F6E56' },
            { label: 'Total Spent', value: formatPKR(parseFloat(profile.total_spent)), color: '#0EA5E9' },
            { label: 'No-Show Rate', value: formatPercent(parseFloat(profile.no_show_rate) || 0), color: '#E24B4A' },
            { label: 'Completion Rate', value: formatPercent(parseFloat(profile.completion_rate) || 0), color: '#22C55E' },
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
        {(['overview', 'history', 'doctors'] as const).map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            style={{
              padding: '8px 18px', borderRadius: '8px 8px 0 0', border: 'none', cursor: 'pointer',
              fontFamily: 'inherit', fontSize: 13, fontWeight: 500,
              background: activeTab === tab ? 'var(--color-surface)' : 'transparent',
              color: activeTab === tab ? 'var(--color-text)' : 'var(--color-text-muted)',
              borderBottom: activeTab === tab ? '2px solid #0F6E56' : '2px solid transparent',
              marginBottom: -1,
            }}>
            {tab === 'overview' ? 'Overview' : tab === 'history' ? 'Visit History' : 'Doctors Seen'}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 28px' }}>

        {activeTab === 'overview' && (
          <div>
            {/* Medical info cards */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
              {profile.allergies && (
                <div style={{ background: 'rgba(226,75,74,.06)', border: '1px solid rgba(226,75,74,.2)', borderRadius: 10, padding: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
                    <AlertTriangle className="w-4 h-4" style={{ color: '#E24B4A' }} />
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#E24B4A', textTransform: 'uppercase', letterSpacing: '.05em' }}>Allergies</span>
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--color-text)' }}>{profile.allergies}</div>
                </div>
              )}
              {profile.chronic_conditions && (
                <div style={{ background: 'rgba(186,117,23,.06)', border: '1px solid rgba(186,117,23,.2)', borderRadius: 10, padding: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
                    <Thermometer className="w-4 h-4" style={{ color: '#BA7517' }} />
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#BA7517', textTransform: 'uppercase', letterSpacing: '.05em' }}>Conditions</span>
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--color-text)' }}>{profile.chronic_conditions}</div>
                </div>
              )}
              {profile.emergency_contact && (
                <div style={{ background: 'var(--color-surface-2)', borderRadius: 10, padding: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
                    <Shield className="w-4 h-4" style={{ color: '#0F6E56' }} />
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '.05em' }}>Emergency Contact</span>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>{profile.emergency_contact}</div>
                  <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{profile.emergency_phone}</div>
                </div>
              )}
              {profile.address && (
                <div style={{ background: 'var(--color-surface-2)', borderRadius: 10, padding: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
                    <MapPin className="w-4 h-4" style={{ color: '#7C3AED' }} />
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '.05em' }}>Address</span>
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--color-text)' }}>{profile.address}</div>
                </div>
              )}
            </div>

            {/* Visit timeline + dept chart */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12, marginBottom: 16 }}>
              <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10, padding: 16 }}>
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4, color: 'var(--color-text)' }}>Monthly Visits (Last 12 Months)</div>
                <div style={{ height: 160 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthly_visits}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                      <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }} tickFormatter={(v) => v.slice(5)} />
                      <YAxis tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }} allowDecimals={false} />
                      <Tooltip contentStyle={TOOLTIP_STYLE.contentStyle} />
                      <Bar dataKey="visits" fill="#0F6E56" radius={[3, 3, 0, 0]} name="Visits" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10, padding: 16 }}>
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4, color: 'var(--color-text)' }}>By Department</div>
                <div style={{ height: 130 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={deptPie} cx="50%" cy="50%" outerRadius={52} dataKey="value" paddingAngle={3}>
                        {deptPie.map((e) => <Cell key={e.name} fill={e.color} />)}
                      </Pie>
                      <Tooltip contentStyle={TOOLTIP_STYLE.contentStyle} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {deptPie.map((d) => (
                    <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--color-text-muted)' }}>
                      <div style={{ width: 7, height: 7, borderRadius: '50%', background: d.color, flexShrink: 0 }} />
                      <span className="truncate">{d.name} ({d.value})</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Timeline summary */}
            {profile.first_visit && profile.last_visit && (
              <div style={{ background: 'var(--color-surface-2)', borderRadius: 10, padding: 14, display: 'flex', justifyContent: 'space-around', textAlign: 'center' }}>
                {[
                  { label: 'First Visit', value: new Date(profile.first_visit).toLocaleDateString('en-PK', { dateStyle: 'medium' }) },
                  { label: 'Last Visit', value: new Date(profile.last_visit).toLocaleDateString('en-PK', { dateStyle: 'medium' }) },
                  { label: 'Patient Since', value: `${Math.floor((Date.now() - new Date(profile.first_visit).getTime()) / (365.25*24*60*60*1000))} years` },
                ].map((s) => (
                  <div key={s.label}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text)' }}>{s.value}</div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 3 }}>{s.label}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <div>
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 14 }}>Complete appointment history (most recent first)</div>
            {visit_history.map((visit) => (
              <div key={visit.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '13px 0', borderBottom: '1px solid var(--color-border)' }}>
                <div style={{
                  width: 8, height: 8, borderRadius: '50%', marginTop: 6, flexShrink: 0,
                  background: STATUS_COLORS[visit.status] || '#94A3B8',
                  boxShadow: `0 0 0 3px ${STATUS_COLORS[visit.status] || '#94A3B8'}20`,
                }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--color-text)', marginBottom: 3 }}>
                    {visit.doctor_name} <span style={{ fontWeight: 400, color: 'var(--color-text-muted)' }}>({visit.seniority_level})</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                    {visit.department} · {visit.clinic}, {visit.city}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>
                    {new Date(visit.scheduled_at).toLocaleString('en-PK', { dateStyle: 'medium', timeStyle: 'short' })}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#0F6E56' }}>{formatPKR(parseFloat(visit.consultation_fee))}</div>
                  <span style={{
                    fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, display: 'inline-block', marginTop: 4,
                    background: `${STATUS_COLORS[visit.status] || '#94A3B8'}15`,
                    color: STATUS_COLORS[visit.status] || '#94A3B8',
                  }}>
                    {visit.status.replace('_', ' ')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'doctors' && (
          <div>
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 14 }}>Doctors this patient has visited</div>
            {doctors_seen.map((doc, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 0', borderBottom: '1px solid var(--color-border)' }}>
                <Avatar name={doc.name} size={40} isDoctor />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--color-text)' }}>{doc.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{doc.department} · {doc.seniority_level}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text)' }}>{doc.visits} visits</div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                    Last: {new Date(doc.last_seen).toLocaleDateString('en-PK')}
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

export default function PatientProfilesPage() {
  const [search, setSearch] = useState('');
  const [returningFilter, setReturningFilter] = useState('');
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const filters = useMemo(() => {
    const f: Record<string, string> = { page: String(page), limit: '15' };
    if (search) f.search = search;
    if (returningFilter) f.is_returning = returningFilter;
    return f;
  }, [search, returningFilter, page]);

  const { data, isLoading, isError, refetch } = usePatientProfiles(filters);
  const patients = data?.data || [];
  const total = data?.meta?.total || 0;

  return (
    <div className="animate-fade-up">
      <PageHeader title="Patient Profiles" subtitle={`${total} patients in the MediTrack network`} />

      {/* Summary bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total Patients', value: total.toLocaleString(), color: '#0F6E56', icon: User },
          { label: 'Returning Patients', value: data ? Math.round(total * 0.6).toLocaleString() : '—', color: '#7C3AED', icon: Heart },
          { label: 'Avg Visits / Patient', value: data?.data?.length ? (data.data.reduce((s,p) => s + parseInt(p.total_visits), 0) / data.data.length).toFixed(1) : '—', color: '#0EA5E9', icon: Activity },
        ].map(({ label, value, color, icon: Icon }) => (
          <div key={label} className="card" style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: `${color}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon className="w-5 h-5" style={{ color }} />
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-text)' }}>{value}</div>
              <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="card" style={{ padding: '12px 16px', marginBottom: 18 }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: '1 1 240px', minWidth: 200 }}>
            <Search className="w-4 h-4" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
            <input type="text" placeholder="Search by name, phone, email..." value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="form-control" style={{ paddingLeft: 34, width: '100%' }} />
          </div>
          <select value={returningFilter} onChange={(e) => { setReturningFilter(e.target.value); setPage(1); }}
            className="form-control" style={{ minWidth: 160 }}>
            <option value="">All Patients</option>
            <option value="true">Returning Only</option>
            <option value="false">New Only</option>
          </select>
          {(search || returningFilter) && (
            <button onClick={() => { setSearch(''); setReturningFilter(''); setPage(1); }} className="btn-outline" style={{ fontSize: 12 }}>Clear</button>
          )}
          <div style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--color-text-muted)' }}>{total} patients</div>
        </div>
      </div>

      {isError && <ErrorBanner message="Failed to load patient profiles" onRetry={refetch} />}

      {isLoading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(270px,1fr))', gap: 14 }}>
          {Array.from({ length: 15 }).map((_, i) => (
            <div key={i} className="card" style={{ padding: 18 }}>
              <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
                <div className="skeleton" style={{ width: 56, height: 56, borderRadius: '50%', flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div className="skeleton" style={{ height: 14, marginBottom: 8 }} />
                  <div className="skeleton" style={{ height: 10, width: '60%' }} />
                </div>
              </div>
              <div className="skeleton" style={{ height: 60 }} />
            </div>
          ))}
        </div>
      ) : patients.length === 0 ? (
        <div className="card" style={{ padding: 60, textAlign: 'center' }}>
          <User className="w-12 h-12 mx-auto mb-4" style={{ color: 'var(--color-text-muted)' }} />
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--color-text)', marginBottom: 4 }}>No patients found</div>
          <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Try adjusting your search</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(270px,1fr))', gap: 14 }}>
          {patients.map((pat) => (
            <PatientCard key={pat.id} patient={pat} onClick={() => setSelectedId(pat.id)} />
          ))}
        </div>
      )}

      {total > 15 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 24 }}>
          <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page === 1} className="btn-outline">← Prev</button>
          <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Page {page} of {Math.ceil(total/15)}</span>
          <button onClick={() => setPage(p => p+1)} disabled={page >= Math.ceil(total/15)} className="btn-outline">Next →</button>
        </div>
      )}

      {/* Profile modal */}
      {selectedId !== null && (
        <>
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 50, backdropFilter: 'blur(2px)' }}
            onClick={() => setSelectedId(null)} />
          <div style={{
            position: 'fixed', right: 0, top: 0, bottom: 0, width: '100%', maxWidth: 680,
            background: 'var(--color-surface)', zIndex: 51, overflowY: 'auto',
            boxShadow: '-8px 0 40px rgba(0,0,0,0.2)', animation: 'slideIn .3s ease',
          }}>
            <PatientProfileModal patientId={selectedId} onClose={() => setSelectedId(null)} />
          </div>
        </>
      )}
    </div>
  );
}
