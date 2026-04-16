import { useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Upload, Download, Brain, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import Papa from 'papaparse';
import { useReferenceData, useModelMetrics } from '../hooks';
import { PageHeader, RiskGauge, ErrorBanner } from '../components/ui';
import api from '../utils/api';
import type { PredictionResult } from '../types';

const schema = z.object({
  city_id: z.string().min(1, 'Select a city'),
  clinic_id: z.string().min(1, 'Select a clinic'),
  doctor_id: z.string().min(1, 'Select a doctor'),
  patient_id: z.string().min(1, 'Select a patient'),
  scheduled_at: z.string().min(1, 'Pick a date and time'),
});
type FormData = z.infer<typeof schema>;

interface BulkRow {
  patient_name?: string;
  doctor_id?: string;
  patient_id?: string;
  department_id?: string;
  scheduled_at?: string;
  city_id?: string;
  probability?: number;
  risk_level?: string;
  recommended_action?: string;
  error?: string;
}

export default function PredictorPage() {
  const ref = useReferenceData();
  const metrics = useModelMetrics();
  const [result, setResult] = useState<PredictionResult | null>(null);
  const [predError, setPredError] = useState('');
  const [bulkRows, setBulkRows] = useState<BulkRow[]>([]);
  const [bulkLoading, setBulkLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const cityId = watch('city_id');
  const clinicId = watch('clinic_id');

  const filteredClinics = ref.data?.clinics.filter((c) => !cityId || c.city_id === parseInt(cityId)) || [];
  const filteredDoctors = ref.data?.doctors.filter((d) => !clinicId || d.clinic_id === parseInt(clinicId)) || [];

  const onSubmit = async (data: FormData) => {
    setPredError('');
    setResult(null);
    const doctor = ref.data?.doctors.find((d) => d.id === parseInt(data.doctor_id));
    try {
      const res = await api.post('/predict/no-show', {
        doctor_id: parseInt(data.doctor_id),
        patient_id: parseInt(data.patient_id),
        department_id: doctor?.department_id || 1,
        scheduled_at: data.scheduled_at,
        city_id: parseInt(data.city_id),
      });
      setResult(res.data.data);
    } catch {
      setPredError('Prediction failed. Please try again.');
    }
  };

  const handleBulkUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBulkLoading(true);
    setBulkRows([]);
    Papa.parse<BulkRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const processed: BulkRow[] = [];
        for (const row of results.data.slice(0, 50)) {
          try {
            const res = await api.post('/predict/no-show', {
              doctor_id: parseInt(row.doctor_id || '1'),
              patient_id: parseInt(row.patient_id || '1'),
              department_id: parseInt(row.department_id || '1'),
              scheduled_at: row.scheduled_at || new Date().toISOString(),
              city_id: parseInt(row.city_id || '1'),
            });
            processed.push({ ...row, ...res.data.data });
          } catch {
            processed.push({ ...row, error: 'Failed' });
          }
        }
        setBulkRows(processed);
        setBulkLoading(false);
      },
    });
  };

  const exportBulk = () => {
    const csv = Papa.unparse(bulkRows);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'meditrack_predictions.csv';
    a.click();
  };

  const RISK_COLORS = { low: '#22C55E', medium: '#BA7517', high: '#E24B4A' };

  return (
    <div className="animate-fade-up">
      <PageHeader title="No-Show Predictor" subtitle="ML-powered appointment no-show risk prediction" />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Form */}
        <div className="xl:col-span-2 space-y-6">
          <div className="card p-6">
            <div className="flex items-center gap-2 mb-6">
              <div className="p-2 rounded-lg" style={{ background: 'rgba(15,110,86,0.1)' }}>
                <Brain className="w-5 h-5" style={{ color: '#0F6E56' }} />
              </div>
              <div>
                <h3 className="font-semibold" style={{ color: 'var(--color-text)' }}>Predict No-Show Risk</h3>
                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Enter appointment details to get a risk score</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* City */}
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-text)' }}>City</label>
                <select {...register('city_id')}
                  className="w-full px-3 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  style={{ background: 'var(--color-surface-2)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}>
                  <option value="">Select city...</option>
                  {ref.data?.cities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                {errors.city_id && <p className="text-red-500 text-xs mt-1">{errors.city_id.message}</p>}
              </div>

              {/* Clinic */}
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-text)' }}>Clinic</label>
                <select {...register('clinic_id')}
                  className="w-full px-3 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  style={{ background: 'var(--color-surface-2)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}>
                  <option value="">Select clinic...</option>
                  {filteredClinics.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                {errors.clinic_id && <p className="text-red-500 text-xs mt-1">{errors.clinic_id.message}</p>}
              </div>

              {/* Doctor */}
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-text)' }}>Doctor</label>
                <select {...register('doctor_id')}
                  className="w-full px-3 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  style={{ background: 'var(--color-surface-2)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}>
                  <option value="">Select doctor...</option>
                  {filteredDoctors.map((d) => (
                    <option key={d.id} value={d.id}>{d.name} ({d.seniority_level})</option>
                  ))}
                </select>
                {errors.doctor_id && <p className="text-red-500 text-xs mt-1">{errors.doctor_id.message}</p>}
              </div>

              {/* Patient */}
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-text)' }}>Patient</label>
                <select {...register('patient_id')}
                  className="w-full px-3 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  style={{ background: 'var(--color-surface-2)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}>
                  <option value="">Select patient...</option>
                  {ref.data?.patients.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} — {p.phone}</option>
                  ))}
                </select>
                {errors.patient_id && <p className="text-red-500 text-xs mt-1">{errors.patient_id.message}</p>}
              </div>

              {/* Date/Time */}
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-text)' }}>Appointment Date & Time</label>
                <input
                  type="datetime-local"
                  {...register('scheduled_at')}
                  className="w-full px-3 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  style={{ background: 'var(--color-surface-2)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
                />
                {errors.scheduled_at && <p className="text-red-500 text-xs mt-1">{errors.scheduled_at.message}</p>}
              </div>
            </div>

            {predError && <div className="mt-4"><ErrorBanner message={predError} /></div>}

            <button
              onClick={handleSubmit(onSubmit)}
              disabled={isSubmitting}
              className="mt-6 w-full py-3 rounded-xl text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-60 transition-all"
              style={{ background: 'linear-gradient(135deg, #0F6E56, #1D9E75)' }}
            >
              {isSubmitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Predicting...</> : <><Brain className="w-4 h-4" /> Predict Risk</>}
            </button>
          </div>

          {/* Result */}
          {result && (
            <div className="card p-6 animate-fade-up">
              <h3 className="font-semibold mb-5" style={{ color: 'var(--color-text)' }}>Prediction Result</h3>
              <div className="flex flex-col sm:flex-row items-center gap-8">
                <RiskGauge probability={result.probability} />
                <div className="flex-1">
                  <div className="mb-4">
                    <div className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--color-text-muted)' }}>Risk Level</div>
                    <span className="text-lg font-bold capitalize" style={{ color: RISK_COLORS[result.risk_level] }}>
                      {result.risk_level} Risk
                    </span>
                  </div>
                  <div className="p-4 rounded-xl" style={{ background: 'var(--color-surface-2)' }}>
                    <div className="flex items-start gap-2">
                      {result.risk_level === 'low'
                        ? <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                        : <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: RISK_COLORS[result.risk_level] }} />}
                      <div>
                        <div className="text-xs font-semibold mb-1" style={{ color: 'var(--color-text-muted)' }}>Recommended Action</div>
                        <div className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>{result.recommended_action}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Bulk Upload */}
          <div className="card p-6">
            <h3 className="font-semibold mb-1" style={{ color: 'var(--color-text)' }}>Bulk Predictor</h3>
            <p className="text-sm mb-4" style={{ color: 'var(--color-text-muted)' }}>
              Upload a CSV with columns: doctor_id, patient_id, department_id, scheduled_at (ISO), city_id
            </p>
            <div className="flex gap-3 mb-4">
              <button
                onClick={() => fileRef.current?.click()}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all hover:border-primary-400"
                style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
              >
                <Upload className="w-4 h-4" /> Upload CSV
              </button>
              <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleBulkUpload} />
              {bulkRows.length > 0 && (
                <button
                  onClick={exportBulk}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white"
                  style={{ background: '#0F6E56' }}
                >
                  <Download className="w-4 h-4" /> Export Results
                </button>
              )}
            </div>

            {bulkLoading && (
              <div className="flex items-center gap-3 py-4">
                <Loader2 className="w-5 h-5 animate-spin" style={{ color: '#0F6E56' }} />
                <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Processing {bulkRows.length} rows...</span>
              </div>
            )}

            {bulkRows.length > 0 && !bulkLoading && (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <th className="text-left py-2 pr-3 font-semibold" style={{ color: 'var(--color-text-muted)' }}>Scheduled At</th>
                      <th className="text-left py-2 pr-3 font-semibold" style={{ color: 'var(--color-text-muted)' }}>Doctor ID</th>
                      <th className="text-right py-2 pr-3 font-semibold" style={{ color: 'var(--color-text-muted)' }}>Probability</th>
                      <th className="text-center py-2 font-semibold" style={{ color: 'var(--color-text-muted)' }}>Risk</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bulkRows.slice(0, 20).map((row, i) => (
                      <tr key={i} className="border-t" style={{ borderColor: 'var(--color-border)' }}>
                        <td className="py-2 pr-3" style={{ color: 'var(--color-text)' }}>{row.scheduled_at}</td>
                        <td className="py-2 pr-3" style={{ color: 'var(--color-text)' }}>{row.doctor_id}</td>
                        <td className="py-2 pr-3 text-right font-mono"
                          style={{ color: row.probability !== undefined ? RISK_COLORS[row.risk_level as keyof typeof RISK_COLORS || 'low'] : 'var(--color-text-muted)' }}>
                          {row.probability !== undefined ? `${(row.probability * 100).toFixed(1)}%` : row.error || '—'}
                        </td>
                        <td className="py-2 text-center">
                          {row.risk_level && (
                            <span className="px-2 py-0.5 rounded-full text-xs font-semibold capitalize"
                              style={{
                                background: `${RISK_COLORS[row.risk_level as keyof typeof RISK_COLORS]}20`,
                                color: RISK_COLORS[row.risk_level as keyof typeof RISK_COLORS],
                              }}>
                              {row.risk_level}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Model Metrics sidebar */}
        <div className="space-y-4">
          <div className="card p-6">
            <h3 className="font-semibold mb-4" style={{ color: 'var(--color-text)' }}>Model Performance</h3>
            {metrics.isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => <div key={i} className="skeleton h-10" />)}
              </div>
            ) : metrics.data ? (
              <>
                <div className="mb-4 p-3 rounded-xl text-center" style={{ background: 'rgba(15,110,86,0.08)' }}>
                  <div className="text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Algorithm</div>
                  <div className="font-bold" style={{ color: '#0F6E56' }}>{metrics.data.algorithm}</div>
                  <div className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>v{metrics.data.model_version}</div>
                </div>

                {[
                  { label: 'Accuracy', value: metrics.data.accuracy, color: '#0F6E56' },
                  { label: 'Precision', value: metrics.data.precision_score, color: '#0EA5E9' },
                  { label: 'Recall', value: metrics.data.recall_score, color: '#7C3AED' },
                  { label: 'F1 Score', value: metrics.data.f1_score, color: '#BA7517' },
                  { label: 'AUC-ROC', value: metrics.data.auc_roc, color: '#0F6E56' },
                ].map((m) => (
                  <div key={m.label} className="mb-4">
                    <div className="flex justify-between text-sm mb-1">
                      <span style={{ color: 'var(--color-text-muted)' }}>{m.label}</span>
                      <span className="font-semibold" style={{ color: 'var(--color-text)' }}>
                        {(parseFloat(m.value as unknown as string) * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="h-2 rounded-full" style={{ background: 'var(--color-surface-2)' }}>
                      <div
                        className="h-2 rounded-full"
                        style={{ width: `${parseFloat(m.value as unknown as string) * 100}%`, background: m.color }}
                      />
                    </div>
                  </div>
                ))}

                <div className="text-xs pt-3 border-t" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}>
                  Trained on {metrics.data.training_rows?.toLocaleString()} appointments
                  <br />
                  {metrics.data.trained_at ? new Date(metrics.data.trained_at).toLocaleDateString() : ''}
                </div>
              </>
            ) : (
              <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Metrics unavailable</p>
            )}
          </div>

          <div className="card p-4">
            <h4 className="font-semibold text-sm mb-3" style={{ color: 'var(--color-text)' }}>Risk Thresholds</h4>
            {[
              { label: 'Low Risk', range: '0–30%', color: '#22C55E', action: 'No action needed' },
              { label: 'Medium Risk', range: '30–60%', color: '#BA7517', action: 'Send SMS reminder' },
              { label: 'High Risk', range: '60–100%', color: '#E24B4A', action: 'Call patient directly' },
            ].map((t) => (
              <div key={t.label} className="flex items-start gap-3 mb-3 last:mb-0">
                <div className="w-3 h-3 rounded-full mt-0.5 flex-shrink-0" style={{ background: t.color }} />
                <div>
                  <div className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>{t.label} ({t.range})</div>
                  <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{t.action}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
