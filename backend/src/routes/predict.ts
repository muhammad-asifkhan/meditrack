import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { authenticate } from '../middleware/auth';
import { query } from '../db/pool';

const router = Router();
router.use(authenticate);

const ML_URL = process.env.ML_SERVICE_URL || 'http://localhost:8001';

function getRiskLevel(prob: number): 'low' | 'medium' | 'high' {
  if (prob < 0.3) return 'low';
  if (prob < 0.6) return 'medium';
  return 'high';
}

function getRecommendedAction(prob: number): string {
  if (prob < 0.3) return 'No action needed — low no-show risk';
  if (prob < 0.5) return 'Send automated SMS reminder 24 hours before appointment';
  if (prob < 0.7) return 'Send SMS + WhatsApp reminder 48 hours before appointment';
  return 'Call patient directly — high no-show risk. Consider overbooking this slot.';
}

/**
 * POST /api/v1/predict/no-show
 */
router.post('/no-show', [
  body('doctor_id').isInt({ min: 1 }),
  body('patient_id').isInt({ min: 1 }),
  body('department_id').isInt({ min: 1 }),
  body('scheduled_at').isISO8601(),
  body('city_id').isInt({ min: 1 }),
], async (req: Request, res: Response): Promise<void> => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ success: false, errors: errors.array() });
    return;
  }

  const { doctor_id, patient_id, department_id, scheduled_at, city_id } = req.body;

  try {
    // Fetch doctor seniority and patient is_returning
    const [doctorRes, patientRes] = await Promise.all([
      query(`SELECT seniority_level FROM doctors WHERE id = $1`, [doctor_id]),
      query(`SELECT is_returning FROM patients WHERE id = $1`, [patient_id]),
    ]);

    if (!doctorRes.rows[0] || !patientRes.rows[0]) {
      res.status(404).json({ success: false, error: 'Doctor or patient not found' });
      return;
    }

    const seniority = doctorRes.rows[0].seniority_level;
    const isReturning = patientRes.rows[0].is_returning;
    const scheduledDate = new Date(scheduled_at);
    const now = new Date();
    const daysInAdvance = Math.max(0, Math.floor((scheduledDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

    // Call ML microservice
    let probability = 0.25; // fallback
    try {
      const mlRes = await fetch(`${ML_URL}/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hour_of_day: scheduledDate.getHours(),
          day_of_week: scheduledDate.getDay(),
          department_id,
          doctor_seniority: seniority === 'consultant' ? 2 : seniority === 'senior' ? 1 : 0,
          is_returning_patient: isReturning,
          days_booked_in_advance: daysInAdvance,
          city_id,
        }),
        signal: AbortSignal.timeout(5000),
      });

      if (mlRes.ok) {
        const mlData = await mlRes.json() as { probability: number };
        probability = mlData.probability;
      }
    } catch (mlErr) {
      console.warn('ML service unavailable, using rule-based fallback');
      // Rule-based fallback
      const hour = scheduledDate.getHours();
      const dow = scheduledDate.getDay();
      probability = 0.20;
      if (!isReturning) probability += 0.10;
      if (daysInAdvance > 14) probability += 0.08;
      if (seniority === 'junior') probability += 0.05;
      if (hour < 10 || hour > 15) probability += 0.05;
      if (dow === 5 || dow === 6) probability += 0.08;
    }

    res.json({
      success: true,
      data: {
        probability: Math.min(Math.max(probability, 0), 1),
        risk_level: getRiskLevel(probability),
        recommended_action: getRecommendedAction(probability),
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Prediction failed' });
  }
});

/**
 * GET /api/v1/predict/model-metrics
 */
router.get('/model-metrics', async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await query(
      `SELECT * FROM model_metrics ORDER BY trained_at DESC LIMIT 1`
    );
    res.json({ success: true, data: result.rows[0] || null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to fetch metrics' });
  }
});

export default router;
