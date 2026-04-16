import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore, useThemeStore } from './store';
import Layout from './components/layout/Layout';
import LoginPage from './pages/LoginPage';
import OverviewPage from './pages/OverviewPage';
import DepartmentsPage from './pages/DepartmentsPage';
import DoctorsPage from './pages/DoctorsPage';
import RevenuePage from './pages/RevenuePage';
import TimeAnalysisPage from './pages/TimeAnalysisPage';
import PredictorPage from './pages/PredictorPage';
import SettingsPage from './pages/SettingsPage';
import DoctorProfilesPage from './pages/DoctorProfilesPage';
import PatientProfilesPage from './pages/PatientProfilesPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

export default function App() {
  const { isDark } = useThemeStore();

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
  }, [isDark]);

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={
            <RequireAuth>
              <Layout />
            </RequireAuth>
          }>
            <Route index element={<Navigate to="/overview" replace />} />
            <Route path="overview" element={<OverviewPage />} />
            <Route path="departments" element={<DepartmentsPage />} />
            <Route path="doctors" element={<DoctorsPage />} />
            <Route path="revenue" element={<RevenuePage />} />
            <Route path="time-analysis" element={<TimeAnalysisPage />} />
            <Route path="predictor" element={<PredictorPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="doctor-profiles" element={<DoctorProfilesPage />} />
            <Route path="patient-profiles" element={<PatientProfilesPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
