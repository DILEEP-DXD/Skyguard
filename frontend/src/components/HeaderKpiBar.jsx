import React from 'react';
import { Radio, Database, Cpu, AlertTriangle, ShieldCheck, Activity, Volume2, VolumeX } from 'lucide-react';

export default function HeaderKpiBar({
  wsStatus,
  stationId = "AWS-ALPHA-01",
  stationName = "Hyderabad AWS",
  totalReadings = 0,
  totalAnomalies = 0,
  activeCluster = 0,
  activeTab,
  setActiveTab,
  isMuted = false,
  onToggleMute
}) {
  const isWsLive = wsStatus === 'connected';

  // Weather regime metadata for MiniBatchKMeans clusters
  const clusterMeta = {
    0: { label: "Regime 0: Neutral Day", color: "border-sky-500/40 text-sky-400 bg-sky-950/40" },
    1: { label: "Regime 1: Diurnal Warm Peak", color: "border-amber-500/40 text-amber-400 bg-amber-950/40" },
    2: { label: "Regime 2: Cool / High Humidity", color: "border-emerald-500/40 text-emerald-400 bg-emerald-950/40" }
  };
  const currentCluster = clusterMeta[activeCluster] || {
    label: `Cluster ${activeCluster ?? 0}`,
    color: "border-indigo-500/40 text-indigo-400 bg-indigo-950/40"
  };

  return (
    <header className="border-b border-slate-800 bg-slate-950/90 backdrop-blur sticky top-0 z-40">
      {/* Top Main Bar */}
      <div className="max-w-[1700px] mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-4">
        {/* Brand & Station */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 via-blue-600/30 to-indigo-600/20 border border-cyan-500/40 flex items-center justify-center shadow-lg shadow-cyan-500/10">
            <Radio className="w-5 h-5 text-cyan-400 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black tracking-wider text-slate-100 flex items-center gap-1.5">
                SKY<span className="text-cyan-400">GUARD</span>
              </h1>
              <span className="text-[10px] font-mono tracking-widest px-2 py-0.5 rounded border border-slate-700 bg-slate-900 text-slate-400">
                LIVE INTERNET AWS
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono tracking-tight">
              Hardware Sensor Anomaly Detection • Autonomous Unsupervised ML
            </p>
          </div>
        </div>

        {/* Live KPI metrics */}
        <div className="flex items-center flex-wrap gap-2 sm:gap-3 text-xs font-mono">
          {/* Status Badge */}
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${
            isWsLive 
              ? 'border-emerald-500/30 bg-emerald-950/30 text-emerald-400' 
              : 'border-amber-500/30 bg-amber-950/30 text-amber-400'
          }`}>
            <span className={`w-2 h-2 rounded-full ${isWsLive ? 'bg-emerald-400 animate-ping' : 'bg-amber-400'}`} />
            <span className="font-semibold tracking-wider">
              {isWsLive ? 'LIVE STREAM • SQLITE ACTIVE' : `WS: ${wsStatus.toUpperCase()}`}
            </span>
          </div>

          {/* Active Station */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-900 text-slate-300">
            <Database className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-slate-400 font-normal">AWS:</span>
            <span className="font-bold text-slate-100">{stationName || stationId}</span>
          </div>

          {/* Total Readings */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-900 text-slate-300">
            <Activity className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-slate-400 font-normal">TELEMETRY:</span>
            <span className="font-bold text-cyan-300">{totalReadings.toLocaleString()}</span>
          </div>

          {/* Anomalies Caught */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-500/30 bg-rose-950/30 text-rose-300">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
            <span className="text-rose-400/80 font-normal">ANOMALIES:</span>
            <span className="font-bold text-rose-200">{totalAnomalies}</span>
          </div>

          {/* Operating Weather Cluster */}
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border ${currentCluster.color}`}>
            <Cpu className="w-3.5 h-3.5" />
            <span className="font-semibold">{currentCluster.label}</span>
          </div>

          {/* Audio Alert Toggle */}
          <button
            onClick={onToggleMute}
            title={isMuted ? "Audio alert chime muted (click to unmute)" : "Audio alert chime active (click to mute)"}
            className={`p-1.5 rounded-lg border transition-all cursor-pointer flex items-center gap-1 text-[11px] ${
              isMuted
                ? 'border-slate-800 bg-slate-900 text-slate-500'
                : 'border-cyan-500/40 bg-cyan-950/30 text-cyan-400'
            }`}
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-slate-400" /> : <Volume2 className="w-4 h-4 text-cyan-400" />}
            <span>{isMuted ? 'Muted' : 'Sound ON'}</span>
          </button>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="max-w-[1700px] mx-auto px-4 flex items-center gap-2 border-t border-slate-900">
        <button
          onClick={() => setActiveTab('live')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold tracking-wide uppercase transition-all border-b-2 -mb-px cursor-pointer ${
            activeTab === 'live'
              ? 'border-cyan-400 text-cyan-400 bg-cyan-950/10'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
          }`}
        >
          <Activity className="w-4 h-4" />
          Tab 1: Live Sensor Telemetry & Alert Command Center
        </button>

        <button
          onClick={() => setActiveTab('analytics')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold tracking-wide uppercase transition-all border-b-2 -mb-px cursor-pointer ${
            activeTab === 'analytics'
              ? 'border-indigo-400 text-indigo-400 bg-indigo-950/10'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
          }`}
        >
          <Cpu className="w-4 h-4" />
          Tab 2: Unsupervised Model Analytics & Embedding Explorer
        </button>
      </div>
    </header>
  );
}
