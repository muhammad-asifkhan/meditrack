import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import cron from 'node-cron';
import pool from './db/pool';

import authRoutes from './routes/auth';
import analyticsRoutes from './routes/analytics';
import predictRoutes from './routes/predict';
import reportsRoutes from './routes/reports';
import adminRoutes from './routes/admin';
import profileRoutes from './routes/profiles';
import { seedDatabase } from './db/seeder';

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
    },
  },
}));

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
}));

app.use(compression());
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Rate limiting for data routes
const dataLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/v1/analytics', dataLimiter);
app.use('/api/v1/predict', dataLimiter);
app.use('/api/v1/reports', dataLimiter);

// Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/analytics', analyticsRoutes);
app.use('/api/v1/predict', predictRoutes);
app.use('/api/v1/reports', reportsRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/profiles', profileRoutes);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ success: false, error: 'Route not found' });
});

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ success: false, error: 'Internal server error' });
});

async function waitForDb(retries = 10): Promise<void> {
  for (let i = 0; i < retries; i++) {
    try {
      await pool.query('SELECT 1');
      console.log('✅ Database connected');
      return;
    } catch (err) {
      console.log(`⏳ Waiting for database... (${i + 1}/${retries})`);
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }
  throw new Error('Database connection failed after retries');
}

async function start(): Promise<void> {
  await waitForDb();

  // Auto-seed if enabled
  if (process.env.SEED_DB === 'true') {
    try {
      const check = await pool.query('SELECT COUNT(*) FROM appointments');
      if (parseInt(check.rows[0].count) < 100) {
        console.log('🌱 Seeding database...');
        await seedDatabase(pool);
      } else {
        console.log(`✅ Database already has ${check.rows[0].count} appointments, skipping seed`);
      }
    } catch (err) {
      console.warn('Seed check failed:', err);
    }
  }

  // Monthly model retrain cron (1st of every month at 2am)
  cron.schedule('0 2 1 * *', async () => {
    console.log('🔄 Monthly model retrain triggered');
    const ML_URL = process.env.ML_SERVICE_URL || 'http://localhost:8001';
    try {
      await fetch(`${ML_URL}/retrain`, { method: 'POST', signal: AbortSignal.timeout(300000) });
      console.log('✅ Model retrain complete');
    } catch (err) {
      console.error('Model retrain failed:', err);
    }
  });

  app.listen(PORT, () => {
    console.log(`🚀 MediTrack API running on http://localhost:${PORT}`);
    console.log(`📊 Environment: ${process.env.NODE_ENV}`);
  });
}

start().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

export default app;
