import { useQuery } from '@tanstack/react-query';
import api from '../utils/api';
import { useDateRangeStore } from '../store';
import type {
  KpiSummary, DepartmentStat, DoctorStat, RevenueData,
  TimeseriesData, ModelMetrics, ReferenceData
} from '../types';

function useDateParams() {
  const { from, to } = useDateRangeStore();
  return { date_from: from, date_to: to };
}

export function useKpiSummary() {
  const params = useDateParams();
  return useQuery<KpiSummary>({
    queryKey: ['kpi-summary', params],
    queryFn: async () => {
      const res = await api.get('/analytics/kpi-summary', { params });
      return res.data.data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useDepartmentStats() {
  const params = useDateParams();
  return useQuery<DepartmentStat[]>({
    queryKey: ['departments', params],
    queryFn: async () => {
      const res = await api.get('/analytics/departments', { params });
      return res.data.data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useDoctorStats(filters?: Record<string, string>) {
  const params = { ...useDateParams(), ...filters };
  return useQuery<DoctorStat[]>({
    queryKey: ['doctors', params],
    queryFn: async () => {
      const res = await api.get('/analytics/doctors', { params });
      return res.data.data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useRevenueData() {
  const params = useDateParams();
  return useQuery<RevenueData>({
    queryKey: ['revenue', params],
    queryFn: async () => {
      const res = await api.get('/analytics/revenue', { params });
      return res.data.data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useTimeseriesData() {
  const params = useDateParams();
  return useQuery<TimeseriesData>({
    queryKey: ['timeseries', params],
    queryFn: async () => {
      const res = await api.get('/analytics/timeseries', { params });
      return res.data.data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useModelMetrics() {
  return useQuery<ModelMetrics>({
    queryKey: ['model-metrics'],
    queryFn: async () => {
      const res = await api.get('/predict/model-metrics');
      return res.data.data;
    },
    staleTime: 60 * 60 * 1000,
  });
}

export function useReferenceData() {
  return useQuery<ReferenceData>({
    queryKey: ['reference'],
    queryFn: async () => {
      const res = await api.get('/admin/reference');
      return res.data.data;
    },
    staleTime: 30 * 60 * 1000,
  });
}

// ─── Profile Hooks ──────────────────────────────────────────────────────────
import type { DoctorProfile, DoctorProfileFull, PatientProfile, PatientProfileFull } from '../types';

export function useDoctorProfiles(filters?: Record<string, string>) {
  return useQuery<{ data: DoctorProfile[]; meta: { total: number } }>({
    queryKey: ['doctor-profiles', filters],
    queryFn: async () => {
      const res = await api.get('/profiles/doctors', { params: filters });
      return res.data;
    },
    staleTime: 3 * 60 * 1000,
  });
}

export function useDoctorProfile(id: number | null) {
  return useQuery<DoctorProfileFull>({
    queryKey: ['doctor-profile', id],
    queryFn: async () => {
      const res = await api.get(`/profiles/doctors/${id}`);
      return res.data.data;
    },
    enabled: !!id,
    staleTime: 3 * 60 * 1000,
  });
}

export function usePatientProfiles(filters?: Record<string, string>) {
  return useQuery<{ data: PatientProfile[]; meta: { total: number } }>({
    queryKey: ['patient-profiles', filters],
    queryFn: async () => {
      const res = await api.get('/profiles/patients', { params: filters });
      return res.data;
    },
    staleTime: 3 * 60 * 1000,
  });
}

export function usePatientProfile(id: number | null) {
  return useQuery<PatientProfileFull>({
    queryKey: ['patient-profile', id],
    queryFn: async () => {
      const res = await api.get(`/profiles/patients/${id}`);
      return res.data.data;
    },
    enabled: !!id,
    staleTime: 3 * 60 * 1000,
  });
}
