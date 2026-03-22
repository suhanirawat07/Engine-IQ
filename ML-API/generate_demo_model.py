"""
generate_demo_model.py
──────────────────────
Generates placeholder rf_model.pkl and scaler.pkl files for local development
and testing when you don't have a trained model yet.

Run once from the ml-api/ directory:
    python generate_demo_model.py
"""

import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import StandardScaler
import joblib

FEATURES = [
    "RPM", "SPEED", "THROTTLE_POS", "MAF", "SHORT_FUEL_TRIM_1",
    "COOLANT_TEMP", "INTAKE_TEMP", "LONG_FUEL_TRIM_1", "ENGINE_LOAD",
    "FUEL_LEVEL", "ELM_VOLTAGE", "FUEL_USAGE_ML_MIN", "FUEL_USED_TOTAL_ML",
    "RELATIVE_THROTTLE_POS", "ABSOLUTE_LOAD", "INTAKE_PRESSURE",
]

np.random.seed(42)
N = 800

X = np.column_stack([
    np.random.uniform(600, 5000, N),    # RPM
    np.random.uniform(0, 180, N),       # SPEED
    np.random.uniform(5, 80, N),        # THROTTLE_POS
    np.random.uniform(1, 50, N),        # MAF
    np.random.uniform(-15, 15, N),      # SHORT_FUEL_TRIM_1
    np.random.uniform(70, 115, N),      # COOLANT_TEMP
    np.random.uniform(15, 60, N),       # INTAKE_TEMP
    np.random.uniform(-12, 12, N),      # LONG_FUEL_TRIM_1
    np.random.uniform(15, 90, N),       # ENGINE_LOAD
    np.random.uniform(5, 100, N),       # FUEL_LEVEL
    np.random.uniform(11.5, 14.8, N),   # ELM_VOLTAGE
    np.random.uniform(10, 800, N),      # FUEL_USAGE_ML_MIN
    np.random.uniform(0, 5000, N),      # FUEL_USED_TOTAL_ML
    np.random.uniform(5, 60, N),        # RELATIVE_THROTTLE_POS
    np.random.uniform(10, 80, N),       # ABSOLUTE_LOAD
    np.random.uniform(20, 100, N),      # INTAKE_PRESSURE
])

# Synthetic labels: 0=Critical, 1=High Risk, 2=Moderate, 3=Healthy
y = np.zeros(N, dtype=int)
for i in range(N):
    score = 100
    if X[i, 0] > 4500: score -= 20   # High RPM
    if X[i, 5] > 108:  score -= 25   # Overheating
    if abs(X[i, 4]) > 12: score -= 15 # SFT deviation
    if abs(X[i, 7]) > 10: score -= 15 # LFT deviation
    if X[i, 10] < 12.0: score -= 20  # Low voltage
    score += np.random.uniform(-5, 5)
    if score >= 75:   y[i] = 3
    elif score >= 50: y[i] = 2
    elif score >= 25: y[i] = 1
    else:             y[i] = 0

scaler = StandardScaler()
X_scaled = scaler.fit_transform(X)

model = RandomForestClassifier(n_estimators=100, random_state=42)
model.fit(X_scaled, y)

joblib.dump(model, "rf_model.pkl")
joblib.dump(scaler, "scaler.pkl")

print("✅ rf_model.pkl and scaler.pkl created successfully.")
print(f"   Training samples: {N}")
print(f"   Class distribution: {dict(zip(*np.unique(y, return_counts=True)))}")
print("   → 0=Critical, 1=High Risk, 2=Moderate, 3=Healthy")
