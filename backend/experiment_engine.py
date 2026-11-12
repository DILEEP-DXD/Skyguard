"""
SkyGuard — Module 2 Advanced Unsupervised Learning & Experiment Studio Engine
=============================================================================
Provides rigorous, scientifically defensible unsupervised ML experimentation:
  1. Model Comparison (Isolation Forest vs. Local Outlier Factor)
  2. K-Means Experiment Lab (Inertia, Silhouette, Davies-Bouldin, Calinski-Harabasz)
  3. Feature Ablation Experiments (Raw 3 vs. Raw+Delta 6 vs. Full 12 Temporal)
  4. Cluster Stability Evaluation (Adjusted Rand Index across seeds & resamples)
  5. Explainable Anomaly Investigation (Standardized Z-deviations, Percentiles, Rule-Guided Attribution)
  6. Concept Drift Monitoring (Kolmogorov-Smirnov 2-sample test & Population Stability Index)
  7. Comprehensive Fault Benchmarking (7-fault catalogue with confusion matrix, detection delay, F1)
  8. DBSCAN vs. K-Means comparative clustering analysis
"""

from __future__ import annotations

import os
import sys
import time
import uuid
import json
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

import joblib
import numpy as np
import pandas as pd
import scipy.stats as stats
from sklearn.cluster import AgglomerativeClustering, DBSCAN, MiniBatchKMeans
from sklearn.decomposition import PCA
from sklearn.ensemble import IsolationForest
from sklearn.mixture import GaussianMixture
from sklearn.metrics import (
    adjusted_rand_score,
    calinski_harabasz_score,
    davies_bouldin_score,
    silhouette_score,
)
from sklearn.neighbors import LocalOutlierFactor
from sklearn.preprocessing import StandardScaler

BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BACKEND_DIR, "data")
MODELS_DIR = os.path.join(BACKEND_DIR, "models")
EXPERIMENTS_DIR = os.path.join(BACKEND_DIR, "experiments")
os.makedirs(EXPERIMENTS_DIR, exist_ok=True)

sys.path.insert(0, BACKEND_DIR)
from features import FEATURE_NAMES, WINDOW_SIZE, compute_features_batch, features_to_array
from data_generator import generate_healthy_data, inject_faults


# ──────────────────────────────────────────────────────────────────────────────
# Helper Utilities & Metrics Calculation
# ──────────────────────────────────────────────────────────────────────────────

def calculate_classification_metrics(
    y_true: np.ndarray, y_pred: np.ndarray
) -> Dict[str, float]:
    """
    Computes precision, recall, f1-score, false positive rate, accuracy.
    y_true: bool array (True = fault)
    y_pred: bool array (True = flagged anomaly)
    """
    tp = int(np.sum(y_true & y_pred))
    fp = int(np.sum(~y_true & y_pred))
    fn = int(np.sum(y_true & ~y_pred))
    tn = int(np.sum(~y_true & ~y_pred))

    precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
    recall = tp / (tp + fn) if (tp + fn) > 0 else 0.0
    f1 = 2 * (precision * recall) / (precision + recall) if (precision + recall) > 0 else 0.0
    fpr = fp / (fp + tn) if (fp + tn) > 0 else 0.0
    accuracy = (tp + tn) / len(y_true) if len(y_true) > 0 else 0.0

    return {
        "tp": tp,
        "fp": fp,
        "fn": fn,
        "tn": tn,
        "precision": round(float(precision), 4),
        "recall": round(float(recall), 4),
        "f1_score": round(float(f1), 4),
        "false_positive_rate": round(float(fpr), 4),
        "accuracy": round(float(accuracy), 4),
    }


def compute_detection_delays(
    df_eval: pd.DataFrame, pred_anomalies: np.ndarray
) -> Dict[str, float]:
    """
    Calculates average detection delay (in timesteps/ticks) from the start of a fault window
    to the first anomaly flag raised by the model.
    """
    delays_by_fault: Dict[str, List[int]] = {}
    
    # Identify contiguous fault windows
    in_fault = False
    current_type = None
    start_idx = 0

    for i in range(len(df_eval)):
        ft = df_eval.loc[i, "fault_type"]
        if ft != "NONE" and not in_fault:
            in_fault = True
            current_type = ft
            start_idx = i
        elif (ft == "NONE" or ft != current_type) and in_fault:
            # End of window
            window_slice = pred_anomalies[start_idx:i]
            flagged_indices = np.where(window_slice)[0]
            delay = int(flagged_indices[0]) if len(flagged_indices) > 0 else (i - start_idx)
            delays_by_fault.setdefault(current_type, []).append(delay)
            
            if ft != "NONE":
                in_fault = True
                current_type = ft
                start_idx = i
            else:
                in_fault = False
                current_type = None

    if in_fault and current_type:
        window_slice = pred_anomalies[start_idx : len(df_eval)]
        flagged_indices = np.where(window_slice)[0]
        delay = int(flagged_indices[0]) if len(flagged_indices) > 0 else (len(df_eval) - start_idx)
        delays_by_fault.setdefault(current_type, []).append(delay)

    avg_delays: Dict[str, float] = {}
    for ft, d_list in delays_by_fault.items():
        avg_delays[ft] = round(float(np.mean(d_list)), 2)

    return avg_delays


def calculate_psi(
    expected: np.ndarray, actual: np.ndarray, num_buckets: int = 10
) -> float:
    """
    Population Stability Index (PSI) measuring distributional shift between
    training baseline (expected) and current monitoring window (actual).
    PSI < 0.1: No significant change
    0.1 <= PSI < 0.2: Moderate drift
    PSI >= 0.2: Significant drift
    """
    if len(expected) == 0 or len(actual) == 0:
        return 0.0

    percentiles = np.linspace(0, 100, num_buckets + 1)
    bins = np.percentile(expected, percentiles)
    bins[0] = -np.inf
    bins[-1] = np.inf

    # Ensure monotonic increasing bins
    for i in range(1, len(bins)):
        if bins[i] <= bins[i - 1]:
            bins[i] = bins[i - 1] + 1e-5

    e_counts = np.histogram(expected, bins=bins)[0]
    a_counts = np.histogram(actual, bins=bins)[0]

    e_pct = np.maximum(e_counts / len(expected), 1e-4)
    a_pct = np.maximum(a_counts / len(actual), 1e-4)

    psi = np.sum((a_pct - e_pct) * np.log(a_pct / e_pct))
    return float(psi)


# ──────────────────────────────────────────────────────────────────────────────
# 1. Model Comparison: Isolation Forest vs Local Outlier Factor
# ──────────────────────────────────────────────────────────────────────────────

def run_model_comparison(
    contamination: float = 0.08,
    n_estimators: int = 200,
    n_neighbors: int = 20,
    random_seed: int = 42,
) -> Dict[str, Any]:
    """
    Executes a formal academic comparison between Isolation Forest (tree-based isolation)
    and Local Outlier Factor (density-based local outlier detection).
    Trained strictly on unlabelled healthy baseline, evaluated on controlled fault testset.
    """
    # 1. Load data
    healthy_path = os.path.join(DATA_DIR, "baseline_healthy.csv")
    eval_path = os.path.join(DATA_DIR, "eval_with_faults.csv")

    if not os.path.exists(healthy_path) or not os.path.exists(eval_path):
        df_h = generate_healthy_data(5000, seed=random_seed)
        df_h.to_csv(healthy_path, index=False)
        df_e = inject_faults(df_h, seed=random_seed + 1)
        df_e.to_csv(eval_path, index=False)
    else:
        df_h = pd.read_csv(healthy_path)
        df_e = pd.read_csv(eval_path)

    X_train = compute_features_batch(df_h).values
    X_test = compute_features_batch(df_e).values
    y_true_fault = (df_e["fault_type"] != "NONE").values

    scaler = StandardScaler().fit(X_train)
    X_train_s = scaler.transform(X_train)
    X_test_s = scaler.transform(X_test)

    # 2. Train Isolation Forest
    t0_if_train = time.perf_counter()
    iforest = IsolationForest(
        n_estimators=n_estimators,
        contamination=contamination,
        random_state=random_seed,
        n_jobs=-1,
    )
    iforest.fit(X_train_s)
    if_train_time = (time.perf_counter() - t0_if_train) * 1000

    # 3. Train LOF in novelty mode
    t0_lof_train = time.perf_counter()
    lof = LocalOutlierFactor(
        n_neighbors=n_neighbors,
        contamination=contamination,
        novelty=True,
        n_jobs=-1,
    )
    lof.fit(X_train_s)
    lof_train_time = (time.perf_counter() - t0_lof_train) * 1000

    # 4. Infer on test set
    t0_if_inf = time.perf_counter()
    if_preds = iforest.predict(X_test_s)
    if_inf_time = (time.perf_counter() - t0_if_inf) * 1000

    t0_lof_inf = time.perf_counter()
    lof_preds = lof.predict(X_test_s)
    lof_inf_time = (time.perf_counter() - t0_lof_inf) * 1000

    if_anom = if_preds == -1
    lof_anom = lof_preds == -1

    # Inter-model agreement & disagreement metrics
    both_flagged = int(np.sum(if_anom & lof_anom))
    if_only = int(np.sum(if_anom & ~lof_anom))
    lof_only = int(np.sum(~if_anom & lof_anom))
    neither_flagged = int(np.sum(~if_anom & ~lof_anom))
    agreement_rate = (both_flagged + neither_flagged) / len(X_test)

    # Supervised classification metrics on labelled fault test set
    if_metrics = calculate_classification_metrics(y_true_fault, if_anom)
    lof_metrics = calculate_classification_metrics(y_true_fault, lof_anom)

    # Detection delays
    if_delays = compute_detection_delays(df_e, if_anom)
    lof_delays = compute_detection_delays(df_e, lof_anom)

    # Score distributions
    if_scores = iforest.score_samples(X_test_s)
    lof_scores = lof.score_samples(X_test_s)

    return {
        "experiment_id": f"EXP-CMP-{uuid.uuid4().hex[:8]}",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "n_train_samples": len(X_train),
        "n_test_samples": len(X_test),
        "contamination": contamination,
        "isolation_forest": {
            "hyperparameters": {
                "n_estimators": n_estimators,
                "contamination": contamination,
                "random_state": random_seed,
            },
            "train_duration_ms": round(if_train_time, 2),
            "inference_duration_ms": round(if_inf_time, 2),
            "flagged_count": int(np.sum(if_anom)),
            "score_distribution": {
                "mean": round(float(np.mean(if_scores)), 4),
                "std": round(float(np.std(if_scores)), 4),
                "min": round(float(np.min(if_scores)), 4),
                "max": round(float(np.max(if_scores)), 4),
            },
            "benchmark_metrics": if_metrics,
            "detection_delays": if_delays,
        },
        "local_outlier_factor": {
            "hyperparameters": {
                "n_neighbors": n_neighbors,
                "contamination": contamination,
                "novelty": True,
            },
            "train_duration_ms": round(lof_train_time, 2),
            "inference_duration_ms": round(lof_inf_time, 2),
            "flagged_count": int(np.sum(lof_anom)),
            "score_distribution": {
                "mean": round(float(np.mean(lof_scores)), 4),
                "std": round(float(np.std(lof_scores)), 4),
                "min": round(float(np.min(lof_scores)), 4),
                "max": round(float(np.max(lof_scores)), 4),
            },
            "benchmark_metrics": lof_metrics,
            "detection_delays": lof_delays,
        },
        "consensus_analysis": {
            "both_flagged": both_flagged,
            "if_only": if_only,
            "lof_only": lof_only,
            "neither_flagged": neither_flagged,
            "overall_agreement_rate": round(float(agreement_rate), 4),
        },
    }


# ──────────────────────────────────────────────────────────────────────────────
# 2. K-Means Experiment Lab
# ──────────────────────────────────────────────────────────────────────────────

def run_kmeans_lab(
    k_range: Tuple[int, int] = (2, 8),
    batch_size: int = 512,
    random_seed: int = 42,
) -> Dict[str, Any]:
    """
    Evaluates MiniBatch K-Means across k = 2..8 on the healthy operational feature space.
    Calculates Inertia, Silhouette Score, Davies-Bouldin Index, and Calinski-Harabasz Index.
    """
    healthy_path = os.path.join(DATA_DIR, "baseline_healthy.csv")
    df_h = pd.read_csv(healthy_path)
    X = compute_features_batch(df_h).values
    scaler = StandardScaler().fit(X)
    X_s = scaler.transform(X)

    # Sample up to 1000 for computationally stable silhouette computation
    rng = np.random.default_rng(random_seed)
    sample_idx = rng.choice(len(X_s), size=min(1000, len(X_s)), replace=False)
    X_eval = X_s[sample_idx]

    results_by_k: List[Dict[str, Any]] = []

    for k in range(k_range[0], k_range[1] + 1):
        t0 = time.perf_counter()
        km = MiniBatchKMeans(
            n_clusters=k,
            init="k-means++",
            n_init=10,
            batch_size=batch_size,
            random_state=random_seed,
        )
        km.fit(X_s)
        train_ms = (time.perf_counter() - t0) * 1000

        full_labels = km.predict(X_s)
        sample_labels = full_labels[sample_idx]

        inertia = float(km.inertia_)
        unique_labels = np.unique(sample_labels)

        if len(unique_labels) > 1:
            sil = float(silhouette_score(X_eval, sample_labels))
            db = float(davies_bouldin_score(X_eval, sample_labels))
            ch = float(calinski_harabasz_score(X_eval, sample_labels))
        else:
            sil, db, ch = 0.0, 0.0, 0.0

        # Cluster distribution and feature centroid summaries
        cluster_sizes = [int(np.sum(full_labels == c)) for c in range(k)]
        cluster_percentages = [round(sz / len(full_labels) * 100, 2) for sz in cluster_sizes]

        # Centroids in original telemetry units for interpretability
        centroids_scaled = km.cluster_centers_
        centroids_orig = scaler.inverse_transform(centroids_scaled)
        centroids_summary = []
        for c_idx in range(k):
            centroids_summary.append({
                "cluster_id": c_idx,
                "size": cluster_sizes[c_idx],
                "percentage": cluster_percentages[c_idx],
                "mean_temperature": round(float(centroids_orig[c_idx, 0]), 2),
                "mean_pressure": round(float(centroids_orig[c_idx, 1]), 2),
                "mean_humidity": round(float(centroids_orig[c_idx, 2]), 2),
                "mean_delta_temp": round(float(centroids_orig[c_idx, 3]), 4),
            })

        results_by_k.append({
            "k": k,
            "inertia": round(inertia, 2),
            "silhouette_score": round(sil, 4),
            "davies_bouldin_index": round(db, 4),
            "calinski_harabasz_index": round(ch, 2),
            "train_duration_ms": round(train_ms, 2),
            "cluster_distribution": cluster_sizes,
            "centroids": centroids_summary,
        })

    return {
        "experiment_id": f"EXP-KM-{uuid.uuid4().hex[:8]}",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "k_range": list(k_range),
        "results": results_by_k,
        "interpretative_guidance": (
            "Higher Silhouette and Calinski-Harabasz indicate better separation; "
            "lower Davies-Bouldin indicates tighter clusters. The elbow in Inertia "
            "often reflects the inflection point of operating regimes."
        ),
    }


# ──────────────────────────────────────────────────────────────────────────────
# 3. Feature Ablation Experiments
# ──────────────────────────────────────────────────────────────────────────────

def run_feature_ablation(
    contamination: float = 0.08,
    random_seed: int = 42,
) -> Dict[str, Any]:
    """
    Rigorous academic feature ablation comparing:
      Set A: Raw sensor values [temperature, pressure, humidity] (3 features)
      Set B: Raw + First-order differences [raw + deltas] (6 features)
      Set C: Full verified sliding-window set [raw + deltas + roll_means + roll_stds] (12 features)
    Evaluates impact on detecting specific failure modes (FROZEN_SENSOR, DRIFT_FAULT, etc.).
    """
    healthy_path = os.path.join(DATA_DIR, "baseline_healthy.csv")
    eval_path = os.path.join(DATA_DIR, "eval_with_faults.csv")

    df_h = pd.read_csv(healthy_path)
    df_e = pd.read_csv(eval_path)

    all_feats_h = compute_features_batch(df_h)
    all_feats_e = compute_features_batch(df_e)

    subsets = {
        "RAW_3": {
            "name": "Raw Sensor Readings",
            "features": ["temperature", "pressure", "humidity"],
        },
        "RAW_DELTA_6": {
            "name": "Raw + First-Order Differences",
            "features": [
                "temperature", "pressure", "humidity",
                "delta_temp", "delta_pressure", "delta_humidity",
            ],
        },
        "FULL_12": {
            "name": "Full Temporal Window Feature Set",
            "features": FEATURE_NAMES,
        },
    }

    y_true_fault = (df_e["fault_type"] != "NONE").values
    fault_classes = ["SPIKE_FAULT", "FROZEN_SENSOR", "DRIFT_FAULT", "CROSS_SENSOR_MISMATCH"]

    comparison_results: List[Dict[str, Any]] = []

    for subset_key, cfg in subsets.items():
        cols = cfg["features"]
        X_train = all_feats_h[cols].values
        X_test = all_feats_e[cols].values

        scaler = StandardScaler().fit(X_train)
        X_train_s = scaler.transform(X_train)
        X_test_s = scaler.transform(X_test)

        # Evaluate with LOF (novelty)
        t0 = time.perf_counter()
        lof = LocalOutlierFactor(
            n_neighbors=20, contamination=contamination, novelty=True, n_jobs=-1
        )
        lof.fit(X_train_s)
        train_ms = (time.perf_counter() - t0) * 1000

        t0_inf = time.perf_counter()
        preds = lof.predict(X_test_s)
        inf_ms = (time.perf_counter() - t0_inf) * 1000

        pred_anom = preds == -1
        overall_metrics = calculate_classification_metrics(y_true_fault, pred_anom)
        delays = compute_detection_delays(df_e, pred_anom)

        # Per-fault recall breakdown
        per_fault_recall = {}
        for ft in fault_classes:
            mask = (df_e["fault_type"] == ft).values
            tp = int(np.sum(mask & pred_anom))
            total = int(np.sum(mask))
            per_fault_recall[ft] = round(tp / total, 4) if total > 0 else 0.0

        comparison_results.append({
            "subset_id": subset_key,
            "name": cfg["name"],
            "feature_count": len(cols),
            "features": cols,
            "train_duration_ms": round(train_ms, 2),
            "inference_duration_ms": round(inf_ms, 2),
            "overall_metrics": overall_metrics,
            "per_fault_recall": per_fault_recall,
            "detection_delays": delays,
        })

    return {
        "experiment_id": f"EXP-ABL-{uuid.uuid4().hex[:8]}",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "ablation_results": comparison_results,
        "academic_conclusion": (
            "Temporal rolling features (especially roll_std) are essential to detecting "
            "FROZEN_SENSOR flatlines. Without second-order dispersion metrics, frozen sensors "
            "residing inside standard physical ranges remain virtually invisible to static density estimators."
        ),
    }


# ──────────────────────────────────────────────────────────────────────────────
# 4. Cluster Stability Experiment (Adjusted Rand Index)
# ──────────────────────────────────────────────────────────────────────────────

def run_cluster_stability(
    k: int = 3,
    n_runs: int = 5,
    random_seeds: Optional[List[int]] = None,
) -> Dict[str, Any]:
    """
    Evaluates cluster assignment reproducibility across multiple stochastic runs.
    Calculates pairwise Adjusted Rand Index (ARI), measuring permutation-invariant cluster agreement.
    """
    if random_seeds is None:
        random_seeds = [42, 101, 202, 303, 404][:n_runs]

    healthy_path = os.path.join(DATA_DIR, "baseline_healthy.csv")
    df_h = pd.read_csv(healthy_path)
    X = compute_features_batch(df_h).values
    scaler = StandardScaler().fit(X)
    X_s = scaler.transform(X)

    assignments: List[np.ndarray] = []
    run_details: List[Dict[str, Any]] = []

    for seed in random_seeds:
        t0 = time.perf_counter()
        km = MiniBatchKMeans(
            n_clusters=k,
            init="k-means++",
            n_init=10,
            random_state=seed,
            batch_size=512,
        )
        km.fit(X_s)
        labels = km.predict(X_s)
        dur = (time.perf_counter() - t0) * 1000

        assignments.append(labels)
        run_details.append({
            "seed": seed,
            "inertia": round(float(km.inertia_), 2),
            "duration_ms": round(dur, 2),
            "cluster_sizes": [int(np.sum(labels == c)) for c in range(k)],
        })

    # Pairwise ARI calculation
    ari_matrix = []
    pairwise_scores = []
    for i in range(len(assignments)):
        row = []
        for j in range(len(assignments)):
            score = float(adjusted_rand_score(assignments[i], assignments[j]))
            row.append(round(score, 4))
            if i < j:
                pairwise_scores.append(score)
        ari_matrix.append(row)

    mean_ari = float(np.mean(pairwise_scores)) if pairwise_scores else 1.0
    std_ari = float(np.std(pairwise_scores)) if pairwise_scores else 0.0

    return {
        "experiment_id": f"EXP-STAB-{uuid.uuid4().hex[:8]}",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "k": k,
        "n_runs": len(random_seeds),
        "seeds": random_seeds,
        "runs": run_details,
        "pairwise_ari_matrix": ari_matrix,
        "summary": {
            "mean_ari": round(mean_ari, 4),
            "std_ari": round(std_ari, 4),
            "stability_category": (
                "HIGH_STABILITY" if mean_ari >= 0.75
                else "MODERATE_STABILITY" if mean_ari >= 0.50
                else "LOW_STABILITY"
            ),
        },
    }


# ──────────────────────────────────────────────────────────────────────────────
# 5. Explainable Anomaly Investigation
# ──────────────────────────────────────────────────────────────────────────────

def explain_anomaly_observation(
    observation: Dict[str, float],
    scaler: Optional[StandardScaler] = None,
    baseline_stats: Optional[Dict[str, Dict[str, float]]] = None,
) -> Dict[str, Any]:
    """
    Generates human-readable, evidence-based anomaly investigation diagnostics.
    Computes standardized deviations (z-scores) against healthy baseline and attributes
    dominant anomalous features without claiming unverified causal certainty.
    """
    if scaler is None:
        scaler = joblib.load(os.path.join(MODELS_DIR, "scaler.joblib"))

    # Compute baseline reference stats if not supplied
    if baseline_stats is None:
        healthy_path = os.path.join(DATA_DIR, "baseline_healthy.csv")
        df_h = pd.read_csv(healthy_path)
        feats_h = compute_features_batch(df_h)
        baseline_stats = {}
        for col in FEATURE_NAMES:
            baseline_stats[col] = {
                "mean": float(feats_h[col].mean()),
                "std": float(feats_h[col].std()),
                "p05": float(feats_h[col].quantile(0.05)),
                "p50": float(feats_h[col].quantile(0.50)),
                "p95": float(feats_h[col].quantile(0.95)),
            }

    # Standardized deviations
    feature_deviations: List[Dict[str, Any]] = []
    for col in FEATURE_NAMES:
        val = float(observation.get(col, 0.0))
        ref = baseline_stats.get(col, {"mean": 0.0, "std": 1.0, "p05": 0.0, "p95": 1.0})
        std = ref["std"] if ref["std"] > 1e-6 else 1.0
        z_score = (val - ref["mean"]) / std

        feature_deviations.append({
            "feature": col,
            "observed_value": round(val, 4),
            "baseline_mean": round(ref["mean"], 4),
            "baseline_std": round(std, 4),
            "z_score": round(float(z_score), 3),
            "abs_z_score": round(float(abs(z_score)), 3),
            "is_outlier": abs(z_score) > 3.0,
        })

    # Sort descending by absolute deviation
    feature_deviations.sort(key=lambda d: d["abs_z_score"], reverse=True)
    top_deviations = feature_deviations[:4]

    # Generate rule-guided diagnostic reasoning
    explanations: List[str] = []

    # Check for flatline signature
    for sensor, prefix in [("Temperature", "temp"), ("Pressure", "pressure"), ("Humidity", "humidity")]:
        std_feat = f"roll_std_{prefix}"
        if observation.get(std_feat, 1.0) < 0.005:
            explanations.append(
                f"{sensor} rolling standard deviation ({observation.get(std_feat):.4f}) has dropped "
                f"to near-zero, which strongly indicates sensor stagnation or ADC flatline failure."
            )

    # Check for sudden impulse step
    for sensor, prefix in [("Temperature", "temp"), ("Pressure", "pressure"), ("Humidity", "humidity")]:
        delta_feat = f"delta_{prefix}"
        val = observation.get(delta_feat, 0.0)
        ref = baseline_stats.get(delta_feat, {"std": 1.0})
        if abs(val) > 4.0 * max(ref["std"], 0.1):
            explanations.append(
                f"{sensor} first difference ({val:+.2f}) deviates drastically from nominal dynamics "
                f"(>4σ), consistent with an instantaneous voltage or electrostatic spike."
            )

    # Check for persistent drift
    for sensor, prefix in [("Temperature", "temp"), ("Pressure", "pressure"), ("Humidity", "humidity")]:
        mean_feat = f"roll_mean_{prefix}"
        val = observation.get(mean_feat, 0.0)
        ref = baseline_stats.get(mean_feat, {"mean": 0.0, "std": 1.0})
        z = abs(val - ref["mean"]) / max(ref["std"], 0.1)
        if z > 3.5:
            explanations.append(
                f"{sensor} rolling mean ({val:.2f}) has drifted substantially away from the seasonal baseline "
                f"({ref['mean']:.2f}, z={z:.1f}), characteristic of transducer calibration slippage."
            )

    if not explanations:
        top_f = top_deviations[0]
        explanations.append(
            f"Observation flagged by unsupervised ensemble based on joint multivariate divergence; "
            f"primary contributor is '{top_f['feature']}' (z={top_f['z_score']:+.2f})."
        )

    return {
        "timestamp": observation.get("timestamp", datetime.now(timezone.utc).isoformat()),
        "top_feature_deviations": top_deviations,
        "diagnostic_explanations": explanations,
        "confidence_level": "EVIDENTIARY_CORRELATION",
        "attribution_note": (
            "Feature deviations highlight supporting statistical evidence and do not prove root-cause causality."
        ),
    }


# ──────────────────────────────────────────────────────────────────────────────
# 6. Concept Drift Monitoring
# ──────────────────────────────────────────────────────────────────────────────

def evaluate_concept_drift(
    current_window: pd.DataFrame,
    baseline_df: Optional[pd.DataFrame] = None,
    ks_alpha: float = 0.01,
    psi_threshold: float = 0.20,
) -> Dict[str, Any]:
    """
    Monitors streaming distribution shift comparing current sliding window to the baseline.
    Computes Kolmogorov-Smirnov 2-sample test and Population Stability Index (PSI).
    """
    if baseline_df is None:
        healthy_path = os.path.join(DATA_DIR, "baseline_healthy.csv")
        baseline_df = pd.read_csv(healthy_path)

    if len(current_window) < 30:
        return {
            "status": "INSUFFICIENT_DATA",
            "message": f"Requires at least 30 observations for valid drift testing (got {len(current_window)}).",
            "drift_detected": False,
            "feature_metrics": {},
        }

    drift_report: Dict[str, Any] = {}
    drift_flagged_count = 0
    test_features = ["temperature", "pressure", "humidity"]

    for col in test_features:
        base_vals = baseline_df[col].values
        curr_vals = current_window[col].values

        # Kolmogorov-Smirnov two-sample test
        ks_stat, ks_pval = stats.ks_2samp(base_vals, curr_vals)

        # Population Stability Index
        psi_val = calculate_psi(base_vals, curr_vals)

        is_drift = bool(ks_pval < ks_alpha and psi_val >= psi_threshold)
        if is_drift:
            drift_flagged_count += 1

        drift_report[col] = {
            "ks_statistic": round(float(ks_stat), 4),
            "ks_pvalue": round(float(ks_pval), 6),
            "psi": round(float(psi_val), 4),
            "ks_drift_flag": bool(ks_pval < ks_alpha),
            "psi_drift_flag": bool(psi_val >= psi_threshold),
            "drift_status": (
                "CRITICAL_DRIFT" if psi_val >= 0.25 and ks_pval < 0.001
                else "MODERATE_DRIFT" if psi_val >= 0.10
                else "STABLE"
            ),
        }

    overall_drift = drift_flagged_count > 0

    return {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "baseline_sample_size": len(baseline_df),
        "current_sample_size": len(current_window),
        "overall_drift_detected": overall_drift,
        "features_evaluated": drift_report,
        "recommendation": (
            "Sustained distribution drift detected across weather sensors. "
            "Consider validating station calibration or scheduling a versioned model recalibration."
            if overall_drift else "Sensor distributions are stable relative to training baseline."
        ),
    }


# ──────────────────────────────────────────────────────────────────────────────
# 7. Comprehensive Fault Benchmarking Engine
# ──────────────────────────────────────────────────────────────────────────────

def inject_extended_benchmark_suite(
    df_clean: pd.DataFrame, seed: int = 43
) -> pd.DataFrame:
    """
    Injects the comprehensive 7-fault hardware simulation suite:
      1. SPIKE_FAULT: High-voltage ADC step
      2. FROZEN_SENSOR: Transducer stagnation
      3. DRIFT_FAULT: Linear calibration slip
      4. CROSS_SENSOR_MISMATCH: Thermodynamic contradiction
      5. SENSOR_BIAS: Constant calibration offset
      6. ABNORMAL_NOISE: Excessive high-frequency noise
      7. GRADUAL_DEGRADATION: Non-linear decaying polynomial drift
    """
    rng = np.random.default_rng(seed)
    df = df_clean.copy()
    n = len(df)

    FAULT_PLAN = [
        ("SPIKE_FAULT", 20, (1, 3)),
        ("FROZEN_SENSOR", 4, (20, 35)),
        ("DRIFT_FAULT", 3, (30, 50)),
        ("CROSS_SENSOR_MISMATCH", 5, (10, 18)),
        ("SENSOR_BIAS", 3, (25, 45)),
        ("ABNORMAL_NOISE", 4, (15, 30)),
        ("GRADUAL_DEGRADATION", 3, (35, 60)),
    ]

    occupied = np.zeros(n, dtype=bool)
    occupied[:50] = True

    windows: List[Tuple[int, int, str]] = []
    for ft, count, (min_d, max_d) in FAULT_PLAN:
        for _ in range(count):
            dur = int(rng.integers(min_d, max_d + 1))
            for _attempt in range(200):
                start = int(rng.integers(50, n - dur - 1))
                if not np.any(occupied[start : start + dur]):
                    occupied[start : start + dur] = True
                    windows.append((start, start + dur, ft))
                    break

    for start, end, ft in windows:
        dur = end - start
        df.loc[start : end - 1, "fault_type"] = ft

        if ft == "SPIKE_FAULT":
            ch = rng.choice(["temperature", "pressure", "humidity"])
            sign = rng.choice([-1, 1])
            mag = float(rng.uniform(25, 50))
            df.loc[start : end - 1, ch] += sign * mag

        elif ft == "FROZEN_SENSOR":
            ch = rng.choice(["temperature", "pressure", "humidity"])
            fz = df.loc[start, ch]
            df.loc[start : end - 1, ch] = fz

        elif ft == "DRIFT_FAULT":
            ch = rng.choice(["temperature", "pressure", "humidity"])
            sign = rng.choice([-1, 1])
            drift = np.linspace(0, sign * rng.uniform(10, 20), dur)
            df.loc[start : end - 1, ch] += drift

        elif ft == "CROSS_SENSOR_MISMATCH":
            df.loc[start : end - 1, "pressure"] -= np.linspace(0, 25, dur)
            df.loc[start : end - 1, "humidity"] = np.clip(
                df.loc[start : end - 1, "humidity"] - np.linspace(0, 35, dur), 0, 100
            )

        elif ft == "SENSOR_BIAS":
            ch = rng.choice(["temperature", "pressure", "humidity"])
            bias = float(rng.uniform(6.0, 15.0) * rng.choice([-1, 1]))
            df.loc[start : end - 1, ch] += bias

        elif ft == "ABNORMAL_NOISE":
            ch = rng.choice(["temperature", "pressure", "humidity"])
            noise = rng.normal(0, 6.0, dur)
            df.loc[start : end - 1, ch] += noise

        elif ft == "GRADUAL_DEGRADATION":
            ch = rng.choice(["temperature", "pressure", "humidity"])
            t_norm = np.linspace(0, 1, dur)
            degrade = 18.0 * (t_norm ** 2)
            df.loc[start : end - 1, ch] += degrade

    for c in ["temperature", "pressure", "humidity"]:
        df[c] = df[c].round(3)

    return df


def run_comprehensive_benchmark(random_seed: int = 42) -> Dict[str, Any]:
    """
    Executes an end-to-end controlled benchmark on the 7-fault hardware catalogue.
    Evaluates both Isolation Forest and Local Outlier Factor, recording detailed confusion
    matrices, precision, recall, F1, FPR, and detection delays per failure mode.
    """
    df_h = generate_healthy_data(5000, seed=random_seed)
    df_e = inject_extended_benchmark_suite(df_h, seed=random_seed + 1)

    X_train = compute_features_batch(df_h).values
    X_test = compute_features_batch(df_e).values
    y_true = (df_e["fault_type"] != "NONE").values

    scaler = StandardScaler().fit(X_train)
    X_train_s = scaler.transform(X_train)
    X_test_s = scaler.transform(X_test)

    # Fit detectors
    iforest = IsolationForest(n_estimators=200, contamination=0.08, random_state=random_seed).fit(X_train_s)
    lof = LocalOutlierFactor(n_neighbors=20, contamination=0.08, novelty=True).fit(X_train_s)

    if_pred = iforest.predict(X_test_s) == -1
    lof_pred = lof.predict(X_test_s) == -1
    ensemble_pred = if_pred | lof_pred

    all_faults = [
        "SPIKE_FAULT",
        "FROZEN_SENSOR",
        "DRIFT_FAULT",
        "CROSS_SENSOR_MISMATCH",
        "SENSOR_BIAS",
        "ABNORMAL_NOISE",
        "GRADUAL_DEGRADATION",
    ]

    per_fault_breakdown: Dict[str, Any] = {}
    for ft in all_faults:
        mask = (df_e["fault_type"] == ft).values
        n_rows = int(np.sum(mask))
        if n_rows == 0:
            continue

        per_fault_breakdown[ft] = {
            "n_fault_rows": n_rows,
            "isolation_forest": {
                "tp": int(np.sum(mask & if_pred)),
                "recall": round(float(np.sum(mask & if_pred) / n_rows), 4),
            },
            "lof": {
                "tp": int(np.sum(mask & lof_pred)),
                "recall": round(float(np.sum(mask & lof_pred) / n_rows), 4),
            },
            "ensemble": {
                "tp": int(np.sum(mask & ensemble_pred)),
                "recall": round(float(np.sum(mask & ensemble_pred) / n_rows), 4),
            },
        }

    overall_if = calculate_classification_metrics(y_true, if_pred)
    overall_lof = calculate_classification_metrics(y_true, lof_pred)
    overall_ens = calculate_classification_metrics(y_true, ensemble_pred)

    if_delays = compute_detection_delays(df_e, if_pred)
    lof_delays = compute_detection_delays(df_e, lof_pred)

    return {
        "benchmark_id": f"BMK-{uuid.uuid4().hex[:8]}",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "total_test_observations": len(df_e),
        "total_fault_observations": int(np.sum(y_true)),
        "fault_percentage": round(float(np.sum(y_true) / len(df_e) * 100), 2),
        "overall_performance": {
            "isolation_forest": overall_if,
            "local_outlier_factor": overall_lof,
            "ensemble_max_pooling": overall_ens,
        },
        "per_fault_breakdown": per_fault_breakdown,
        "detection_delays": {
            "isolation_forest": if_delays,
            "local_outlier_factor": lof_delays,
        },
        "benchmark_disclaimer": (
            "These metrics originate from offline controlled benchmark simulations and "
            "represent theoretical detector capacity under known hardware failure models."
        ),
    }


# ──────────────────────────────────────────────────────────────────────────────
# 8. Comparative Analysis: DBSCAN vs. K-Means
# ──────────────────────────────────────────────────────────────────────────────

def run_dbscan_vs_kmeans_comparison(
    eps: float = 2.5,
    min_samples: int = 5,
    k: int = 3,
    sample_size: int = 1000,
    random_seed: int = 42,
) -> Dict[str, Any]:
    """
    Academic comparative analysis contrasting centroid-based partitioning (K-Means)
    with density-based spatial clustering with noise (DBSCAN).
    """
    healthy_path = os.path.join(DATA_DIR, "baseline_healthy.csv")
    df_h = pd.read_csv(healthy_path)
    X = compute_features_batch(df_h).values
    scaler = StandardScaler().fit(X)
    X_s = scaler.transform(X)

    rng = np.random.default_rng(random_seed)
    idx = rng.choice(len(X_s), size=min(sample_size, len(X_s)), replace=False)
    X_sub = X_s[idx]

    # 1. K-Means
    t0_km = time.perf_counter()
    km = MiniBatchKMeans(n_clusters=k, init="k-means++", n_init=10, random_state=random_seed)
    km_labels = km.fit_predict(X_sub)
    km_ms = (time.perf_counter() - t0_km) * 1000

    km_sil = float(silhouette_score(X_sub, km_labels))
    km_db = float(davies_bouldin_score(X_sub, km_labels))
    km_ch = float(calinski_harabasz_score(X_sub, km_labels))

    # 2. DBSCAN
    t0_db = time.perf_counter()
    dbscan = DBSCAN(eps=eps, min_samples=min_samples)
    db_labels = dbscan.fit_predict(X_sub)
    db_ms = (time.perf_counter() - t0_db) * 1000

    noise_count = int(np.sum(db_labels == -1))
    core_clusters = set(db_labels) - {-1}

    # Evaluate DBSCAN on non-noise points if multiple clusters exist
    non_noise_mask = db_labels != -1
    if len(core_clusters) > 1 and np.sum(non_noise_mask) > 10:
        db_sil = float(silhouette_score(X_sub[non_noise_mask], db_labels[non_noise_mask]))
        db_dbi = float(davies_bouldin_score(X_sub[non_noise_mask], db_labels[non_noise_mask]))
        db_ch  = float(calinski_harabasz_score(X_sub[non_noise_mask], db_labels[non_noise_mask]))
    else:
        db_sil, db_dbi, db_ch = 0.0, 0.0, 0.0

    # 3. Agglomerative Hierarchical Clustering (Linkage & Dendrogram analysis)
    t0_agg = time.perf_counter()
    agg = AgglomerativeClustering(n_clusters=k, linkage="ward", compute_distances=True)
    agg_labels = agg.fit_predict(X_sub)
    agg_ms = (time.perf_counter() - t0_agg) * 1000
    agg_sil = float(silhouette_score(X_sub, agg_labels))
    agg_db  = float(davies_bouldin_score(X_sub, agg_labels))
    agg_ch  = float(calinski_harabasz_score(X_sub, agg_labels))

    # Dendrogram merge summary (last 6 hierarchical merges)
    top_merges = []
    if hasattr(agg, "distances_") and agg.distances_ is not None:
        for idx_m, (children, dist) in enumerate(zip(agg.children_[-6:], agg.distances_[-6:])):
            top_merges.append({
                "step": idx_m + 1,
                "node_a": int(children[0]),
                "node_b": int(children[1]),
                "merge_distance": round(float(dist), 3),
            })

    # 4. Gaussian Mixture Models (Soft Probabilistic EM Clustering)
    t0_gmm = time.perf_counter()
    gmm = GaussianMixture(n_components=k, covariance_type="full", random_state=random_seed)
    gmm_labels = gmm.fit_predict(X_sub)
    gmm_ms = (time.perf_counter() - t0_gmm) * 1000
    gmm_sil = float(silhouette_score(X_sub, gmm_labels)) if len(np.unique(gmm_labels)) > 1 else 0.0
    gmm_db  = float(davies_bouldin_score(X_sub, gmm_labels)) if len(np.unique(gmm_labels)) > 1 else 0.0
    gmm_ch  = float(calinski_harabasz_score(X_sub, gmm_labels)) if len(np.unique(gmm_labels)) > 1 else 0.0
    gmm_bic = float(gmm.bic(X_sub))
    gmm_aic = float(gmm.aic(X_sub))

    return {
        "experiment_id": f"EXP-CMP-{uuid.uuid4().hex[:8]}",
        "sample_size": len(X_sub),
        "kmeans": {
            "paradigm": "Centroid-based geometric partitioning",
            "k": k,
            "duration_ms": round(km_ms, 2),
            "silhouette_score": round(km_sil, 4),
            "davies_bouldin_index": round(km_db, 4),
            "calinski_harabasz_index": round(km_ch, 2),
            "inertia": round(float(km.inertia_), 2),
            "clusters_discovered": k,
            "noise_handling": "Forces all points into nearest centroid (no noise class)",
        },
        "dbscan": {
            "paradigm": "Density-based connectivity partitioning",
            "hyperparameters": {"eps": eps, "min_samples": min_samples},
            "duration_ms": round(db_ms, 2),
            "clusters_discovered": len(core_clusters),
            "noise_points": noise_count,
            "noise_percentage": round(noise_count / len(X_sub) * 100, 2),
            "core_silhouette_score": round(db_sil, 4),
            "core_davies_bouldin": round(db_dbi, 4),
            "core_calinski_harabasz": round(db_ch, 2),
            "noise_handling": "Explicit noise class (-1) for low-density spatial outliers",
        },
        "agglomerative": {
            "paradigm": "Hierarchical bottom-up tree merging (Ward linkage)",
            "k": k,
            "linkage": "ward",
            "duration_ms": round(agg_ms, 2),
            "silhouette_score": round(agg_sil, 4),
            "davies_bouldin_index": round(agg_db, 4),
            "calinski_harabasz_index": round(agg_ch, 2),
            "dendrogram_merges": top_merges,
        },
        "gmm": {
            "paradigm": "Expectation-Maximization soft probabilistic clustering",
            "n_components": k,
            "duration_ms": round(gmm_ms, 2),
            "bic": round(gmm_bic, 2),
            "aic": round(gmm_aic, 2),
            "silhouette_score": round(gmm_sil, 4),
            "davies_bouldin_index": round(gmm_db, 4),
            "calinski_harabasz_index": round(gmm_ch, 2),
            "converged": bool(gmm.converged_),
        },
        "comparative_insights": [
            "K-Means enforces spherical partitions and assigns every observation to a regime.",
            "DBSCAN detects arbitrary density structures and explicitly isolates low-density noise.",
            "Agglomerative Clustering builds a hierarchical tree revealing progressive merge thresholds.",
            "Gaussian Mixture Model fits full covariance ellipsoids with soft posterior regime probabilities."
        ],
    }


def run_hierarchical_clustering_lab(
    n_clusters: int = 3,
    linkage: str = "ward",
    sample_size: int = 300,
    random_seed: int = 42,
) -> Dict[str, Any]:
    """
    Evaluates Agglomerative Hierarchical Clustering with linkage tree extraction.
    """
    healthy_path = os.path.join(DATA_DIR, "baseline_healthy.csv")
    df_h = pd.read_csv(healthy_path)
    X = compute_features_batch(df_h).values
    scaler = StandardScaler().fit(X)
    X_s = scaler.transform(X)

    rng = np.random.default_rng(random_seed)
    idx = rng.choice(len(X_s), size=min(sample_size, len(X_s)), replace=False)
    X_sub = X_s[idx]

    t0 = time.perf_counter()
    agg = AgglomerativeClustering(n_clusters=n_clusters, linkage=linkage, compute_distances=True)
    labels = agg.fit_predict(X_sub)
    duration_ms = (time.perf_counter() - t0) * 1000

    sil = float(silhouette_score(X_sub, labels))
    dbi = float(davies_bouldin_score(X_sub, labels))
    chi = float(calinski_harabasz_score(X_sub, labels))

    merges = []
    if hasattr(agg, "distances_") and agg.distances_ is not None:
        for idx_m, (children, dist) in enumerate(zip(agg.children_[-12:], agg.distances_[-12:])):
            merges.append({
                "step": idx_m + 1,
                "node_a": int(children[0]),
                "node_b": int(children[1]),
                "distance": round(float(dist), 3)
            })

    cluster_counts = [int(np.sum(labels == c)) for c in range(n_clusters)]

    return {
        "experiment_id": f"EXP-HIER-{uuid.uuid4().hex[:8]}",
        "n_clusters": n_clusters,
        "linkage": linkage,
        "sample_size": len(X_sub),
        "duration_ms": round(duration_ms, 2),
        "silhouette_score": round(sil, 4),
        "davies_bouldin_index": round(dbi, 4),
        "calinski_harabasz_index": round(chi, 2),
        "cluster_distribution": cluster_counts,
        "dendrogram_merges": merges,
    }


def run_gmm_lab(
    min_components: int = 2,
    max_components: int = 8,
    sample_size: int = 500,
    random_seed: int = 42,
) -> Dict[str, Any]:
    """
    Evaluates Gaussian Mixture Models across component range with BIC, AIC, and log-likelihood.
    """
    healthy_path = os.path.join(DATA_DIR, "baseline_healthy.csv")
    df_h = pd.read_csv(healthy_path)
    X = compute_features_batch(df_h).values
    scaler = StandardScaler().fit(X)
    X_s = scaler.transform(X)

    rng = np.random.default_rng(random_seed)
    idx = rng.choice(len(X_s), size=min(sample_size, len(X_s)), replace=False)
    X_sub = X_s[idx]

    components_results = []
    for k in range(min_components, max_components + 1):
        t0 = time.perf_counter()
        gmm = GaussianMixture(n_components=k, covariance_type="full", random_state=random_seed, max_iter=100)
        labels = gmm.fit_predict(X_sub)
        dur = (time.perf_counter() - t0) * 1000

        bic = float(gmm.bic(X_sub))
        aic = float(gmm.aic(X_sub))
        log_lik = float(gmm.score(X_sub))
        sil = float(silhouette_score(X_sub, labels)) if len(np.unique(labels)) > 1 else 0.0

        components_results.append({
            "k": k,
            "bic": round(bic, 2),
            "aic": round(aic, 2),
            "log_likelihood": round(log_lik, 4),
            "silhouette_score": round(sil, 4),
            "duration_ms": round(dur, 2),
            "converged": bool(gmm.converged_),
        })

    return {
        "experiment_id": f"EXP-GMM-{uuid.uuid4().hex[:8]}",
        "sample_size": len(X_sub),
        "results": components_results,
    }


# ──────────────────────────────────────────────────────────────────────────────
# 9. Persistent Experiment Store
# ──────────────────────────────────────────────────────────────────────────────

class ExperimentStore:
    """Manages serialization, retrieval, and comparison of experiment records."""

    def __init__(self, storage_dir: str = EXPERIMENTS_DIR):
        self.storage_dir = storage_dir
        os.makedirs(self.storage_dir, exist_ok=True)

    def save_experiment(self, exp_data: Dict[str, Any]) -> str:
        exp_id = exp_data.get("experiment_id", f"EXP-{uuid.uuid4().hex[:8]}")
        filepath = os.path.join(self.storage_dir, f"{exp_id}.json")
        with open(filepath, "w") as f:
            json.dump(exp_data, f, indent=2)
        return exp_id

    def get_experiment(self, exp_id: str) -> Optional[Dict[str, Any]]:
        filepath = os.path.join(self.storage_dir, f"{exp_id}.json")
        if not os.path.exists(filepath):
            return None
        with open(filepath, "r") as f:
            return json.load(f)

    def list_experiments(self) -> List[Dict[str, Any]]:
        entries = []
        for fname in sorted(os.listdir(self.storage_dir), reverse=True):
            if fname.endswith(".json"):
                fpath = os.path.join(self.storage_dir, fname)
                try:
                    with open(fpath, "r") as f:
                        data = json.load(f)
                    entries.append({
                        "experiment_id": data.get("experiment_id", fname[:-5]),
                        "timestamp": data.get("timestamp", ""),
                        "type": data.get("experiment_id", "")[:10],
                        "summary": {k: v for k, v in data.items() if k not in ["results", "pairwise_ari_matrix", "ablation_results"]},
                    })
                except Exception:
                    continue
        return entries


experiment_store = ExperimentStore()
