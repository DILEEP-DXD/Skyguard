import React, { useState } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Radio,
  MapPin,
  Cpu,
  Layers,
  ShieldAlert,
  Loader2,
  Clock,
  Sparkles,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';

export const STATION_PRESETS = [
  { id: 'IN-HYD', name: 'Hyderabad AWS', lat: 17.3850, lon: 78.4867, state: 'Telangana' },
  { id: 'IN-PB',  name: 'Jalandhar / Punjab AWS', lat: 31.3260, lon: 75.5762, state: 'Punjab' },
  { id: 'IN-DEL', name: 'New Delhi Safdarjung AWS', lat: 28.5843, lon: 77.2028, state: 'Delhi NCR' },
  { id: 'IN-MUM', name: 'Mumbai Santacruz AWS', lat: 19.0896, lon: 72.8656, state: 'Maharashtra' },
  { id: 'IN-BLR', name: 'Bengaluru HAL AWS', lat: 12.9500, lon: 77.6682, state: 'Karnataka' },
  { id: 'CUSTOM', name: 'Custom Lat / Lon', lat: 20.0, lon: 77.0, state: 'Custom Coordinates' }
];

export default function PipelineControlBar({
  pipelineStatus = {},
  onStartPipeline,
  onStopPipeline,
  onResetSession,
  isCalibrating = false
}) {
  const currentStationId = pipelineStatus?.station?.id || 'IN-HYD';
  const [selectedStationId, setSelectedStationId] = useState(currentStationId);
  const [customLat, setCustomLat] = useState(17.3850);
  const [customLon, setCustomLon] = useState(78.4867);

  const selectedPreset = STATION_PRESETS.find(s => s.id === selectedStationId) || STATION_PRESETS[0];
  const isStreaming = pipelineStatus.state === 'STREAMING_LIVE';
  const isIdle = pipelineStatus.state === 'IDLE';
  const isPaused = pipelineStatus.state === 'PAUSED';
  const fetchLatency = pipelineStatus.fetch_latency_ms || 0;
  const stages = pipelineStatus.stages || {};

  const handleStart = () => {
    let lat = selectedPreset.lat;
    let lon = selectedPreset.lon;
    let name = selectedPreset.name;

    if (selectedStationId === 'CUSTOM') {
      lat = parseFloat(customLat) || 17.3850;
      lon = parseFloat(customLon) || 78.4867;
      name = `Custom AWS (${lat.toFixed(2)}, ${lon.toFixed(2)})`;
    }

    onStartPipeline({
      station_id: selectedStationId,
      latitude: lat,
      longitude: lon,
      station_name: name,
      poll_interval_sec: 3.0
    });
  };

  // Stepper active states
  const s1Status = stages.stage1_collect?.status || (isStreaming ? 'COMPLETED' : 'IDLE');
  const s2Status = stages.stage2_features_ml?.status || (isStreaming ? 'COMPLETED' : 'IDLE');
  const s3Status = stages.stage3_detect?.status || (isStreaming ? 'COMPLETED' : 'IDLE');
  const s4Status = stages.stage4_alert?.status || 'IDLE';

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-4 mb-6 shadow-xl backdrop-blur">
      {/* Top Header Row */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-xl border ${
            isStreaming
              ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-400'
              : isCalibrating
              ? 'bg-cyan-950/60 border-cyan-500/50 text-cyan-400 animate-pulse'
              : 'bg-slate-950 border-slate-800 text-slate-400'
          }`}>
            <Radio className={`w-5 h-5 ${isStreaming ? 'animate-pulse' : ''}`} />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-200 font-mono">
                Real-Time Weather Station Pipeline Control
              </h2>
              <span className={`text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full border ${
                isStreaming
                  ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-400'
                  : isCalibrating
                  ? 'bg-cyan-950/80 border-cyan-500/50 text-cyan-400 animate-pulse'
                  : isPaused
                  ? 'bg-amber-950/80 border-amber-500/50 text-amber-400'
                  : 'bg-slate-800 border-slate-700 text-slate-400'
              }`}>
                {isCalibrating ? 'CALIBRATING ON 14-DAY REAL DATA...' : pipelineStatus.state || 'IDLE'}
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono">
              True real-time internet ingestion from Open-Meteo with dynamic station calibration
            </p>
          </div>
        </div>

        {/* Live Controls */}
        <div className="flex items-center gap-2">
          {/* Start / Calibrate Button */}
          <button
            onClick={handleStart}
            disabled={isCalibrating}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-mono font-bold tracking-wider uppercase border border-cyan-500/50 bg-cyan-950/40 text-cyan-300 hover:bg-cyan-900/50 hover:border-cyan-400 transition-all cursor-pointer shadow-lg shadow-cyan-950/30 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isCalibrating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
                <span>Calibrating...</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 text-cyan-400 fill-cyan-400" />
                <span>{isPaused ? 'Resume Pipeline' : isStreaming ? 'Restart / Recalibrate' : 'Start Live Pipeline'}</span>
              </>
            )}
          </button>

          {/* Pause Button */}
          {isStreaming && (
            <button
              onClick={onStopPipeline}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-mono font-bold tracking-wider uppercase border border-amber-500/40 bg-amber-950/30 text-amber-300 hover:bg-amber-900/40 transition-all cursor-pointer"
            >
              <Pause className="w-4 h-4 text-amber-400" />
              <span>Pause</span>
            </button>
          )}

          {/* Reset Session Button */}
          <button
            onClick={onResetSession}
            disabled={isCalibrating}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-mono font-semibold tracking-wider uppercase border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 hover:border-slate-600 transition-all cursor-pointer disabled:opacity-50"
          >
            <RotateCcw className="w-4 h-4 text-slate-400" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* Station Selector Bar */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center mb-4">
        <div className="md:col-span-5 flex items-center gap-2">
          <MapPin className="w-4 h-4 text-cyan-400 shrink-0" />
          <span className="text-xs font-mono text-slate-400 whitespace-nowrap">Station:</span>
          <select
            value={selectedStationId}
            onChange={(e) => setSelectedStationId(e.target.value)}
            disabled={isCalibrating}
            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-400 transition-colors"
          >
            {STATION_PRESETS.map((st) => (
              <option key={st.id} value={st.id}>
                {st.name} — {st.state} ({st.lat}, {st.lon})
              </option>
            ))}
          </select>
        </div>

        {/* Custom Lat / Lon Inputs if selected */}
        {selectedStationId === 'CUSTOM' ? (
          <div className="md:col-span-4 flex items-center gap-2">
            <input
              type="number"
              step="0.0001"
              value={customLat}
              onChange={(e) => setCustomLat(e.target.value)}
              placeholder="Latitude"
              className="w-1/2 bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-xs font-mono text-slate-200"
            />
            <input
              type="number"
              step="0.0001"
              value={customLon}
              onChange={(e) => setCustomLon(e.target.value)}
              placeholder="Longitude"
              className="w-1/2 bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-xs font-mono text-slate-200"
            />
          </div>
        ) : (
          <div className="md:col-span-4 flex items-center gap-3 text-xs font-mono text-slate-400">
            <span className="text-slate-400">GPS:</span>
            <span className="text-slate-300 font-semibold">{selectedPreset.lat.toFixed(4)}°N, {selectedPreset.lon.toFixed(4)}°E</span>
          </div>
        )}

        {/* Latency & Polling Info */}
        <div className="md:col-span-3 flex items-center justify-end gap-2 text-xs font-mono">
          <Clock className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-slate-400">HTTP Latency:</span>
          <span className={`font-bold ${fetchLatency > 400 ? 'text-amber-400' : 'text-emerald-400'}`}>
            {fetchLatency ? `${fetchLatency}ms` : '--'}
          </span>
          <span className="text-slate-400">(3s poll)</span>
        </div>
      </div>

      {/* 4-Stage Real-Time Pipeline Stepper */}
      <div className="pt-3 border-t border-slate-800/80">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Sparkles className="w-3 h-3 text-cyan-400" />
            Live 4-Stage Execution Stepper (Real-Time Ingestion Loop)
          </span>
          <span className="text-[10px] font-mono text-slate-400">
            {isStreaming ? 'ACTIVE STREAMING • TICK EVERY 3 SECONDS' : 'WAITING FOR USER TRIGGER'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          {/* Stage 1: API Collection */}
          <div className={`p-2.5 rounded-lg border text-xs font-mono flex items-center justify-between transition-all ${
            s1Status === 'FETCHING'
              ? 'border-cyan-500 bg-cyan-950/60 text-cyan-200 animate-pulse'
              : s1Status === 'COMPLETED' && isStreaming
              ? 'border-emerald-500/40 bg-emerald-950/20 text-emerald-300'
              : 'border-slate-800 bg-slate-950 text-slate-400'
          }`}>
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center text-[10px] font-bold text-cyan-400">
                1
              </span>
              <div>
                <div className="font-semibold text-slate-200">1. Live API Ingest</div>
                <div className="text-[10px] text-slate-400">Open-Meteo Current</div>
              </div>
            </div>
            <span className="text-[10px] font-bold text-cyan-400">
              {fetchLatency ? `${fetchLatency}ms` : '3s'}
            </span>
          </div>

          {/* Stage 2: 12D Feature & ML Inference */}
          <div className={`p-2.5 rounded-lg border text-xs font-mono flex items-center justify-between transition-all ${
            s2Status === 'PROCESSING'
              ? 'border-indigo-500 bg-indigo-950/60 text-indigo-200 animate-pulse'
              : s2Status === 'COMPLETED' && isStreaming
              ? 'border-emerald-500/40 bg-emerald-950/20 text-emerald-300'
              : 'border-slate-800 bg-slate-950 text-slate-400'
          }`}>
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center text-[10px] font-bold text-indigo-400">
                2
              </span>
              <div>
                <div className="font-semibold text-slate-200">2. 12D Feature + ML</div>
                <div className="text-[10px] text-slate-400">Scaler • IF • LOF • PCA</div>
              </div>
            </div>
            <span className="text-[10px] text-indigo-300 font-bold">
              {stages.stage2_features_ml?.duration_ms ? `${stages.stage2_features_ml.duration_ms}ms` : 'Real-time'}
            </span>
          </div>

          {/* Stage 3: Anomaly Consensus Check */}
          <div className={`p-2.5 rounded-lg border text-xs font-mono flex items-center justify-between transition-all ${
            stages.stage3_detect?.is_anomaly
              ? 'border-rose-500 bg-rose-950/60 text-rose-200 animate-pulse'
              : isStreaming
              ? 'border-emerald-500/40 bg-emerald-950/20 text-emerald-300'
              : 'border-slate-800 bg-slate-950 text-slate-400'
          }`}>
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center text-[10px] font-bold text-amber-400">
                3
              </span>
              <div>
                <div className="font-semibold text-slate-200">3. Anomaly Consensus</div>
                <div className="text-[10px] text-slate-400">IForest + LOF Scoring</div>
              </div>
            </div>
            {stages.stage3_detect?.is_anomaly ? (
              <span className="text-[10px] font-bold text-rose-400 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                ANOMALY
              </span>
            ) : (
              <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                NOMINAL
              </span>
            )}
          </div>

          {/* Stage 4: Instant Alert Dispatch */}
          <div className={`p-2.5 rounded-lg border text-xs font-mono flex items-center justify-between transition-all ${
            s4Status === 'ALERTED' || s4Status === 'DISPATCHING'
              ? 'border-rose-500 bg-rose-950/80 text-rose-100 shadow-lg shadow-rose-950/50 animate-bounce'
              : 'border-slate-800 bg-slate-950 text-slate-400'
          }`}>
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center text-[10px] font-bold text-rose-400">
                4
              </span>
              <div>
                <div className="font-semibold text-slate-200">4. Instant Alert</div>
                <div className="text-[10px] text-slate-400">WebSocket + Toast + Audio</div>
              </div>
            </div>
            <span className={`text-[10px] font-bold ${s4Status === 'ALERTED' ? 'text-rose-400' : 'text-slate-400'}`}>
              {s4Status === 'ALERTED' ? 'TRIGGERED!' : 'STANDBY'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

