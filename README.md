# ⚡ EngineScan — Hybrid Intelligent Engine Health Monitoring System

A full-stack MERN + Python ML application that predicts engine health risk using 16 OBD-II sensor inputs.

---

## 🏗️ Architecture

```
engine-health-system/
├── frontend/          ← React 18 + TailwindCSS + Recharts + Firebase Auth
├── backend/           ← Node.js + Express + MongoDB (Mongoose)
└── ml-api/            ← Python FastAPI + scikit-learn Random Forest
```

**Data flow:**
```
Browser → React (port 3000)
            ↓ POST /api/predict
        Express (port 5000)
            ↓ POST /predict
        FastAPI ML Server (port 8000)
            ↓ returns { risk_level, health_score, ... }
        MongoDB ← Express saves prediction history
```

---

## 🚀 Quick Start

### Prerequisites

| Tool | Version |
|------|---------|
| Node.js | 18+ |
| Python | 3.10+ |
| MongoDB | 6+ (local) or MongoDB Atlas URI |
| npm / pip | latest |

---

### 1. Clone and enter the project

```bash
git clone <repo-url>
cd engine-health-system
```

---

### 2. Set up the Python ML API

```bash
cd ml-api

# Create virtual environment
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Generate demo model files (skip if you have real rf_model.pkl + scaler.pkl)
python generate_demo_model.py

# Start the FastAPI server
uvicorn main:app --reload --port 8000
```

**Verify:** Open http://localhost:8000 — should return `{"message":"Engine Health ML API is running"}`

---

### 3. Set up the Node.js backend

```bash
cd ../backend

# Install dependencies
npm install

# Configure environment
cp .env .env.local
# Edit .env.local:
#   MONGODB_URI=mongodb://localhost:27017/engine-health
#   ML_API_URL=http://localhost:8000
#   PORT=5000

# Start the Express server
npm run dev
```

**Verify:** Open http:// localhost:5000/api/health — should return `{"status":"ok"}`

---

### 4. Set up Firebase (for Google Authentication)

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project
3. Enable **Authentication → Sign-in method → Google**
4. Go to **Project Settings → Your apps → Web app** → copy config
5. Edit `frontend/.env`:

```env
REACT_APP_FIREBASE_API_KEY=AIza...
REACT_APP_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=your-project-id
REACT_APP_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=1234567890
REACT_APP_FIREBASE_APP_ID=1:123:web:abc
```

---

### 5. Set up the React frontend

```bash
cd ../frontend

# Install dependencies
npm install

# Start the React development server
npm start
```

Open http://localhost:3000 🎉

---

## 🔬 API Reference

### ML API (FastAPI — port 8000)

#### `POST /predict`

Request body:
```json
{
  "RPM": 800,
  "SPEED": 0,
  "THROTTLE_POS": 15.0,
  "MAF": 3.5,
  "SHORT_FUEL_TRIM_1": 0.0,
  "COOLANT_TEMP": 90,
  "INTAKE_TEMP": 30,
  "LONG_FUEL_TRIM_1": 0.0,
  "ENGINE_LOAD": 25.0,
  "FUEL_LEVEL": 60,
  "ELM_VOLTAGE": 13.8,
  "FUEL_USAGE_ML_MIN": 50.0,
  "FUEL_USED_TOTAL_ML": 500,
  "RELATIVE_THROTTLE_POS": 10.0,
  "ABSOLUTE_LOAD": 20.0,
  "INTAKE_PRESSURE": 35.0
}
```

Response:
```json
{
  "risk_level": "Healthy",
  "health_score": 87.5,
  "risk_description": "Engine is operating within optimal parameters.",
  "recommendations": ["Continue regular maintenance schedule", "..."]
}
```

#### `GET /health` — ML server health check

---

### Express API (Node.js — port 5000)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/predict` | Run prediction + save to MongoDB |
| GET | `/api/predict/history/:userId` | Get user prediction history |
| DELETE | `/api/predict/:id` | Delete a prediction record |
| POST | `/api/users/sync` | Sync Firebase user to MongoDB |
| GET | `/api/health` | Server health check |

---

## 🎯 Engine Health Score

| Score | Risk Level | Colour |
|-------|-----------|--------|
| 75–100 | Healthy | 🟢 Green |
| 50–75 | Moderate | 🟡 Yellow |
| 25–50 | High Risk | 🟠 Orange |
| 0–25 | Critical | 🔴 Red |

---

## 📁 Project Structure

```
engine-health-system/
├── frontend/
│   ├── public/
│   │   └── index.html
│   ├── src/
│   │   ├── components/
│   │   │   ├── Layout.js          ← Navbar + footer wrapper
│   │   │   ├── SensorInput.js     ← Reusable input field with tooltip
│   │   │   └── HealthGauge.js     ← SVG arc gauge component
│   │   ├── pages/
│   │   │   ├── HomePage.js        ← Landing page
│   │   │   ├── LoginPage.js       ← Google OAuth login
│   │   │   ├── DashboardPage.js   ← 16-sensor prediction form
│   │   │   ├── ResultPage.js      ← Health score + recommendations
│   │   │   ├── HistoryPage.js     ← Prediction history + Recharts
│   │   │   └── ManualPage.js      ← User manual + maintenance tips
│   │   ├── services/
│   │   │   ├── api.js             ← Axios API client
│   │   │   └── sensorMeta.js      ← Sensor metadata + risk config
│   │   ├── firebase/
│   │   │   └── config.js          ← Firebase initialisation
│   │   ├── hooks/
│   │   │   └── useAuth.js         ← Auth context + provider
│   │   ├── App.js
│   │   ├── index.js
│   │   └── index.css
│   ├── tailwind.config.js
│   └── package.json
│
├── backend/
│   ├── config/
│   │   └── db.js                  ← MongoDB connection
│   ├── models/
│   │   ├── User.js                ← User schema
│   │   └── Prediction.js          ← Prediction schema (16 fields)
│   ├── controllers/
│   │   ├── predictController.js   ← Prediction logic + history
│   │   └── userController.js      ← User sync
│   ├── routes/
│   │   ├── predict.js
│   │   └── user.js
│   ├── server.js
│   └── package.json
│
└── ml-api/
    ├── main.py                    ← FastAPI server + /predict endpoint
    ├── generate_demo_model.py     ← Creates demo rf_model.pkl + scaler.pkl
    ├── rf_model.pkl               ← (generated or replaced with your model)
    ├── scaler.pkl                 ← (generated or replaced with your scaler)
    ├── requirements.txt
    └── .env
```

---

## 🔧 Replacing the Demo Model

Drop your own trained files in `ml-api/`:
- `rf_model.pkl` — a `sklearn.ensemble.RandomForestClassifier`
- `scaler.pkl` — a `sklearn.preprocessing.StandardScaler`

The scaler must have been fitted on the same 16 features in the same order listed in `main.py`.

If your model outputs a continuous health score (regression), update the `predict()` function in `main.py` accordingly. If it outputs class probabilities, the existing weighted-average logic handles it automatically.

---

## 🛡️ Security Notes

- Firebase handles authentication; never expose Firebase Admin SDK on the client.
- OBD-II sensor inputs are validated in both the Express backend and FastAPI ML API.
- Rate limiting is applied to all `/api/` routes (100 req / 15 min).
- MongoDB queries are scoped to `userId` to prevent cross-user data access.

---

## 📦 Deployment

### Frontend → Vercel / Netlify
```bash
cd . && npm run build
# Deploy the build/ folder
```

Required Vercel environment variables (Production/Preview):
- `REACT_APP_FIREBASE_API_KEY`
- `REACT_APP_FIREBASE_AUTH_DOMAIN`
- `REACT_APP_FIREBASE_PROJECT_ID`
- `REACT_APP_FIREBASE_STORAGE_BUCKET`
- `REACT_APP_FIREBASE_MESSAGING_SENDER_ID`
- `REACT_APP_FIREBASE_APP_ID`
- `REACT_APP_API_URL` (your deployed backend origin, without `/api`)

Firebase Auth setup required for deployed sign-in:
- Enable Google provider in Firebase Authentication.
- Add your Vercel domains to **Authentication → Settings → Authorized domains**.
- Add both your production domain (for example `engine-iq.vercel.app`) and preview domains if you test previews.

### Backend → Railway / Render
- Set `MONGODB_URI` to your Atlas connection string
- Set `ML_API_URL` to your deployed FastAPI URL
- Set `CORS_ORIGINS` to include your frontend domain(s), comma-separated

### ML API → Railway / Render (Python service)
```bash
uvicorn main:app --host 0.0.0.0 --port 8000
```

---

## 📄 License

MIT — free to use, modify, and distribute.
