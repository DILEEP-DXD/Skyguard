import React from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Sun,
  Moon,
  Loader2
} from 'lucide-react';

export default function Toolbar({
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
  const isFaultActive = overallStatus !== 'Nominal' && isStreaming;

  return (
    <header className="h-12 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-4 flex items-center justify-between gap-4 sticky top-0 z-30 select-none">
      {/* Left: Brand + Segmented Tab Control */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="flex items-center gap-2">
          {/* Minimalist geometric mark */}
          <div className="w-5 h-5 rounded border border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center">
            <div className="w-2 h-2 rounded-[1px] bg-zinc-900 dark:bg-zinc-100" />
          </div>
          <span className="text-xs font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            SkyGuard
          </span>
        </div>

        <div className="h-4 w-px bg-zinc-200 dark:border-zinc-800 dark:bg-zinc-800" />

        {/* Tab Switcher */}
        <div className="flex items-center p-0.5 rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-100/80 dark:bg-zinc-900 text-xs font-medium">
          <button
            onClick={() => setActiveTab('telemetry')}
            className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
              activeTab === 'telemetry'
                ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xs font-semibold'
                : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
            }`}
          >
            Telemetry
          </button>
          <button
            onClick={() => setActiveTab('diagnostics')}
            className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
              activeTab === 'diagnostics'
                ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xs font-semibold'
                : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
            }`}
          >
            Model Diagnostics
          </button>
        </div>
      </div>

      {/* Center: Station Select + Controls + Telemetry Readout */}
      <div className="flex items-center gap-3">
        {/* Compact Station Select Dropdown */}
        <div className="flex items-center">
          <select
            value={selectedStationId}
            onChange={(e) => setSelectedStationId(e.target.value)}
            disabled={isCalibrating}
            className="h-7 text-xs font-mono bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded px-2 text-zinc-800 dark:text-zinc-200 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-600 transition-colors cursor-pointer"
          >
            {stations.map((st) => (
              <option key={st.id} value={st.id}>
                {st.name} ({st.lat.toFixed(2)}, {st.lon.toFixed(2)})
              </option>
            ))}
          </select>
        </div>

        {/* Stream Actions */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={onStartPipeline}
            disabled={isCalibrating}
            className="h-7 px-2.5 text-xs font-medium rounded border border-zinc-900 dark:border-zinc-100 bg-zinc-900 dark:bg-zinc-100 text-zinc-100 dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {isCalibrating ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={1.75} />
                <span>Calibrating</span>
              </>
            ) : (
              <>
                <Play className="w-3 h-3 fill-current" strokeWidth={1.75} />
                <span>{isPaused ? 'Resume' : isStreaming ? 'Restart' : 'Start Stream'}</span>
              </>
            )}
          </button>

          {isStreaming && (
            <button
              onClick={onStopPipeline}
              className="h-7 px-2 text-xs font-medium rounded border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors flex items-center gap-1 cursor-pointer"
            >
              <Pause className="w-3 h-3" strokeWidth={1.75} />
              <span>Pause</span>
            </button>
          )}

          <button
            onClick={onResetSession}
            disabled={isCalibrating}
            title="Reset telemetry database & session"
            className="h-7 px-2 text-xs font-medium rounded border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50"
          >
            <RotateCcw className="w-3 h-3" strokeWidth={1.75} />
            <span>Reset</span>
          </button>
        </div>

        <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-800 hidden md:block" />

        {/* Inline Monospace Pipeline Telemetry Readout */}
        <div className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400 hidden xl:flex items-center gap-2">
          <span>API: <span className="text-zinc-700 dark:text-zinc-300">{latency ? `${Math.round(latency)}ms` : '--'}</span></span>
          <span>·</span>
          <span>Window: <span className="text-zinc-700 dark:text-zinc-300">10 ticks</span></span>
          <span>·</span>
          <span>Status: <span className="text-zinc-700 dark:text-zinc-300">{pipelineStatus.state || 'IDLE'}</span></span>
        </div>
      </div>

      {/* Right: Health Status Dot + Mute + Theme Toggle */}
      <div className="flex items-center gap-3 shrink-0">
        {/* Status indicator */}
        <div className="flex items-center gap-2 text-xs font-medium">
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              isFaultActive
                ? 'bg-red-500'
                : isStreaming
                ? 'bg-emerald-500'
                : 'bg-zinc-400 dark:bg-zinc-600'
            }`}
          />
          <span className="text-zinc-700 dark:text-zinc-300 text-xs">
            {overallStatus}
          </span>
        </div>

        <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-800" />

        {/* Audio Mute Button */}
        <button
          onClick={onToggleMute}
          title={isMuted ? 'Unmute alert tone' : 'Mute alert tone'}
          className="w-7 h-7 rounded border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 flex items-center justify-center text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors cursor-pointer"
        >
          {isMuted ? (
            <VolumeX className="w-3.5 h-3.5" strokeWidth={1.75} />
          ) : (
            <Volume2 className="w-3.5 h-3.5" strokeWidth={1.75} />
          )}
        </button>

        {/* Theme Toggle Button */}
        <button
          onClick={onToggleTheme}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          className="w-7 h-7 rounded border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 flex items-center justify-center text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors cursor-pointer"
        >
          {theme === 'dark' ? (
            <Sun className="w-3.5 h-3.5" strokeWidth={1.75} />
          ) : (
            <Moon className="w-3.5 h-3.5" strokeWidth={1.75} />
          )}
        </button>
      </div>
    </header>
  );
}

