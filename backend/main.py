"""
SkyGuard — FastAPI Backend (User-Triggered Live Weather Pipeline)
================================================================
Endpoints:
  POST /api/pipeline/start     – Start/calibrate live pipeline for an AWS station
  POST /api/pipeline/stop      – Pause live ingestion stream
  POST /api/pipeline/reset     – Reset session data & return to IDLE
  GET  /api/pipeline/status    – Pipeline state, station metadata & 4-stage stepper
  GET  /api/pipeline/stations  – Built-in Automatic Weather Station presets

  GET  /api/telemetry/recent   – Recent live readings from SQLite (alias: /api/readings)
  GET  /api/alerts             – Recent anomaly alerts from SQLite
  POST /api/alerts/{id}/acknowledge – Acknowledge alert
  GET  /api/analytics          – Dynamically calibrated analytics snapshot (alias: /api/analytics/snapshot)
  POST /api/inject-fault       – Hardware fault injection (SPIKE, FROZEN, DRIFT, MISMATCH, CLEAR)
  WS   /ws/stream              – Real-time telemetry & instant alert streaming (alias: /ws)
"""

import asyncio
import json
import os
import sys
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Optional, List

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BACKEND_DIR)

from database import SessionLocal, SensorReading, Alert, init_db
from pipeline import pipeline_manager, STATION_PRESETS
from experiment_engine import (
    run_model_comparison,
    run_kmeans_lab,
    run_feature_ablation,
    run_cluster_stability,
    run_comprehensive_benchmark,
    run_dbscan_vs_kmeans_comparison,
    explain_anomaly_observation,
    evaluate_concept_drift,
    experiment_store,
)

# ── Connected WebSocket clients ───────────────────────────────────────────────
connected_clients: List[WebSocket] = []

async def broadcast(data: dict):
    dead = []
    for ws in list(connected_clients):
        try:
            await ws.send_json(data)
        except Exception:
            dead.append(ws)
    for ws in dead:
        if ws in connected_clients:
            connected_clients.remove(ws)

# Wire broadcast callback to pipeline manager
pipeline_manager.broadcast_callback = broadcast


# ── App lifecycle ─────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    # App starts in IDLE / Standby mode — no fake telemetry or auto-stream
    init_db()
    print("[SkyGuard] Server initialized in STANDBY MODE (Pipeline IDLE).")
    yield
    # Clean shutdown
    pipeline_manager.stop()


app = FastAPI(title="SkyGuard Live API", version="2.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Pipeline Lifecycle Routes ─────────────────────────────────────────────────

class PipelineStartRequest(BaseModel):
    station_id:        str = "IN-HYD"
    latitude:          float = 17.3850
    longitude:         float = 78.4867
    station_name:      str = "Hyderabad AWS"
    poll_interval_sec: float = 3.0


@app.post("/api/pipeline/start")
async def start_pipeline(req: PipelineStartRequest):
    """
    Calibrate ML models on real 14-day observations for coordinates
    and start 3-second live station polling.
    """
    try:
        status = await pipeline_manager.start(
            station_id=req.station_id,
            latitude=req.latitude,
            longitude=req.longitude,
            station_name=req.station_name,
            poll_interval_sec=req.poll_interval_sec
        )
        await broadcast({"type": "pipeline_status", "data": status})
        return status
    except Exception as e:
        pipeline_manager.state = "IDLE"
        raise HTTPException(status_code=500, detail=f"Failed to start pipeline: {str(e)}")


@app.post("/api/pipeline/stop")
async def stop_pipeline():
    """Pause live collection stream."""
    status = pipeline_manager.stop()
    await broadcast({"type": "pipeline_status", "data": status})
    return status


@app.post("/api/pipeline/reset")
async def reset_pipeline():
    """Clear session database rows and return to IDLE."""
    status = pipeline_manager.reset_session()
    await broadcast({"type": "pipeline_status", "data": status})
    await broadcast({"type": "session_reset"})
    return status


@app.get("/api/pipeline/status")
def get_pipeline_status():
    """Return pipeline execution state, station metadata & 4-stage stepper."""
    return pipeline_manager.get_status()


@app.get("/api/pipeline/stations")
def get_station_presets():
    """Return predefined real-world Automatic Weather Station locations."""
    return list(STATION_PRESETS.values())


# ── Telemetry & Alert Routes ──────────────────────────────────────────────────

@app.get("/api/readings")
@app.get("/api/telemetry/recent")
def get_readings(limit: int = 60):
    db = SessionLocal()
    try:
        rows = (
            db.query(SensorReading)
            .order_by(SensorReading.id.desc())
            .limit(limit)
            .all()
        )
        rows.reverse()
        return [r.to_dict() for r in rows]
    finally:
        db.close()


@app.get("/api/alerts")
def get_alerts(limit: int = 50):
    db = SessionLocal()
    try:
        rows = (
            db.query(Alert)
            .order_by(Alert.id.desc())
            .limit(limit)
            .all()
        )
        return [r.to_dict() for r in rows]
    finally:
        db.close()


@app.post("/api/alerts/{alert_id}/acknowledge")
def acknowledge_alert(alert_id: int):
    db = SessionLocal()
    try:
        alert = db.query(Alert).filter(Alert.id == alert_id).first()
        if not alert:
            return {"error": "Alert not found", "id": alert_id}
        alert.is_acknowledged = True
        alert.acknowledged_at = datetime.now(timezone.utc).isoformat()
        alert.status = "ACKNOWLEDGED"
        db.commit()
        db.refresh(alert)
        return alert.to_dict()
    finally:
        db.close()


class BulkAlertRequest(BaseModel):
    alert_ids: list[int]
    action: str  # "ACKNOWLEDGE" | "DISMISS" | "RESOLVE" | "REOPEN"


@app.post("/api/alerts/bulk-action")
def bulk_alert_action(req: BulkAlertRequest):
    """
    Race-safe bulk alert status update.
    Acts exclusively on the specified alert_ids.
    """
    if not req.alert_ids:
        return {"updated_count": 0, "alert_ids": [], "action": req.action}
    db = SessionLocal()
    try:
        now_iso = datetime.now(timezone.utc).isoformat()
        alerts = db.query(Alert).filter(Alert.id.in_(req.alert_ids)).all()
        act = req.action.upper()
        for a in alerts:
            if act == "ACKNOWLEDGE":
                a.status = "ACKNOWLEDGED"
                a.is_acknowledged = True
                a.acknowledged_at = now_iso
            elif act == "DISMISS":
                a.status = "DISMISSED"
                a.is_acknowledged = True
                a.dismissed_at = now_iso
            elif act == "RESOLVE":
                a.status = "RESOLVED"
                a.is_acknowledged = True
                a.resolved_at = now_iso
            elif act == "REOPEN":
                a.status = "OPEN"
                a.is_acknowledged = False
                a.acknowledged_at = None
                a.dismissed_at = None
                a.resolved_at = None
        db.commit()
        return {
            "updated_count": len(alerts),
            "alert_ids": [a.id for a in alerts],
            "action": req.action
        }
    finally:
        db.close()


@app.post("/api/alerts/clear-simulated")
def clear_simulated_alerts():
    """Clear all alerts generated by hardware simulator runs."""
    db = SessionLocal()
    try:
        deleted = (
            db.query(Alert)
            .filter(
                (Alert.is_simulated == True) |
                (Alert.fault_type.in_(["SPIKE_FAULT", "FROZEN_SENSOR", "DRIFT_FAULT", "CROSS_SENSOR_MISMATCH", "NOISE_FAULT", "STICKY_SENSOR"]))
            )
            .delete(synchronize_session=False)
        )
        db.commit()
        return {"cleared_count": deleted}
    finally:
        db.close()


class PollingIntervalRequest(BaseModel):
    interval_sec: float


@app.post("/api/pipeline/polling-interval")
def set_polling_interval(req: PollingIntervalRequest):
    """Adjust live ingestion polling interval (e.g. 3.0s, 5.0s, 10.0s)."""
    sec = max(1.0, min(60.0, float(req.interval_sec)))
    pipeline_manager.poll_interval_sec = sec
    return {"poll_interval_sec": sec}


@app.post("/api/pipeline/recalibrate")
async def recalibrate_station():
    """Recalibrate baseline models using active station historical weather."""
    st = pipeline_manager.station
    lat = st.get("latitude", 17.3850)
    lon = st.get("longitude", 78.4867)
    name = st.get("name", "Station")
    await pipeline_manager.calibrate_station(lat, lon, name)
    return {"message": "Recalibrated successfully", "snapshot": pipeline_manager.analytics_snapshot}


@app.get("/api/analytics")
@app.get("/api/analytics/snapshot")
def get_analytics():
    return pipeline_manager.analytics_snapshot


class FaultRequest(BaseModel):
    fault_type: str
    sensor:     Optional[str] = "TEMPERATURE"
    duration:   int = 15   # ticks


@app.post("/api/inject-fault")
def inject_fault(req: FaultRequest):
    res = pipeline_manager.inject_fault(
        fault_type=req.fault_type,
        sensor=req.sensor or "TEMPERATURE",
        duration=req.duration
    )
    return res


@app.get("/api/status")
def get_legacy_status():
    return {
        "status": pipeline_manager.state,
        "station_id": pipeline_manager.station.get("id", "AWS-ALPHA-01"),
        "active_fault": pipeline_manager.active_fault["type"],
        "fault_remaining": pipeline_manager.active_fault["remaining"],
        "total_collected": pipeline_manager.total_collected
    }


# ── Experiment Studio & Advanced ML Routes (Module 2) ─────────────────────────

class ModelComparisonRequest(BaseModel):
    contamination: float = 0.08
    n_estimators: int = 200
    n_neighbors: int = 20
    random_seed: int = 42


@app.post("/api/experiments/model-comparison")
def api_model_comparison(req: ModelComparisonRequest):
    """Run empirical comparison between Isolation Forest and Local Outlier Factor."""
    res = run_model_comparison(
        contamination=req.contamination,
        n_estimators=req.n_estimators,
        n_neighbors=req.n_neighbors,
        random_seed=req.random_seed,
    )
    experiment_store.save_experiment(res)
    return res


class KMeansLabRequest(BaseModel):
    min_k: int = 2
    max_k: int = 8
    batch_size: int = 512
    random_seed: int = 42


@app.post("/api/experiments/kmeans-lab")
def api_kmeans_lab(req: KMeansLabRequest):
    """Evaluate MiniBatch K-Means over k=2..8 with Silhouette, Davies-Bouldin, and Calinski-Harabasz."""
    res = run_kmeans_lab(
        k_range=(max(2, req.min_k), min(12, req.max_k)),
        batch_size=req.batch_size,
        random_seed=req.random_seed,
    )
    experiment_store.save_experiment(res)
    return res


class FeatureAblationRequest(BaseModel):
    contamination: float = 0.08
    random_seed: int = 42


@app.post("/api/experiments/feature-ablation")
def api_feature_ablation(req: FeatureAblationRequest):
    """Run academic feature ablation comparing Raw 3, Raw+Delta 6, and Full 12 feature subsets."""
    res = run_feature_ablation(
        contamination=req.contamination,
        random_seed=req.random_seed,
    )
    experiment_store.save_experiment(res)
    return res


class ClusterStabilityRequest(BaseModel):
    k: int = 3
    n_runs: int = 5


@app.post("/api/experiments/cluster-stability")
def api_cluster_stability(req: ClusterStabilityRequest):
    """Evaluate clustering reproducibility using pairwise Adjusted Rand Index (ARI)."""
    res = run_cluster_stability(k=req.k, n_runs=req.n_runs)
    experiment_store.save_experiment(res)
    return res


class BenchmarkRequest(BaseModel):
    random_seed: int = 42


@app.post("/api/experiments/benchmark")
def api_comprehensive_benchmark(req: BenchmarkRequest):
    """Execute end-to-end controlled benchmark across the 7-fault hardware catalogue."""
    res = run_comprehensive_benchmark(random_seed=req.random_seed)
    experiment_store.save_experiment(res)
    return res


class DBSCANComparisonRequest(BaseModel):
    eps: float = 2.5
    min_samples: int = 5
    k: int = 3
    sample_size: int = 500


@app.post("/api/experiments/dbscan-comparison")
def api_dbscan_comparison(req: DBSCANComparisonRequest):
    """Compare centroid-based K-Means with density-based DBSCAN clustering."""
    res = run_dbscan_vs_kmeans_comparison(
        eps=req.eps,
        min_samples=req.min_samples,
        k=req.k,
        sample_size=req.sample_size,
    )
    experiment_store.save_experiment(res)
    return res


@app.get("/api/experiments/history")
def api_list_experiments():
    """Retrieve history of all persisted Experiment Studio runs."""
    return experiment_store.list_experiments()


@app.get("/api/experiments/{experiment_id}")
def api_get_experiment(experiment_id: str):
    """Retrieve full details of a specific persisted experiment."""
    exp = experiment_store.get_experiment(experiment_id)
    if not exp:
        raise HTTPException(status_code=404, detail="Experiment not found")
    return exp


@app.get("/api/investigate/alert/{alert_id}")
def api_investigate_alert(alert_id: int):
    """
    Produce explainable statistical deviation diagnostics for an anomaly alert.
    Correlates observation features against healthy baseline distributions.
    """
    db = SessionLocal()
    try:
        alert = db.query(Alert).filter(Alert.id == alert_id).first()
        if not alert:
            raise HTTPException(status_code=404, detail="Alert not found")

        reading = None
        if alert.reading_id:
            reading = db.query(SensorReading).filter(SensorReading.id == alert.reading_id).first()
        
        if not reading:
            # Fallback to nearest reading by timestamp
            reading = db.query(SensorReading).filter(SensorReading.timestamp == alert.timestamp).first()

        obs_dict = reading.to_dict() if reading else {
            "temperature": 25.0, "pressure": 1013.25, "humidity": 50.0
        }
        obs_dict["timestamp"] = alert.timestamp

        diagnosis = explain_anomaly_observation(obs_dict)
        return {
            "alert": alert.to_dict(),
            "reading": obs_dict,
            "investigation": diagnosis,
        }
    finally:
        db.close()


@app.get("/api/monitoring/drift")
def api_concept_drift(window_size: int = 100):
    """
    Evaluates concept drift between recent telemetry window and training baseline
    using Kolmogorov-Smirnov test and Population Stability Index (PSI).
    """
    db = SessionLocal()
    try:
        readings = (
            db.query(SensorReading)
            .order_by(SensorReading.id.desc())
            .limit(max(30, min(500, window_size)))
            .all()
        )
        if not readings or len(readings) < 30:
            return {
                "status": "INSUFFICIENT_DATA",
                "message": f"Requires at least 30 live readings in database (currently {len(readings)}).",
                "drift_detected": False,
                "current_window_size": len(readings),
            }

        df_curr = pd.DataFrame([r.to_dict() for r in reversed(readings)])
        drift_res = evaluate_concept_drift(df_curr)
        return drift_res
    finally:
        db.close()


# ── WebSocket Streaming ───────────────────────────────────────────────────────

@app.websocket("/ws")
@app.websocket("/ws/stream")
async def websocket_stream_endpoint(websocket: WebSocket):
    await websocket.accept()
    connected_clients.append(websocket)
    print(f"[WS] Client connected. Total: {len(connected_clients)}")

    # Send current pipeline status immediately on connect
    try:
        await websocket.send_json({
            "type": "pipeline_status",
            "data": pipeline_manager.get_status()
        })
    except Exception:
        pass

    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        if websocket in connected_clients:
            connected_clients.remove(websocket)
        print(f"[WS] Client disconnected. Total: {len(connected_clients)}")
    except Exception:
        if websocket in connected_clients:
            connected_clients.remove(websocket)
