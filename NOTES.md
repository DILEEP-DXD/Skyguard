# SkyGuard — Project Context & Architecture Notes

## Project Goal
Real-time **hardware sensor anomaly detection** for Automatic Weather Stations (AWS).
- **NOT** a weather forecasting system.
- Detects: voltage spikes, frozen sensors, calibration drift, cross-sensor mismatches.

## Stack
- **Backend**: Python 3.11, FastAPI, SQLAlchemy (SQLite), scikit-learn 1.9, joblib
- **Frontend**: React (Phase 2+)
- **Transport**: WebSocket (real-time streaming)
- **Persistence**: SQLite

## Phase 1 — Completed ✓

### Environment
- venv: `backend/venv/`
- Run with `PYTHONIOENCODING=utf-8` on Windows to avoid cp1252 encoding errors

### Files Created
| File | Purpose |
|------|---------|
| `backend/data_generator.py` | Synthetic AWS data — healthy baseline + fault injection |
| `backend/features.py` | 12-feature rolling window pipeline (batch + streaming) |
| `backend/train_models.py` | Trains all models, saves artifacts, builds analytics snapshot |

### Data
| File | Rows | Notes |
|------|------|-------|
| `data/baseline_healthy.csv` | 5,000 | Day/night cycles, inverse temp-humidity, micro-noise |
| `data/eval_with_faults.csv` | 5,000 | Same + injected SPIKE/FROZEN/DRIFT/MISMATCH faults |

### Models (all in `backend/models/`)
| Artifact | Size | Notes |
|----------|------|-------|
| `scaler.joblib` | 0.9 KB | StandardScaler on 12 features |
| `isolation_forest.joblib` | 2.88 MB | 200 estimators, contamination=0.10 |
| `lof.joblib` | 1.89 MB | novelty=True, n_neighbors=20 |
| `kmeans.joblib` | 20.8 KB | n_clusters=3, init=k-means++ |
| `pca.joblib` | 1.3 KB | n_components=2 (PC1=33%, PC2=17%) |
| `analytics_snapshot.json` | 96.5 KB | 500-point eval snapshot |

### 12 Features (FEATURE_NAMES order)
1. `temperature`         — raw (°C)
2. `pressure`            — raw (hPa)
3. `humidity`            — raw (%)
4. `delta_temp`          — first diff
5. `delta_pressure`      — first diff
6. `delta_humidity`      — first diff
7. `roll_mean_temp`      — window=10 mean
8. `roll_mean_pressure`  — window=10 mean
9. `roll_mean_humidity`  — window=10 mean
10. `roll_std_temp`      — window=10 std  ← flatline → 0.0
11. `roll_std_pressure`  — window=10 std  ← flatline → 0.0
12. `roll_std_humidity`  — window=10 std  ← flatline → 0.0

### Detection Performance (500-pt sample)
| Fault Type | IF Recall | LOF Recall | DBSCAN Recall |
|------------|-----------|------------|---------------|
| FROZEN_SENSOR | 0.658 | 0.895 | 1.000 |
| DRIFT_FAULT | 0.875 | 0.961 | 1.000 |
| CROSS_SENSOR_MISMATCH | 0.988 | 0.994 | 1.000 |

> DBSCAN achieves perfect recall at cost of more false positives (fp=41).

## Decisions
- `PYTHONIOENCODING=utf-8` needed for Windows terminal (cp1252 default)
- `max_iter` (not `n_iter`) in TSNE for scikit-learn >= 1.4
- Fault injection can produce overlapping windows → high faulty-row percentage is expected
- `StreamingFeatureExtractor` in `features.py` is the real-time path for WebSocket ingestion

## Next: Phase 2 & 3 Completed ✓

### Phase 2 — Real-Time Streaming & Persistence
- **FastAPI Backend**: `backend/main.py`, `backend/pipeline.py`, `backend/database.py`.
- **Endpoints**:
  - `GET /api/status`, `GET /api/pipeline/status`
  - `POST /api/pipeline/start`, `POST /api/pipeline/stop`, `POST /api/pipeline/reset`
  - `GET /api/telemetry/recent`, `GET /api/alerts`, `POST /api/alerts/{id}/ack`
  - `GET /api/analytics` (unified baseline & model diagnostics)
  - `POST /api/inject-fault` (SPIKE_FAULT, FROZEN_SENSOR, DRIFT_FAULT, CROSS_SENSOR_MISMATCH)
  - `WS /ws/stream` (real-time telemetry and instant alert broadcasting)
- **Database**: SQLite (`skyguard.db`) with `SensorReading` and `Alert` models.

### Phase 3 — UI Restyling & Simplification
- **Design System**:
  - Quiet, content-first aesthetic inspired by Linear / Vercel / Stripe dashboards.
  - Light mode `#FAFAFA` by default with dark mode `#0F0F10`, neutral borders (`#E5E5E5` / `#262626`).
  - System preference detection with `localStorage` persistence.
  - Single accent blue (`#2563EB` / `#3B82F6`), status colors (green/amber/red) reserved strictly for dots and text.
  - No neon glow, sci-fi borders, or gradients.
  - Typography: Inter with `tabular-nums` for numeric telemetry; sentence case everywhere.
- **App Shell**:
  - Sidebar: "SkyGuard" branding only, sentence case navigation ("Overview", "Sensors", "Alerts", "Model performance", "Fault simulator", "Settings", plus "Advanced" -> "Experiments").
  - Top Bar: Station selector, single live status line (`● Live · updated 2s ago`), outlined secondary Pause/Resume button, and theme toggle.
- **Overview Page**:
  - Single plain-language status line: `"All 3 sensors are normal · 0 open alerts"`.
  - 3 clean sensor cards in a row (Temperature, Pressure, Humidity) with live area charts.
  - 2-column bottom layout: "Recent alerts" (with empty state) and "Model health" (Silhouette, Davies-Bouldin, Inertia with 1-line explanations). Fits 1080p without scrolling.
- **Sensors (Telemetry)**:
  - Stacked cards with live flat area charts.
  - Fixed Y-axis clipping with `margin.left = 10` and `width = 56`.
  - Clamped minimum visual span (Temp: 3°C, Pressure: 8 hPa, Humidity: 12%) so ADC micro-noise does not look like huge spikes.
  - Renamed labels to "Change per reading" and "Variability" with `(?)` tooltips.
- **Model Performance**:
  - Unified metrics with Overview from `/api/analytics` single source of truth.
  - Sentence case segmented controls for PCA / t-SNE scatter plots.
  - Neutral green/red scatter dots without glow.
  - Detection matrix with `tabular-nums`, bolded best values, and readable fault names.
- **Alerts & Fault Simulator**:
  - Alerts: Clean table with segmented controls ("All", "Unresolved", "Critical") and friendly empty state.
  - Fault Simulator: 4 plain cards ("Spike", "Frozen sensor", "Drift", "Sensor mismatch") with duration secondary text and "Run" button.
- **Settings**:
  - Clean preferences card for audio notification toggle, latency/freshness statistics, database row counts, and session reset.


