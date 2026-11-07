"""
SkyGuard — 12-Feature Rolling Window Pipeline
==============================================
Takes a sliding window of the last N readings and computes 12 engineered
features that make three distinct hardware fault signatures detectable:

  SPIKE_FAULT        → extreme delta values
  FROZEN_SENSOR      → roll_std drops to ~0.0 (flatline signature)
  DRIFT_FAULT        → roll_mean drifts away from historical baseline
  CROSS_SENSOR_MISMATCH → inter-sensor feature combinations diverge

Feature set (12 total)
──────────────────────
Raw values (3):
  temperature, pressure, humidity

First-order rate-of-change / deltas (3):
  delta_temp, delta_pressure, delta_humidity

Rolling mean over the window (3):
  roll_mean_temp, roll_mean_pressure, roll_mean_humidity

Rolling standard deviation over the window (3):
  roll_std_temp, roll_std_pressure, roll_std_humidity
"""

from __future__ import annotations

import numpy as np
import pandas as pd
from collections import deque
from typing import Optional

# ── Constants ─────────────────────────────────────────────────────────────────
WINDOW_SIZE   = 10
FEATURE_NAMES = [
    # raw
    "temperature", "pressure", "humidity",
    # deltas
    "delta_temp", "delta_pressure", "delta_humidity",
    # rolling mean
    "roll_mean_temp", "roll_mean_pressure", "roll_mean_humidity",
    # rolling std
    "roll_std_temp", "roll_std_pressure", "roll_std_humidity",
]


# ──────────────────────────────────────────────────────────────────────────────
# Batch version — for training / offline analytics
# ──────────────────────────────────────────────────────────────────────────────

def compute_features_batch(df: pd.DataFrame, window: int = WINDOW_SIZE) -> pd.DataFrame:
    """
    Compute all 12 features on a DataFrame with columns
    [timestamp, temperature, pressure, humidity].

    Rows at the start where the window is not yet full are filled with
    forward-filled values (so no NaN leaks into training data).

    Returns a DataFrame with FEATURE_NAMES columns aligned to the input index.
    """
    if not {"temperature", "pressure", "humidity"}.issubset(df.columns):
        raise ValueError("Input DataFrame must contain: temperature, pressure, humidity")

    out = pd.DataFrame(index=df.index)

    for col, feat_prefix in [
        ("temperature", "temp"),
        ("pressure",    "pressure"),
        ("humidity",    "humidity"),
    ]:
        series = df[col].astype(float)

        # raw
        out[col] = series

        # delta (first difference)
        delta = series.diff().fillna(0.0)
        out[f"delta_{feat_prefix}"] = delta

        # rolling mean and std (min_periods=1 to avoid NaNs in the warm-up zone)
        out[f"roll_mean_{feat_prefix}"] = (
            series.rolling(window, min_periods=1).mean()
        )
        out[f"roll_std_{feat_prefix}"] = (
            series.rolling(window, min_periods=1).std().fillna(0.0)
        )

    # Enforce column order
    return out[FEATURE_NAMES]


# ──────────────────────────────────────────────────────────────────────────────
# Streaming version — for real-time inference (one reading at a time)
# ──────────────────────────────────────────────────────────────────────────────

class StreamingFeatureExtractor:
    """
    Stateful, single-reading feature extractor designed for real-time WebSocket
    ingestion.  Maintains a fixed-length deque (ring buffer) of recent readings
    and computes the same 12 features on each new reading.

    Usage
    -----
    >>> extractor = StreamingFeatureExtractor(window=10)
    >>> features  = extractor.update(temperature=22.1, pressure=1012.3, humidity=65.0)
    >>> # features is a dict with FEATURE_NAMES keys
    """

    def __init__(self, window: int = WINDOW_SIZE) -> None:
        self.window = window
        self._buf: dict[str, deque] = {
            "temperature": deque(maxlen=window),
            "pressure":    deque(maxlen=window),
            "humidity":    deque(maxlen=window),
        }
        self._prev: dict[str, Optional[float]] = {
            "temperature": None,
            "pressure":    None,
            "humidity":    None,
        }

    def reset(self) -> None:
        """Clear internal state (use between disconnected sessions)."""
        for key in self._buf:
            self._buf[key].clear()
        for key in self._prev:
            self._prev[key] = None

    def update(
        self,
        temperature: float,
        pressure:    float,
        humidity:    float,
    ) -> dict[str, float]:
        """
        Ingest one new reading and return the 12-feature vector as a dict.
        Guarantees unbiased sample standard deviation (ddof=1) matching pandas
        batch computation, and prevents NaN/inf on non-finite input.
        """
        # Validate inputs are float and finite
        raw = {
            "temperature": float(temperature) if np.isfinite(temperature) else 0.0,
            "pressure":    float(pressure) if np.isfinite(pressure) else 1013.25,
            "humidity":    float(humidity) if np.isfinite(humidity) else 50.0,
        }

        features: dict[str, float] = {}

        for col in ["temperature", "pressure", "humidity"]:
            v = raw[col]
            self._buf[col].append(v)
            buf_arr = np.array(self._buf[col], dtype=np.float64)

            # raw
            features[col] = v

            # delta
            prev = self._prev[col]
            features[f"delta_{_feat_prefix(col)}"] = (v - prev) if prev is not None else 0.0
            self._prev[col] = v

            # rolling stats (over current buffer)
            features[f"roll_mean_{_feat_prefix(col)}"] = float(buf_arr.mean())
            # ddof=1 ensures exact parity with pandas Series.rolling(window, min_periods=1).std()
            features[f"roll_std_{_feat_prefix(col)}"]  = float(buf_arr.std(ddof=1)) if len(buf_arr) > 1 else 0.0

        return features

    @property
    def is_warmed_up(self) -> bool:
        """True once the buffer holds a full window of readings."""
        return len(self._buf["temperature"]) >= self.window


def _feat_prefix(col: str) -> str:
    """Map column name to its feature prefix (handles 'pressure' → 'pressure')."""
    return {
        "temperature": "temp",
        "pressure":    "pressure",
        "humidity":    "humidity",
    }[col]


# ──────────────────────────────────────────────────────────────────────────────
# Convenience: features → numpy array in canonical order
# ──────────────────────────────────────────────────────────────────────────────

def features_to_array(feature_dict: dict[str, float]) -> np.ndarray:
    """Return a (1, 12) numpy array from a feature dict in FEATURE_NAMES order."""
    return np.array([[feature_dict[k] for k in FEATURE_NAMES]], dtype=np.float64)


# ──────────────────────────────────────────────────────────────────────────────
# Quick self-test
# ──────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import sys, os
    sys.path.insert(0, os.path.dirname(__file__))
    from data_generator import generate_healthy_data

    df_h = generate_healthy_data(100)
    feats = compute_features_batch(df_h)

    assert feats.shape == (100, 12), f"Expected (100,12), got {feats.shape}"
    assert list(feats.columns) == FEATURE_NAMES
    assert feats.isna().sum().sum() == 0, "NaNs found in batch features!"

    # Streaming sanity check
    extractor = StreamingFeatureExtractor(window=10)
    for _, row in df_h.iterrows():
        fv = extractor.update(row["temperature"], row["pressure"], row["humidity"])
        assert len(fv) == 12

    print("[✓] features.py self-test passed — 12 features, no NaNs.")

