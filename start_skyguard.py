#!/usr/bin/env python3
"""
SkyGuard — Root Startup Script
================================
Launches both servers and waits for them to be healthy.

Usage:
    python start_skyguard.py
"""

import os
import subprocess
import sys
import time
import urllib.request
import urllib.error

ROOT = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR  = os.path.join(ROOT, "backend")
FRONTEND_DIR = os.path.join(ROOT, "frontend")
VENV_PYTHON  = os.path.join(BACKEND_DIR, "venv", "Scripts", "python.exe")


def wait_for_port(url: str, timeout: int = 40, label: str = "") -> bool:
    start = time.time()
    while time.time() - start < timeout:
        try:
            urllib.request.urlopen(url, timeout=2)
            return True
        except Exception:
            time.sleep(1)
    return False


def main():
    print("=" * 60)
    print("  SkyGuard — Starting all services")
    print("=" * 60)

    env = os.environ.copy()
    env["PYTHONIOENCODING"] = "utf-8"

    # ── Launch FastAPI backend ─────────────────────────────────────
    print("\n[1/2] Starting FastAPI backend on http://localhost:8000 ...")
    backend_proc = subprocess.Popen(
        [
            VENV_PYTHON, "-m", "uvicorn",
            "main:app",
            "--host", "0.0.0.0",
            "--port", "8000",
            "--reload",
        ],
        cwd=BACKEND_DIR,
        env=env,
    )

    if not wait_for_port("http://localhost:8000/api/pipeline/status", timeout=30, label="backend"):
        print("[ERROR] Backend did not start in time.")
        backend_proc.terminate()
        sys.exit(1)
    print("  [OK] Backend is up at http://localhost:8000")

    # ── Launch Vite frontend ───────────────────────────────────────
    print("\n[2/2] Starting Vite frontend on http://localhost:5173 ...")
    npm_cmd = "npm.cmd" if sys.platform == "win32" else "npm"
    frontend_proc = subprocess.Popen(
        [npm_cmd, "run", "dev"],
        cwd=FRONTEND_DIR,
        env=env,
    )

    if not wait_for_port("http://localhost:5173", timeout=40, label="frontend"):
        print("[ERROR] Frontend did not start in time.")
        frontend_proc.terminate()
        backend_proc.terminate()
        sys.exit(1)
    print("  [OK] Frontend is up at http://localhost:5173")

    print("\n" + "=" * 60)
    print("  SkyGuard is running!")
    print("  Backend  : http://localhost:8000")
    print("  Frontend : http://localhost:5173")
    print("  API Docs : http://localhost:8000/docs")
    print("  Press Ctrl+C to stop all services.")
    print("=" * 60 + "\n")

    try:
        backend_proc.wait()
    except KeyboardInterrupt:
        print("\n[Shutdown] Stopping all services ...")
        frontend_proc.terminate()
        backend_proc.terminate()
        print("[Shutdown] Done.")


if __name__ == "__main__":
    main()

