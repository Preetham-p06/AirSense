import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import Ridge
from sklearn.metrics import mean_absolute_error, r2_score
import joblib

CSV_NAME = "AirQualityUCI.csv"

def load_air_quality(csv_name: str) -> pd.DataFrame:
    """
    Loads common UCI/Kaggle variants of the Air Quality dataset.
    Handles separators and decimal commas.
    """
    # Try common formats: UCI original often uses sep=";" and decimal=","
    try:
        df = pd.read_csv(csv_name, sep=";", decimal=",")
    except Exception:
        df = pd.read_csv(csv_name)

    # Drop empty columns sometimes created by trailing separators
    df = df.dropna(axis=1, how="all")

    # Standardize column names (strip spaces)
    df.columns = [c.strip() for c in df.columns]

    # Replace common missing sentinel values
    df = df.replace(-200, np.nan)

    return df

def pick_column(df: pd.DataFrame, candidates: list[str]) -> str | None:
    for c in candidates:
        if c in df.columns:
            return c
    return None

df = load_air_quality(CSV_NAME)

# --- Pick pollutant columns if present (dataset variants differ) ---
col_co  = pick_column(df, ["CO(GT)", "CO_GT", "CO"])
col_nox = pick_column(df, ["NOx(GT)", "NOX(GT)", "NOx_GT", "NOx"])
col_no2 = pick_column(df, ["NO2(GT)", "NO2_GT", "NO2"])
col_c6h6 = pick_column(df, ["C6H6(GT)", "C6H6_GT", "Benzene", "C6H6"])

# Temperature/Humidity in original UCI are often: T and RH
col_t  = pick_column(df, ["T", "Temp", "Temperature", "tempC"])
col_rh = pick_column(df, ["RH", "Humidity", "RelativeHumidity", "humidity"])

# Convert chosen columns to numeric if they exist
use_cols = [c for c in [col_co, col_nox, col_no2, col_c6h6, col_t, col_rh] if c is not None]
for c in use_cols:
    df[c] = pd.to_numeric(df[c], errors="coerce")

# If temp/humidity missing, create reasonable defaults (still works)
if col_t is None:
    df["T"] = 15.0
    col_t = "T"
if col_rh is None:
    df["RH"] = 55.0
    col_rh = "RH"

# For pollutants missing, fill with 0 so AQI proxy still computes
if col_co is None:
    df["CO(GT)"] = 0.0
    col_co = "CO(GT)"
if col_nox is None:
    df["NOx(GT)"] = 0.0
    col_nox = "NOx(GT)"
if col_no2 is None:
    df["NO2(GT)"] = 0.0
    col_no2 = "NO2(GT)"
if col_c6h6 is None:
    df["C6H6(GT)"] = 0.0
    col_c6h6 = "C6H6(GT)"

# Drop rows missing temp/humidity (and any pollutant rows that are NaN)
df = df[[col_co, col_nox, col_no2, col_c6h6, col_t, col_rh]].dropna().copy()

# --- Build an AQI-like exposure score ---
# Not “true AQI”, but a defensible proxy: weighted combination of pollutants.
# We also add a rolling mean exposure (asthma often responds to exposure over time).
df["aqi_raw"] = (
    0.35 * df[col_no2].clip(lower=0) +
    0.35 * df[col_nox].clip(lower=0) +
    0.20 * df[col_co].clip(lower=0) * 10 +  # CO often smaller scale; boost a bit
    0.10 * df[col_c6h6].clip(lower=0) * 10  # benzene smaller scale; boost a bit
)

# Create "recent exposure" features (rolling window)
# If your data is hourly, this is like last ~6 hours.
df = df.reset_index(drop=True)
df["aqi_rolling6"] = df["aqi_raw"].rolling(window=6, min_periods=1).mean()
df["aqi_rolling24"] = df["aqi_raw"].rolling(window=24, min_periods=1).mean()

# Normalize AQI proxy into a 0–200-ish range (for stability)
# (This is just scaling; keeps numbers reasonable for presentation)
p95 = np.percentile(df["aqi_rolling24"], 95)
scale = p95 if p95 > 1e-6 else 1.0
df["aqi"] = (df["aqi_rolling24"] / scale) * 150.0
df["aqi"] = df["aqi"].clip(0, 250)

# Use temp/humidity in app-friendly naming
df["tempC"] = df[col_t]
df["humidity"] = df[col_rh].clip(0, 100)

# --- Simulate wearable vitals in a medically plausible way ---
# Higher pollution → slightly higher HR/RR, slightly lower SpO2.
# Add noise so model isn't “too perfect”.
rng = np.random.default_rng(42)

# Baselines
base_hr = rng.normal(78, 8, len(df))
base_rr = rng.normal(16, 2.5, len(df))
base_spo2 = rng.normal(97.2, 1.0, len(df))

# Effects of pollution + humidity + temperature
pollution_effect = (df["aqi"] / 250.0)  # 0–1
humidity_effect = (df["humidity"] / 100.0)
temp_effect = np.abs(df["tempC"] - 20) / 20.0  # bigger when far from 20C

df["heartRate"] = (base_hr + 10*pollution_effect + 3*humidity_effect + 2*temp_effect).clip(50, 160)
df["respRate"] = (base_rr + 4*pollution_effect + 1.5*humidity_effect).clip(8, 30)
df["spo2"] = (base_spo2 - 2.2*pollution_effect - 1.0*humidity_effect + rng.normal(0, 0.3, len(df))).clip(90, 100)

# --- Generate peak flow (target) ---
# Peak flow falls with pollution & humidity; improves with better SpO2; worsens with higher RR.
# Add a nonlinear “attack-like” penalty when AQI is high.
personal_best = 600.0  # you can treat this as average PB for population training

attack_penalty = np.where(df["aqi"] > 160, (df["aqi"] - 160) * 0.8, 0)  # sharper drop above threshold
humidity_penalty = np.where(df["humidity"] > 70, (df["humidity"] - 70) * 0.6, 0)

df["peakFlow"] = (
    personal_best
    - 0.9 * df["aqi"]                      # main pollution effect
    - 0.35 * df["humidity"]                # humidity effect
    - 8.0 * (df["respRate"] - 16).clip(lower=0)  # fast breathing
    + 18.0 * (df["spo2"] - 95)             # oxygenation helps
    - attack_penalty
    - humidity_penalty
    + rng.normal(0, 18, len(df))           # measurement noise
).clip(150, 650)

# --- Train model to predict peak flow from app inputs ---
X = df[["heartRate", "respRate", "spo2", "tempC", "humidity", "aqi"]]
y = df["peakFlow"]

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

model = Pipeline([
    ("scaler", StandardScaler()),
    ("ridge", Ridge(alpha=2.0))
])

model.fit(X_train, y_train)

pred = model.predict(X_test)
mae = mean_absolute_error(y_test, pred)
r2 = r2_score(y_test, pred)

print("✅ Model trained (Ridge + StandardScaler)")
print("MAE (L/min):", round(mae, 2))
print("R^2:", round(r2, 3))

# Save a bundle so the API can keep feature order consistent
bundle = {
    "model": model,
    "feature_names": ["heartRate", "respRate", "spo2", "tempC", "humidity", "aqi"]
}
joblib.dump(bundle, "peakflow_model.joblib")
print(" Saved model bundle -> peakflow_model.joblib")