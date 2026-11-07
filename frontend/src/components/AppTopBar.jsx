import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  Sun,
  Moon,
  Menu,
  Volume2,
  VolumeX,
  ChevronDown,
  RefreshCw
} from 'lucide-react';
import { soundManager } from '../utils/audio';

export default function AppTopBar({
  selectedStationId,
  onSelectStation,
  setSelectedStationId: propSetSelectedStationId,
  stations = [],
  pipelineStatus = {},
  isCalibrating = false,
  isConnected = true,
  onReconnect,
  onStartStream,
  onStartPipeline: propOnStartPipeline,
  onStopStream,
  onStopPipeline: propOnStopPipeline,
  theme = 'light',
  onToggleTheme,
  onToggleMobileNav
}) {
  const handleSelectStation = onSelectStation || propSetSelectedStationId || (() => {});
  const handleStart = onStartStream || propOnStartPipeline || (() => {});
  const handleStop = onStopStream || propOnStopPipeline || (() => {});

  const isStreaming = pipelineStatus.state === 'STREAMING_LIVE';
  const isPaused = pipelineStatus.state === 'PAUSED';

  // Audio manager state
  const [audioState, setAudioState] = useState(soundManager.getState());
  const [isAudioMenuOpen, setIsAudioMenuOpen] = useState(false);
  const audioMenuRef = useRef(null);

  useEffect(() => {
    const unsubscribe = soundManager.subscribe((state) => {
      setAudioState(state);
    });
    return unsubscribe;
  }, []);

  // Close audio menu on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (audioMenuRef.current && !audioMenuRef.current.contains(e.target)) {
        setIsAudioMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Compute live relative time e.g. "updated 2s ago"
  const [secondsAgo, setSecondsAgo] = useState(2);

  useEffect(() => {
    const updateTime = () => {
      if (!pipelineStatus.last_poll_time) {
        setSecondsAgo(null);
        return;
      }
      const diff = Math.max(0, Math.round((Date.now() - new Date(pipelineStatus.last_poll_time).getTime()) / 1000));
      setSecondsAgo(diff);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [pipelineStatus.last_poll_time]);

  const isStale = isStreaming && secondsAgo !== null && secondsAgo >= 15;

  return (
    <header className="h-14 border-b border-[#E5E5E5] dark:border-[#262626] bg-[#FFFFFF] dark:bg-[#121213] px-4 sm:px-6 flex items-center justify-between gap-4 sticky top-0 z-30 shrink-0">
      {/* Left: Mobile Nav Button + Station Selector */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleMobileNav}
          className="md:hidden p-1.5 rounded-md text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer"
          aria-label="Open navigation menu"
        >
          <Menu className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2">
          <label htmlFor="station-select" className="text-xs text-neutral-500 dark:text-neutral-400 hidden sm:inline">
            Station:
          </label>
          <select
            id="station-select"
            value={selectedStationId}
            onChange={(e) => handleSelectStation(e.target.value)}
            disabled={isStreaming || isCalibrating}
            className="text-xs py-1.5 pl-2.5 pr-8 rounded-md border border-[#E5E5E5] dark:border-[#262626] bg-[#FFFFFF] dark:bg-[#171718] text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer disabled:opacity-60"
          >
            {stations.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Right: Live Status, Mute, Pause, Theme */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Live Status Indicator */}
        <div className="flex items-center gap-1.5 text-xs text-neutral-600 dark:text-neutral-400">
          {!isConnected ? (
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-500" />
              <span className="text-red-600 dark:text-red-400 font-medium">Disconnected</span>
              {onReconnect && (
                <button
                  onClick={onReconnect}
                  className="ml-1 text-[11px] underline text-blue-600 dark:text-blue-400 cursor-pointer flex items-center gap-0.5"
                  title="Reconnect to stream"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Retry</span>
                </button>
              )}
            </div>
          ) : isStale ? (
            <>
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              <span className="text-amber-600 dark:text-amber-400 font-medium">
                Stale · last update {secondsAgo}s ago
              </span>
            </>
          ) : isStreaming ? (
            <>
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>Live</span>
              <span className="text-neutral-400 dark:text-neutral-500">·</span>
              <span className="tabular-nums text-neutral-500 dark:text-neutral-400">
                updated {secondsAgo !== null ? `${secondsAgo}s ago` : 'just now'}
              </span>
            </>
          ) : isCalibrating ? (
            <>
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              <span>Calibrating</span>
            </>
          ) : isPaused ? (
            <>
              <span className="w-2 h-2 rounded-full bg-neutral-400" />
              <span>Paused</span>
            </>
          ) : (
            <>
              <span className="w-2 h-2 rounded-full bg-neutral-400" />
              <span>Standby</span>
            </>
          )}
        </div>

        {/* Audio Mute Button with Dropdown */}
        <div className="relative" ref={audioMenuRef}>
          <div className="inline-flex rounded-md border border-[#E5E5E5] dark:border-[#262626] bg-white dark:bg-[#171718] overflow-hidden">
            <button
              onClick={() => soundManager.toggleMute()}
              className="p-1.5 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
              title={soundManager.getMuteTooltip()}
              aria-label={audioState.isMuted ? 'Unmute alert audio (M)' : 'Mute alert audio (M)'}
            >
              {audioState.isMuted ? (
                <VolumeX className="w-3.5 h-3.5 text-red-500" />
              ) : (
                <Volume2 className="w-3.5 h-3.5 text-neutral-600 dark:text-neutral-400" />
              )}
            </button>
            <button
              onClick={() => setIsAudioMenuOpen(!isAudioMenuOpen)}
              className="px-1 border-l border-[#E5E5E5] dark:border-[#262626] text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-800 cursor-pointer"
              aria-label="Audio options"
            >
              <ChevronDown className="w-3 h-3" />
            </button>
          </div>

          {/* Audio Dropdown Popover */}
          {isAudioMenuOpen && (
            <div className="absolute right-0 mt-1 w-56 rounded-lg border border-[#E5E5E5] dark:border-[#262626] bg-white dark:bg-[#171718] p-1.5 shadow-md z-50 text-xs">
              <div className="px-2 py-1 font-semibold text-neutral-900 dark:text-neutral-100 border-b border-[#F0F0F0] dark:border-[#262626] mb-1">
                Sound options (Press M)
              </div>
              <button
                onClick={() => {
                  soundManager.muteFor(15);
                  setIsAudioMenuOpen(false);
                }}
                className="w-full text-left px-2 py-1.5 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 cursor-pointer"
              >
                Mute for 15 minutes
              </button>
              <button
                onClick={() => {
                  soundManager.muteFor(60);
                  setIsAudioMenuOpen(false);
                }}
                className="w-full text-left px-2 py-1.5 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 cursor-pointer"
              >
                Mute for 1 hour
              </button>
              <button
                onClick={() => {
                  soundManager.muteIndefinitely();
                  setIsAudioMenuOpen(false);
                }}
                className="w-full text-left px-2 py-1.5 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 cursor-pointer"
              >
                Mute until I turn it back on
              </button>
              {audioState.isMuted && (
                <button
                  onClick={() => {
                    soundManager.unmute();
                    setIsAudioMenuOpen(false);
                  }}
                  className="w-full text-left px-2 py-1.5 rounded text-blue-600 dark:text-blue-400 font-medium hover:bg-blue-50 dark:hover:bg-blue-950/40 cursor-pointer border-t border-[#F0F0F0] dark:border-[#262626] mt-1"
                >
                  Unmute sound
                </button>
              )}
            </div>
          )}
        </div>

        {/* Pause / Resume Button */}
        {isStreaming ? (
          <button
            onClick={handleStop}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md border border-[#E5E5E5] dark:border-[#262626] bg-white dark:bg-[#171718] text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
            title="Pause live updates (Space)"
            aria-label="Pause live updates"
          >
            <Pause className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Pause live updates</span>
            <span className="sm:hidden">Pause</span>
          </button>
        ) : (
          <button
            onClick={handleStart}
            disabled={isCalibrating}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md border border-[#E5E5E5] dark:border-[#262626] bg-white dark:bg-[#171718] text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors cursor-pointer disabled:opacity-50"
            title="Start or resume telemetry updates (Space)"
            aria-label="Start or resume telemetry updates"
          >
            <Play className="w-3.5 h-3.5" />
            <span>{isPaused ? 'Resume' : 'Start'}</span>
          </button>
        )}

        {/* Theme Toggle Button */}
        <button
          onClick={onToggleTheme}
          className="p-1.5 rounded-md border border-[#E5E5E5] dark:border-[#262626] bg-white dark:bg-[#171718] text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
          title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
        </button>
      </div>
    </header>
  );
}
