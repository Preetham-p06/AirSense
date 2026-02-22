// peakflow-ui/src/App.jsx
import { useEffect, useMemo, useState } from "react";
import "./App.css";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

const API_BASE = "http://127.0.0.1:5001";

// quick fallback location (Columbus-ish) so demo still works 
const FALLBACK_LAT = 39.9612;
const FALLBACK_LON = -82.9988;

function ZonePill({ zone }) {
  const label =
    zone === "green" ? "Green Zone" : zone === "yellow" ? "Yellow Zone" : "Red Zone";
  return <div className={`pill pill-${zone}`}>{label}</div>;
}

// icons 
function IconHome({ active }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" className={`navIcon ${active ? "active" : ""}`}>
      <path
        d="M3 10.5 12 3l9 7.5V21a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1V10.5Z"
        fill="currentColor"
      />
    </svg>
  );
}

function IconTrends({ active }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" className={`navIcon ${active ? "active" : ""}`}>
      <path
        d="M4 19h16v2H3a1 1 0 0 1-1-1V4h2v15Zm3-2 4-6 3 4 4-8 2 1-6 12-3-4-3 5H7Z"
        fill="currentColor"
      />
    </svg>
  );
}

function IconFamily({ active }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" className={`navIcon ${active ? "active" : ""}`}>
      <path
        d="M7.5 11a3 3 0 1 0-3-3 3 3 0 0 0 3 3Zm9 0a3 3 0 1 0-3-3 3 3 0 0 0 3 3ZM3 20a4.5 4.5 0 0 1 9 0v1H3v-1Zm9-2.2A5.8 5.8 0 0 1 20.5 21H13v-1a6.3 6.3 0 0 0-1-2.2Z"
        fill="currentColor"
      />
    </svg>
  );
}

function IconInfo({ active }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" className={`navIcon ${active ? "active" : ""}`}>
      <path
        d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Zm1 15h-2V11h2Zm0-8h-2V7h2Z"
        fill="currentColor"
      />
    </svg>
  );
}

// little calenda
function IconDay({ active }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" className={`navIcon ${active ? "active" : ""}`}>
      <path
        d="M7 2h2v2h6V2h2v2h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2V2Zm14 8H3v10a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V10Zm-1-4H4a1 1 0 0 0-1 1v1h18V7a1 1 0 0 0-1-1Zm-9 7h2v5h-2v-5Z"
        fill="currentColor"
      />
    </svg>
  );
}

function Lungs({ zone }) {
  const fill =
    zone === "green" ? "#2ecc71" : zone === "yellow" ? "#f1c40f" : zone === "red" ? "#e74c3c" : "#95a5a6";

  return (
    <svg className="lungs" viewBox="0 0 220 180" aria-hidden="true">
      <path d="M110 30v120" stroke="#1f2a36" strokeWidth="10" strokeLinecap="round" opacity="0.35" />
      <path
        d="M95 48c-12 8-25 25-31 46-8 30-2 70 24 76 12 3 22-3 27-14 5-12 6-27 6-42V48c0-9-9-6-26 0Z"
        fill={fill}
        stroke="#1f2a36"
        strokeWidth="10"
        strokeLinejoin="round"
      />
      <path
        d="M125 48c12 8 25 25 31 46 8 30 2 70-24 76-12 3-22-3-27-14-5-12-6-27-6-42V48c0-9 9-6 26 0Z"
        fill={fill}
        stroke="#1f2a36"
        strokeWidth="10"
        strokeLinejoin="round"
      />
      <path d="M84 96c-6 8-9 16-10 24" stroke="#1f2a36" strokeWidth="7" strokeLinecap="round" opacity="0.35" />
      <path d="M136 96c6 8 9 16 10 24" stroke="#1f2a36" strokeWidth="7" strokeLinecap="round" opacity="0.35" />
    </svg>
  );
}

// hoose the “worst” zone in a group
function worstZone(zones) {
  if (zones.includes("red")) return "red";
  if (zones.includes("yellow")) return "yellow";
  return "green";
}

// convert hour to friendly label
function hourLabel(h) {
  const ampm = h >= 12 ? "PM" : "AM";
  const hour12 = ((h + 11) % 12) + 1;
  return `${hour12} ${ampm}`;
}

// build a  “daily AQI curve” 
function makeFakeAqiCurve(seedBase = 120) {
  // 24 hourly values
  const out = [];
  const base = seedBase;

  for (let h = 0; h < 24; h++) {
    //  pattern: lower at night, higher in morning rush + evening
    const morningBump = Math.exp(-Math.pow((h - 8) / 3.0, 2)) * 70;
    const eveningBump = Math.exp(-Math.pow((h - 18) / 3.2, 2)) * 55;

    // 
    const wiggle = (Math.random() * 2 - 1) * 18;

    //  “bad air” hour
    const spike = Math.random() < 0.08 ? 80 + Math.random() * 90 : 0;

    let aqi = base + morningBump + eveningBump + wiggle + spike;

   
    aqi = Math.max(0, Math.min(300, aqi));
    out.push(Math.round(aqi));
  }

  return out;
}

// fetch hourly weather using Open-Meteo
async function fetchHourlyWeather(lat, lon) {
  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${lat}&longitude=${lon}` +
    `&hourly=temperature_2m,relative_humidity_2m` +
    `&forecast_days=1` +
    `&timezone=auto`;

  const res = await fetch(url);
  const json = await res.json();

  // safe parsing
  const times = json?.hourly?.time ?? [];
  const temps = json?.hourly?.temperature_2m ?? [];
  const hums = json?.hourly?.relative_humidity_2m ?? [];

  // build array of 24 hours 
  const rows = [];
  for (let i = 0; i < Math.min(24, times.length); i++) {
    rows.push({
      hour: new Date(times[i]).getHours(),
      tempC: Number(temps[i]),
      humidity: Number(hums[i]),
    });
  }

  // sort by hour 
  rows.sort((a, b) => a.hour - b.hour);
  return rows;
}

export default function App() {
  const [tab, setTab] = useState("home"); // home | day | trends | family | info
  const [data, setData] = useState(null);
  const [history, setHistory] = useState([]);
  const [manual, setManual] = useState(false);

  // demo inputs (watch + weather)
  const [inputs, setInputs] = useState({
    heartRate: 85,
    respRate: 18,
    spo2: 96,
    tempC: 10,
    humidity: 70,
    aqi: 110,
    personalBestPeakFlow: 600,
  });

  // Day Forecast state
  const [dayLoading, setDayLoading] = useState(false);
  const [dayError, setDayError] = useState("");
  const [dayRows, setDayRows] = useState([]); 
  const [dayAqiCurve, setDayAqiCurve] = useState([]); 

  const zone = data?.zone ?? "green";
  const percent = data?.peakFlowPercent ?? null;
  const predicted = data?.predictedPeakFlow ?? null;

  const bgClass = zone === "green" ? "bg-green" : zone === "yellow" ? "bg-yellow" : "bg-red";
  const lastUpdated = useMemo(() => new Date(), [data]);

  // call /predict (Flask)
  const fetchPrediction = async (payload) => {
    const res = await fetch(`${API_BASE}/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    setData(json);
  };

  // call /history
  const fetchHistory = async () => {
    const res = await fetch(`${API_BASE}/history?limit=60`);
    const json = await res.json();
    setHistory(json);
  };

  // auto refresh 
  useEffect(() => {
    const tick = async () => {
      const drift = (val, amt, min, max) =>
        Math.max(min, Math.min(max, val + (Math.random() * 2 - 1) * amt));

      const simulated = {
        ...inputs,
        heartRate: drift(inputs.heartRate, 10, 55, 160),
        respRate: drift(inputs.respRate, 3, 10, 40),
        spo2: drift(inputs.spo2, 2, 88, 100),
        aqi: drift(inputs.aqi, 35, 0, 300),
        humidity: drift(inputs.humidity, 10, 5, 100),
        tempC: drift(inputs.tempC, 2, -10, 40),
      };

      // only auto-update when manual is OFF
      if (!manual) {
        setInputs(simulated);
        await fetchPrediction(simulated);
        await fetchHistory();
      }
    };

    tick();
    const id = setInterval(tick, 4000);
    return () => clearInterval(id);

    
  }, [manual]);

  // manual mode: sliders call predict 
  useEffect(() => {
    if (!manual) return;
    const run = async () => {
      await fetchPrediction(inputs);
      await fetchHistory();
    };
    run();

   
  }, [manual, inputs]);

  // Trends chart data 
  const chartData = useMemo(() => {
    const reversed = [...history].reverse();
    return reversed.map((r) => ({
      ts: r.ts,
      peakFlowPercent: r.peakFlowPercent,
    }));
  }, [history]);

  // Day Forecast chart data
  const dayChart = useMemo(() => {
    return dayRows.map((r) => ({
      h: r.hour,
      label: hourLabel(r.hour),
      peakFlowPercent: r.peakFlowPercent,
      aqi: r.aqi,
    }));
  }, [dayRows]);

  // summary for Day page 
  const daySummary = useMemo(() => {
    if (!dayRows.length) return null;

    const worst = [...dayRows].sort((a, b) => a.peakFlowPercent - b.peakFlowPercent)[0];
    const worstMsg =
      worst.zone === "red"
        ? "Highest risk today. Keep inhaler close and follow your plan."
        : worst.zone === "yellow"
        ? "Some risk today. Keep inhaler nearby during the risky hours."
        : "Low risk today. Still keep your inhaler like normal.";

    return { worst, worstMsg };
  }, [dayRows]);

  // Build the Day Forecast when you open that tab 
  useEffect(() => {
    if (tab !== "day") return;

    const buildDay = async () => {
      setDayError("");
      setDayLoading(true);

      try {
        // 1) get user location 
        const pos = await new Promise((resolve) => {
          if (!navigator.geolocation) return resolve(null);

          navigator.geolocation.getCurrentPosition(
            (p) => resolve(p),
            () => resolve(null),
            { enableHighAccuracy: false, timeout: 4000 }
          );
        });

        const lat = pos?.coords?.latitude ?? FALLBACK_LAT;
        const lon = pos?.coords?.longitude ?? FALLBACK_LON;

        // 2) fetch hourly weather (temp + humidity)
        const weatherRows = await fetchHourlyWeather(lat, lon);

    
        const padded = [...weatherRows];
        while (padded.length < 24) {
          padded.push({
            hour: padded.length,
            tempC: inputs.tempC,
            humidity: inputs.humidity,
          });
        }

        // 3) generate hourly AQI curve replace after demo
        const curve = makeFakeAqiCurve(Math.round(inputs.aqi));
        setDayAqiCurve(curve);

   
        const baseHR = inputs.heartRate;
        const baseRR = inputs.respRate;
        const baseSp = inputs.spo2;

        // build prediction calls
        const calls = padded.slice(0, 24).map(async (w, idx) => {
          const hour = w.hour;
          const aqi = curve[idx];

          // time of day
          const hr = Math.max(50, Math.min(160, baseHR + (Math.random() * 2 - 1) * 3 + (aqi > 180 ? 4 : 0)));
          const rr = Math.max(10, Math.min(40, baseRR + (Math.random() * 2 - 1) * 1.2 + (aqi > 180 ? 1 : 0)));
          const sp = Math.max(88, Math.min(100, baseSp + (Math.random() * 2 - 1) * 0.5 - (aqi > 200 ? 0.8 : 0)));

          const payload = {
            heartRate: hr,
            respRate: rr,
            spo2: sp,
            tempC: w.tempC,
            humidity: w.humidity,
            aqi,
            personalBestPeakFlow: inputs.personalBestPeakFlow,
          };

          const res = await fetch(`${API_BASE}/predict`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          const json = await res.json();

          return {
            hour,
            tempC: w.tempC,
            humidity: w.humidity,
            aqi,
            zone: json.zone,
            peakFlowPercent: Number(json.peakFlowPercent),
            predictedPeakFlow: Number(json.predictedPeakFlow),
          };
        });

        // do all 24 in parallel 
        const results = await Promise.all(calls);

        // sort by hour so it displays
        results.sort((a, b) => a.hour - b.hour);
        setDayRows(results);
      } catch (e) {
        setDayError(`Day forecast failed: ${String(e)}`);
      } finally {
        setDayLoading(false);
      }
    };

    buildDay();

  }, [tab, inputs.personalBestPeakFlow]);

  // display values for Home page
  const displayPercent = percent == null ? "--" : Math.round(percent);
  const displayPred = predicted == null ? "--" : predicted.toFixed(0);

  // group hours into blocks with inhaler recommendations
  const dayBlocks = useMemo(() => {
    if (!dayRows.length) return [];

    const blocks = [
      { name: "Overnight", start: 0, end: 5 },
      { name: "Morning", start: 6, end: 11 },
      { name: "Afternoon", start: 12, end: 17 },
      { name: "Evening", start: 18, end: 23 },
    ];

    return blocks.map((b) => {
      const rows = dayRows.filter((r) => r.hour >= b.start && r.hour <= b.end);
      const z = worstZone(rows.map((r) => r.zone));

      const rec =
        z === "red"
          ? "High risk — keep inhaler close, avoid triggers if possible."
          : z === "yellow"
          ? "Moderate risk — keep inhaler close during this block."
          : "Low risk — normal routine.";

      const avgTemp = rows.reduce((s, r) => s + r.tempC, 0) / Math.max(1, rows.length);
      const avgHum = rows.reduce((s, r) => s + r.humidity, 0) / Math.max(1, rows.length);
      const avgAqi = rows.reduce((s, r) => s + r.aqi, 0) / Math.max(1, rows.length);

      return {
        ...b,
        zone: z,
        rec,
        avgTemp: Math.round(avgTemp),
        avgHum: Math.round(avgHum),
        avgAqi: Math.round(avgAqi),
      };
    });
  }, [dayRows]);

  return (
    <div className="outer">
      <div className={`phone ${bgClass}`}>
        {/* top fake phone bar */}
        <div className="statusBar">
          <div className="time">
            {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </div>
          <div className="pillGroup">
            {data?.zone ? <ZonePill zone={data.zone} /> : <div className="pill pill-gray">Loading…</div>}
          </div>
        </div>

        {/* main content area */}
        <div className="content">
          {tab === "home" && (
            <div className="screen">
              <div className="titleWrap">
                <h1 className="title">Peak Flow</h1>
                <div className="subtitle">
                  {predicted != null ? (
                    <>
                      Predicted: <span className="mono">{displayPred}</span> L/min • Best:{" "}
                      <span className="mono">{inputs.personalBestPeakFlow}</span>
                    </>
                  ) : (
                    "Connecting to model…"
                  )}
                </div>
              </div>

              <div className="hero">
                <Lungs zone={zone} />
                <div className="percent">{displayPercent}%</div>
                <div className="percentSub">of predicted maximum peak flow value</div>
                <div className={`message message-${zone}`}>{data?.message ?? "..."}</div>
                <div className="updated">
                  Updated{" "}
                  {lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                </div>
              </div>

              <div className="controlsCard">
                <div className="row">
                  <div>
                    <div className="label">Demo mode</div>
                    <div className="hint">Toggle manual sliders vs live drifting inputs</div>
                  </div>
                  <button className={`toggle ${manual ? "on" : ""}`} onClick={() => setManual((v) => !v)}>
                    <div className="knob" />
                  </button>
                </div>

                {manual && (
                  <div className="sliders">
                    <Slider
                      label="Heart Rate"
                      value={inputs.heartRate}
                      min={50}
                      max={160}
                      step={1}
                      unit="bpm"
                      onChange={(v) => setInputs((p) => ({ ...p, heartRate: v }))}
                    />
                    <Slider
                      label="Resp Rate"
                      value={inputs.respRate}
                      min={10}
                      max={40}
                      step={1}
                      unit="/min"
                      onChange={(v) => setInputs((p) => ({ ...p, respRate: v }))}
                    />
                    <Slider
                      label="SpO₂"
                      value={inputs.spo2}
                      min={88}
                      max={100}
                      step={1}
                      unit="%"
                      onChange={(v) => setInputs((p) => ({ ...p, spo2: v }))}
                    />
                    <Slider
                      label="AQI"
                      value={inputs.aqi}
                      min={0}
                      max={300}
                      step={1}
                      unit=""
                      onChange={(v) => setInputs((p) => ({ ...p, aqi: v }))}
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === "day" && (
            <div className="screen">
              <div className="titleWrap">
                <h1 className="title">Day Plan</h1>
                <div className="subtitle">Hourly prediction + weather blocks (demo)</div>
              </div>

              <div className="card">
                <div className="cardTitle">Today</div>
                <div className="cardBody">
                  {dayLoading ? "Building your daily forecast…" : daySummary ? daySummary.worstMsg : "Open the tab to load forecast."}
                </div>

                <div className="ctaRow">
                  <button className="primaryBtn" onClick={() => setTab("day")}>
                    Refresh
                  </button>
                </div>

                {dayError && <div className="hint" style={{ marginTop: 10 }}>{dayError}</div>}
              </div>

              <div className="chartCard">
                <div className="listHeader">Peak flow % through the day</div>
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={dayChart}>
                    <XAxis dataKey="label" hide />
                    <YAxis domain={[0, 120]} tick={{ fill: "rgba(255,255,255,0.75)" }} />
                    <Tooltip
                      contentStyle={{
                        background: "rgba(20,25,30,0.95)",
                        border: "1px solid rgba(255,255,255,0.15)",
                        borderRadius: 12,
                        color: "white",
                      }}
                      labelFormatter={(lbl) => lbl}
                      formatter={(v, name, ctx) => {
                        const row = ctx?.payload;
                        return [`${Math.round(v)}%  (AQI ${row?.aqi})`, "Peak Flow %"];
                      }}
                    />
                    <ReferenceLine y={80} stroke="rgba(255,255,255,0.35)" strokeDasharray="6 6" />
                    <ReferenceLine y={50} stroke="rgba(255,255,255,0.35)" strokeDasharray="6 6" />
                    <Line type="monotone" dataKey="peakFlowPercent" stroke="white" strokeWidth={3} dot={false} />
                  </LineChart>
                </ResponsiveContainer>

                <div className="zonesLegend">
                  <div className="legendItem">
                    <span className="dot dot-green" /> ≥80% Green
                  </div>
                  <div className="legendItem">
                    <span className="dot dot-yellow" /> 50–79% Yellow
                  </div>
                  <div className="legendItem">
                    <span className="dot dot-red" /> &lt;50% Red
                  </div>
                </div>
              </div>

              <div className="listCard">
                <div className="listHeader">Time blocks (inhaler guidance)</div>
                <div className="list">
                  {dayBlocks.map((b, i) => (
                    <div key={i} className="listRow">
                      <div className={`badge badge-${b.zone}`}>{b.zone}</div>
                      <div className="listMain">
                        <div className="listPct">{b.name}</div>
                        <div className="listTs">
                          {hourLabel(b.start)} – {hourLabel(b.end)} • {b.avgTemp}°C • {b.avgHum}% • AQI {b.avgAqi}
                        </div>
                      </div>
                      <div className="listPred" style={{ textAlign: "right" }}>
                        {b.rec}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="listCard">
                <div className="listHeader">Hourly details (first 12 shown)</div>
                <div className="list">
                  {dayRows.slice(0, 12).map((h, i) => (
                    <div key={i} className="listRow">
                      <div className={`badge badge-${h.zone}`}>{h.zone}</div>
                      <div className="listMain">
                        <div className="listPct">{hourLabel(h.hour)}</div>
                        <div className="listTs">
                          {Math.round(h.peakFlowPercent)}% • {Math.round(h.predictedPeakFlow)} L/min
                        </div>
                      </div>
                      <div className="listPred">
                        {Math.round(h.tempC)}°C • {Math.round(h.humidity)}% • AQI {h.aqi}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab === "trends" && (
            <div className="screen">
              <div className="titleWrap">
                <h1 className="title">Trends</h1>
                <div className="subtitle">Recent peak flow % history (last 60)</div>
              </div>

              <div className="chartCard">
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={chartData}>
                    <XAxis dataKey="ts" hide />
                    <YAxis domain={[0, 120]} tick={{ fill: "rgba(255,255,255,0.75)" }} />
                    <Tooltip
                      contentStyle={{
                        background: "rgba(20,25,30,0.95)",
                        border: "1px solid rgba(255,255,255,0.15)",
                        borderRadius: 12,
                        color: "white",
                      }}
                      labelFormatter={() => ""}
                      formatter={(v) => [`${Math.round(v)}%`, "Peak Flow %"]}
                    />
                    <ReferenceLine y={80} stroke="rgba(255,255,255,0.35)" strokeDasharray="6 6" />
                    <ReferenceLine y={50} stroke="rgba(255,255,255,0.35)" strokeDasharray="6 6" />
                    <Line type="monotone" dataKey="peakFlowPercent" stroke="white" strokeWidth={3} dot={false} />
                  </LineChart>
                </ResponsiveContainer>

                <div className="zonesLegend">
                  <div className="legendItem">
                    <span className="dot dot-green" /> ≥80% Green
                  </div>
                  <div className="legendItem">
                    <span className="dot dot-yellow" /> 50–79% Yellow
                  </div>
                  <div className="legendItem">
                    <span className="dot dot-red" /> &lt;50% Red
                  </div>
                </div>
              </div>

              <div className="listCard">
                <div className="listHeader">Latest</div>
                <div className="list">
                  {history.slice(0, 10).map((h, i) => (
                    <div key={i} className="listRow">
                      <div className={`badge badge-${h.zone}`}>{h.zone}</div>
                      <div className="listMain">
                        <div className="listPct">{Math.round(h.peakFlowPercent)}%</div>
                        <div className="listTs">{h.ts.replace("T", " ").slice(0, 19)}</div>
                      </div>
                      <div className="listPred">{h.predictedPeakFlow.toFixed(0)} L/min</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab === "family" && (
            <div className="screen">
              <div className="titleWrap">
                <h1 className="title">Family</h1>
                <div className="subtitle">Demo placeholder (share view)</div>
              </div>

              <div className="card">
                <div className="cardTitle">Share your status</div>
                <div className="cardBody">
                  In a real app, you’d add family members and share alerts when your zone turns yellow/red.
                </div>
                <div className="ctaRow">
                  <button className="primaryBtn" onClick={() => alert("Demo: would invite family")}>
                    + Invite family member
                  </button>
                </div>
              </div>
            </div>
          )}

          {tab === "info" && (
            <div className="screen">
              <div className="titleWrap">
                <h1 className="title">Info</h1>
                <div className="subtitle">How this demo works</div>
              </div>

              <div className="card">
                <div className="cardTitle">Pipeline</div>
                <ul className="bullets">
                  <li>Inputs (watch + weather): HR, RR, SpO₂, temp, humidity, AQI</li>
                  <li>Flask API sends inputs to a trained scikit-learn model</li>
                  <li>Model predicts peak flow (L/min), converted to % of personal best</li>
                  <li>Zone logic: Green ≥80, Yellow 50–79, Red &lt;50</li>
                  <li>Each prediction is stored; Trends reads from /history</li>
                  <li>Day Plan uses real hourly weather + demo hourly AQI curve</li>
                </ul>
              </div>

              <div className="card">
                <div className="cardTitle">Safety note</div>
                <div className="cardBody">
                  This is a demo for educational purposes, not a medical device. Always follow your asthma action plan and
                  consult a clinician for medical guidance.
                </div>
              </div>
            </div>
          )}
        </div>

        {/* bottom nav */}
        <div className="nav">
          <button className={`navBtn ${tab === "home" ? "active" : ""}`} onClick={() => setTab("home")}>
            <IconHome active={tab === "home"} />
            <div>Home</div>
          </button>

          <button className={`navBtn ${tab === "day" ? "active" : ""}`} onClick={() => setTab("day")}>
            <IconDay active={tab === "day"} />
            <div>Day</div>
          </button>

          <button className={`navBtn ${tab === "trends" ? "active" : ""}`} onClick={() => setTab("trends")}>
            <IconTrends active={tab === "trends"} />
            <div>Trends</div>
          </button>

          <button className={`navBtn ${tab === "family" ? "active" : ""}`} onClick={() => setTab("family")}>
            <IconFamily active={tab === "family"} />
            <div>Family</div>
          </button>

          <button className={`navBtn ${tab === "info" ? "active" : ""}`} onClick={() => setTab("info")}>
            <IconInfo active={tab === "info"} />
            <div>Info</div>
          </button>
        </div>
      </div>
    </div>
  );
}

function Slider({ label, value, min, max, step, unit, onChange }) {
  return (
    <div className="sliderRow">
      <div className="sliderTop">
        <div className="sliderLabel">{label}</div>
        <div className="sliderValue">
          <span className="mono">{Math.round(value)}</span> {unit}
        </div>
      </div>

      <input
        className="slider"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}