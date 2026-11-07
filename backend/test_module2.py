"""
SkyGuard — Module 2 Advanced Unsupervised Learning Test Suite
=============================================================
Tests:
  1. Model comparison execution, consensus matrix, metrics calculation
  2. K-Means Lab parameter sweep (k=2..6), inertia elbow, Silhouette, Davies-Bouldin, Calinski-Harabasz
  3. Feature ablation (Raw vs Raw+Delta vs Full Temporal) and temporal flatline sensitivity
  4. Cluster stability via pairwise Adjusted Rand Index (ARI)
  5. Explainable anomaly investigation (Z-score deviation, rule-based attribution)
  6. Concept drift detection (Kolmogorov-Smirnov test and Population Stability Index)
  7. Comprehensive 7-fault hardware benchmark simulation
  8. DBSCAN vs K-Means comparative clustering
  9. Persistent experiment store (save, get, list)
  10. Fast API Module 2 endpoints validation
"""

import os
import sys
import unittest
import numpy as np
import pandas as pd
from fastapi.testclient import TestClient

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BACKEND_DIR = os.path.join(ROOT_DIR, "backend")
DATA_DIR = os.path.join(BACKEND_DIR, "data")
sys.path.insert(0, BACKEND_DIR)

from experiment_engine import (
    calculate_classification_metrics,
    compute_detection_delays,
    calculate_psi,
    run_model_comparison,
    run_kmeans_lab,
    run_feature_ablation,
    run_cluster_stability,
    explain_anomaly_observation,
    evaluate_concept_drift,
    run_comprehensive_benchmark,
    run_dbscan_vs_kmeans_comparison,
    experiment_store,
)
from main import app
from database import SessionLocal, Alert, SensorReading, init_db


class TestExperimentStudioEngine(unittest.TestCase):

    def test_classification_metrics_math(self):
        """Verify precision, recall, f1, fpr against manual calculation."""
        y_true = np.array([True, True, True, False, False])
        y_pred = np.array([True, True, False, True, False])
        # TP=2, FP=1, FN=1, TN=1
        m = calculate_classification_metrics(y_true, y_pred)
        self.assertEqual(m["tp"], 2)
        self.assertEqual(m["fp"], 1)
        self.assertEqual(m["fn"], 1)
        self.assertEqual(m["tn"], 1)
        self.assertAlmostEqual(m["precision"], 2 / 3, places=3)
        self.assertAlmostEqual(m["recall"], 2 / 3, places=3)
        self.assertAlmostEqual(m["false_positive_rate"], 1 / 2, places=3)

    def test_psi_zero_drift_and_high_drift(self):
        """Verify PSI math: same distribution yields PSI ~ 0; shifted yields PSI > 0.25."""
        np.random.seed(42)
        base = np.random.normal(25.0, 5.0, 1000)
        same = np.random.normal(25.0, 5.0, 500)
        drift = np.random.normal(35.0, 5.0, 500)

        psi_same = calculate_psi(base, same)
        psi_drift = calculate_psi(base, drift)

        self.assertLess(psi_same, 0.10, "Same distribution should have PSI < 0.10")
        self.assertGreater(psi_drift, 0.25, "Shifted distribution should have high PSI > 0.25")

    def test_model_comparison_execution(self):
        res = run_model_comparison(contamination=0.08, n_estimators=50, n_neighbors=15, random_seed=42)
        self.assertIn("experiment_id", res)
        self.assertIn("isolation_forest", res)
        self.assertIn("local_outlier_factor", res)
        self.assertIn("consensus_analysis", res)

        ca = res["consensus_analysis"]
        self.assertGreaterEqual(ca["overall_agreement_rate"], 0.70)
        self.assertIn("precision", res["isolation_forest"]["benchmark_metrics"])
        self.assertIn("recall", res["local_outlier_factor"]["benchmark_metrics"])

    def test_kmeans_lab_execution(self):
        res = run_kmeans_lab(k_range=(2, 4), batch_size=256, random_seed=42)
        self.assertEqual(len(res["results"]), 3)
        for r in res["results"]:
            self.assertIn("k", r)
            self.assertIn("inertia", r)
            self.assertIn("silhouette_score", r)
            self.assertIn("davies_bouldin_index", r)
            self.assertIn("calinski_harabasz_index", r)
            self.assertIn("centroids", r)
            self.assertEqual(len(r["centroids"]), r["k"])

    def test_feature_ablation_temporal_flatline_advantage(self):
        """Verify academic ablation finding: FULL_12 achieves vastly higher FROZEN_SENSOR recall than RAW_3."""
        res = run_feature_ablation(contamination=0.08, random_seed=42)
        self.assertEqual(len(res["ablation_results"]), 3)

        raw_3 = next(r for r in res["ablation_results"] if r["subset_id"] == "RAW_3")
        full_12 = next(r for r in res["ablation_results"] if r["subset_id"] == "FULL_12")

        self.assertEqual(raw_3["feature_count"], 3)
        self.assertEqual(full_12["feature_count"], 12)

        frozen_raw = raw_3["per_fault_recall"].get("FROZEN_SENSOR", 0.0)
        frozen_full = full_12["per_fault_recall"].get("FROZEN_SENSOR", 0.0)

        self.assertGreater(
            frozen_full, frozen_raw,
            f"Full temporal features ({frozen_full}) must outperform raw ({frozen_raw}) on flatline detection."
        )

    def test_cluster_stability_ari(self):
        res = run_cluster_stability(k=3, n_runs=3, random_seeds=[42, 101, 202])
        self.assertEqual(len(res["runs"]), 3)
        self.assertIn("pairwise_ari_matrix", res)
        self.assertEqual(len(res["pairwise_ari_matrix"]), 3)
        self.assertGreater(res["summary"]["mean_ari"], 0.0)
        self.assertLessEqual(res["summary"]["mean_ari"], 1.0)

    def test_explainable_anomaly_investigation(self):
        obs = {
            "temperature": 45.0,
            "pressure": 1013.25,
            "humidity": 50.0,
            "delta_temp": 25.0,
            "roll_mean_temp": 38.0,
            "roll_std_temp": 0.0001,
            "roll_std_humidity": 0.0001,
        }
        res = explain_anomaly_observation(obs)
        self.assertIn("top_feature_deviations", res)
        self.assertIn("diagnostic_explanations", res)
        self.assertGreater(len(res["diagnostic_explanations"]), 0)
        self.assertEqual(res["confidence_level"], "EVIDENTIARY_CORRELATION")

    def test_concept_drift_monitoring(self):
        # 1. Normal window drawn from baseline distribution (representative sample)
        df_h = pd.read_csv(os.path.join(DATA_DIR, "baseline_healthy.csv"))
        rng = np.random.default_rng(42)
        sample_idx = rng.choice(len(df_h), size=200, replace=False)
        df_curr_norm = df_h.iloc[sample_idx].copy()
        res_norm = evaluate_concept_drift(df_curr_norm, baseline_df=df_h)
        self.assertFalse(res_norm["overall_drift_detected"])

        # 2. Extreme shift
        df_curr_drift = df_curr_norm.copy()
        df_curr_drift["temperature"] += 15.0
        df_curr_drift["pressure"] -= 20.0
        res_drift = evaluate_concept_drift(df_curr_drift, baseline_df=df_h)
        self.assertTrue(res_drift["overall_drift_detected"])

    def test_comprehensive_7_fault_benchmark(self):
        res = run_comprehensive_benchmark(random_seed=42)
        self.assertIn("benchmark_id", res)
        self.assertIn("overall_performance", res)
        self.assertIn("per_fault_breakdown", res)

        expected_faults = [
            "SPIKE_FAULT", "FROZEN_SENSOR", "DRIFT_FAULT", "CROSS_SENSOR_MISMATCH",
            "SENSOR_BIAS", "ABNORMAL_NOISE", "GRADUAL_DEGRADATION"
        ]
        for ft in expected_faults:
            self.assertIn(ft, res["per_fault_breakdown"])
            self.assertGreater(res["per_fault_breakdown"][ft]["n_fault_rows"], 0)

    def test_dbscan_vs_kmeans_comparison(self):
        res = run_dbscan_vs_kmeans_comparison(eps=2.5, min_samples=5, k=3, sample_size=300)
        self.assertIn("kmeans", res)
        self.assertIn("dbscan", res)
        self.assertEqual(res["kmeans"]["clusters_discovered"], 3)
        self.assertIn("noise_points", res["dbscan"])

    def test_experiment_store_lifecycle(self):
        dummy_exp = {"experiment_id": "EXP-TEST-999", "timestamp": "2026-11-03T00:00:00Z", "metric": 0.95}
        exp_id = experiment_store.save_experiment(dummy_exp)
        self.assertEqual(exp_id, "EXP-TEST-999")

        loaded = experiment_store.get_experiment("EXP-TEST-999")
        self.assertEqual(loaded["metric"], 0.95)

        exp_list = experiment_store.list_experiments()
        self.assertGreater(len(exp_list), 0)


class TestModule2ApiEndpoints(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        init_db()
        cls.client = TestClient(app)

    def test_api_kmeans_lab_endpoint(self):
        resp = self.client.post("/api/experiments/kmeans-lab", json={"min_k": 2, "max_k": 3, "batch_size": 256})
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(len(data["results"]), 2)

    def test_api_feature_ablation_endpoint(self):
        resp = self.client.post("/api/experiments/feature-ablation", json={"contamination": 0.08})
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(len(data["ablation_results"]), 3)

    def test_api_cluster_stability_endpoint(self):
        resp = self.client.post("/api/experiments/cluster-stability", json={"k": 3, "n_runs": 2})
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn("pairwise_ari_matrix", data)

    def test_api_benchmark_endpoint(self):
        resp = self.client.post("/api/experiments/benchmark", json={"random_seed": 42})
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn("benchmark_id", data)

    def test_api_dbscan_endpoint(self):
        resp = self.client.post("/api/experiments/dbscan-comparison", json={"eps": 2.5, "sample_size": 200})
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn("dbscan", data)

    def test_api_experiments_history(self):
        resp = self.client.get("/api/experiments/history")
        self.assertEqual(resp.status_code, 200)
        self.assertIsInstance(resp.json(), list)

    def test_api_investigate_alert(self):
        # Insert a mock alert to investigate
        db = SessionLocal()
        alert = Alert(
            timestamp="2026-11-03T12:00:00Z",
            title="Temperature Spike",
            message="Extreme deviation",
            diagnosis_message="Extreme deviation",
            severity="CRITICAL",
            fault_type="SPIKE_FAULT",
            sensor="TEMPERATURE",
        )
        db.add(alert)
        db.commit()
        db.refresh(alert)
        alert_id = alert.id
        db.close()

        resp = self.client.get(f"/api/investigate/alert/{alert_id}")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn("investigation", data)
        self.assertIn("top_feature_deviations", data["investigation"])

    def test_api_drift_endpoint(self):
        resp = self.client.get("/api/monitoring/drift?window_size=100")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn("status", data)


if __name__ == "__main__":
    unittest.main()
