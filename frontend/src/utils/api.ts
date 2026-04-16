import axios from 'axios';

const api = axios.create({
  baseURL: (import.meta.env.VITE_API_URL || 'http://localhost:3001') + '/api/v1',
  withCredentials: true,
  timeout: 30000,
});

// Attach stored token on startup
const stored = localStorage.getItem('meditrack-auth');
if (stored) {
  try {
    const { state } = JSON.parse(stored);
    if (state?.accessToken) {
      api.defaults.headers.common['Authorization'] = `Bearer ${state.accessToken}`;
    }
  } catch {}
}

// Response interceptor for token refresh
let refreshing = false;
let queue: Array<(token: string) => void> = [];

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config;
    if (err.response?.status === 401 && !original._retry) {
      if (refreshing) {
        return new Promise((resolve) => {
          queue.push((token) => {
            original.headers['Authorization'] = `Bearer ${token}`;
            resolve(api(original));
          });
        });
      }
      original._retry = true;
      refreshing = true;
      try {
        const res = await api.post('/auth/refresh');
        const newToken = res.data.data.accessToken;
        api.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
        queue.forEach((cb) => cb(newToken));
        queue = [];
        return api(original);
      } catch {
        window.location.href = '/login';
      } finally {
        refreshing = false;
      }
    }
    return Promise.reject(err);
  }
);

export default api;
