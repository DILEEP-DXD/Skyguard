import React from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Sun,
  Moon,
  Loader2,
  Activity,
  Terminal
} from 'lucide-react';

export default function ConsoleToolbar({
  activeTab,
  setActiveTab,
  selectedStationId,
  setSelectedStationId,
  stations = [],
  pipelineStatus = {},
  isCalibrating = false,
  onStartPipeline,
  onStopPipeline,
  onResetSession,
  isMuted,
  onToggleMute,
  theme,
  onToggleTheme,
  overallStatus = 'Nominal'
}) {
  const isStreaming = pipelineStatus.state === 'STREAMING_LIVE';
  const isPaused = pipelineStatus.state === 'PAUSED';
  const latency = pipelineStatus.fetch_latency_ms || 0;
  const isFaultActive = overallStatus === 'Fault Active';

  return (
    <header className="h-12 border-b border-slate-200 dark:border-[#162238] bg-white/95 dark:bg-[#070b16]/95 backdrop-blur-md px-3.5 flex items-center justify-between gap-3 sticky top-0 z-30 select-none transition-colors">
      {/* Left: Brand + Segmented Tab Control */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="flex items-center gap-2">
          {/* Mission-Control Radar Beacon */}
          <div className="relative w-5 h-5 rounded border border-slate-300 dark:border-[#1e2f4c] bg-slate-100 dark:bg-[#0d1627] flex items-center justify-center">
            <div className={`w-2 h-2 rounded-full ${
              isFaultActive
                ? 'bg-rose-500 animate-ping'
                : isStreaming
                ? 'bg-cyan-400 radar-dot-active'
                : 'bg-slate-400'
            }`} />
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-mono font-bold tracking-tight text-slate-900 dark:text-slate-100">
              SkyGuard
            </span>
          </div>
        </div>

        <div className="h-4 w-px bg-slate-200 dark:bg-[#162238]" />

        {/* Tab Switcher */}
        <div className="flex items-center p-0.5 rounded border border-slate-200 dark:border-[#162238] bg-slate-100 dark:bg-[#0a0f1d] text-xs font-medium font-mono">
          <button
            onClick={() => setActiveTab('telemetry')}
            className={`px-2.5 py-1 rounded transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'telemetry'
                ? 'bg-white dark:bg-[#121c2e] text-slate-900 dark:text-cyan-400 shadow-xs font-semibold'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <span>Telemetry</span>
            <span className="text-[9px] px-1 py-0.2 rounded bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400">1</span>
          </button>
          <button
            onClick={() => setActiveTab('diagnostics')}
            className={`px-2.5 py-1 rounded transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'diagnostics'
                ? 'bg-white dark:bg-[#121c2e] text-slate-900 dark:text-cyan-400 shadow-xs font-semibold'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <span>Model Diagnostics</span>
            <span className="text-[9px] px-1 py-0.2 rounded bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400">2</span>
          </button>
        </div>
      </div>

      {/* Center: Station Selector + Pipeline Actions */}
      <div className="flex items-center gap-2.5">
        {/* Station Select */}
        <div className="flex items-center">
          <select
            value={selectedStationId}
            onChange={(e) => setSelectedStationId(e.target.value)}
            disabled={isCalibrating}
            className="h-7 text-xs font-mono bg-slate-50 dark:bg-[#0a0f1d] border border-slate-200 dark:border-[#162238] rounded px-2 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-cyan-500 dark:focus:border-cyan-500 transition-colors cursor-pointer"
          >
            {stations.map((st) => (
              <option key={st.id} value={st.id}>
                {st.name} ({st.lat.toFixed(2)}, {st.lon.toFixed(2)})
              </option>
            ))}
          </select>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={onStartPipeline}
            disabled={isCalibrating}
            className="h-7 px-2.5 text-xs font-mono font-medium rounded border border-cyan-600 dark:border-cyan-500 bg-cyan-600 dark:bg-cyan-500 text-white dark:text-slate-950 hover:bg-cyan-700 dark:hover:bg-cyan-400 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-sm"
          >
            {isCalibrating ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={2} />
                <span>Calibrating...</span>
              </>
            ) : (
              <>
                <Play className="w-3 h-3 fill-current" strokeWidth={2} />
                <span>{isPaused ? 'Resume' : isStreaming ? 'Restart' : 'Start Live'}</span>
              </>
            )}
          </button>

          {isStreaming && (
            <button
              onClick={onStopPipeline}
              className="h-7 px-2 text-xs font-mono font-medium rounded border border-slate-200 dark:border-[#162238] bg-slate-50 dark:bg-[#0a0f1d] text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#121c2e] transition-colors flex items-center gap-1 cursor-pointer"
              title="Pause stream [Space]"
            >
              <Pause className="w-3 h-3" strokeWidth={2} />
              <span>Pause</span>
            </button>
          )}

          <button
            onClick={onResetSession}
            disabled={isCalibrating}
            title="Reset telemetry database & session [R]"
            className="h-7 px-2 text-xs font-mono font-medium rounded border border-slate-200 dark:border-[#162238] bg-slate-50 dark:bg-[#0a0f1d] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#121c2e] transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50"
          >
            <RotateCcw className="w-3 h-3" strokeWidth={2} />
            <span>Reset</span>
          </button>
        </div>

        <div className="h-4 w-px bg-slate-200 dark:bg-[#162238] hidden lg:block" />

        {/* Real-Time Monospace Telemetry Status */}
        <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 hidden xl:flex items-center gap-2">
          <span>Latency: <strong className="text-slate-800 dark:text-cyan-400 tabular-nums">{latency ? `${Math.round(latency)}ms` : '--'}</strong></span>
          <span>·</span>
          <span>Window: <strong className="text-slate-800 dark:text-slate-300">10 ticks</strong></span>
          <span>·</span>
          <span>State: <strong className="text-slate-800 dark:text-slate-300 uppercase">{pipelineStatus.state || 'IDLE'}</strong></span>
        </div>
      </div>

      {/* Right: Health Status Pill + Mute + Theme Toggle */}
      <div className="flex items-center gap-2.5 shrink-0">
        {/* Overall System Health Status */}
        <div className={`px-2.5 py-1 rounded text-xs font-mono font-semibold flex items-center gap-1.5 border transition-all ${
          overallStatus === 'Fault Active'
            ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30'
            : overallStatus === 'Calibrating'
            ? 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/30'
            : overallStatus === 'Nominal'
            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
            : 'bg-slate-100 dark:bg-[#0a0f1d] text-slate-600 dark:text-slate-400 border-slate-200 dark:border-[#162238]'
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${
            overallStatus === 'Fault Active'
              ? 'bg-rose-500 animate-ping'
              : overallStatus === 'Nominal'
              ? 'bg-emerald-500'
              : overallStatus === 'Calibrating'
              ? 'bg-cyan-400 animate-pulse'
              : 'bg-slate-400'
          }`} />
          <span>{overallStatus}</span>
        </div>

        {/* Audio Mute Toggle */}
        <button
          onClick={onToggleMute}
          title={isMuted ? 'Unmute Audio Alerts' : 'Mute Audio Alerts'}
          className="h-7 w-7 rounded border border-slate-200 dark:border-[#162238] bg-slate-50 dark:bg-[#0a0f1d] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 flex items-center justify-center transition-colors cursor-pointer"
        >
          {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
        </button>

        {/* Dark/Light Mode Toggle */}
        <button
          onClick={onToggleTheme}
          title={theme === 'dark' ? 'Switch to Lab Light Mode' : 'Switch to Mission Navy Dark Mode'}
          className="h-7 w-7 rounded border border-slate-200 dark:border-[#162238] bg-slate-50 dark:bg-[#0a0f1d] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 flex items-center justify-center transition-colors cursor-pointer"
        >
          {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
        </button>
      </div>
    </header>
  );
}

