import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Shield, UserPlus, Loader2, CheckCircle } from 'lucide-react';
import { useAuthStore } from '../store';
import { PageHeader, ErrorBanner } from '../components/ui';
import api from '../utils/api';

const userSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Min 8 characters'),
  role: z.enum(['superadmin', 'city_manager', 'clinic_staff']),
  city_id: z.string().optional(),
  clinic_id: z.string().optional(),
});
type UserForm = z.infer<typeof userSchema>;

interface AuditEntry {
  id: number;
  event_type: string;
  ip_address: string;
  created_at: string;
  user_email: string;
  user_role: string;
  details: Record<string, unknown>;
}

interface UserEntry {
  id: number;
  email: string;
  role: string;
  is_active: boolean;
  created_at: string;
  city_name: string | null;
  clinic_name: string | null;
}

const EVENT_COLORS: Record<string, string> = {
  LOGIN_SUCCESS: 'text-green-500',
  LOGIN_FAILED: 'text-red-500',
  LOGOUT: 'text-blue-500',
  EXPORT: 'text-purple-500',
};

export default function SettingsPage() {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<'users' | 'audit'>('users');
  const [createSuccess, setCreateSuccess] = useState(false);

  const users = useQuery<UserEntry[]>({
    queryKey: ['users'],
    queryFn: async () => {
      const res = await api.get('/admin/users');
      return res.data.data;
    },
    enabled: user?.role === 'superadmin',
  });

  const audit = useQuery<{ data: AuditEntry[]; meta: { total: number } }>({
    queryKey: ['audit-log'],
    queryFn: async () => {
      const res = await api.get('/admin/audit-log?limit=50');
      return res.data;
    },
    enabled: user?.role === 'superadmin' && activeTab === 'audit',
  });

  const createUser = useMutation({
    mutationFn: (data: UserForm) => api.post('/admin/users', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      reset();
      setCreateSuccess(true);
      setTimeout(() => setCreateSuccess(false), 3000);
    },
  });

  const toggleActive = useMutation({
    mutationFn: ({ id, is_active }: { id: number; is_active: boolean }) =>
      api.patch(`/admin/users/${id}`, { is_active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<UserForm>({
    resolver: zodResolver(userSchema),
  });

  if (user?.role !== 'superadmin') {
    return (
      <div className="animate-fade-up">
        <PageHeader title="Settings" />
        <div className="card p-12 text-center">
          <Shield className="w-12 h-12 mx-auto mb-4" style={{ color: 'var(--color-text-muted)' }} />
          <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--color-text)' }}>Access Restricted</h3>
          <p style={{ color: 'var(--color-text-muted)' }}>Settings are only available to Super Admins.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-up">
      <PageHeader title="Settings" subtitle="User management and audit log (Super Admin only)" />

      {/* Tabs */}
      <div className="flex gap-1 mb-6 p-1 rounded-xl w-fit" style={{ background: 'var(--color-surface-2)' }}>
        {(['users', 'audit'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="px-5 py-2 rounded-lg text-sm font-medium capitalize transition-all"
            style={{
              background: activeTab === tab ? 'var(--color-surface)' : 'transparent',
              color: activeTab === tab ? 'var(--color-text)' : 'var(--color-text-muted)',
              boxShadow: activeTab === tab ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            }}
          >
            {tab === 'users' ? 'User Management' : 'Audit Log'}
          </button>
        ))}
      </div>

      {activeTab === 'users' && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Create user form */}
          <div className="card p-6">
            <div className="flex items-center gap-2 mb-5">
              <UserPlus className="w-5 h-5" style={{ color: '#0F6E56' }} />
              <h3 className="font-semibold" style={{ color: 'var(--color-text)' }}>Create User</h3>
            </div>

            {createSuccess && (
              <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg flex items-center gap-2 text-green-600 text-sm">
                <CheckCircle className="w-4 h-4" /> User created successfully
              </div>
            )}

            <form onSubmit={handleSubmit((d) => createUser.mutate(d))} className="space-y-3">
              {[
                { name: 'email' as const, label: 'Email', type: 'email', placeholder: 'user@meditrack.pk' },
                { name: 'password' as const, label: 'Password', type: 'password', placeholder: '••••••••' },
              ].map((f) => (
                <div key={f.name}>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text)' }}>{f.label}</label>
                  <input
                    {...register(f.name)}
                    type={f.type}
                    placeholder={f.placeholder}
                    className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    style={{ background: 'var(--color-surface-2)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
                  />
                  {errors[f.name] && <p className="text-red-500 text-xs mt-1">{errors[f.name]?.message}</p>}
                </div>
              ))}

              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text)' }}>Role</label>
                <select {...register('role')}
                  className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  style={{ background: 'var(--color-surface-2)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}>
                  <option value="clinic_staff">Clinic Staff</option>
                  <option value="city_manager">City Manager</option>
                  <option value="superadmin">Super Admin</option>
                </select>
              </div>

              {createUser.isError && <ErrorBanner message="Failed to create user" />}

              <button
                type="submit"
                disabled={isSubmitting || createUser.isPending}
                className="w-full py-2.5 rounded-lg text-white font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-60"
                style={{ background: '#0F6E56' }}
              >
                {createUser.isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating...</> : 'Create User'}
              </button>
            </form>
          </div>

          {/* Users table */}
          <div className="xl:col-span-2 card overflow-hidden">
            <div className="px-5 py-4 border-b font-semibold" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}>
              All Users ({users.data?.length || 0})
            </div>
            {users.isLoading ? (
              <div className="p-6 space-y-3">
                {[1, 2, 3].map((i) => <div key={i} className="skeleton h-12" />)}
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: 'var(--color-surface-2)', borderBottom: '1px solid var(--color-border)' }}>
                    {['Email', 'Role', 'Scope', 'Status', 'Actions'].map((h) => (
                      <th key={h} className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(users.data || []).map((u) => (
                    <tr key={u.id} className="border-t" style={{ borderColor: 'var(--color-border)' }}>
                      <td className="px-5 py-3.5" style={{ color: 'var(--color-text)' }}>{u.email}</td>
                      <td className="px-5 py-3.5">
                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400">
                          {u.role}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                        {u.city_name || u.clinic_name || 'All'}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${u.is_active ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-500'}`}>
                          {u.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <button
                          onClick={() => toggleActive.mutate({ id: u.id, is_active: !u.is_active })}
                          className="text-xs px-3 py-1.5 rounded-lg border transition-colors hover:bg-gray-50 dark:hover:bg-white/5"
                          style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}
                        >
                          {u.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {activeTab === 'audit' && (
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
            <h3 className="font-semibold" style={{ color: 'var(--color-text)' }}>
              Audit Log ({audit.data?.meta.total || 0} total events)
            </h3>
          </div>
          {audit.isLoading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3, 4, 5].map((i) => <div key={i} className="skeleton h-10" />)}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: 'var(--color-surface-2)', borderBottom: '1px solid var(--color-border)' }}>
                  {['Timestamp', 'User', 'Event', 'IP Address', 'Details'].map((h) => (
                    <th key={h} className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(audit.data?.data || []).map((entry) => (
                  <tr key={entry.id} className="border-t" style={{ borderColor: 'var(--color-border)' }}>
                    <td className="px-5 py-3 font-mono text-xs" style={{ color: 'var(--color-text-muted)' }}>
                      {new Date(entry.created_at).toLocaleString()}
                    </td>
                    <td className="px-5 py-3 text-xs" style={{ color: 'var(--color-text)' }}>
                      {entry.user_email || 'Anonymous'}
                    </td>
                    <td className={`px-5 py-3 text-xs font-semibold ${EVENT_COLORS[entry.event_type] || 'text-gray-500'}`}>
                      {entry.event_type}
                    </td>
                    <td className="px-5 py-3 text-xs font-mono" style={{ color: 'var(--color-text-muted)' }}>
                      {entry.ip_address || '—'}
                    </td>
                    <td className="px-5 py-3 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                      {entry.details ? JSON.stringify(entry.details).slice(0, 60) + '...' : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
