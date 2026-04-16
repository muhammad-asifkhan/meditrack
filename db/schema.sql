-- MediTrack Database Schema
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS cities (
  id   SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS clinics (
  id      SERIAL PRIMARY KEY,
  city_id INTEGER NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
  name    VARCHAR(150) NOT NULL,
  address TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_clinics_city_id ON clinics(city_id);

CREATE TABLE IF NOT EXISTS departments (
  id   SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS doctors (
  id                   SERIAL PRIMARY KEY,
  clinic_id            INTEGER NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  department_id        INTEGER NOT NULL REFERENCES departments(id),
  name                 VARCHAR(150) NOT NULL,
  seniority_level      VARCHAR(20) NOT NULL CHECK (seniority_level IN ('junior','senior','consultant')),
  bio                  TEXT,
  phone                VARCHAR(20),
  email                VARCHAR(150),
  avatar_seed          VARCHAR(50),
  years_experience     INTEGER DEFAULT 0,
  qualification        VARCHAR(200),
  available_days       VARCHAR(100) DEFAULT 'Mon,Tue,Wed,Thu,Fri',
  consultation_start   TIME DEFAULT '09:00',
  consultation_end     TIME DEFAULT '17:00',
  rating               NUMERIC(3,2) DEFAULT 4.0,
  languages            VARCHAR(200) DEFAULT 'Urdu,English',
  specializations      TEXT
);
CREATE INDEX IF NOT EXISTS idx_doctors_clinic_id     ON doctors(clinic_id);
CREATE INDEX IF NOT EXISTS idx_doctors_department_id ON doctors(department_id);

CREATE TABLE IF NOT EXISTS patients (
  id                  SERIAL PRIMARY KEY,
  name                VARCHAR(150) NOT NULL,
  dob                 DATE,
  phone               VARCHAR(20),
  email               VARCHAR(150),
  is_returning        BOOLEAN NOT NULL DEFAULT FALSE,
  gender              VARCHAR(10),
  blood_group         VARCHAR(5),
  address             TEXT,
  city                VARCHAR(100),
  allergies           TEXT,
  chronic_conditions  TEXT,
  avatar_seed         VARCHAR(50),
  emergency_contact   VARCHAR(150),
  emergency_phone     VARCHAR(20)
);

CREATE TABLE IF NOT EXISTS appointments (
  id               SERIAL PRIMARY KEY,
  doctor_id        INTEGER NOT NULL REFERENCES doctors(id),
  patient_id       INTEGER NOT NULL REFERENCES patients(id),
  clinic_id        INTEGER NOT NULL REFERENCES clinics(id),
  department_id    INTEGER NOT NULL REFERENCES departments(id),
  scheduled_at     TIMESTAMPTZ NOT NULL,
  status           VARCHAR(20) NOT NULL CHECK (status IN ('completed','cancelled','no_show')),
  consultation_fee NUMERIC(10,2) NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_appt_doctor_id     ON appointments(doctor_id);
CREATE INDEX IF NOT EXISTS idx_appt_patient_id    ON appointments(patient_id);
CREATE INDEX IF NOT EXISTS idx_appt_clinic_id     ON appointments(clinic_id);
CREATE INDEX IF NOT EXISTS idx_appt_department_id ON appointments(department_id);
CREATE INDEX IF NOT EXISTS idx_appt_scheduled_at  ON appointments(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_appt_status        ON appointments(status);

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  email         VARCHAR(150) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          VARCHAR(20) NOT NULL CHECK (role IN ('superadmin','city_manager','clinic_staff')),
  city_id       INTEGER REFERENCES cities(id),
  clinic_id     INTEGER REFERENCES clinics(id),
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked    BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);

CREATE TABLE IF NOT EXISTS audit_log (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER REFERENCES users(id),
  event_type VARCHAR(50) NOT NULL,
  ip_address VARCHAR(45),
  user_agent TEXT,
  details    JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id    ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_log_event_type ON audit_log(event_type);

CREATE TABLE IF NOT EXISTS model_metrics (
  id              SERIAL PRIMARY KEY,
  model_version   VARCHAR(50) NOT NULL,
  algorithm       VARCHAR(50) NOT NULL,
  accuracy        NUMERIC(5,4),
  precision_score NUMERIC(5,4),
  recall_score    NUMERIC(5,4),
  f1_score        NUMERIC(5,4),
  auc_roc         NUMERIC(5,4),
  trained_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  training_rows   INTEGER
);

INSERT INTO cities (name) VALUES ('Karachi'),('Lahore'),('Islamabad'),('Peshawar'),('Multan') ON CONFLICT DO NOTHING;
INSERT INTO departments (name) VALUES ('General'),('Cardiology'),('Orthopaedics'),('Dermatology'),('Pediatrics') ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────
-- PROFILE EXTENSIONS (migration-safe)
-- ─────────────────────────────────────


