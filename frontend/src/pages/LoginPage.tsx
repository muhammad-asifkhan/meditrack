import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Activity, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useAuthStore } from '../store';

const schema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});
type LoginForm = z.infer<typeof schema>;

const DEMO_USERS = [
  { label: 'Super Admin', email: 'admin@meditrack.pk', password: 'Admin@1234' },
  { label: 'City Manager (Karachi)', email: 'karachi@meditrack.pk', password: 'Manager@1234' },
  { label: 'Clinic Staff', email: 'staff@meditrack.pk', password: 'Staff@1234' },
];

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuthStore();
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');

  const { register, handleSubmit, setValue, formState: { errors, isSubmitting } } = useForm<LoginForm>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: LoginForm) => {
    setError('');
    try {
      await login(data.email, data.password);
      navigate('/overview');
    } catch {
      setError('Invalid email or password. Please try again.');
    }
  };

  const fillDemo = (email: string, password: string) => {
    setValue('email', email);
    setValue('password', password);
  };

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--color-bg)' }}>
      {/* Left panel */}
      <div className="hidden lg:flex flex-col justify-between w-1/2 p-12 text-white"
        style={{ background: 'linear-gradient(135deg, #0A1628 0%, #0F6E56 100%)' }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
            <Activity className="w-6 h-6" />
          </div>
          <span className="text-xl font-bold">MediTrack</span>
        </div>
        <div>
          <h1 className="text-4xl font-bold mb-4 leading-tight">
            Healthcare Analytics<br />That Drive Results
          </h1>
          <p className="text-white/60 text-lg mb-8">
            Real-time insights across 5 cities, 15+ clinics, and thousands of appointments.
          </p>
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: 'Total Appointments', value: '2,500+' },
              { label: 'Cities Covered', value: '5' },
              { label: 'Avg No-Show Rate', value: '~20%' },
              { label: 'ML Prediction AUC', value: '0.82' },
            ].map((stat) => (
              <div key={stat.label} className="bg-white/5 rounded-xl p-4">
                <div className="text-2xl font-bold">{stat.value}</div>
                <div className="text-white/50 text-sm">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
        <p className="text-white/30 text-sm">© 2024 MediTrack. All rights reserved.</p>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <Activity className="w-8 h-8" style={{ color: '#0F6E56' }} />
            <span className="text-xl font-bold">MediTrack</span>
          </div>

          <h2 className="text-2xl font-bold mb-1" style={{ color: 'var(--color-text)' }}>Welcome back</h2>
          <p className="text-sm mb-8" style={{ color: 'var(--color-text-muted)' }}>Sign in to your analytics dashboard</p>

          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-text)' }}>Email</label>
              <input
                {...register('email')}
                type="email"
                placeholder="you@meditrack.pk"
                className="w-full px-4 py-3 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                style={{ background: 'var(--color-surface-2)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
              />
              {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-text)' }}>Password</label>
              <div className="relative">
                <input
                  {...register('password')}
                  type={showPw ? 'text' : 'password'}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all pr-11"
                  style={{ background: 'var(--color-surface-2)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
                />
                <button type="button" onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1"
                  style={{ color: 'var(--color-text-muted)' }}>
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 rounded-xl text-white font-semibold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-70"
              style={{ background: 'linear-gradient(135deg, #0F6E56, #1D9E75)' }}
            >
              {isSubmitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Signing in...</> : 'Sign In'}
            </button>
          </form>

          {/* Demo users */}
          <div className="mt-8">
            <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--color-text-muted)' }}>
              Demo Accounts (click to fill)
            </p>
            <div className="space-y-2">
              {DEMO_USERS.map((u) => (
                <button
                  key={u.email}
                  onClick={() => fillDemo(u.email, u.password)}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-xl border text-left transition-all hover:border-primary-400"
                  style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
                >
                  <div>
                    <div className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>{u.label}</div>
                    <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{u.email}</div>
                  </div>
                  <span className="text-xs" style={{ color: '#0F6E56' }}>Fill →</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
