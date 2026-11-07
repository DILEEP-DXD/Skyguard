"""
SkyGuard - Synthetic Weather Station Data Generator
Generates:
  1. A 5,000-row healthy baseline dataset (no faults)
  2. An evaluation dataset with injected hardware faults:
       SPIKE_FAULT, FROZEN_SENSOR, DRIFT_FAULT, CROSS_SENSOR_MISMATCH

All outputs are saved to backend/data/
"""

import os
import numpy as np
import pandas as pd
from datetime import datetime, timedelta

# ── Reproducibility ────────────────────────────────────────────────────────────
RNG_SEED = 42
rng = np.random.default_rng(RNG_SEED)

# ── Output directory ───────────────────────────────────────────────────────────
DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
os.makedirs(DATA_DIR, exist_ok=True)

# ── Constants ──────────────────────────────────────────────────────────────────
N_BASELINE = 5_000          # healthy rows
SAMPLE_INTERVAL_S = 60      # one reading per minute
START_TIME = datetime(2024, 1, 1, 0, 0, 0)

# Fault injection parameters
FAULT_FRACTION   = 0.10     # ~10 % of eval rows are faulty
FAULT_TYPES = ["SPIKE_FAULT", "FROZEN_SENSOR", "DRIFT_FAULT", "CROSS_SENSOR_MISMATCH"]


# ──────────────────────────────────────────────────────────────────────────────
# 1. HEALTHY DATA GENERATION
# ──────────────────────────────────────────────────────────────────────────────

def _hour_of_day(idx: np.ndarray, interval_s: int = SAMPLE_INTERVAL_S) -> np.ndarray:
    """Return fractional hour-of-day for each reading index."""
    return (idx * interval_s / 3600.0) % 24.0


def generate_healthy_data(n: int = N_BASELINE, seed: int = RNG_SEED) -> pd.DataFrame:
    """
    Simulate realistic AWS readings with:
      • sinusoidal day/night temperature cycle  (peak ~14:00, trough ~04:00)
      • inverse temperature-humidity correlation
      • realistic pressure variation (slow synoptic drift + diurnal tide)
      • low-amplitude Gaussian micro-noise on all three channels
    """
    rng_local = np.random.default_rng(seed)

    idx = np.arange(n)
    hour = _hour_of_day(idx)

    # ---------- Temperature  (°C) ----------
    # Base: 22 °C mean, ±8 °C diurnal swing (peaks ~14 h), season ignored.
    temp_base  = 22.0 + 8.0 * np.sin((hour - 10.0) * np.pi / 12.0)
    temp_noise = rng_local.normal(0, 0.3, n)
    temperature = temp_base + temp_noise

    # ---------- Humidity  (%) ----------
    # Inverse correlation with temperature + independent noise.
    # When temp is at max (30°C) → ~35 % RH; at min (14°C) → ~85 % RH.
    hum_base   = 60.0 - 2.0 * (temperature - 22.0)   # linear inverse
    hum_base   = np.clip(hum_base, 10.0, 100.0)
    hum_noise  = rng_local.normal(0, 1.5, n)
    humidity   = np.clip(hum_base + hum_noise, 0.0, 100.0)

    # ---------- Pressure  (hPa) ----------
    # Mean 1013 hPa, slow synoptic drift (period ~72 h) + diurnal tide (±0.5 hPa / 12 h)
    synoptic   = 5.0 * np.sin(2 * np.pi * idx / (72 * 60))
    diurnal    = 0.5 * np.sin(2 * np.pi * hour / 12.0)
    pres_noise = rng_local.normal(0, 0.2, n)
    pressure   = 1013.0 + synoptic + diurnal + pres_noise

    # ---------- Timestamps ----------
    timestamps = [START_TIME + timedelta(seconds=int(i) * SAMPLE_INTERVAL_S) for i in idx]

    df = pd.DataFrame({
        "timestamp":   timestamps,
        "temperature": np.round(temperature, 3),
        "pressure":    np.round(pressure, 3),
        "humidity":    np.round(humidity, 3),
        "fault_type":  "NONE",
    })
    return df


# ──────────────────────────────────────────────────────────────────────────────
# 2. FAULT INJECTION
# ──────────────────────────────────────────────────────────────────────────────

def inject_faults(df_clean: pd.DataFrame, seed: int = RNG_SEED + 1) -> pd.DataFrame:
    """
    Return a copy of df_clean with hardware faults injected.
    Each fault window is non-overlapping and spans a realistic duration,
    maintaining a strictly controlled fault fraction (~8-12%) so clean
    and faulty observations remain distinctly separated.

    Fault catalogue
    ───────────────
    SPIKE_FAULT          : sudden large instantaneous excursion (voltage spike).
    FROZEN_SENSOR        : sensor output freezes (flatlines) for N consecutive readings.
    DRIFT_FAULT          : slow linear drift away from true value (calibration slip).
    CROSS_SENSOR_MISMATCH: pressure and humidity move in physically impossible directions
                           simultaneously (e.g., dropping pressure while humidity rockets).
    """
    rng_local = np.random.default_rng(seed)
    df = df_clean.copy()
    n = len(df)

    # Allocate non-overlapping fault windows:
    # Target ~10% total fault rows across 4 fault classes
    FAULT_CONFIG = [
        ("SPIKE_FAULT", 25, (1, 3)),
        ("FROZEN_SENSOR", 4, (20, 35)),
        ("DRIFT_FAULT", 3, (30, 50)),
        ("CROSS_SENSOR_MISMATCH", 6, (10, 18)),
    ]

    occupied = np.zeros(n, dtype=bool)
    occupied[:50] = True  # reserve warm-up period as healthy

    fault_windows: list[tuple[int, int, str]] = []

    for fault_type, count, (min_d, max_d) in FAULT_CONFIG:
        for _ in range(count):
            dur = int(rng_local.integers(min_d, max_d + 1))
            # Attempt to find non-overlapping placement
            for _attempt in range(200):
                start = int(rng_local.integers(50, n - dur - 1))
                if not np.any(occupied[start : start + dur]):
                    occupied[start : start + dur] = True
                    fault_windows.append((start, start + dur, fault_type))
                    break

    # Apply fault windows
    for start, end, fault_type in fault_windows:
        df.loc[start : end - 1, "fault_type"] = fault_type

        if fault_type == "SPIKE_FAULT":
            # Random channel, large excursion (±20–50 units)
            channel = rng_local.choice(["temperature", "pressure", "humidity"])
            sign    = rng_local.choice([-1, 1])
            mag     = float(rng_local.uniform(20, 50))
            df.loc[start : end - 1, channel] += sign * mag

        elif fault_type == "FROZEN_SENSOR":
            # Freeze a sensor at its value at fault onset (strict flatline, 0 std)
            channel  = rng_local.choice(["temperature", "pressure", "humidity"])
            frozen_v = df.loc[start, channel]
            df.loc[start : end - 1, channel] = frozen_v

        elif fault_type == "DRIFT_FAULT":
            # Accumulating linear offset across duration
            channel = rng_local.choice(["temperature", "pressure", "humidity"])
            sign    = rng_local.choice([-1, 1])
            max_drift = float(rng_local.uniform(8, 20))
            drift_vals = np.linspace(0, sign * max_drift, end - start)
            df.loc[start : end - 1, channel] += drift_vals

        elif fault_type == "CROSS_SENSOR_MISMATCH":
            # Pressure drops sharply while humidity simultaneously plummets
            drop_p    = float(rng_local.uniform(15, 30))
            drop_h    = float(rng_local.uniform(20, 40))
            dur_range = end - start
            df.loc[start : end - 1, "pressure"] -= np.linspace(0, drop_p, dur_range)
            df.loc[start : end - 1, "humidity"]  = np.clip(
                df.loc[start : end - 1, "humidity"] - np.linspace(0, drop_h, dur_range),
                0, 100
            )

    # Round after modification
    for col in ["temperature", "pressure", "humidity"]:
        df[col] = df[col].round(3)

    return df


# ──────────────────────────────────────────────────────────────────────────────
# 3. MAIN
# ──────────────────────────────────────────────────────────────────────────────

def main() -> None:
    print("=" * 60)
    print("SkyGuard — Synthetic Data Generator")
    print("=" * 60)

    # ── Healthy baseline ───────────────────────────────────────────
    print(f"\n[1/2] Generating {N_BASELINE:,} healthy baseline rows …")
    df_healthy = generate_healthy_data(N_BASELINE)

    baseline_path = os.path.join(DATA_DIR, "baseline_healthy.csv")
    df_healthy.to_csv(baseline_path, index=False)

    print(f"      Saved -> {baseline_path}")
    print(f"      Shape : {df_healthy.shape}")
    print(f"      Temp  : {df_healthy['temperature'].min():.2f} - {df_healthy['temperature'].max():.2f} degC")
    print(f"      Press : {df_healthy['pressure'].min():.2f} - {df_healthy['pressure'].max():.2f} hPa")
    print(f"      Humid : {df_healthy['humidity'].min():.2f} - {df_healthy['humidity'].max():.2f} %")

    # ── Evaluation dataset with faults ────────────────────────────
    print(f"\n[2/2] Injecting hardware faults into evaluation dataset …")
    df_eval = inject_faults(df_healthy)

    fault_counts = df_eval[df_eval["fault_type"] != "NONE"]["fault_type"].value_counts()
    eval_path = os.path.join(DATA_DIR, "eval_with_faults.csv")
    df_eval.to_csv(eval_path, index=False)

    print(f"      Saved -> {eval_path}")
    print(f"      Shape : {df_eval.shape}")
    print(f"      Fault rows by type:")
    for ft, cnt in fault_counts.items():
        print(f"        {ft:<30s}: {cnt} rows")
    total_faults = fault_counts.sum()
    print(f"      Total faulty rows : {total_faults} / {len(df_eval)} "
          f"({100 * total_faults / len(df_eval):.1f} %)")

    print("\n[OK] Data generation complete.\n")


if __name__ == "__main__":
    main()
