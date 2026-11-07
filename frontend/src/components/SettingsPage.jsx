import React, { useState, useEffect } from 'react';
import {
  RotateCcw,
  Volume2,
  VolumeX,
  Check,
  Download,
  AlertTriangle,
  Sliders,
  Clock,
  ShieldCheck
} from 'lucide-react';
import { soundManager } from '../utils/audio';

export default function SettingsPage({
  pipelineStatus,
  onResetSession,
  onShowToast
}) {
  const [audioState, setAudioState] = useState(soundManager.getState());
  const [dbStats, setDbStats] = useState({
    total_telemetry_rows: 0,
    total_alert_rows: 0
  });
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [pollingInterval, setPollingInterval] = useState(pipelineStatus?.poll_interval_sec || 3.0);

  useEffect(() => {
    const unsub = soundManager.subscribe((st) => setAudioState(st));
    return unsub;
  }, []);

  const fetchStats = () => {
    Promise.all([
      fetch('http://localhost:8000/api/telemetry/recent?limit=1000').then((r) => (r.ok ? r.json() : [])).catch(() => []),
      fetch('http://localhost:8000/api/alerts?limit=1000').then((r) => (r.ok ? r.json() : [])).catch(() => [])
    ]).then(([telemetry, alerts]) => {
      setDbStats({
        total_telemetry_rows: telemetry.length,
        total_alert_rows: alerts.length
      });
    });
  };

  useEffect(() => {
    fetchStats();
  }, [pipelineStatus]);

  const handlePollingChange = async (newVal) => {
    const val = parseFloat(newVal);
    setPollingInterval(val);
    try {
      await fetch('http://localhost:8000/api/pipeline/polling-interval', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interval_sec: val })
      });
      if (onShowToast) {
        onShowToast({ message: `Polling interval updated to ${val}s` });
      }
    } catch (err) {
      console.error('Failed to update polling interval:', err);
    }
  };

  const handleExportSession = async () => {
    try {
      const [readingsRes, alertsRes] = await Promise.all([
        fetch('http://localhost:8000/api/telemetry/recent?limit=2000'),
        fetch('http://localhost:8000/api/alerts?limit=2000')
      ]);
      const readings = readingsRes.ok ? await readingsRes.json() : [];
      const alerts = alertsRes.ok ? await alertsRes.json() : [];

      const sessionDump = {
        exported_at: new Date().toISOString(),
        station: pipelineStatus.station,
        telemetry_count: readings.length,
        alert_count: alerts.length,
        telemetry: readings,
        alerts: alerts
      };

      const blob = new Blob([JSON.stringify(sessionDump, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `skyguard_session_export_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      if (onShowToast) {
        onShowToast({ message: 'Session data exported successfully' });
      }
    } catch (err) {
      console.error('Session export failed:', err);
    }
  };

  const confirmReset = async () => {
    setIsResetting(true);
    try {
      if (onResetSession) {
        await onResetSession();
      }
      setIsResetModalOpen(false);
      fetchStats();
      if (onShowToast) {
        onShowToast({ message: 'Session reset complete. Storage cleared.' });
      }
    } catch (err) {
      console.error('Reset failed:', err);
    } finally {
      setIsResetting(false);
    }
  };

  const latency = pipelineStatus?.fetch_latency_ms || 0;
  const lastPoll = pipelineStatus?.last_poll_time
    ? new Date(pipelineStatus.last_poll_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : 'None';

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="pb-2 border-b border-[#E5E5E5] dark:border-[#262626]">
        <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
          Settings
        </h1>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
          Station polling parameters, audio alert triggers, and database persistence controls.
        </p>
      </div>

      {/* 1. Audio Notifications */}
      <div className="rounded-xl border border-[#E5E5E5] dark:border-[#262626] bg-[#FFFFFF] dark:bg-[#171718] p-5 space-y-4">
        <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
          Audio notifications
        </h2>

        {/* Master Mute & Status */}
        <div className="flex items-center justify-between py-2 border-b border-[#F0F0F0] dark:border-[#262626]">
          <div>
            <div className="text-xs font-medium text-neutral-900 dark:text-neutral-100">
              Chime state
            </div>
            <div className="text-[12px] text-neutral-500 dark:text-neutral-400 mt-0.5">
              {soundManager.getMuteTooltip()}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => soundManager.toggleMute()}
              className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md border border-[#E5E5E5] dark:border-[#262626] bg-white dark:bg-[#171718] text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
            >
              {audioState.isMuted ? (
                <VolumeX className="w-3.5 h-3.5 text-red-500" />
              ) : (
                <Volume2 className="w-3.5 h-3.5 text-neutral-600 dark:text-neutral-400" />
              )}
              <span>{audioState.isMuted ? 'Muted' : 'Sound active'}</span>
            </button>
          </div>
        </div>

        {/* Critical Alerts Only Toggle */}
        <div className="flex items-center justify-between py-2 border-b border-[#F0F0F0] dark:border-[#262626]">
          <div>
            <div className="text-xs font-medium text-neutral-900 dark:text-neutral-100">
              Critical alerts only
            </div>
            <div className="text-[12px] text-neutral-500 dark:text-neutral-400 mt-0.5">
              Suppress chimes for WARNING outliers; only sound chimes for CRITICAL hardware faults.
            </div>
          </div>

          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={audioState.criticalOnly}
              onChange={(e) => soundManager.setCriticalOnly(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-neutral-200 peer-focus:outline-none rounded-full peer dark:bg-neutral-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-neutral-600 peer-checked:bg-blue-600"></div>
          </label>
        </div>

        {/* Volume Slider */}
        <div className="flex items-center justify-between py-2">
          <div>
            <div className="text-xs font-medium text-neutral-900 dark:text-neutral-100">
              Volume ({Math.round(audioState.volume * 100)}%)
            </div>
            <div className="text-[12px] text-neutral-500 dark:text-neutral-400 mt-0.5">
              Maximum synthesizer gain level for browser chime playback.
            </div>
          </div>

          <input
            type="range"
            min="0.05"
            max="1.0"
            step="0.05"
            value={audioState.volume}
            onChange={(e) => soundManager.setVolume(e.target.value)}
            className="w-32 accent-blue-600 cursor-pointer"
          />
        </div>
      </div>

      {/* 2. Pipeline Ingestion & Station Parameters */}
      <div className="rounded-xl border border-[#E5E5E5] dark:border-[#262626] bg-[#FFFFFF] dark:bg-[#171718] p-5 space-y-4">
        <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
          Telemetry stream & latency
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-3 rounded-lg border border-[#E5E5E5] dark:border-[#262626]">
            <span className="text-[11px] text-neutral-400">Polling rate</span>
            <div className="mt-1">
              <select
                value={pollingInterval}
                onChange={(e) => handlePollingChange(e.target.value)}
                className="w-full text-xs py-1 px-2 rounded border border-[#E5E5E5] dark:border-[#262626] bg-neutral-50 dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200 cursor-pointer"
              >
                <option value="3.0">3.0s (Fast / Real-Time)</option>
                <option value="5.0">5.0s (Balanced)</option>
                <option value="10.0">10.0s (Low-Bandwidth)</option>
              </select>
            </div>
          </div>

          <div className="p-3 rounded-lg border border-[#E5E5E5] dark:border-[#262626]">
            <span className="text-[11px] text-neutral-400">API fetch latency</span>
            <div className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 tabular-nums mt-1">
              {latency} ms
            </div>
          </div>

          <div className="p-3 rounded-lg border border-[#E5E5E5] dark:border-[#262626]">
            <span className="text-[11px] text-neutral-400">Last poll timestamp</span>
            <div className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 tabular-nums mt-1">
              {lastPoll}
            </div>
          </div>
        </div>
      </div>

      {/* 3. Session Data & Database Persistence */}
      <div className="rounded-xl border border-[#E5E5E5] dark:border-[#262626] bg-[#FFFFFF] dark:bg-[#171718] p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
              Session management
            </h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
              SQLite storage currently holds {dbStats.total_telemetry_rows} readings and {dbStats.total_alert_rows} alerts.
            </p>
          </div>

          <button
            onClick={handleExportSession}
            className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md border border-[#E5E5E5] dark:border-[#262626] bg-white dark:bg-[#171718] text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export session data</span>
          </button>
        </div>

        <div className="pt-2">
          <button
            onClick={() => setIsResetModalOpen(true)}
            className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md border border-red-200 dark:border-red-900 bg-red-50/50 dark:bg-red-950/30 text-red-600 dark:text-red-400 hover:bg-red-100 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset session...</span>
          </button>
        </div>
      </div>

      {/* Reset Confirmation Modal */}
      {isResetModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-xl border border-[#E5E5E5] dark:border-[#262626] bg-white dark:bg-[#171718] p-5 shadow-xl text-xs space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                  Reset session data?
                </h3>
                <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1 leading-relaxed">
                  This will permanently clear <strong>{dbStats.total_telemetry_rows} sensor readings</strong> and <strong>{dbStats.total_alert_rows} incident records</strong> from the local database. Model weights and baseline statistics will be preserved.
                </p>
              </div>
            </div>

            <div className="p-3 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/40 flex items-center justify-between">
              <span className="text-[11px] text-neutral-500">Want to back up your readings first?</span>
              <button
                onClick={handleExportSession}
                className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Download className="w-3 h-3" />
                <span>Export first</span>
              </button>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#F0F0F0] dark:border-[#262626]">
              <button
                onClick={() => setIsResetModalOpen(false)}
                className="px-3 py-1.5 rounded-md border border-[#E5E5E5] dark:border-[#262626] text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={confirmReset}
                disabled={isResetting}
                className="px-3.5 py-1.5 rounded-md bg-red-600 text-white font-medium hover:bg-red-700 transition-colors cursor-pointer disabled:opacity-50"
              >
                {isResetting ? 'Resetting...' : 'Confirm & reset'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
