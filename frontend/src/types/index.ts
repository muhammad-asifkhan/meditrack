export interface User {
  id: number;
  email: string;
  role: 'superadmin' | 'city_manager' | 'clinic_staff';
  cityId: number | null;
  clinicId: number | null;
}

export interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<void>;
  setUser: (user: User, token: string) => void;
}

export interface KpiSummary {
  total_revenue: string;
  total_appointments: string;
  no_show_rate: string;
  cancellation_rate: string;
  avg_fee: string;
  top_department: string;
  top_city: string;
}

export interface DepartmentStat {
  id: number;
  department: string;
  appointment_count: string;
  revenue: string;
  no_show_rate: string;
  cancellation_rate: string;
  avg_fee: string;
  completion_rate: string;
}

export interface DoctorStat {
  id: number;
  doctor: string;
  seniority: 'junior' | 'senior' | 'consultant';
  department: string;
  clinic: string;
  city: string;
  appointment_count: string;
  revenue: string;
  no_show_rate: string;
  completion_rate: string;
  avg_fee: string;
}

export interface RevenueData {
  by_city: { city: string; city_id: number; revenue: string; appointment_count: string }[];
  by_clinic: { id: number; clinic: string; city: string; revenue: string; appointment_count: string }[];
  by_department: { department: string; id: number; revenue: string; appointment_count: string }[];
  by_month: { month: string; department: string; revenue: string; appointment_count: string }[];
}

export interface TimeseriesData {
  monthly_volume: { month: string; appointment_count: string; revenue: string }[];
  daily_of_week_volume: { day_of_week: number; appointment_count: string }[];
  hourly_distribution: { day_of_week: number; hour: number; appointment_count: string }[];
}

export interface PredictionResult {
  probability: number;
  risk_level: 'low' | 'medium' | 'high';
  recommended_action: string;
}

export interface ModelMetrics {
  model_version: string;
  algorithm: string;
  accuracy: string;
  precision_score: string;
  recall_score: string;
  f1_score: string;
  auc_roc: string;
  trained_at: string;
  training_rows: number;
}

export interface ReferenceData {
  cities: { id: number; name: string }[];
  clinics: { id: number; city_id: number; name: string }[];
  departments: { id: number; name: string }[];
  doctors: { id: number; clinic_id: number; department_id: number; name: string; seniority_level: string }[];
  patients: { id: number; name: string; phone: string }[];
}

export interface DateRange {
  from: string;
  to: string;
}

// ─── Profile Types ──────────────────────────────────────────────────────────
export interface DoctorProfile {
  id: number;
  name: string;
  seniority_level: 'junior' | 'senior' | 'consultant';
  bio: string | null;
  phone: string | null;
  email: string | null;
  avatar_seed: string | null;
  years_experience: number;
  qualification: string | null;
  available_days: string | null;
  consultation_start: string | null;
  consultation_end: string | null;
  rating: number;
  languages: string | null;
  specializations: string | null;
  department: string;
  department_id: number;
  clinic: string;
  clinic_id: number;
  city: string;
  city_id: number;
  total_appointments: string;
  total_revenue: string;
  no_show_rate: string;
  completion_rate: string;
  avg_fee: string;
  unique_patients: string;
}

export interface DoctorProfileFull {
  profile: DoctorProfile;
  monthly_trend: { month: string; appointments: string; revenue: string; no_show_rate: string }[];
  status_breakdown: { status: string; count: string }[];
  recent_appointments: {
    id: number; scheduled_at: string; status: string;
    consultation_fee: string; patient_name: string;
    patient_phone: string; is_returning: boolean;
  }[];
  patient_types: { is_returning: boolean; count: string }[];
  top_patients: { name: string; phone: string; is_returning: boolean; visits: string; last_visit: string }[];
}

export interface PatientProfile {
  id: number;
  name: string;
  dob: string | null;
  phone: string | null;
  email: string | null;
  is_returning: boolean;
  gender: string | null;
  blood_group: string | null;
  address: string | null;
  city: string | null;
  allergies: string | null;
  chronic_conditions: string | null;
  avatar_seed: string | null;
  emergency_contact: string | null;
  emergency_phone: string | null;
  total_visits: string;
  last_visit: string | null;
  first_visit: string | null;
  total_spent: string;
  no_show_rate: string;
  completion_rate: string;
}

export interface PatientProfileFull {
  profile: PatientProfile;
  visit_history: {
    id: number; scheduled_at: string; status: string;
    consultation_fee: string; doctor_name: string;
    seniority_level: string; department: string;
    clinic: string; city: string;
  }[];
  department_breakdown: { department: string; visits: string; spent: string }[];
  doctors_seen: { name: string; seniority_level: string; department: string; visits: string; last_seen: string }[];
  monthly_visits: { month: string; visits: string; spent: string }[];
}
