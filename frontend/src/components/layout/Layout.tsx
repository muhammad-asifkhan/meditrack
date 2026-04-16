import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import {
  LayoutDashboard, Building2, Users, DollarSign, Clock,
  Brain, Settings, Menu, X, Sun, Moon, LogOut, ChevronRight,
  Activity, Stethoscope, UserCircle
} from 'lucide-react';
import { useAuthStore, useThemeStore, useDateRangeStore } from '../../store';
import clsx from 'clsx';

const NAV_ITEMS = [
  { to: '/overview',      icon: LayoutDashboard, label: 'Overview' },
  { to: '/departments',      icon: Building2,       label: 'Departments' },
  { to: '/doctors',          icon: Users,           label: 'Doctors' },
  { to: '/doctor-profiles',  icon: Stethoscope,     label: 'Doctor Profiles' },
  { to: '/patient-profiles', icon: UserCircle,      label: 'Patient Profiles' },
  { to: '/revenue',          icon: DollarSign,      label: 'Revenue' },
  { to: '/time-analysis', icon: Clock,           label: 'Time Analysis' },
  { to: '/predictor',     icon: Brain,           label: 'No-Show Predictor' },
  { to: '/settings',      icon: Settings,        label: 'Settings' },
];

const ROLE_LABELS = {
  superadmin: 'Super Admin',
  city_manager: 'City Manager',
  clinic_staff: 'Clinic Staff',
};

const ROLE_COLORS = {
  superadmin: 'bg-purple-500/20 text-purple-300',
  city_manager: 'bg-blue-500/20 text-blue-300',
  clinic_staff: 'bg-green-500/20 text-green-300',
};

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, logout } = useAuthStore();
  const { isDark, toggle } = useThemeStore();
  const { from, to, setRange } = useDateRangeStore();

  const handleLogout = async () => {
    await logout();
    window.location.href = '/login';
  };

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--color-bg)' }}>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={clsx(
        'fixed md:relative inset-y-0 left-0 z-50 flex flex-col transition-all duration-300',
        sidebarOpen ? 'w-64' : 'w-16',
        mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
      )} style={{ background: 'var(--color-sidebar)' }}>
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-5 border-b border-white/5">
          <div className="w-9 h-9 rounded-xl bg-primary-500 flex items-center justify-center flex-shrink-0">
            <Activity className="w-5 h-5 text-white" />
          </div>
          {sidebarOpen && (
            <div className="animate-fade-up">
              <div className="text-white font-bold text-lg leading-none">MediTrack</div>
              <div className="text-white/40 text-xs mt-0.5">Analytics Platform</div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 overflow-y-auto">
          <div className={clsx('px-3 mb-2', !sidebarOpen && 'px-2')}>
            {sidebarOpen && <p className="text-white/30 text-xs font-semibold uppercase tracking-wider px-2 mb-2">Navigation</p>}
            {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) => clsx(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 transition-all duration-150 group',
                  isActive
                    ? 'bg-primary-500 text-white'
                    : 'text-white/50 hover:text-white hover:bg-white/5'
                )}
                title={!sidebarOpen ? label : undefined}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {sidebarOpen && <span className="text-sm font-medium">{label}</span>}
                {sidebarOpen && <ChevronRight className="w-3.5 h-3.5 ml-auto opacity-0 group-hover:opacity-50 transition-opacity" />}
              </NavLink>
            ))}
          </div>
        </nav>

        {/* User area */}
        <div className="border-t border-white/5 p-3">
          {sidebarOpen && user && (
            <div className="px-2 py-2 mb-2">
              <div className="text-white text-sm font-medium truncate">{user.email}</div>
              <span className={clsx('text-xs px-2 py-0.5 rounded-full', ROLE_COLORS[user.role])}>
                {ROLE_LABELS[user.role]}
              </span>
            </div>
          )}
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-white/50 hover:text-white hover:bg-white/5 transition-all text-sm"
          >
            <LogOut className="w-4 h-4 flex-shrink-0" />
            {sidebarOpen && 'Sign Out'}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar */}
        <header className="flex items-center gap-4 px-6 py-4 border-b" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setSidebarOpen(!sidebarOpen); }}
              className="hidden md:flex p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
            >
              <Menu className="w-5 h-5" style={{ color: 'var(--color-text-muted)' }} />
            </button>
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="flex md:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>

          <div className="flex-1" />

          {/* Date Range */}
          <div className="hidden sm:flex items-center gap-2 text-sm" style={{ color: 'var(--color-text-muted)' }}>
            <input
              type="date"
              value={from}
              onChange={(e) => setRange(e.target.value, to)}
              className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              style={{ background: 'var(--color-surface-2)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
            />
            <span>→</span>
            <input
              type="date"
              value={to}
              onChange={(e) => setRange(from, e.target.value)}
              className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              style={{ background: 'var(--color-surface-2)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
            />
          </div>

          {/* Dark mode toggle */}
          <button
            onClick={toggle}
            className="p-2.5 rounded-lg border transition-colors hover:bg-gray-100 dark:hover:bg-white/5"
            style={{ borderColor: 'var(--color-border)' }}
          >
            {isDark ? <Sun className="w-4 h-4 text-yellow-400" /> : <Moon className="w-4 h-4" style={{ color: 'var(--color-text-muted)' }} />}
          </button>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
