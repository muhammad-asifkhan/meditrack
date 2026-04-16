import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '../utils/api';
import { AuthState, User } from '../types';

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      isAuthenticated: false,

      setUser: (user: User, token: string) => {
        set({ user, accessToken: token, isAuthenticated: true });
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      },

      login: async (email: string, password: string) => {
        const res = await api.post('/auth/login', { email, password });
        const { accessToken, user } = res.data.data;
        get().setUser(user, accessToken);
      },

      logout: async () => {
        try { await api.post('/auth/logout'); } catch {}
        delete api.defaults.headers.common['Authorization'];
        set({ user: null, accessToken: null, isAuthenticated: false });
      },

      refreshToken: async () => {
        try {
          const res = await api.post('/auth/refresh');
          const { accessToken } = res.data.data;
          const { user } = get();
          if (user) {
            set({ accessToken });
            api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
          }
        } catch {
          get().logout();
        }
      },
    }),
    {
      name: 'meditrack-auth',
      partialize: (state) => ({ user: state.user, accessToken: state.accessToken, isAuthenticated: state.isAuthenticated }),
    }
  )
);

export const useThemeStore = create<{
  isDark: boolean;
  toggle: () => void;
}>()(
  persist(
    (set, get) => ({
      isDark: false,
      toggle: () => {
        const next = !get().isDark;
        set({ isDark: next });
        document.documentElement.classList.toggle('dark', next);
      },
    }),
    { name: 'meditrack-theme' }
  )
);

export const useDateRangeStore = create<{
  from: string;
  to: string;
  setRange: (from: string, to: string) => void;
}>()((set) => {
  const to = new Date().toISOString().split('T')[0];
  const from = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  return { from, to, setRange: (from, to) => set({ from, to }) };
});
