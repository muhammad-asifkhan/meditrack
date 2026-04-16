# 🏥 MediTrack Analytics Dashboard

Production-ready healthcare analytics — 5 Pakistani cities, 15+ clinics, 83 doctors, 500 patients, ML-powered no-show prediction, Doctor & Patient profiles, role-based access, dark mode.

## ⚡ Setup

### Option A — Docker (full stack)
```bash
cp .env.example .env
docker compose up --build
# Open: http://localhost:5173
```

### Option B — Python only (no Docker, no Node needed)
```bash
pip install flask flask-cors bcrypt pyjwt scikit-learn numpy
python3 server.py
# Open: http://localhost:3001
```

## 🔑 Login
| Role | Email | Password |
|------|-------|----------|
| Super Admin | admin@meditrack.pk | Admin@1234 |
| City Manager | karachi@meditrack.pk | Manager@1234 |
| Clinic Staff | staff@meditrack.pk | Staff@1234 |

## 📊 Pages
1. Overview — KPIs, trend charts, city comparison, top doctors
2. Departments — sortable table, health status badges, detail drawer
3. Doctors — cascading filters, no-show highlights
4. **Doctor Profiles** — avatar cards, bios, ratings, qualifications, full profile drawer
5. **Patient Profiles** — blood group, allergies, conditions, visit history timeline
6. Revenue — stacked dept bars, clinic heatmap
7. Time Analysis — rolling average, 7×24 heatmap, auto insight
8. No-Show Predictor — ML gauge, bulk CSV, model metrics
9. Settings — user management, audit log

## 🗄️ Data
- 83 doctors with bios, FCPS qualifications, specializations, ratings, languages
- 500 patients with blood groups, genders, cities, allergies, chronic conditions
- 2,500 appointments over 24 months with realistic seasonality
