"""
Hybrid Intelligent Engine Health Monitoring System
FastAPI ML Server — built for your exact trained models:
  - scaler.pkl      : MinMaxScaler (16 features)
  - rf_model.pkl    : RandomForestClassifier (classes: 0=CRITICAL,1=HIGH RISK,2=MODERATE,3=HEALTHY)
  - iso_forest.pkl  : IsolationForest (optional — used for anomaly confidence)
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import numpy as np
import joblib
import os
import logging
import gdown
import warnings
from sklearn.exceptions import InconsistentVersionWarning
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import MinMaxScaler
warnings.filterwarnings("ignore", category=InconsistentVersionWarning)

try:
    import shap
    SHAP_AVAILABLE = True
except Exception:
    shap = None
    SHAP_AVAILABLE = False

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Engine Health ML API",
    description="Hybrid Intelligent Engine Health Monitor — RF + IsolationForest",
    version="2.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Load models ──────────────────────────────────────────────────────────────
rf_model   = None
scaler     = None
iso_forest = None
shap_explainer = None

def download_if_missing():
    """Downloads model files from Google Drive if not present locally."""
    # files = {
    #     "rf_model.pkl":    os.getenv("RF_MODEL_DRIVE_ID"),
    #     "scaler.pkl":      os.getenv("SCALER_DRIVE_ID"),
    #     "iso_forest.pkl":  os.getenv("ISO_FOREST_DRIVE_ID"),
    # }

    files = {
        "rf_model.pkl":   "1AiPiAmuMs2YUB_xz8QkBxyMxTx9gAnDi",
        "scaler.pkl":     "12A-I-Ys4vlQtjxp2qgdqZy_jHGZgDt-f",
        "iso_forest.pkl": "1erpSoTnOhNsMflxG-dNmmJC8aXKVK0R-",
    }
    for filename, file_id in files.items():
        if os.path.exists(filename):
            logger.info(f"✅ {filename} already exists, skipping download")
            continue
        if not file_id:
            logger.warning(f"⚠️  No Drive ID set for {filename}")
            continue
        try:
            url = f"https://drive.google.com/uc?id={file_id}"
            logger.info(f"⬇️  Downloading {filename} from Google Drive...")
            gdown.download(url, filename, quiet=False, fuzzy=True)
            logger.info(f"✅ {filename} downloaded successfully")
        except Exception as e:
            logger.error(f"❌ Failed to download {filename}: {e}")

@app.on_event("startup")
def load_models():
    global rf_model, scaler, iso_forest, shap_explainer

     # Download from Google Drive if files are missing
    download_if_missing()

    try:
        rf_model   = joblib.load(os.getenv("MODEL_PATH",      "rf_model.pkl"))
        scaler     = joblib.load(os.getenv("SCALER_PATH",     "scaler.pkl"))
        iso_forest = joblib.load(os.getenv("ISO_FOREST_PATH", "iso_forest.pkl"))

        logger.info("✅ All models loaded successfully")
        logger.info(f"   RF classes       : {rf_model.classes_}")
        logger.info(f"   RF features      : {rf_model.n_features_in_}")
        logger.info(f"   Scaler features  : {scaler.n_features_in_}")
        logger.info(f"   IsoForest feats  : {iso_forest.n_features_in_}")

        if SHAP_AVAILABLE:
            try:
                shap_explainer = shap.TreeExplainer(rf_model)
                logger.info("✅ SHAP explainer initialized")
            except Exception as e:
                shap_explainer = None
                logger.warning(f"⚠️  SHAP explainer initialization failed: {e}")
        else:
            logger.warning("⚠️  SHAP not installed; fallback XAI explanation will be used")
    except FileNotFoundError as e:
        logger.error(f"❌ Model file not found: {e}")
        logger.warning("Running in DEMO mode — heuristic predictions only")
    except Exception as e:
        logger.error(f"❌ Failed to load models: {e}")


# ─── Feature order — must exactly match training column order ─────────────────
# From your notebook: scaler was fit on engine_df[selected_cols]
# MinMaxScaler data_min_ confirms 16 features in this order:
FEATURE_ORDER = [
    "RPM",
    "SPEED",
    "THROTTLE_POS",
    "MAF",
    "SHORT_FUEL_TRIM_1",
    "COOLANT_TEMP",
    "INTAKE_TEMP",
    "LONG_FUEL_TRIM_1",
    "ENGINE_LOAD",
    "FUEL_LEVEL",
    "ELM_VOLTAGE",
    "FUEL_USAGE_ML_MIN",
    "FUEL_USED_TOTAL_ML",
    "RELATIVE_THROTTLE_POS",
    "ABSOLUTE_LOAD",
    "INTAKE_PRESSURE",
]

# ─── Class label mapping (from your notebook Cell 26) ─────────────────────────
# label_map = {'CRITICAL': 0, 'HIGH RISK': 1, 'MODERATE': 2, 'HEALTHY': 3}
CLASS_TO_LABEL = {
    0: "Critical",
    1: "High Risk",
    2: "Moderate",
    3: "Healthy",
}
LABEL_TO_CLASS = {v: k for k, v in CLASS_TO_LABEL.items()}

# Centre score for each class (used when probabilities unavailable)
CLASS_TO_SCORE = {
    0: 12.5,   # CRITICAL  : 0–25
    1: 37.5,   # HIGH RISK : 25–50
    2: 62.5,   # MODERATE  : 50–75
    3: 87.5,   # HEALTHY   : 75–100
}

# Probability-weighted bin centres (same order as rf_model.classes_)
# classes_ = [0, 1, 2, 3]  →  scores = [12.5, 37.5, 62.5, 87.5]
PROBA_BIN_SCORES = [12.5, 37.5, 62.5, 87.5]


# ─── Input schema ─────────────────────────────────────────────────────────────
class SensorInput(BaseModel):
    RPM:                   float = Field(..., ge=0,   le=8000,  description="Engine RPM")
    SPEED:                 float = Field(..., ge=0,   le=300,   description="Vehicle speed km/h")
    THROTTLE_POS:          float = Field(..., ge=0,   le=100,   description="Throttle position %")
    MAF:                   float = Field(..., ge=0,   le=300,   description="Mass air flow g/s")
    SHORT_FUEL_TRIM_1:     float = Field(..., ge=-40, le=60,    description="Short-term fuel trim %")
    COOLANT_TEMP:          float = Field(..., ge=-10, le=120,   description="Coolant temperature °C")
    INTAKE_TEMP:           float = Field(..., ge=-10, le=60,    description="Intake air temperature °C")
    LONG_FUEL_TRIM_1:      float = Field(..., ge=-10, le=35,    description="Long-term fuel trim %")
    ENGINE_LOAD:           float = Field(..., ge=0,   le=100,   description="Engine load %")
    FUEL_LEVEL:            float = Field(..., ge=5,   le=100,   description="Fuel level %")
    ELM_VOLTAGE:           float = Field(..., ge=12,  le=15,    description="ELM voltage V")
    FUEL_USAGE_ML_MIN:     float = Field(..., ge=0,   le=820,   description="Fuel usage mL/min")
    FUEL_USED_TOTAL_ML:    float = Field(..., ge=0,   le=7300,  description="Total fuel used mL")
    RELATIVE_THROTTLE_POS: float = Field(..., ge=1,   le=54,    description="Relative throttle pos %")
    ABSOLUTE_LOAD:         float = Field(..., ge=0,   le=8710,  description="Absolute engine load %")
    INTAKE_PRESSURE:       float = Field(..., ge=19,  le=104,   description="Intake manifold pressure kPa")


class PredictionResponse(BaseModel):
    risk_level:       str
    health_score:     float
    risk_description: str
    recommendations:  list[str]
    anomaly_detected: bool
    confidence:       float
    shap_explanation: dict | None = None


class FeedbackSample(BaseModel):
    label: str
    RPM: float
    SPEED: float
    THROTTLE_POS: float
    MAF: float
    SHORT_FUEL_TRIM_1: float
    COOLANT_TEMP: float
    INTAKE_TEMP: float
    LONG_FUEL_TRIM_1: float
    ENGINE_LOAD: float
    FUEL_LEVEL: float
    ELM_VOLTAGE: float
    FUEL_USAGE_ML_MIN: float
    FUEL_USED_TOTAL_ML: float
    RELATIVE_THROTTLE_POS: float
    ABSOLUTE_LOAD: float
    INTAKE_PRESSURE: float


class RetrainRequest(BaseModel):
    samples: list[FeedbackSample]


def build_fallback_explanation(features: np.ndarray, scaled: np.ndarray, predicted_class: int) -> dict:
    """Build a deterministic fallback attribution when SHAP is unavailable."""
    importances = np.asarray(getattr(rf_model, "feature_importances_", np.ones(len(FEATURE_ORDER))), dtype=float)
    if importances.size != len(FEATURE_ORDER) or float(np.sum(importances)) == 0.0:
        importances = np.ones(len(FEATURE_ORDER), dtype=float)

    # Center scaled values around 0.5 to infer contribution direction.
    centered = scaled[0] - 0.5
    proxy_impacts = centered * importances

    rows = []
    for idx, feature_name in enumerate(FEATURE_ORDER):
        impact = float(proxy_impacts[idx])
        rows.append(
            {
                "feature": feature_name,
                "value": float(features[0][idx]),
                "impact": impact,
                "direction": "increase" if impact >= 0 else "decrease",
                "abs_impact": abs(impact),
            }
        )

    ranked = sorted(rows, key=lambda x: x["abs_impact"], reverse=True)
    top_positive = [r for r in ranked if r["impact"] > 0][:5]
    top_negative = [r for r in ranked if r["impact"] < 0][:5]

    return {
        "method": "Fallback Feature Attribution",
        "predicted_class": int(predicted_class),
        "base_value": 0.5,
        "top_positive": top_positive,
        "top_negative": top_negative,
        "top_features": ranked[:8],
    }


def build_shap_explanation(features: np.ndarray, scaled: np.ndarray, predicted_class: int) -> dict:
    """Build a compact SHAP summary for the predicted class, with fallback output."""
    if shap_explainer is None:
        return build_fallback_explanation(features, scaled, predicted_class)

    try:
        class_index = int(np.where(rf_model.classes_ == predicted_class)[0][0])
        shap_values_raw = shap_explainer.shap_values(features)
        expected_raw = shap_explainer.expected_value

        # SHAP output can vary by version/model type; normalize to 1D feature vector.
        if isinstance(shap_values_raw, list):
            feature_impacts = np.asarray(shap_values_raw[class_index][0], dtype=float)
        else:
            shap_arr = np.asarray(shap_values_raw)
            if shap_arr.ndim == 3:
                if shap_arr.shape[0] == 1:
                    feature_impacts = shap_arr[0, :, class_index].astype(float)
                else:
                    feature_impacts = shap_arr[class_index, 0, :].astype(float)
            else:
                feature_impacts = shap_arr[0].astype(float)

        if isinstance(expected_raw, (list, np.ndarray)):
            base_value = float(np.asarray(expected_raw)[class_index])
        else:
            base_value = float(expected_raw)

        rows = []
        for idx, feature_name in enumerate(FEATURE_ORDER):
            impact = float(feature_impacts[idx])
            rows.append(
                {
                    "feature": feature_name,
                    "value": float(features[0][idx]),
                    "impact": impact,
                    "direction": "increase" if impact >= 0 else "decrease",
                    "abs_impact": abs(impact),
                }
            )

        ranked = sorted(rows, key=lambda x: x["abs_impact"], reverse=True)
        top_positive = [r for r in ranked if r["impact"] > 0][:5]
        top_negative = [r for r in ranked if r["impact"] < 0][:5]

        return {
            "method": "SHAP TreeExplainer",
            "predicted_class": int(predicted_class),
            "base_value": base_value,
            "top_positive": top_positive,
            "top_negative": top_negative,
            "top_features": ranked[:8],
        }
    except Exception as e:
        logger.warning(f"⚠️  SHAP explanation generation failed: {e}")
        return build_fallback_explanation(features, scaled, predicted_class)


def rebuild_shap_explainer() -> None:
    global shap_explainer
    if SHAP_AVAILABLE and rf_model is not None:
        try:
            shap_explainer = shap.TreeExplainer(rf_model)
            logger.info("✅ SHAP explainer refreshed")
        except Exception as e:
            shap_explainer = None
            logger.warning(f"⚠️  SHAP refresh failed: {e}")
    else:
        shap_explainer = None


def retrain_from_feedback(samples: list[FeedbackSample]) -> dict:
    global rf_model, scaler

    if not samples:
        raise HTTPException(status_code=400, detail="No samples provided for retraining")

    X = []
    y = []
    for sample in samples:
        if sample.label not in LABEL_TO_CLASS:
            continue
        X.append([getattr(sample, f) for f in FEATURE_ORDER])
        y.append(LABEL_TO_CLASS[sample.label])

    if len(X) < 2:
        raise HTTPException(status_code=400, detail="Not enough valid labeled samples")

    unique_classes = sorted(set(y))
    if len(unique_classes) < 2:
        raise HTTPException(
            status_code=400,
            detail="Retraining requires at least two distinct class labels",
        )

    X_arr = np.asarray(X, dtype=float)
    y_arr = np.asarray(y, dtype=int)

    new_scaler = MinMaxScaler()
    X_scaled = new_scaler.fit_transform(X_arr)

    new_model = RandomForestClassifier(
        n_estimators=300,
        random_state=42,
        class_weight="balanced",
        n_jobs=-1,
    )
    new_model.fit(X_scaled, y_arr)

    model_path = os.getenv("MODEL_PATH", "rf_model.pkl")
    scaler_path = os.getenv("SCALER_PATH", "scaler.pkl")
    joblib.dump(new_model, model_path)
    joblib.dump(new_scaler, scaler_path)

    rf_model = new_model
    scaler = new_scaler
    rebuild_shap_explainer()

    class_distribution = {
        CLASS_TO_LABEL[int(cls)]: int(np.sum(y_arr == cls)) for cls in unique_classes
    }

    return {
        "status": "retrained",
        "sample_count": int(len(X_arr)),
        "class_distribution": class_distribution,
        "model_path": model_path,
        "scaler_path": scaler_path,
    }


# ─── Risk details ─────────────────────────────────────────────────────────────
def get_risk_details(risk_level: str) -> tuple[str, list[str]]:
    details = {
        "Healthy": (
            "Engine is operating within optimal parameters. No immediate action required.",
            [
                "Continue regular maintenance schedule",
                "Monitor fuel trims for consistency",
                "Keep up with oil change intervals",
            ],
        ),
        "Moderate": (
            "Minor irregularities detected. Schedule a routine inspection soon.",
            [
                "Check and clean MAF sensor",
                "Inspect air filter and intake system",
                "Verify fuel injector performance",
                "Monitor coolant levels",
            ],
        ),
        "High Risk": (
            "Significant engine stress detected. Prompt inspection strongly advised.",
            [
                "Immediate diagnostic scan recommended",
                "Check for vacuum leaks",
                "Inspect throttle body and EGR valve",
                "Test fuel pressure and injectors",
                "Check coolant system for leaks",
            ],
        ),
        "Critical": (
            "Critical engine condition detected. Do not drive — seek immediate professional service.",
            [
                "Stop driving immediately if safe to do so",
                "Contact a certified mechanic urgently",
                "Do not ignore warning lights",
                "Possible engine overheating or fuel system failure",
            ],
        ),
    }
    return details.get(risk_level, details["Moderate"])


# ─── Predict endpoint ─────────────────────────────────────────────────────────
@app.post("/predict", response_model=PredictionResponse)
def predict(data: SensorInput):
    try:
        # Build feature array in the exact order the scaler was trained on
        features = np.array([[getattr(data, f) for f in FEATURE_ORDER]])
        logger.info(f"Raw input: {features}")

        if rf_model is None or scaler is None:
            raise HTTPException(
                status_code=503,
                detail="Models not loaded. Place rf_model.pkl, scaler.pkl, iso_forest.pkl in the ML-API folder and restart."
            )

        # ── Step 1: Scale input ──────────────────────────────────────────────
        scaled = scaler.transform(features)

        # ── Step 2: RF prediction ────────────────────────────────────────────
        predicted_class = int(rf_model.predict(scaled)[0])
        risk_level = CLASS_TO_LABEL.get(predicted_class, "Moderate")

        # ── Step 3: Health score from class probabilities ────────────────────
        # predict_proba gives [P(0), P(1), P(2), P(3)]
        # weighted sum with bin centres gives a smooth 0-100 score
        proba = rf_model.predict_proba(scaled)[0]
        health_score = float(np.dot(proba, PROBA_BIN_SCORES))
        confidence   = float(np.max(proba))

        logger.info(f"Probabilities : {proba}")
        logger.info(f"Predicted class: {predicted_class} → {risk_level}")
        logger.info(f"Health score  : {health_score:.1f}")
        logger.info(f"Confidence    : {confidence:.2%}")

        shap_explanation = build_shap_explanation(features, scaled, predicted_class)

        # ── Step 4: Isolation Forest anomaly check ───────────────────────────
        anomaly_detected = False
        if iso_forest is not None:
            iso_pred = iso_forest.predict(scaled)[0]   # 1 = normal, -1 = anomaly
            anomaly_detected = bool(iso_pred == -1)
            if anomaly_detected:
                logger.warning("⚠️  IsolationForest flagged this reading as anomalous")
                # Pull health score down slightly if anomaly detected + high risk
                if health_score > 50:
                    health_score = max(health_score - 10, 25.0)

        # Recalculate risk level based on final score
        if health_score >= 75:
            risk_level = "Healthy"
        elif health_score >= 50:
            risk_level = "Moderate"
        elif health_score >= 25:
            risk_level = "High Risk"
        else:
            risk_level = "Critical"

        description, recommendations = get_risk_details(risk_level)

        return PredictionResponse(
            risk_level=risk_level,
            health_score=round(health_score, 1),
            risk_description=description,
            recommendations=recommendations,
            anomaly_detected=anomaly_detected,
            confidence=round(confidence * 100, 1),
            shap_explanation=shap_explanation,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Prediction error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ─── Health check ─────────────────────────────────────────────────────────────
@app.get("/health")
def health():
    return {
        "status": "ok",
        "rf_model_loaded":    rf_model   is not None,
        "scaler_loaded":      scaler     is not None,
        "iso_forest_loaded":  iso_forest is not None,
    }


@app.post("/retrain")
def retrain(payload: RetrainRequest):
    try:
        result = retrain_from_feedback(payload.samples)
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Retrain error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/")
def root():
    return {"message": "Engine Health ML API v2.0 is running"}