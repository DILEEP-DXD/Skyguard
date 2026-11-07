"""
SkyGuard — Real-Time Pipeline Integration Tests
================================================
Verifies:
  1. Live pipeline normal telemetry ingestion and WebSocket broadcast
  2. Telemetry ingestion, feature scaling, model scoring
  3. Controlled fault injection triggers real-time anomaly detection (SPIKE, FROZEN, DRIFT, MISMATCH)
  4. End-to-end WebSocket dispatch callback
  5. SQLite persistence of readings and incidents
"""

import os
import sys
import time
import asyncio
import unittest
import pandas as pd

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BACKEND_DIR = os.path.join(ROOT_DIR, "backend")
DATA_DIR = os.path.join(BACKEND_DIR, "data")
sys.path.insert(0, BACKEND_DIR)

from database import SessionLocal, SensorReading, Alert, init_db
from pipeline import pipeline_manager


class TestLivePipelineIntegration(unittest.TestCase):

    def setUp(self):
        init_db()
        self.db = SessionLocal()
        self.db.query(Alert).delete()
        self.db.query(SensorReading).delete()
        self.db.commit()
        pipeline_manager.reset_session()

    def tearDown(self):
        pipeline_manager.stop()
        self.db.query(Alert).delete()
        self.db.query(SensorReading).delete()
        self.db.commit()
        self.db.close()

    def test_pipeline_normal_telemetry_flow(self):
        """Simulate normal station reading ingestion matching baseline operating regime."""
        async def run_scenario():
            dispatched_events = []
            async def mock_broadcast(msg):
                dispatched_events.append(msg)

            pipeline_manager.broadcast_callback = mock_broadcast
            pipeline_manager.state = "STREAMING_LIVE"
            pipeline_manager.total_collected = 10  # past warm-up

            # Pre-warm extractor with nominal baseline readings
            df_h = pd.read_csv(os.path.join(DATA_DIR, "baseline_healthy.csv"))
            for _, r in df_h.iloc[90:100].iterrows():
                pipeline_manager.extractor.update(r["temperature"], r["pressure"], r["humidity"])

            row100 = df_h.iloc[100]
            nominal_reading = {
                "temperature": float(row100["temperature"]),
                "pressure": float(row100["pressure"]),
                "humidity": float(row100["humidity"])
            }
            # Mock _fetch_current_weather to return exact nominal baseline
            pipeline_manager.last_api_raw = nominal_reading
            original_fetch = pipeline_manager._fetch_current_weather
            async def mock_fetch():
                pipeline_manager.fetch_latency_ms = 12.0
                return nominal_reading
            pipeline_manager._fetch_current_weather = mock_fetch

            try:
                # Run poll loop until at least 1 reading is processed
                t0 = time.time()
                task = asyncio.create_task(pipeline_manager._poll_loop())
                while time.time() - t0 < 8.0:
                    if pipeline_manager.total_collected > 10:
                        break
                    await asyncio.sleep(0.3)
                pipeline_manager.state = "IDLE"
                task.cancel()
                try:
                    await task
                except asyncio.CancelledError:
                    pass
            finally:
                pipeline_manager._fetch_current_weather = original_fetch

            return dispatched_events

        events = asyncio.run(run_scenario())
        self.assertGreater(len(events), 0)
        reading_event = events[0]
        self.assertEqual(reading_event["type"], "reading")
        self.assertIn("data", reading_event)
        self.assertFalse(reading_event["data"]["is_anomaly"])

    def test_pipeline_spike_fault_scenario(self):
        """Inject SPIKE_FAULT and verify anomaly detection & alert generation."""
        async def run_scenario():
            dispatched_events = []
            async def mock_broadcast(msg):
                dispatched_events.append(msg)

            pipeline_manager.broadcast_callback = mock_broadcast
            pipeline_manager.total_collected = 10
            pipeline_manager.inject_fault("SPIKE_FAULT", sensor="TEMPERATURE", duration=2)
            pipeline_manager.state = "STREAMING_LIVE"

            t0 = time.time()
            task = asyncio.create_task(pipeline_manager._poll_loop())
            while time.time() - t0 < 8.0:
                if pipeline_manager.total_anomalies > 0:
                    break
                await asyncio.sleep(0.3)
            pipeline_manager.state = "IDLE"
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass

            return dispatched_events

        events = asyncio.run(run_scenario())
        alert_events = [e for e in events if e.get("type") == "ALERT_TRIGGERED"]
        self.assertGreater(len(alert_events), 0)
        self.assertEqual(alert_events[0]["alert"]["severity"], "CRITICAL")
        self.assertEqual(alert_events[0]["alert"]["sensor"], "TEMPERATURE")

        # Verify database record
        alert_row = self.db.query(Alert).first()
        self.assertIsNotNone(alert_row)
        self.assertEqual(alert_row.severity, "CRITICAL")
        self.assertEqual(alert_row.fault_type, "SPIKE_FAULT")

    def test_pipeline_frozen_sensor_scenario(self):
        """Inject FROZEN_SENSOR and verify detection."""
        async def run_scenario():
            pipeline_manager.total_collected = 15
            pipeline_manager.inject_fault("FROZEN_SENSOR", sensor="HUMIDITY", duration=5)
            pipeline_manager.state = "STREAMING_LIVE"

            t0 = time.time()
            task = asyncio.create_task(pipeline_manager._poll_loop())
            while time.time() - t0 < 8.0:
                if pipeline_manager.total_anomalies > 0:
                    break
                await asyncio.sleep(0.3)
            pipeline_manager.state = "IDLE"
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass

        asyncio.run(run_scenario())
        alerts = self.db.query(Alert).all()
        self.assertGreater(len(alerts), 0)
        self.assertEqual(alerts[0].fault_type, "FROZEN_SENSOR")

    def test_pipeline_drift_fault_scenario(self):
        """Inject DRIFT_FAULT and verify detection."""
        async def run_scenario():
            pipeline_manager.total_collected = 20
            pipeline_manager.inject_fault("DRIFT_FAULT", sensor="PRESSURE", duration=5)
            pipeline_manager.state = "STREAMING_LIVE"

            t0 = time.time()
            task = asyncio.create_task(pipeline_manager._poll_loop())
            while time.time() - t0 < 8.0:
                if pipeline_manager.total_anomalies > 0:
                    break
                await asyncio.sleep(0.3)
            pipeline_manager.state = "IDLE"
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass

        asyncio.run(run_scenario())
        alerts = self.db.query(Alert).all()
        self.assertGreater(len(alerts), 0)
        self.assertEqual(alerts[0].fault_type, "DRIFT_FAULT")

    def test_pipeline_cross_sensor_mismatch_scenario(self):
        """Inject CROSS_SENSOR_MISMATCH and verify detection."""
        async def run_scenario():
            pipeline_manager.total_collected = 20
            pipeline_manager.inject_fault("CROSS_SENSOR_MISMATCH", sensor="PRESSURE", duration=5)
            pipeline_manager.state = "STREAMING_LIVE"

            t0 = time.time()
            task = asyncio.create_task(pipeline_manager._poll_loop())
            while time.time() - t0 < 8.0:
                if pipeline_manager.total_anomalies > 0:
                    break
                await asyncio.sleep(0.3)
            pipeline_manager.state = "IDLE"
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass

        asyncio.run(run_scenario())
        alerts = self.db.query(Alert).all()
        self.assertGreater(len(alerts), 0)
        self.assertEqual(alerts[0].fault_type, "CROSS_SENSOR_MISMATCH")


if __name__ == "__main__":
    unittest.main()
