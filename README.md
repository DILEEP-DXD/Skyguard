# SkyGuard: Unsupervised Real-Time Sensor Degradation & Anomaly Intelligence

SkyGuard is an unsupervised machine learning and industrial telemetry observability platform designed to monitor Automatic Weather Stations (AWS) and detect hardware sensor degradation in real time.

Built for **INT 396 – Unsupervised Learning**, SkyGuard focuses strictly on hardware degradation detection, sensor fault diagnostics, and unsupervised regime discovery—**not** weather forecasting.

---

## 1. System Architecture

```
                                  [ Open-Meteo AWS REST API ]
                                               │
                                               ▼
                              [ Live Pipeline Polling Loop ]
                                (Automatic Fallback & Noise)
                                               │
                                 ┌─────────────┴─────────────┐
                                 ▼                           ▼
                     [ Controlled Fault Injector ]   [ Feature Extractor ]
                       - SPIKE_FAULT                   - 12D Sliding Window
                       - FROZEN_SENSOR                 - ddof=1 Exact Parity
                       - DRIFT_FAULT                   - StandardScaler
                       - CROSS_SENSOR_MISMATCH         - Non-finite Resilience
                                 │                           │
                                 └─────────────┬─────────────┘
                                               ▼
                                 [ Dual Anomaly Detectors ]
                                   ├─ Isolation Forest (iForest)
                                   └─ Local Outlier Factor (LOF Novelty)
                                               │
                                               ▼
                                 [ Sigmoidal Normalization ]
                                 [ S_ensemble = max(S_if, S_lof) ]
                                               │
                                 ┌─────────────┴─────────────┐
                                 ▼                           ▼
                     [ MiniBatch K-Means ]           [ SQLite Database ]
                     (3 Diurnal Regimes)             (Readings & Alerts)
                                 │                           │
                                 └─────────────┬─────────────┘
                                               ▼
                                  [ FastAPI + WebSocket Hub ]
                                  (Port 8000 REST + WSS Stream)
                                               │
                                               ▼
                         [ Industrial Mission-Control Frontend ]
                          (React 19 + Tailwind CSS + Lucide Icons)
                          - Overview Dashboard
                          - Real-Time Telemetry Console
                          - 2D PCA Diagnostics Console
                          - Experiment Studio (6 ML Labs)
                          - Incident Command Register
                          - Hardware Fault Simulator
                          - System Settings & Calibration
```

---

## 2. Unsupervised Machine Learning Pipeline

### 2.1 The 12-Dimensional Temporal Feature Vector
To detect temporal anomalies such as frozen transducers (stiction) and subtle calibration drift, SkyGuard extracts a verified 12-dimensional sliding window vector ($W=10$ observations):

| Index | Feature Name | Mathematical Description | Diagnostic Significance |
|---|---|---|---|
| 0 | `temperature` | Raw instantaneous ambient temperature (°C) | Direct reading baseline |
| 1 | `pressure` | Raw atmospheric surface pressure (hPa) | Direct reading baseline |
| 2 | `humidity` | Raw relative humidity (%) | Direct reading baseline |
| 3 | `delta_temp` | $x_t - x_{t-1}$ (First-order difference) | Spikes produce large $\Delta$, frozen produces $\Delta=0$ |
| 4 | `delta_pressure` | $x_t - x_{t-1}$ (First-order difference) | Rapid pressure shocks |
| 5 | `delta_humidity` | $x_t - x_{t-1}$ (First-order difference) | Rapid humidity shifts |
| 6 | `roll_mean_temp` | $\frac{1}{W} \sum_{i=0}^{W-1} x_{t-i}$ | Rolling trend level |
| 7 | `roll_mean_pressure` | $\frac{1}{W} \sum_{i=0}^{W-1} x_{t-i}$ | Rolling barometric trend |
| 8 | `roll_mean_humidity` | $\frac{1}{W} \sum_{i=0}^{W-1} x_{t-i}$ | Rolling moisture trend |
| 9 | `roll_std_temp` | $\sqrt{\frac{1}{W-1}\sum (x_i - \bar{x})^2}$ (`ddof=1`) | **Frozen sensor detection**: drops to 0.000 |
| 10 | `roll_std_pressure`| $\sqrt{\frac{1}{W-1}\sum (x_i - \bar{x})^2}$ (`ddof=1`) | Detects pressure transducer lockup |
| 11 | `roll_std_humidity`| $\sqrt{\frac{1}{W-1}\sum (x_i - \bar{x})^2}$ (`ddof=1`) | Detects humidity sensor stiction |

> **Numerical Parity Verified**: Both offline batch training and real-time streaming feature extraction employ unbiased sample variance (`ddof=1`), maintaining identical numerical precision ($<10^{-10}$ deviation).

### 2.2 Anomaly Detectors & Ensemble Decision
1. **Isolation Forest**: Subsamples points and recursively isolates features via random splits. Tree depth serves as an isolation metric ($n\_estimators=100$, $contamination=0.05$).
2. **Local Outlier Factor (LOF with Novelty Detection)**: Measures local reachability density against $k=20$ nearest neighbors to detect density-based degradation.
3. **Calibrated Score Fusion**: Raw scores are mapped to $[0, 1]$ using a calibrated sigmoid function:
   $$S_{\text{ensemble}} = \max\left(S_{\text{IF}}, S_{\text{LOF}}\right)$$
   An alert is triggered when $S_{\text{ensemble}} \ge 0.85$.

### 2.3 Operating Regime Discovery & Clustering
- **MiniBatch K-Means ($k=3$)**: Identifies diurnal meteorological operating regimes (e.g., Cool/Humid Night, Warm/Dry Afternoon, Transitional Morning/Evening).
- **PCA Dimensionality Reduction**: Reduces the 12D standardized feature space to 2 principal components for live scatter plot rendering and cluster boundary visualization.

---

## 3. Experiment Studio (Academic Capabilities)

The Experiment Studio enables deep unsupervised learning research through 6 dedicated laboratory modules:

1. **Model Comparison**: Head-to-head empirical comparison of Isolation Forest vs. Local Outlier Factor (training duration, inference latency, agreement percentage, score distributions, and labeled benchmark metrics).
2. **K-Means Lab ($k=2..8$)**: Comprehensive clustering validation computing WCSS/Inertia, Silhouette Score, Davies-Bouldin Index, and Calinski-Harabasz Index across repeated initializations.
3. **Feature Ablation Experiments**: Rigorous academic comparison proving the necessity of temporal features:
   - Configuration A: Raw sensor values ($D=3$)
   - Configuration B: Raw values + first differences ($D=6$)
   - Configuration C: Full temporal feature set with rolling variance ($D=12$)
   *(Demonstrates how $D=12$ achieves ~90% recall on frozen sensor stiction where $D=3$ achieves 0% recall)*.
4. **Cluster Stability Analysis**: Evaluates clustering stability across bootstrapped resamplings using the Adjusted Rand Index (ARI).
5. **7-Fault Hardware Benchmark**: Comprehensive evaluation against a standardized catalog of 7 sensor failure modes:
   - `SPIKE_FAULT` (Transient voltage shock)
   - `FROZEN_SENSOR` (ADC/I2C transducer flatline)
   - `DRIFT_FAULT` (Linear thermal aging drift)
   - `NOISE_FAULT` (Gaussian signal degradation)
   - `CROSS_SENSOR_MISMATCH` (Physical psychrometric law violation)
   - `STICKY_SENSOR` (Bit quantization stiction)
   - `GRADUAL_FAILURE` (Multimodal progressive wear)
6. **DBSCAN vs. K-Means Lab**: Compares density-based cluster discovery (handling arbitrary shapes and intrinsic noise points) against partition-based centroid clustering.

---

## 4. Hardware Sensor Diagnostics & Root-Cause Attribution

When an anomaly triggers:
1. SkyGuard standardizes the observation using the baseline scaler:
   $$Z_j = \frac{x_j - \mu_j}{\sigma_j}$$
2. The top feature deviations are ranked and surfaced in the **Explainable Anomaly Drawer**.
3. Automated diagnostic heuristics inspect $Z$-scores and standard deviations to classify the exact failure mode (e.g., `roll_std_humidity < 0.05` $\to$ `FROZEN_SENSOR`).

---

## 5. Quickstart & Installation

### 5.1 Prerequisites
- Python 3.10+ (with virtual environment support)
- Node.js 18+ and npm

### 5.2 Backend Setup
```powershell
# Navigate to backend directory
cd backend

# Create and activate virtual environment
python -m venv venv
venv\Scripts\activate   # Windows
# source venv/bin/activate # Linux/macOS

# Install dependencies
pip install -r requirements.txt

# Train baseline models & generate artifacts
python train_models.py

# Run backend API & WebSocket server
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

### 5.3 Frontend Setup
```powershell
# In a new terminal, navigate to frontend directory
cd frontend

# Install npm dependencies
npm install

# Start Vite development server
npm run dev
```
The frontend is available at: **http://localhost:5173**

---

## 6. Full-Stack Test Suite

Run the complete 37-test automated verification suite covering feature parity, model training, live pipeline integration, fault injection scenarios, and the Experiment Studio:

```powershell
cd backend
venv\Scripts\python -m unittest discover -s . -p "test_*.py" -v
```

### Verified Test Categories:
- `test_streaming_and_batch_numerical_parity`: Ensures $ddof=1$ parity between Pandas batch and NumPy streaming ($<10^{-10}$).
- `test_non_finite_resilience`: Verifies handling of `NaN` and `Inf` inputs without pipeline corruption.
- `test_pipeline_spike_fault_scenario`: Verifies end-to-end alert dispatch for voltage spikes.
- `test_pipeline_frozen_sensor_scenario`: Verifies frozen transducer detection via rolling variance collapse.
- `test_pipeline_drift_fault_scenario`: Verifies linear calibration drift detection.
- `test_pipeline_cross_sensor_mismatch_scenario`: Verifies physical inconsistency detection.
- `test_feature_ablation_temporal_flatline_advantage`: Confirms higher recall of $D=12$ over $D=3$ for stiction.
- `test_psi_zero_drift_and_high_drift`: Verifies Population Stability Index (PSI) drift math.
- `test_comprehensive_7_fault_benchmark`: Verifies benchmark execution across all 7 fault modes.
- `test_all_module2_api_endpoints`: Verifies all REST API routes and JSON schema outputs.

---

## 7. Keyboard Shortcuts (Industrial Hotkeys)

| Key | Action |
|---|---|
| `Space` | Toggle Live Stream (Start / Stop Ingestion) |
| `R` | Purge Stream Buffer & Reset Session |
| `1` | Switch to **Overview** Page |
| `2` | Switch to **Telemetry** Console |
| `3` | Switch to **Model Diagnostics** (2D PCA) |
| `4` | Switch to **Experiment Studio** (Academic Labs) |
| `5` | Switch to **Incidents** Register (Audit Log & Root-Cause Attribution) |
| `6` | Switch to **Fault Simulator** (Controlled Benchmark Injector) |
| `7` | Switch to **Settings** & Calibration Parameters |

