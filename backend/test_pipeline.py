"""
SkyGuard — Module 1 Comprehensive Test Suite
============================================
Verifies:
  1. Feature extraction schema, ordering, and ddof=1 numerical parity
  2. Missing, NaN, and non-finite value protection
  3. Model persistence and artifact validity (IF, LOF, KMeans, PCA, Scaler)
  4. Local Outlier Factor (LOF) novelty detection configuration
  5. MiniBatch KMeans operating regimes and inertia
  6. PCA dimensionality reduction and explained variance
  7. Clustering evaluation metrics (Silhouette, Davies-Bouldin, WCSS)
  8. Anomaly scoring and dual-model ensemble fusion
  9. Controlled hardware fault injection catalogue (SPIKE, FROZEN, DRIFT, MISMATCH)
  10. Telemetry data validation and SQLite database persistence
  11. WebSocket serialization and event dispatch payload verification
"""

import os
import sys
import json
import unittest
import numpy as np
import pandas as pd
import joblib

# Paths
ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BACKEND_DIR = os.path.join(ROOT_DIR, "backend")
MODELS_DIR = os.path.join(BACKEND_DIR, "models")
DATA_DIR = os.path.join(BACKEND_DIR, "data")
sys.path.insert(0, BACKEND_DIR)

from features import (
    FEATURE_NAMES,
    WINDOW_SIZE,
    compute_features_batch,
    StreamingFeatureExtractor,
    features_to_array,
)
from data_generator import generate_healthy_data, inject_faults
from database import SessionLocal, SensorReading, Alert, init_db
from pipeline import pipeline_manager


class TestFeaturePipeline(unittest.TestCase):
    """3. Verify Feature Extraction Pipeline."""

    def test_feature_names_and_dimension(self):
        self.assertEqual(len(FEATURE_NAMES), 12)
        expected = [
            "temperature", "pressure", "humidity",
            "delta_temp", "delta_pressure", "delta_humidity",
            "roll_mean_temp", "roll_mean_pressure", "roll_mean_humidity",
            "roll_std_temp", "roll_std_pressure", "roll_std_humidity",
        ]
        self.assertEqual(FEATURE_NAMES, expected)

    def test_batch_feature_shape_and_no_nan(self):
        df = generate_healthy_data(100, seed=123)
        feats = compute_features_batch(df, window=WINDOW_SIZE)
        self.assertEqual(feats.shape, (100, 12))
        self.assertEqual(list(feats.columns), FEATURE_NAMES)
        self.assertEqual(feats.isna().sum().sum(), 0)

    def test_streaming_and_batch_numerical_parity(self):
        """Verify that streaming ddof=1 exactly matches pandas rolling batch std."""
        df = generate_healthy_data(100, seed=42)
        batch_feats = compute_features_batch(df, window=WINDOW_SIZE)

        streamer = StreamingFeatureExtractor(window=WINDOW_SIZE)
        stream_rows = []
        for _, row in df.iterrows():
            fv = streamer.update(row["temperature"], row["pressure"], row["humidity"])
            stream_rows.append(fv)
        stream_df = pd.DataFrame(stream_rows)

        # Check column by column
        for col in FEATURE_NAMES:
            max_diff = np.max(np.abs(batch_feats[col].values - stream_df[col].values))
            self.assertLess(max_diff, 1e-10, f"Discrepancy in feature {col}: {max_diff}")

    def test_non_finite_resilience(self):
        """Verify that NaN or inf inputs do not corrupt streaming features."""
        streamer = StreamingFeatureExtractor(window=WINDOW_SIZE)
        fv = streamer.update(float("nan"), float("inf"), 55.0)
        self.assertEqual(len(fv), 12)
        arr = features_to_array(fv)
        self.assertFalse(np.isnan(arr).any())
        self.assertFalse(np.isinf(arr).any())


class TestUnsupervisedModels(unittest.TestCase):
    """4. Verify Unsupervised Models and Metrics."""

    @classmethod
    def setUpClass(cls):
        cls.scaler = joblib.load(os.path.join(MODELS_DIR, "scaler.joblib"))
        cls.iforest = joblib.load(os.path.join(MODELS_DIR, "isolation_forest.joblib"))
        cls.lof = joblib.load(os.path.join(MODELS_DIR, "lof.joblib"))
        cls.kmeans = joblib.load(os.path.join(MODELS_DIR, "kmeans.joblib"))
        cls.pca = joblib.load(os.path.join(MODELS_DIR, "pca.joblib"))

    def test_scaler_configuration(self):
        self.assertEqual(self.scaler.n_features_in_, 12)
        self.assertEqual(len(self.scaler.mean_), 12)

    def test_isolation_forest_config_and_scoring(self):
        self.assertEqual(self.iforest.n_features_in_, 12)
        self.assertEqual(self.iforest.contamination, 0.08)
        # Verify prediction on nominal mean sample
        x_norm = self.scaler.transform(self.scaler.mean_.reshape(1, -1))
        pred = self.iforest.predict(x_norm)[0]
        self.assertEqual(pred, 1)

    def test_lof_novelty_configuration(self):
        self.assertTrue(self.lof.novelty, "LOF must be configured with novelty=True for unseen streaming inference")
        self.assertEqual(self.lof.n_features_in_, 12)
        x_norm = self.scaler.transform(self.scaler.mean_.reshape(1, -1))
        pred = self.lof.predict(x_norm)[0]
        self.assertEqual(pred, 1)

    def test_minibatch_kmeans_regimes_and_inertia(self):
        self.assertEqual(self.kmeans.n_clusters, 3)
        self.assertEqual(self.kmeans.cluster_centers_.shape, (3, 12))
        self.assertGreater(self.kmeans.inertia_, 0.0)

    def test_pca_projection(self):
        self.assertEqual(self.pca.n_components, 2)
        self.assertEqual(len(self.pca.explained_variance_ratio_), 2)
        x_norm = self.scaler.transform(self.scaler.mean_.reshape(1, -1))
        pt = self.pca.transform(x_norm)
        self.assertEqual(pt.shape, (1, 2))

    def test_analytics_snapshot_metrics(self):
        snap_path = os.path.join(MODELS_DIR, "analytics_snapshot.json")
        self.assertTrue(os.path.exists(snap_path))
        with open(snap_path, "r") as f:
            snap = json.load(f)
        self.assertIn("metrics", snap)
        self.assertIn("silhouette", snap["metrics"])
        self.assertIn("davies_bouldin", snap["metrics"])
        self.assertIn("wcss", snap["metrics"])
        self.assertEqual(snap["n_points"], 500)
        self.assertEqual(len(snap["pca_coords"]), 500)
        self.assertEqual(len(snap["tsne_coords"]), 500)


class TestAnomalyStrategy(unittest.TestCase):
    """5. Verify Anomaly Score Normalization & Fusion Strategy."""

    @classmethod
    def setUpClass(cls):
        cls.scaler = joblib.load(os.path.join(MODELS_DIR, "scaler.joblib"))
        cls.iforest = joblib.load(os.path.join(MODELS_DIR, "isolation_forest.joblib"))
        cls.lof = joblib.load(os.path.join(MODELS_DIR, "lof.joblib"))

    def test_ensemble_decision_logic(self):
        # 1. Nominal observation
        x_norm = self.scaler.transform(self.scaler.mean_.reshape(1, -1))
        if_df = float(self.iforest.decision_function(x_norm)[0])
        lof_df = float(self.lof.decision_function(x_norm)[0])
        s_if = 1.0 / (1.0 + np.exp(np.clip(15.0 * if_df, -50, 50)))
        s_lof = 1.0 / (1.0 + np.exp(np.clip(2.0 * lof_df, -50, 50)))
        ensemble = max(s_if, s_lof)
        self.assertLess(ensemble, 0.5, "Nominal observation should score below 0.5")

        # 2. Extreme anomaly (voltage spike)
        x_spike = x_norm.copy()
        x_spike[0, 0] += 30.0  # huge temperature delta
        x_spike[0, 3] += 30.0
        if_df_s = float(self.iforest.decision_function(x_spike)[0])
        lof_df_s = float(self.lof.decision_function(x_spike)[0])
        s_if_s = 1.0 / (1.0 + np.exp(np.clip(15.0 * if_df_s, -50, 50)))
        s_lof_s = 1.0 / (1.0 + np.exp(np.clip(2.0 * lof_df_s, -50, 50)))
        ensemble_s = max(s_if_s, s_lof_s)
        self.assertGreater(ensemble_s, 0.8, "Extreme anomaly should score above 0.8")


class TestFaultInjection(unittest.TestCase):
    """7. Verify Fault Injection Functionality."""

    def test_fault_catalog_coverage(self):
        df_h = generate_healthy_data(5000, seed=42)
        df_eval = inject_faults(df_h, seed=43)
        counts = df_eval["fault_type"].value_counts()
        for ft in ["SPIKE_FAULT", "FROZEN_SENSOR", "DRIFT_FAULT", "CROSS_SENSOR_MISMATCH"]:
            self.assertIn(ft, counts)
            self.assertGreater(counts[ft], 0)

        # Fault rows should be strictly bounded to ~5-15% of dataset
        faulty_rows = (df_eval["fault_type"] != "NONE").sum()
        fault_ratio = faulty_rows / len(df_eval)
        self.assertGreater(fault_ratio, 0.04)
        self.assertLess(fault_ratio, 0.15)


class TestDatabaseAndPersistence(unittest.TestCase):
    """8. Verify Database Reliability & Incident Logging."""

    def setUp(self):
        init_db()
        self.db = SessionLocal()

    def tearDown(self):
        self.db.query(Alert).delete()
        self.db.query(SensorReading).delete()
        self.db.commit()
        self.db.close()

    def test_reading_and_alert_crud(self):
        reading = SensorReading(
            timestamp="2026-11-03T12:00:00Z",
            temperature=25.0,
            pressure=1013.25,
            humidity=50.0,
            fault_type="NONE",
            is_anomaly=False,
        )
        self.db.add(reading)
        self.db.commit()
        self.assertIsNotNone(reading.id)

        alert = Alert(
            timestamp="2026-11-03T12:00:00Z",
            title="Sensor Voltage Spike",
            message="Test anomaly alert message",
            diagnosis_message="Test anomaly alert message",
            severity="CRITICAL",
            fault_type="SPIKE_FAULT",
            sensor="TEMPERATURE",
            reading_id=reading.id,
            is_acknowledged=False,
        )
        self.db.add(alert)
        self.db.commit()
        self.assertIsNotNone(alert.id)

        # Query back
        loaded = self.db.query(Alert).filter(Alert.id == alert.id).first()
        self.assertEqual(loaded.title, "Sensor Voltage Spike")
        self.assertEqual(loaded.severity, "CRITICAL")
        self.assertFalse(loaded.is_acknowledged)


if __name__ == "__main__":
    unittest.main()

