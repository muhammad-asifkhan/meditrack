import { Pool } from 'pg';

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'meditrack',
  user: process.env.DB_USER || 'meditrack_user',
  password: process.env.DB_PASSWORD || 'meditrack_secret_2024',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

export default pool;
export const query = (text: string, params?: unknown[]) => pool.query(text, params);
