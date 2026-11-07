import React from 'react';
import { Radio, Play, Sparkles, Shield, Cpu, Activity, Database, CheckCircle2 } from 'lucide-react';

export default function StandbyHero({ onStartPipeline, isCalibrating }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-gradient-to-b from-slate-900 via-slate-900/90 to-slate-950 p-8 shadow-2xl relative overflow-hidden my-6">
      {/* Background ambient glow */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none -ml-20 -mb-20" />

      <div className="relative z-10 max-w-4xl mx-auto text-center space-y-6">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-cyan-500/40 bg-cyan-950/40 text-cyan-400 text-xs font-mono font-bold tracking-widest uppercase">
          <Radio className="w-3.5 h-3.5 animate-pulse" />
          STANDBY MODE • USER-TRIGGERED TRUE REAL-TIME PIPELINE
        </div>

        {/* Heading */}
        <div className="space-y-2">
          <h2 className="text-3xl sm:text-4xl font-black text-slate-100 tracking-tight">
            Live Internet Weather Station Anomaly Defense
          </h2>
          <p className="text-sm text-slate-400 max-w-2xl mx-auto font-mono">
            SkyGuard does not run on fake pre-loaded data. Choose a real-world Automatic Weather Station
            and click below to dynamically calibrate unsupervised ML models on 14 days of real observations
            and begin true live real-time detection.
          </p>
        </div>

        {/* 3 Step Workflow Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left pt-2 font-mono">
          <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/60 flex flex-col gap-2">
            <div className="w-7 h-7 rounded-lg bg-cyan-950 border border-cyan-500/40 text-cyan-400 flex items-center justify-center font-bold text-xs">
              1
            </div>
            <div className="font-bold text-xs text-slate-200">14-Day Dynamic Calibration</div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Fetches 360 real hourly observations from Open-Meteo for the selected coordinates and fits IsolationForest, LOF, KMeans & PCA in real time.
            </p>
          </div>

          <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/60 flex flex-col gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-950 border border-indigo-500/40 text-indigo-400 flex items-center justify-center font-bold text-xs">
              2
            </div>
            <div className="font-bold text-xs text-slate-200">3-Sec Live Polling + ADC Noise</div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Polls live station weather every 3s with sub-decimal hardware transducer micro-noise (±0.02°C) so sensor variances reflect true physical instruments.
            </p>
          </div>

          <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/60 flex flex-col gap-2">
            <div className="w-7 h-7 rounded-lg bg-rose-950 border border-rose-500/40 text-rose-400 flex items-center justify-center font-bold text-xs">
              3
            </div>
            <div className="font-bold text-xs text-slate-200">Instant Alerting & Fault Tests</div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Dispatches WebSocket alert events with audio chimes the exact second an anomaly or injected hardware fault occurs.
            </p>
          </div>
        </div>

        {/* Primary CTA */}
        <div className="pt-4 flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={() => onStartPipeline({
              station_id: 'IN-HYD',
              latitude: 17.3850,
              longitude: 78.4867,
              station_name: 'Hyderabad AWS',
              poll_interval_sec: 3.0
            })}
            disabled={isCalibrating}
            className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-mono font-bold uppercase tracking-wider bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 hover:from-cyan-400 hover:to-blue-500 transition-all cursor-pointer shadow-lg shadow-cyan-500/25 disabled:opacity-50"
          >
            <Play className="w-4 h-4 fill-slate-950" />
            <span>{isCalibrating ? 'Calibrating Station...' : 'Start Live Pipeline (Hyderabad AWS)'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

