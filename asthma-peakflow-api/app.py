from flask import Flask, request, jsonify
from flask_cors import CORS
import joblib
import numpy as np
import sqlite3
from datetime import datetime


# Config
# -----------------------------
DB_PATH = "history.db"
MODEL_PATH = "peakflow_model.joblib"


# setup for py
# -----------------------------
def init_db():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS predictions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ts TEXT NOT NULL,
            predictedPeakFlow REAL NOT NULL,
            peakFlowPercent REAL NOT NULL,
            zone TEXT NOT NULL
        )
    """)
    conn.commit()
    conn.close()

init_db()


# App making
# -----------------------------
app = Flask(__name__)
CORS(app)  # for local dev for starting demo


# Load model bundle exporteddd
# -----------------------------
bundle = joblib.load(MODEL_PATH)
model = bundle["model"]
FEATURES = bundle["feature_names"]


# -----------------------------
@app.get("/")
def home():
    return "Asthma Peak Flow API running "

@app.post("/predict")
def predict():
    data = request.get_json(force=True)

    required = ["heartRate", "respRate", "spo2", "tempC", "humidity", "aqi", "personalBestPeakFlow"]
    missing = [k for k in required if k not in data]
    if missing:
        return jsonify({"error": f"Missing fields: {missing}"}), 400

    # Building array in the exact order the model expects
    try:
        x = np.array([[float(data[f]) for f in FEATURES]])
    except Exception as e:
        return jsonify({"error": f"Bad input types. Make sure inputs are numbers. Details: {e}"}), 400

    # Predict
    pred_peakflow = float(model.predict(x)[0])
    personal_best = float(data["personalBestPeakFlow"])

    # Avoid divide-by-zero
    if personal_best <= 0:
        return jsonify({"error": "personalBestPeakFlow must be > 0"}), 400

    percent = (pred_peakflow / personal_best) * 100.0
    percent = max(0.0, min(percent, 150.0))

    #  logic
    if percent >= 80:
        zone = "green"
        message = "You can breathe easy!"
    elif percent >= 50:
        zone = "yellow"
        message = "You may be at moderate risk of an asthma attack"
    else:
        zone = "red"
        message = "High risk—follow your action plan"

    # 
    pred_peakflow_rounded = round(pred_peakflow, 1)
    percent_rounded = round(percent, 1)

    # Save to historyy
    try:
        conn = sqlite3.connect(DB_PATH)
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO predictions (ts, predictedPeakFlow, peakFlowPercent, zone)
            VALUES (?, ?, ?, ?)
        """, (
            datetime.utcnow().isoformat(),
            pred_peakflow_rounded,
            percent_rounded,
            zone
        ))
        conn.commit()
        conn.close()
    except Exception as e:
        # Even still return prediction 
        return jsonify({
            "predictedPeakFlow": pred_peakflow_rounded,
            "peakFlowPercent": percent_rounded,
            "zone": zone,
            "message": message,
            "warning": f"Prediction saved failed: {e}"
        })

    return jsonify({
        "predictedPeakFlow": pred_peakflow_rounded,
        "peakFlowPercent": percent_rounded,
        "zone": zone,
        "message": message
    })

@app.get("/history")
def history():
    """
    Returns most recent predictions.
    Example: /history?limit=50
    """
    limit = request.args.get("limit", default=50, type=int)
    limit = max(1, min(limit, 500))  

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    cur.execute("""
        SELECT ts, predictedPeakFlow, peakFlowPercent, zone
        FROM predictions
        ORDER BY id DESC
        LIMIT ?
    """, (limit,))
    rows = cur.fetchall()
    conn.close()

    # Return as list 
    return jsonify([dict(r) for r in rows])

# run

if __name__ == "__main__":
    ##run on my device
       app.run(debug=True, port=5001)