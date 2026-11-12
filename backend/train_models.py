"""
SkyGuard — Unsupervised Model Training Script
=============================================
Trains and persists all four ML models + StandardScaler on the healthy
baseline dataset, then computes a pre-generated analytics snapshot on the
evaluation (fault-injected) dataset.

Artifacts written to  backend/models/
──────────────────────────────────────
  scaler.joblib              – StandardScaler fitted on healthy features
  isolation_forest.joblib    – IsolationForest (global anomaly detection)
  lof.joblib                 – LocalOutlierFactor novelty=True (density-based)
  kmeans.joblib              – MiniBatchKMeans n_clusters=3 (regime clustering)
  pca.joblib                 – PCA n_components=2 (real-time 2-D projection)
  analytics_snapshot.json    – Pre-computed 500-point evaluation snapshot

Snapshot schema (all arrays are parallel; index i refers to the same row)
─────────────────────────────────────────────────────────────────────────
{
  "pca_coords":          [[x, y], ...],        # 500 × 2  from PCA
  "tsne_coords":         [[x, y], ...],        # 500 × 2  from t-SNE
  "kmeans_labels":       [int, ...],           # 0/1/2  cluster ids
  "dbscan_labels":       [int, ...],           # 0,1,… or -1 (noise)
  "if_labels":           [int, ...],           # 1=normal, -1=anomaly
  "lof_labels":          [int, ...],           # 1=normal, -1=anomaly
  "fault_types":         ["NONE"|"SPIKE_FAULT"|…, ...],
  "metrics": {
    "silhouette":        float,
    "davies_bouldin":    float,
    "wcss":              float                 # KMeans inertia on 500 pts
  },
  "detection": {
    "<fault_type>": {
      "isolation_forest": {"tp": int, "fp": int, "fn": int, "precision": float, "recall": float},
      "lof":              {...},
      "dbscan":           {...}
    }, ...
  }
}
"""

from __future__ import annotations

import json
import os
import sys
import time

import joblib
import numpy as np
import pandas as pd
from sklearn.cluster import DBSCAN, MiniBatchKMeans
from sklearn.decomposition import PCA
from sklearn.ensemble import IsolationForest
from sklearn.manifold import TSNE
from sklearn.metrics import calinski_harabasz_score, davies_bouldin_score, silhouette_score
from sklearn.mixture import GaussianMixture
from sklearn.neighbors import LocalOutlierFactor
from sklearn.preprocessing import StandardScaler

# ── Path setup ────────────────────────────────────────────────────────────────
BACKEND_DIR  = os.path.dirname(os.path.abspath(__file__))
DATA_DIR     = os.path.join(BACKEND_DIR, "data")
MODELS_DIR   = os.path.join(BACKEND_DIR, "models")
os.makedirs(MODELS_DIR, exist_ok=True)

sys.path.insert(0, BACKEND_DIR)
from features import compute_features_batch, FEATURE_NAMES

# ── Hyper-parameters ──────────────────────────────────────────────────────────
SNAPSHOT_N    = 500
IF_CONTAMINATION  = 0.08   # expected ~8 % anomaly rate on clean baseline
LOF_CONTAMINATION = 0.08
LOF_N_NEIGHBORS   = 20
KMEANS_N_CLUSTERS = 3
DBSCAN_EPS        = 2.5
DBSCAN_MIN_SAMPLES = 5
RNG_SEED = 42


# ──────────────────────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────────────────────

def _banner(msg: str) -> None:
    print(f"\n{'-' * 60}")
    print(f"  {msg}")
    print(f"{'-' * 60}")


def _save(obj, name: str) -> str:
    path = os.path.join(MODELS_DIR, name)
    joblib.dump(obj, path)
    size_kb = os.path.getsize(path) / 1024
    print(f"  [saved] {name}  ({size_kb:.1f} KB)")
    return path


def _detection_metrics(
    true_fault: np.ndarray,   # bool array — True where row is a real fault
    pred_anomaly: np.ndarray, # bool array — True where model flagged anomaly
    fault_mask: np.ndarray,   # bool array — True where fault_type == this type
) -> dict:
    """
    Per-fault-type detection breakdown.
    tp = correctly flagged fault rows of this type
    fp = normal rows incorrectly flagged (global across ALL predictions)
    fn = fault rows of this type missed by the model
    """
    tp = int(np.sum(fault_mask & pred_anomaly))
    fn = int(np.sum(fault_mask & ~pred_anomaly))
    fp = int(np.sum(~true_fault & pred_anomaly))

    precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
    recall    = tp / (tp + fn) if (tp + fn) > 0 else 0.0

    return {
        "tp": tp, "fp": fp, "fn": fn,
        "precision": round(precision, 4),
        "recall":    round(recall, 4),
    }


# ──────────────────────────────────────────────────────────────────────────────
# STEP 1 — Load & featurise healthy data
# ──────────────────────────────────────────────────────────────────────────────

def load_and_featurise_healthy() -> pd.DataFrame:
    path = os.path.join(DATA_DIR, "baseline_healthy.csv")
    if not os.path.exists(path):
        raise FileNotFoundError(
            f"Healthy baseline not found at {path}.\n"
            "Run  python data_generator.py  first."
        )
    df = pd.read_csv(path, parse_dates=["timestamp"])
    feats = compute_features_batch(df)
    print(f"  Healthy dataset: {df.shape[0]:,} rows → {feats.shape[1]} features")
    return feats


# ──────────────────────────────────────────────────────────────────────────────
# STEP 2 — Load & featurise eval data
# ──────────────────────────────────────────────────────────────────────────────

def load_and_featurise_eval() -> tuple[pd.DataFrame, np.ndarray]:
    path = os.path.join(DATA_DIR, "eval_with_faults.csv")
    if not os.path.exists(path):
        raise FileNotFoundError(
            f"Evaluation dataset not found at {path}.\n"
            "Run  python data_generator.py  first."
        )
    df = pd.read_csv(path, parse_dates=["timestamp"])
    feats = compute_features_batch(df)
    fault_labels = df["fault_type"].values
    print(f"  Eval dataset: {df.shape[0]:,} rows → {feats.shape[1]} features")
    return feats, fault_labels


# ──────────────────────────────────────────────────────────────────────────────
# STEP 3 — Train models on healthy data
# ──────────────────────────────────────────────────────────────────────────────

def train_and_save(X_healthy_raw: pd.DataFrame) -> dict:
    """Fit scaler + all models. Returns trained objects."""
    # 3a. StandardScaler
    print("\n  Fitting StandardScaler …")
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X_healthy_raw.values)
    _save(scaler, "scaler.joblib")

    # 3b. IsolationForest
    print("  Training IsolationForest …")
    t0 = time.time()
    iforest = IsolationForest(
        n_estimators=200,
        contamination=IF_CONTAMINATION,
        max_features=1.0,
        random_state=RNG_SEED,
        n_jobs=-1,
    )
    iforest.fit(X_scaled)
    print(f"    done in {time.time()-t0:.2f}s")
    _save(iforest, "isolation_forest.joblib")

    # 3c. LocalOutlierFactor (novelty mode)
    print("  Training LocalOutlierFactor (novelty=True) …")
    t0 = time.time()
    lof = LocalOutlierFactor(
        n_neighbors=LOF_N_NEIGHBORS,
        contamination=LOF_CONTAMINATION,
        novelty=True,
        n_jobs=-1,
    )
    lof.fit(X_scaled)
    print(f"    done in {time.time()-t0:.2f}s")
    _save(lof, "lof.joblib")

    # 3d. MiniBatchKMeans
    print(f"  Training MiniBatchKMeans (n_clusters={KMEANS_N_CLUSTERS}) …")
    t0 = time.time()
    kmeans = MiniBatchKMeans(
        n_clusters=KMEANS_N_CLUSTERS,
        init="k-means++",
        n_init=10,
        random_state=RNG_SEED,
        batch_size=512,
    )
    kmeans.fit(X_scaled)
    print(f"    done in {time.time()-t0:.2f}s  |  inertia={kmeans.inertia_:.2f}")
    _save(kmeans, "kmeans.joblib")

    # 3e. PCA (2-D projection for real-time inference)
    print("  Fitting PCA (n_components=2) …")
    pca = PCA(n_components=2, random_state=RNG_SEED)
    pca.fit(X_scaled)
    evr = pca.explained_variance_ratio_
    print(f"    Explained variance: PC1={evr[0]*100:.1f}%  PC2={evr[1]*100:.1f}%  "
          f"total={sum(evr)*100:.1f}%")
    _save(pca, "pca.joblib")

    # 3f. 12-Component PCA Scree Analysis & Feature Loadings
    print("  Computing full 12-component PCA Scree Analysis & Loadings …")
    pca_full = PCA(n_components=X_scaled.shape[1], random_state=RNG_SEED)
    pca_full.fit(X_scaled)
    evr_full = [round(float(v), 4) for v in pca_full.explained_variance_ratio_]
    cum_var = [round(float(v), 4) for v in np.cumsum(pca_full.explained_variance_ratio_)]
    eigenvalues = [round(float(v), 4) for v in pca_full.explained_variance_]

    top_pc1 = sorted(
        [{"feature": feat, "loading": round(float(val), 4)} for feat, val in zip(FEATURE_NAMES, pca_full.components_[0])],
        key=lambda x: abs(x["loading"]),
        reverse=True,
    )
    top_pc2 = sorted(
        [{"feature": feat, "loading": round(float(val), 4)} for feat, val in zip(FEATURE_NAMES, pca_full.components_[1])],
        key=lambda x: abs(x["loading"]),
        reverse=True,
    )
    pca_scree = {
        "n_components": len(evr_full),
        "explained_variance_ratio": evr_full,
        "cumulative_variance_ratio": cum_var,
        "eigenvalues": eigenvalues,
        "top_loadings_pc1": top_pc1,
        "top_loadings_pc2": top_pc2,
    }

    # Sample for stable intrinsic validation sweeps
    rng_sweep = np.random.default_rng(RNG_SEED)
    sweep_sample_n = min(2000, len(X_scaled))
    idx_sweep = rng_sweep.choice(len(X_scaled), size=sweep_sample_n, replace=False)
    X_sweep = X_scaled[idx_sweep]

    # 3g. K-Means Optimal K Justification Sweep (k=2..10)
    print("  Running K-Means Optimal K sweep (k=2..10) on healthy baseline …")
    elbow_curve = []
    for k in range(2, 11):
        km_k = MiniBatchKMeans(
            n_clusters=k,
            init="k-means++",
            n_init=10,
            random_state=RNG_SEED,
            batch_size=512,
        )
        km_k.fit(X_scaled)
        preds_k = km_k.predict(X_sweep)
        sil = float(silhouette_score(X_sweep, preds_k))
        db = float(davies_bouldin_score(X_sweep, preds_k))
        ch = float(calinski_harabasz_score(X_sweep, preds_k))
        elbow_curve.append({
            "k": k,
            "wcss": round(float(km_k.inertia_), 2),
            "silhouette": round(sil, 4),
            "davies_bouldin": round(db, 4),
            "calinski_harabasz": round(ch, 2),
        })

    # 3h. Gaussian Mixture Models (BIC/AIC curve k=2..8 & Primary Fit)
    print("  Running GMM BIC/AIC component sweep (k=2..8) …")
    gmm_curve = []
    for k in range(2, 9):
        gmm_k = GaussianMixture(
            n_components=k,
            covariance_type="full",
            random_state=RNG_SEED,
            max_iter=100,
        )
        gmm_k.fit(X_sweep)
        bic = float(gmm_k.bic(X_sweep))
        aic = float(gmm_k.aic(X_sweep))
        gmm_curve.append({
            "k": k,
            "bic": round(bic, 2),
            "aic": round(aic, 2),
        })

    print("  Training primary GaussianMixture (n_components=3) …")
    gmm = GaussianMixture(
        n_components=3,
        covariance_type="full",
        random_state=RNG_SEED,
        max_iter=150,
    )
    gmm.fit(X_scaled)
    _save(gmm, "gmm.joblib")

    return {
        "scaler":      scaler,
        "iforest":     iforest,
        "lof":         lof,
        "kmeans":      kmeans,
        "pca":         pca,
        "gmm":         gmm,
        "elbow_curve": elbow_curve,
        "gmm_curve":   gmm_curve,
        "pca_scree":   pca_scree,
    }


# ──────────────────────────────────────────────────────────────────────────────
# STEP 4 — Build analytics snapshot on 500 eval rows
# ──────────────────────────────────────────────────────────────────────────────

def build_analytics_snapshot(
    models:       dict,
    X_eval_raw:   pd.DataFrame,
    fault_labels: np.ndarray,
    n: int = SNAPSHOT_N,
) -> dict:
    """
    Sample n rows from the eval set with stratified representation of all fault classes,
    run all models, compute metrics, and assemble the JSON snapshot.
    """
    rng_local = np.random.default_rng(RNG_SEED)

    # Stratified sampling to ensure all 4 hardware fault types and healthy rows
    # are represented in the 500-point snapshot
    fault_indices = np.where(fault_labels != "NONE")[0]
    clean_indices = np.where(fault_labels == "NONE")[0]

    if len(fault_indices) > 0 and len(clean_indices) > 0:
        n_fault_target = min(len(fault_indices), int(n * 0.70))
        sampled_faults = rng_local.choice(fault_indices, size=n_fault_target, replace=False)
        n_clean_target = min(len(clean_indices), n - n_fault_target)
        sampled_clean = rng_local.choice(clean_indices, size=n_clean_target, replace=False)
        idx_sorted = np.sort(np.concatenate([sampled_faults, sampled_clean]))
    else:
        idx = rng_local.choice(len(X_eval_raw), size=min(n, len(X_eval_raw)), replace=False)
        idx_sorted = np.sort(idx)

    X_sample_raw = X_eval_raw.iloc[idx_sorted].values
    fault_sample = fault_labels[idx_sorted]

    scaler  = models["scaler"]
    iforest = models["iforest"]
    lof     = models["lof"]
    kmeans  = models["kmeans"]
    pca     = models["pca"]
    gmm     = models["gmm"]

    X_scaled = scaler.transform(X_sample_raw)

    # ── 4a. Dimensionality reduction ──────────────────────────────
    print("  Computing PCA 2-D projection …")
    pca_coords = pca.transform(X_scaled).tolist()

    print("  Computing t-SNE 2-D embedding (this may take ~30 s) …")
    t0 = time.time()
    tsne = TSNE(
        n_components=2,
        perplexity=min(30, len(X_scaled) // 4),
        random_state=RNG_SEED,
        max_iter=1000,
        init="pca",
    )
    tsne_coords = tsne.fit_transform(X_scaled).tolist()
    print(f"    t-SNE done in {time.time()-t0:.1f}s")

    # ── 4b. Clustering predictions ────────────────────────────────
    print("  Running MiniBatchKMeans predict …")
    kmeans_labels = kmeans.predict(X_scaled).tolist()

    print("  Running GaussianMixture predict …")
    gmm_labels = gmm.predict(X_scaled).tolist()

    print(f"  Running DBSCAN (eps={DBSCAN_EPS}, min_samples={DBSCAN_MIN_SAMPLES}) …")
    dbscan = DBSCAN(eps=DBSCAN_EPS, min_samples=DBSCAN_MIN_SAMPLES, n_jobs=-1)
    dbscan_labels = dbscan.fit_predict(X_scaled).tolist()

    print("  Running IsolationForest predict …")
    if_labels = iforest.predict(X_scaled).tolist()   # 1 = normal, -1 = anomaly

    print("  Running LOF predict …")
    lof_labels = lof.predict(X_scaled).tolist()       # 1 = normal, -1 = anomaly

    # ── 4c. Clustering metrics ────────────────────────────────────
    print("  Computing clustering validation metrics …")
    unique_km = np.unique(kmeans_labels)
    sil_km = float(silhouette_score(X_scaled, kmeans_labels)) if len(unique_km) > 1 else 0.0
    db_km  = float(davies_bouldin_score(X_scaled, kmeans_labels)) if len(unique_km) > 1 else 0.0
    ch_km  = float(calinski_harabasz_score(X_scaled, kmeans_labels)) if len(unique_km) > 1 else 0.0

    # WCSS from the fitted MiniBatchKMeans baseline model
    wcss = float(kmeans.inertia_)

    # DBSCAN intrinsic metrics
    db_core_mask = np.array(dbscan_labels) != -1
    n_db_clusters = len(set(dbscan_labels) - {-1})
    noise_ratio = float(np.mean(np.array(dbscan_labels) == -1))
    if n_db_clusters > 1 and np.sum(db_core_mask) > 10:
        sil_db = float(silhouette_score(X_scaled[db_core_mask], np.array(dbscan_labels)[db_core_mask]))
        db_db  = float(davies_bouldin_score(X_scaled[db_core_mask], np.array(dbscan_labels)[db_core_mask]))
        ch_db  = float(calinski_harabasz_score(X_scaled[db_core_mask], np.array(dbscan_labels)[db_core_mask]))
    else:
        sil_db, db_db, ch_db = 0.0, 0.0, 0.0

    # GMM intrinsic metrics
    sil_gmm = float(silhouette_score(X_scaled, gmm_labels)) if len(np.unique(gmm_labels)) > 1 else 0.0
    gmm_bic = float(gmm.bic(X_scaled))
    gmm_aic = float(gmm.aic(X_scaled))

    metrics = {
        "silhouette":        round(sil_km, 6),
        "davies_bouldin":    round(db_km, 6),
        "calinski_harabasz": round(ch_km, 2),
        "wcss":              round(wcss, 4),
        "kmeans": {
            "silhouette":        round(sil_km, 6),
            "davies_bouldin":    round(db_km, 6),
            "calinski_harabasz": round(ch_km, 2),
            "wcss":              round(wcss, 4),
        },
        "dbscan": {
            "silhouette":        round(sil_db, 6),
            "davies_bouldin":    round(db_db, 6),
            "calinski_harabasz": round(ch_db, 2),
            "n_clusters":        int(n_db_clusters),
            "noise_ratio":       round(float(noise_ratio), 4),
        },
        "gmm": {
            "bic":          round(float(gmm_bic), 2),
            "aic":          round(float(gmm_aic), 2),
            "silhouette":   round(float(sil_gmm), 6),
            "n_components": int(gmm.n_components),
        }
    }
    print(f"    Silhouette={metrics['silhouette']:.4f}  "
          f"Davies-Bouldin={metrics['davies_bouldin']:.4f}  "
          f"Calinski-Harabasz={metrics['calinski_harabasz']:.2f}  "
          f"WCSS={metrics['wcss']:.2f}")

    kmeans_centroids_pca = pca.transform(kmeans.cluster_centers_).tolist()

    # ── 4d. Detection breakdown per fault type ────────────────────
    print("  Computing per-fault-type detection breakdown …")
    FAULT_TYPES = ["SPIKE_FAULT", "FROZEN_SENSOR", "DRIFT_FAULT", "CROSS_SENSOR_MISMATCH"]

    true_fault    = np.array([ft != "NONE" for ft in fault_sample])
    if_anomaly    = np.array([l == -1 for l in if_labels])
    lof_anomaly   = np.array([l == -1 for l in lof_labels])
    dbscan_anomaly = np.array([l == -1 for l in dbscan_labels])

    detection: dict = {}
    for ft in FAULT_TYPES:
        mask = np.array([f == ft for f in fault_sample])
        if mask.sum() == 0:
            # no rows of this fault type in sample; skip
            continue
        detection[ft] = {
            "n_fault_rows": int(mask.sum()),
            "isolation_forest": _detection_metrics(true_fault, if_anomaly,    mask),
            "lof":              _detection_metrics(true_fault, lof_anomaly,   mask),
            "dbscan":           _detection_metrics(true_fault, dbscan_anomaly, mask),
        }
        _print_detection(ft, detection[ft])

    # ── 4e. Assemble snapshot ─────────────────────────────────────
    snapshot = {
        "generated_at":  pd.Timestamp.now().isoformat(),
        "n_points":             int(len(X_scaled)),
        "pca_coords":           pca_coords,
        "tsne_coords":          tsne_coords,
        "kmeans_labels":        kmeans_labels,
        "dbscan_labels":        dbscan_labels,
        "gmm_labels":           gmm_labels,
        "if_labels":            if_labels,
        "lof_labels":           lof_labels,
        "fault_types":          fault_sample.tolist(),
        "metrics":              metrics,
        "elbow_curve":          models["elbow_curve"],
        "gmm_curve":            models["gmm_curve"],
        "pca_scree":            models["pca_scree"],
        "kmeans_centroids_pca": kmeans_centroids_pca,
        "detection":            detection,
    }

    snap_path = os.path.join(MODELS_DIR, "analytics_snapshot.json")
    with open(snap_path, "w") as fh:
        json.dump(snapshot, fh, indent=2)
    snap_kb = os.path.getsize(snap_path) / 1024
    print(f"\n  [saved] analytics_snapshot.json  ({snap_kb:.1f} KB)")

    return snapshot


def _print_detection(fault_type: str, d: dict) -> None:
    print(f"\n    {fault_type} ({d['n_fault_rows']} rows)")
    for model_name in ["isolation_forest", "lof", "dbscan"]:
        m = d[model_name]
        print(
            f"      {model_name:<20s} "
            f"tp={m['tp']:>3d}  fp={m['fp']:>3d}  fn={m['fn']:>3d}  "
            f"precision={m['precision']:.3f}  recall={m['recall']:.3f}"
        )


# ──────────────────────────────────────────────────────────────────────────────
# MAIN
# ──────────────────────────────────────────────────────────────────────────────

def main() -> None:
    t_start = time.time()
    print("=" * 60)
    print("  SkyGuard — Model Training Pipeline")
    print("=" * 60)

    # ── Generate data if not present ──────────────────────────────
    healthy_csv = os.path.join(DATA_DIR, "baseline_healthy.csv")
    eval_csv    = os.path.join(DATA_DIR, "eval_with_faults.csv")

    if not os.path.exists(healthy_csv) or not os.path.exists(eval_csv):
        _banner("Data files not found — running data generator …")
        from data_generator import main as gen_main
        gen_main()

    # ── Step 1: Featurise ─────────────────────────────────────────
    _banner("Step 1 — Featurising healthy baseline …")
    X_healthy = load_and_featurise_healthy()

    _banner("Step 2 — Featurising evaluation dataset …")
    X_eval, fault_labels = load_and_featurise_eval()

    # ── Step 3: Train ─────────────────────────────────────────────
    _banner("Step 3 — Training models on healthy data …")
    models = train_and_save(X_healthy)

    # ── Step 4: Analytics snapshot ────────────────────────────────
    _banner("Step 4 — Building analytics snapshot (500-point eval sample) …")
    snapshot = build_analytics_snapshot(models, X_eval, fault_labels, n=SNAPSHOT_N)

    # ── Verification ──────────────────────────────────────────────
    _banner("Step 5 — Verifying artifacts …")
    expected_files = [
        "scaler.joblib",
        "isolation_forest.joblib",
        "lof.joblib",
        "kmeans.joblib",
        "pca.joblib",
        "gmm.joblib",
        "analytics_snapshot.json",
    ]
    all_ok = True
    for fname in expected_files:
        fpath = os.path.join(MODELS_DIR, fname)
        exists = os.path.exists(fpath)
        size   = os.path.getsize(fpath) / 1024 if exists else 0
        status = "✓" if exists else "✗ MISSING"
        print(f"  [{status}] {fname:<35s} {size:.1f} KB")
        if not exists:
            all_ok = False

    elapsed = time.time() - t_start
    print(f"\n{'=' * 60}")
    if all_ok:
        print(f"  [OK] All artifacts generated successfully in {elapsed:.1f}s")
    else:
        print(f"  [FAIL] Some artifacts are MISSING - review errors above.")
    print(f"{'=' * 60}\n")

    return snapshot


if __name__ == "__main__":
    main()
