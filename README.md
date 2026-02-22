# AirSense

This project was built in 24 hours for the OSU AI Hackathon.

AirSense is a real-time asthma severity monitoring application that predicts peak flow using wearable vitals and environmental data. The system combines machine learning, a Flask API, and a React frontend to deliver live asthma risk classification and historical tracking.

---

## Overview

- Estimates a user's peak flow in liters per minute using health metrics and air quality data
- Converts the prediction into a percentage of the user's personal best
- Classifies asthma severity into Green, Yellow, or Red zones
- Stores previous predictions and visualizes trends over time

---
```mermaid
flowchart LR
    A[Apple Watch Vitals<br/>Heart Rate<br/>Resp Rate<br/>SpO₂] --> C
    B[Weather + AQI<br/>Temperature<br/>Humidity<br/>Air Quality Index] --> C
    C[ML Regression Model<br/>Ridge + StandardScaler<br/>Predict Peak Flow (L/min)] --> D
    D[Risk Engine<br/>% of Personal Best<br/>Green / Yellow / Red Classification<br/>Daily Forecast] --> E
    E[React UI Dashboard<br/>Live Display<br/>Trends<br/>History Tracking]
```
--

## Technology Stack

### Backend
- Python
- Flask (REST API)
- Scikit-learn (Ridge Regression model)
- SQLite (prediction history storage)
- Joblib (model serialization)

### Frontend
- React
- Recharts (data visualization)

---

## Model Details

- Dataset: UCI Air Quality Dataset  
  https://www.kaggle.com/datasets/dakshbhalala/uci-air-quality-dataset/data
- Model Type: Ridge Regression with feature scaling
- Inputs: Heart rate, respiratory rate, SpO₂, temperature, humidity, AQI
- Output: Predicted peak flow (L/min)
- Evaluation Metrics: Mean Absolute Error (MAE) and R² score

---

## Authors

- Preetham Prabhu
- Varun Ramanujam

The Ohio State University

