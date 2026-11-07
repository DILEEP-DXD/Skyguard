import React, { useState, useEffect, useCallback, useRef } from 'react';
import AppSidebar from './components/AppSidebar';
import AppTopBar from './components/AppTopBar';
import OverviewPage from './components/OverviewPage';
import TelemetryConsole from './components/TelemetryConsole';
import DiagnosticsConsole from './components/DiagnosticsConsole';
import ExperimentStudioPage from './components/ExperimentStudioPage';
import IncidentsPage from './components/IncidentsPage';
import IncidentDetailDrawer from './components/IncidentDetailDrawer';
import FaultSimulatorPage from './components/FaultSimulatorPage';
import SettingsPage from './components/SettingsPage';
import BottomRightToast from './components/BottomRightToast';
import { soundManager } from './utils/audio';
import { getOpenAlerts } from './utils/formatters';
import { X, Keyboard } from 'lucide-react';

const STATION_PRESETS = [
  { id: 'IN-HYD', name: 'Hyderabad AWS', lat: 17.3850, lon: 78.4867, state: 'Telangana' },
  { id: 'IN-PB',  name: 'Jalandhar / Punjab AWS', lat: 31.3260, lon: 75.5762, state: 'Punjab' },
  { id: 'IN-DEL', name: 'New Delhi Safdarjung AWS', lat: 28.5843, lon: 77.2028, state: 'Delhi NCR' },
  { id: 'IN-MUM', name: 'Mumbai Santacruz AWS', lat: 19.0896, lon: 72.8656, state: 'Maharashtra' },
  { id: 'IN-BLR', name: 'Bengaluru HAL AWS', lat: 12.9500, lon: 77.6682, state: 'Karnataka' },
  { id: 'CUSTOM', name: 'Custom GPS Coordinates', lat: 20.0000, lon: 77.0000, state: 'Custom' }
];

const STATION_STORAGE_KEY = 'skyguard_selected_station';

export default function App() {
  // Navigation State
  const [activePage, setActivePage] = useState('overview');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  // Investigation Drawer state
  const [investigatingAlertId, setInvestigatingAlertId] = useState(null);

  // Keyboard shortcut sheet modal
  const [isShortcutsModalOpen, setIsShortcutsModalOpen] = useState(false);

  // Station and Telemetry State
  const [selectedStationId, setSelectedStationId] = useState(() => {
    if (typeof window === 'undefined') return 'IN-HYD';
    return localStorage.getItem(STATION_STORAGE_KEY) || 'IN-HYD';
  });

  const handleSelectStation = (id) => {
    setSelectedStationId(id);
    if (typeof window !== 'undefined') {
      try { localStorage.setItem(STATION_STORAGE_KEY, id); } catch {}
    }
  };

  const [readings, setReadings] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [pipelineStatus, setPipelineStatus] = useState({
    state: 'IDLE',
    station: { id: 'IN-HYD', name: 'Hyderabad AWS' },
    fetch_latency_ms: 0,
    total_collected: 0,
    total_anomalies: 0,
    active_fault: null
  });
  const [analyticsSnapshot, setAnalyticsSnapshot] = useState(null);
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [isConnected, setIsConnected] = useState(true);

  // Toast states
  const [activeToastAlert, setActiveToastAlert] = useState(null);
  const [actionToast, setActionToast] = useState(null);

  // Theme state: light default, system preference fallback, localStorage
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('skyguard_theme');
    if (saved) return saved;
    if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  });

  const wsRef = useRef(null);
  const seenAlertIds = useRef(new Set());
  const gKeyDownRef = useRef(false);
  const gKeyTimerRef = useRef(null);

  // Apply theme to document element
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('skyguard_theme', theme);
  }, [theme]);

  const handleToggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  // Browser tab title reflecting open alert count
  const openAlertsCount = getOpenAlerts(alerts).length;
  useEffect(() => {
    if (openAlertsCount > 0) {
      document.title = `(${openAlertsCount}) SkyGuard`;
    } else {
      document.title = 'SkyGuard';
    }
  }, [openAlertsCount]);

  // ── Central Analytics Fetch ────────────────────────────────────────────────
  const fetchAnalytics = useCallback(async () => {
    try {
      const res = await fetch('http://localhost:8000/api/analytics');
      if (res.ok) {
        const data = await res.json();
        setAnalyticsSnapshot(data);
      }
    } catch {
      // Quiet offline fallback
    }
  }, []);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  // ── Synchronized 2-Second Polling ──────────────────────────────────────────
  const fetchTelemetryAndAlerts = useCallback(async () => {
    try {
      const stRes = await fetch('http://localhost:8000/api/pipeline/status');
      if (stRes.ok) {
        const stData = await stRes.json();
        setPipelineStatus(stData);
        setIsConnected(true);
        if (stData.state !== 'CALIBRATING_MODELS') {
          setIsCalibrating(false);
        }
      }

      const rdRes = await fetch('http://localhost:8000/api/telemetry/recent?limit=60');
      if (rdRes.ok) {
        const rdData = await rdRes.json();
        setReadings(rdData);
      }

      const alRes = await fetch('http://localhost:8000/api/alerts?limit=150');
      if (alRes.ok) {
        const alData = await alRes.json();
        setAlerts(alData);
      }
    } catch {
      setIsConnected(false);
    }
  }, []);

  useEffect(() => {
    fetchTelemetryAndAlerts();
    const interval = setInterval(fetchTelemetryAndAlerts, 2000);
    return () => clearInterval(interval);
  }, [fetchTelemetryAndAlerts]);

  // ── WebSocket Live Connection ──────────────────────────────────────────────
  const connectWs = useCallback(() => {
    const ws = new WebSocket('ws://localhost:8000/ws/stream');
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
    };

    ws.onclose = () => {
      setIsConnected(false);
      setTimeout(connectWs, 2000);
    };

    ws.onerror = () => {
      setIsConnected(false);
    };

    ws.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data);

        if (msg.type === 'pipeline_reset') {
          setReadings([]);
          setAlerts([]);
          setActiveToastAlert(null);
          seenAlertIds.current.clear();
        }

        if (msg.type === 'reading') {
          const r = msg.data;
          setReadings((prev) => [...prev, r].slice(-100));
          if (msg.pipeline) {
            setPipelineStatus(msg.pipeline);
          }
        }

        if (msg.type === 'ALERT_TRIGGERED') {
          const alert = msg.alert;
          if (alert && !seenAlertIds.current.has(alert.id)) {
            seenAlertIds.current.add(alert.id);
            setActiveToastAlert(alert);

            // Group signature for sane chimes
            const groupKey = `${alert.sensor || 'SENSOR'}::${alert.fault_type || 'ANOMALY'}`;
            soundManager.playAlert(alert.severity, groupKey);

            setAlerts((prev) => [alert, ...prev.filter((a) => a.id !== alert.id)]);
          }
        }
      } catch (err) {
        console.error('WS parse error:', err);
      }
    };
  }, []);

  useEffect(() => {
    connectWs();
    return () => wsRef.current?.close();
  }, [connectWs]);

  // ── User Actions (Pipeline Controls) ───────────────────────────────────────
  const handleStartPipeline = async () => {
    const preset = STATION_PRESETS.find((s) => s.id === selectedStationId) || STATION_PRESETS[0];
    setIsCalibrating(true);
    setActiveToastAlert(null);

    try {
      const res = await fetch('http://localhost:8000/api/pipeline/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          station_id: preset.id,
          latitude: preset.lat,
          longitude: preset.lon,
          station_name: preset.name,
          poll_interval_sec: 3.0
        })
      });
      const data = await res.json();
      setPipelineStatus(data);
      fetchTelemetryAndAlerts();
      fetchAnalytics();
    } catch (err) {
      console.error('Failed to start pipeline:', err);
      setIsCalibrating(false);
    }
  };

  const handleStopPipeline = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/pipeline/stop', { method: 'POST' });
      const data = await res.json();
      setPipelineStatus(data);
    } catch (err) {
      console.error('Failed to pause pipeline:', err);
    }
  };

  const handleResetSession = async () => {
    try {
      await fetch('http://localhost:8000/api/pipeline/reset', { method: 'POST' });
      setReadings([]);
      setAlerts([]);
      setActiveToastAlert(null);
      seenAlertIds.current.clear();
      fetchAnalytics();
      fetchTelemetryAndAlerts();
    } catch (e) {
      console.error('Reset error:', e);
    }
  };

  // ── Alert Actions (Single & Bulk) ──────────────────────────────────────────
  const handleBulkAction = async (ids, action) => {
    if (!ids || ids.length === 0) return;
    try {
      const res = await fetch('http://localhost:8000/api/alerts/bulk-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alert_ids: ids, action })
      });
      if (res.ok) {
        const act = action.toUpperCase();
        setAlerts((prev) =>
          prev.map((a) => {
            if (ids.includes(a.id)) {
              return {
                ...a,
                status: act,
                is_acknowledged: act !== 'REOPEN',
                acknowledged_at: act === 'ACKNOWLEDGE' ? new Date().toISOString() : a.acknowledged_at,
                resolved_at: act === 'RESOLVE' ? new Date().toISOString() : a.resolved_at,
                dismissed_at: act === 'DISMISS' ? new Date().toISOString() : a.dismissed_at
              };
            }
            return a;
          })
        );
        if (activeToastAlert && ids.includes(activeToastAlert.id)) {
          setActiveToastAlert(null);
        }
      }
    } catch (err) {
      console.error('Bulk action error:', err);
    }
  };

  const handleAcknowledgeAlert = async (alertId) => {
    await handleBulkAction([alertId], 'ACKNOWLEDGE');
  };

  const handleResolveAlert = async (alertId) => {
    await handleBulkAction([alertId], 'RESOLVE');
  };

  const handleDismissAlert = async (alertId) => {
    await handleBulkAction([alertId], 'DISMISS');
  };

  // ── Global Keyboard Shortcuts ──────────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;

      // Close modal / drawer on Escape
      if (e.key === 'Escape') {
        if (isShortcutsModalOpen) setIsShortcutsModalOpen(false);
        if (investigatingAlertId) setInvestigatingAlertId(null);
        return;
      }

      // Shortcut cheat sheet: ?
      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        e.preventDefault();
        setIsShortcutsModalOpen((prev) => !prev);
        return;
      }

      // M: toggle audio mute
      if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        soundManager.toggleMute();
        return;
      }

      // Space: pause/resume live updates
      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        if (pipelineStatus.state === 'STREAMING_LIVE') {
          handleStopPipeline();
        } else if (pipelineStatus.state === 'PAUSED' || pipelineStatus.state === 'IDLE') {
          handleStartPipeline();
        }
        return;
      }

      // Sequential "G then X" navigation
      if (e.key === 'g' || e.key === 'G') {
        gKeyDownRef.current = true;
        clearTimeout(gKeyTimerRef.current);
        gKeyTimerRef.current = setTimeout(() => {
          gKeyDownRef.current = false;
        }, 1200);
        return;
      }

      if (gKeyDownRef.current) {
        const k = e.key.toLowerCase();
        gKeyDownRef.current = false;
        clearTimeout(gKeyTimerRef.current);

        if (k === 'o') { setActivePage('overview'); return; }
        if (k === 's') { setActivePage('telemetry'); return; }
        if (k === 'a') { setActivePage('incidents'); return; }
        if (k === 'm') { setActivePage('diagnostics'); return; }
        if (k === 'f') { setActivePage('simulator'); return; }
        if (k === 't') { setActivePage('settings'); return; }
        if (k === 'e') { setActivePage('experiments'); return; }
      }

      // Numbers 1-7 direct shortcuts
      if (e.key === '1') setActivePage('overview');
      else if (e.key === '2') setActivePage('telemetry');
      else if (e.key === '3') setActivePage('incidents');
      else if (e.key === '4') setActivePage('diagnostics');
      else if (e.key === '5') setActivePage('simulator');
      else if (e.key === '6') setActivePage('settings');
      else if (e.key === '7') setActivePage('experiments');
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pipelineStatus.state, isShortcutsModalOpen, investigatingAlertId]);

  return (
    <div className="min-h-screen bg-[var(--bg-page)] text-[var(--text-primary)] flex font-sans antialiased">
      {/* 1. Sidebar */}
      <AppSidebar
        activePage={activePage}
        onSelectPage={setActivePage}
        collapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        isMobileOpen={isMobileNavOpen}
        onCloseMobile={() => setIsMobileNavOpen(false)}
        incidentCount={openAlertsCount}
      />

      {/* 2. Main Content Canvas */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Minimal Top Bar */}
        <AppTopBar
          selectedStationId={selectedStationId}
          onSelectStation={handleSelectStation}
          stations={STATION_PRESETS}
          pipelineStatus={pipelineStatus}
          isCalibrating={isCalibrating}
          isConnected={isConnected}
          onReconnect={connectWs}
          onStartStream={handleStartPipeline}
          onStopStream={handleStopPipeline}
          theme={theme}
          onToggleTheme={handleToggleTheme}
          onToggleMobileNav={() => setIsMobileNavOpen(!isMobileNavOpen)}
        />

        {/* Slim Pause Banner */}
        {pipelineStatus.state === 'PAUSED' && (
          <div className="bg-neutral-100 dark:bg-neutral-900 border-b border-[#E5E5E5] dark:border-[#262626] px-4 sm:px-8 py-2 flex items-center justify-between text-xs text-neutral-600 dark:text-neutral-400">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-neutral-400" />
              <span>
                Paused live updates. Showing data as of{' '}
                <strong className="font-semibold text-neutral-800 dark:text-neutral-200">
                  {pipelineStatus.last_poll_time
                    ? new Date(pipelineStatus.last_poll_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : 'session pause'}
                </strong>
              </span>
            </div>
            <button
              onClick={handleStartPipeline}
              className="text-xs font-medium px-2.5 py-1 rounded bg-white dark:bg-[#171718] border border-[#E5E5E5] dark:border-[#262626] text-blue-600 dark:text-blue-400 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
            >
              Resume live updates
            </button>
          </div>
        )}

        {/* Scrollable Viewport with Max Width ~1200px */}
        <main className="flex-1 overflow-y-auto px-4 py-6 sm:px-8 bg-[var(--bg-page)]">
          <div className="max-w-[1200px] mx-auto w-full">
            {activePage === 'overview' && (
              <OverviewPage
                pipelineStatus={pipelineStatus}
                readings={readings}
                alerts={alerts}
                analyticsSnapshot={analyticsSnapshot}
                onNavigate={setActivePage}
                onOpenInvestigate={(id) => setInvestigatingAlertId(id)}
                onBulkAction={handleBulkAction}
                onShowToast={setActionToast}
              />
            )}

            {activePage === 'telemetry' && (
              <TelemetryConsole
                readings={readings}
                alerts={alerts}
                activeFaultType={pipelineStatus.active_fault}
              />
            )}

            {activePage === 'diagnostics' && (
              <DiagnosticsConsole
                snapshot={analyticsSnapshot}
                onReloadSnapshot={fetchAnalytics}
                onShowToast={setActionToast}
              />
            )}

            {activePage === 'incidents' && (
              <IncidentsPage
                alerts={alerts}
                onAcknowledgeAlert={handleAcknowledgeAlert}
                onBulkAction={handleBulkAction}
                onOpenInvestigate={(id) => setInvestigatingAlertId(id)}
                onShowToast={setActionToast}
              />
            )}

            {activePage === 'simulator' && (
              <FaultSimulatorPage
                pipelineStatus={pipelineStatus}
                alerts={alerts}
                onInjectFault={fetchTelemetryAndAlerts}
                onClearFault={fetchTelemetryAndAlerts}
                onNavigate={setActivePage}
                onOpenInvestigate={(id) => setInvestigatingAlertId(id)}
                onShowToast={setActionToast}
              />
            )}

            {activePage === 'settings' && (
              <SettingsPage
                pipelineStatus={pipelineStatus}
                onResetSession={handleResetSession}
                onShowToast={setActionToast}
              />
            )}

            {activePage === 'experiments' && (
              <ExperimentStudioPage />
            )}
          </div>
        </main>
      </div>

      {/* 3. Investigation Drawer */}
      <IncidentDetailDrawer
        alertId={investigatingAlertId}
        isOpen={Boolean(investigatingAlertId)}
        onClose={() => setInvestigatingAlertId(null)}
        readings={readings}
        onAcknowledge={handleAcknowledgeAlert}
        onResolve={handleResolveAlert}
        onDismiss={handleDismissAlert}
      />

      {/* 4. Unified Toast System (Incoming Anomaly + Undo Bar) */}
      <BottomRightToast
        alert={activeToastAlert}
        onDismissAlert={() => setActiveToastAlert(null)}
        onAcknowledgeAlert={handleAcknowledgeAlert}
        actionToast={actionToast}
        onDismissActionToast={() => setActionToast(null)}
      />

      {/* 5. Keyboard Shortcuts Sheet Modal (?) */}
      {isShortcutsModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-xl border border-[#E5E5E5] dark:border-[#262626] bg-white dark:bg-[#171718] p-5 shadow-xl text-xs space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-2 border-b border-[#F0F0F0] dark:border-[#262626]">
              <div className="flex items-center gap-2">
                <Keyboard className="w-4 h-4 text-neutral-500" />
                <h3 className="font-semibold text-sm text-neutral-900 dark:text-neutral-100">
                  Keyboard shortcuts
                </h3>
              </div>
              <button
                onClick={() => setIsShortcutsModalOpen(false)}
                className="p-1 rounded text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              <div className="font-medium text-[11px] text-neutral-400 uppercase tracking-wider">
                Controls
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-neutral-700 dark:text-neutral-300">Pause / Resume updates</span>
                <kbd className="px-2 py-0.5 rounded border border-[#E5E5E5] dark:border-[#262626] bg-neutral-100 dark:bg-neutral-800 text-[11px] font-mono">
                  Space
                </kbd>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-neutral-700 dark:text-neutral-300">Toggle audio mute</span>
                <kbd className="px-2 py-0.5 rounded border border-[#E5E5E5] dark:border-[#262626] bg-neutral-100 dark:bg-neutral-800 text-[11px] font-mono">
                  M
                </kbd>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-neutral-700 dark:text-neutral-300">Open shortcuts cheat sheet</span>
                <kbd className="px-2 py-0.5 rounded border border-[#E5E5E5] dark:border-[#262626] bg-neutral-100 dark:bg-neutral-800 text-[11px] font-mono">
                  ?
                </kbd>
              </div>

              <div className="font-medium text-[11px] text-neutral-400 uppercase tracking-wider pt-2">
                Navigation (G then key, or 1-7)
              </div>
              <div className="grid grid-cols-2 gap-2 text-neutral-700 dark:text-neutral-300">
                <div className="flex items-center justify-between py-0.5">
                  <span>Overview</span>
                  <kbd className="px-1.5 py-0.2 rounded bg-neutral-100 dark:bg-neutral-800 border border-[#E5E5E5] dark:border-[#262626] font-mono">G O</kbd>
                </div>
                <div className="flex items-center justify-between py-0.5">
                  <span>Sensors</span>
                  <kbd className="px-1.5 py-0.2 rounded bg-neutral-100 dark:bg-neutral-800 border border-[#E5E5E5] dark:border-[#262626] font-mono">G S</kbd>
                </div>
                <div className="flex items-center justify-between py-0.5">
                  <span>Alerts</span>
                  <kbd className="px-1.5 py-0.2 rounded bg-neutral-100 dark:bg-neutral-800 border border-[#E5E5E5] dark:border-[#262626] font-mono">G A</kbd>
                </div>
                <div className="flex items-center justify-between py-0.5">
                  <span>Model performance</span>
                  <kbd className="px-1.5 py-0.2 rounded bg-neutral-100 dark:bg-neutral-800 border border-[#E5E5E5] dark:border-[#262626] font-mono">G M</kbd>
                </div>
                <div className="flex items-center justify-between py-0.5">
                  <span>Fault simulator</span>
                  <kbd className="px-1.5 py-0.2 rounded bg-neutral-100 dark:bg-neutral-800 border border-[#E5E5E5] dark:border-[#262626] font-mono">G F</kbd>
                </div>
                <div className="flex items-center justify-between py-0.5">
                  <span>Settings</span>
                  <kbd className="px-1.5 py-0.2 rounded bg-neutral-100 dark:bg-neutral-800 border border-[#E5E5E5] dark:border-[#262626] font-mono">G T</kbd>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
