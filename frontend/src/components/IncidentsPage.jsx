import React, { useState, useEffect, useMemo } from 'react';
import {
  Download,
  ChevronDown,
  ChevronRight,
  Search,
  Check,
  CheckCheck,
  X,
  Layers,
  ArrowUpDown,
  RotateCcw,
  AlertCircle,
  HelpCircle,
  Sparkles
} from 'lucide-react';
import {
  formatSensorName,
  formatFaultType,
  formatSeverity,
  formatStatus,
  formatRelativeTime,
  formatFullDateTime,
  getOpenAlerts
} from '../utils/formatters';

export default function IncidentsPage({
  alerts = [],
  onAcknowledgeAlert,
  onBulkAction,
  onOpenInvestigate,
  onShowToast
}) {
  // ── URL-Synced Filter State ────────────────────────────────────────────────
  const getInitialParams = () => {
    if (typeof window === 'undefined') return {};
    const params = new URLSearchParams(window.location.search);
    return {
      status: params.get('status') || 'OPEN',
      sensor: params.get('sensor') || 'ALL',
      severity: params.get('severity') || 'ALL',
      search: params.get('q') || '',
      sort: params.get('sort') || 'TIME_DESC',
      grouped: params.get('grouped') !== 'false'
    };
  };

  const initial = getInitialParams();
  const [statusFilter, setStatusFilter] = useState(initial.status || 'OPEN');
  const [sensorFilter, setSensorFilter] = useState(initial.sensor || 'ALL');
  const [severityFilter, setSeverityFilter] = useState(initial.severity || 'ALL');
  const [searchQuery, setSearchQuery] = useState(initial.search || '');
  const [sortBy, setSortBy] = useState(initial.sort || 'TIME_DESC');
  const [isGrouped, setIsGrouped] = useState(initial.grouped !== false);
  const [expandedGroupKeys, setExpandedGroupKeys] = useState(new Set());
  const [selectedAlertIds, setSelectedAlertIds] = useState(new Set());
  const [isExporting, setIsExporting] = useState(false);

  // Sync state to URL search params quietly
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams();
    if (statusFilter !== 'OPEN') params.set('status', statusFilter);
    if (sensorFilter !== 'ALL') params.set('sensor', sensorFilter);
    if (severityFilter !== 'ALL') params.set('severity', severityFilter);
    if (searchQuery.trim()) params.set('q', searchQuery.trim());
    if (sortBy !== 'TIME_DESC') params.set('sort', sortBy);
    if (!isGrouped) params.set('grouped', 'false');

    const newUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}`;
    window.history.replaceState(null, '', newUrl);
  }, [statusFilter, sensorFilter, severityFilter, searchQuery, sortBy, isGrouped]);

  // ── Derived Counts for Tabs ────────────────────────────────────────────────
  const counts = useMemo(() => {
    const total = alerts.length;
    let open = 0;
    let ack = 0;
    let resolved = 0;
    let dismissed = 0;

    for (const a of alerts) {
      const st = (a.status || (a.is_acknowledged ? 'ACKNOWLEDGED' : 'OPEN')).toUpperCase();
      if (st === 'OPEN') open++;
      else if (st === 'ACKNOWLEDGED') ack++;
      else if (st === 'RESOLVED') resolved++;
      else if (st === 'DISMISSED') dismissed++;
    }

    return { total, open, ack, resolved, dismissed };
  }, [alerts]);

  // ── Filtered & Sorted Flat Alerts ──────────────────────────────────────────
  const filteredAlerts = useMemo(() => {
    return alerts.filter((alert) => {
      const st = (alert.status || (alert.is_acknowledged ? 'ACKNOWLEDGED' : 'OPEN')).toUpperCase();
      if (statusFilter !== 'ALL' && st !== statusFilter) return false;

      if (sensorFilter !== 'ALL') {
        const s = String(alert.sensor || '').toUpperCase();
        if (!s.includes(sensorFilter.toUpperCase())) return false;
      }

      if (severityFilter !== 'ALL') {
        if ((alert.severity || '').toUpperCase() !== severityFilter) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const text = `${alert.sensor} ${alert.fault_type} ${alert.title} ${alert.message} ${alert.diagnosis_message}`.toLowerCase();
        if (!text.includes(q)) return false;
      }

      return true;
    }).sort((a, b) => {
      if (sortBy === 'TIME_ASC') {
        return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
      }
      if (sortBy === 'SEVERITY') {
        const scoreA = a.severity === 'CRITICAL' ? 2 : 1;
        const scoreB = b.severity === 'CRITICAL' ? 2 : 1;
        if (scoreB !== scoreA) return scoreB - scoreA;
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      }
      // default: TIME_DESC
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });
  }, [alerts, statusFilter, sensorFilter, severityFilter, searchQuery, sortBy]);

  // ── Grouped Representation ─────────────────────────────────────────────────
  const groupedData = useMemo(() => {
    if (!isGrouped) return null;

    const map = new Map();
    for (const a of filteredAlerts) {
      const sKey = String(a.sensor || 'UNKNOWN').toUpperCase();
      const fKey = String(a.fault_type || 'UNKNOWN').toUpperCase();
      const key = `${sKey}::${fKey}`;

      if (!map.has(key)) {
        map.set(key, {
          groupKey: key,
          sensor: a.sensor,
          fault_type: a.fault_type,
          title: a.title,
          severity: a.severity,
          status: a.status || (a.is_acknowledged ? 'ACKNOWLEDGED' : 'OPEN'),
          is_simulated: Boolean(a.is_simulated),
          firstSeen: a.timestamp,
          lastSeen: a.timestamp,
          count: 0,
          items: []
        });
      }

      const g = map.get(key);
      g.count += 1;
      g.items.push(a);

      if (a.severity === 'CRITICAL') g.severity = 'CRITICAL';
      if ((a.status || (a.is_acknowledged ? 'ACKNOWLEDGED' : 'OPEN')).toUpperCase() === 'OPEN') {
        g.status = 'OPEN';
      }
      if (new Date(a.timestamp).getTime() < new Date(g.firstSeen).getTime()) {
        g.firstSeen = a.timestamp;
      }
      if (new Date(a.timestamp).getTime() > new Date(g.lastSeen).getTime()) {
        g.lastSeen = a.timestamp;
      }
    }

    return Array.from(map.values()).sort(
      (a, b) => new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime()
    );
  }, [filteredAlerts, isGrouped]);

  // ── Selection State Helpers ────────────────────────────────────────────────
  const allShownIds = useMemo(() => {
    return filteredAlerts.map(a => a.id);
  }, [filteredAlerts]);

  const isAllSelected = allShownIds.length > 0 && allShownIds.every(id => selectedAlertIds.has(id));
  const isSomeSelected = allShownIds.some(id => selectedAlertIds.has(id)) && !isAllSelected;

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedAlertIds(new Set());
    } else {
      setSelectedAlertIds(new Set(allShownIds));
    }
  };

  const handleToggleSelectRow = (id) => {
    setSelectedAlertIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleToggleGroup = (groupKey) => {
    setExpandedGroupKeys(prev => {
      const next = new Set(prev);
      if (next.has(groupKey)) next.delete(groupKey);
      else next.add(groupKey);
      return next;
    });
  };

  const handleSelectGroup = (items) => {
    const itemIds = items.map(i => i.id);
    const allSelected = itemIds.every(id => selectedAlertIds.has(id));
    setSelectedAlertIds(prev => {
      const next = new Set(prev);
      if (allSelected) {
        itemIds.forEach(id => next.delete(id));
      } else {
        itemIds.forEach(id => next.add(id));
      }
      return next;
    });
  };

  // ── Bulk Actions with Race-Safety and Undo ──────────────────────────────────
  const executeBulkAction = async (action, idsToActOn, toastLabel) => {
    if (!idsToActOn || idsToActOn.length === 0) return;

    // Snapshot current state of these items for Undo
    const previousStates = new Map();
    alerts.forEach(a => {
      if (idsToActOn.includes(a.id)) {
        previousStates.set(a.id, a.status || (a.is_acknowledged ? 'ACKNOWLEDGED' : 'OPEN'));
      }
    });

    try {
      if (onBulkAction) {
        await onBulkAction(idsToActOn, action);
      } else {
        await fetch('http://localhost:8000/api/alerts/bulk-action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ alert_ids: idsToActOn, action })
        });
      }

      // Clear selection of acted upon IDs
      setSelectedAlertIds(prev => {
        const next = new Set(prev);
        idsToActOn.forEach(id => next.delete(id));
        return next;
      });

      // Show Undo Toast
      if (onShowToast) {
        onShowToast({
          message: `${toastLabel} (${idsToActOn.length} alerts)`,
          undoAction: async () => {
            // Reopen or restore
            await fetch('http://localhost:8000/api/alerts/bulk-action', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ alert_ids: idsToActOn, action: 'REOPEN' })
            });
            if (onBulkAction) await onBulkAction(idsToActOn, 'REOPEN');
          }
        });
      }
    } catch (err) {
      console.error('Failed to execute bulk action:', err);
    }
  };

  const handleAcknowledgeAllFiltered = () => {
    executeBulkAction('ACKNOWLEDGE', allShownIds, 'Acknowledged all filtered');
  };

  // ── CSV Export ─────────────────────────────────────────────────────────────
  const handleExportCSV = () => {
    setIsExporting(true);
    try {
      const headers = [
        'ID',
        'Timestamp',
        'Relative Time',
        'Sensor',
        'Fault Mode (Readable)',
        'Fault Mode (Raw Enum)',
        'Severity',
        'Status',
        'Is Simulated',
        'Acknowledged At',
        'Resolved At',
        'Diagnosis'
      ];

      const rows = filteredAlerts.map((a) => [
        a.id,
        `"${a.timestamp}"`,
        `"${formatRelativeTime(a.timestamp)}"`,
        `"${formatSensorName(a.sensor)}"`,
        `"${formatFaultType(a.fault_type)}"`,
        `"${a.fault_type || ''}"`,
        formatSeverity(a.severity),
        formatStatus(a.status),
        a.is_simulated ? 'Yes' : 'No',
        `"${a.acknowledged_at || ''}"`,
        `"${a.resolved_at || ''}"`,
        `"${(a.diagnosis_message || a.message || a.title || '').replace(/"/g, '""')}"`
      ]);

      const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `skyguard_alerts_${statusFilter.toLowerCase()}_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('CSV export failed:', err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* 1. Header & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#E5E5E5] dark:border-[#262626]">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
            Alerts
          </h1>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
            Real-time sensor degradation incidents, anomaly votes, and hardware failure states.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {counts.open > 0 && statusFilter === 'OPEN' && (
            <button
              onClick={handleAcknowledgeAllFiltered}
              className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-colors cursor-pointer"
              title="Acknowledge all open alerts in current view"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span>Acknowledge all ({filteredAlerts.length})</span>
            </button>
          )}

          <button
            onClick={handleExportCSV}
            disabled={filteredAlerts.length === 0 || isExporting}
            className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md border border-[#E5E5E5] dark:border-[#262626] bg-white dark:bg-[#171718] text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors cursor-pointer disabled:opacity-50"
            title="Export filtered alerts to CSV"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* 2. Lifecycle Segmented Control */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-lg border border-[#E5E5E5] dark:border-[#262626] p-0.5 bg-neutral-100/60 dark:bg-neutral-900 text-xs">
          {[
            { id: 'OPEN', label: 'Open', count: counts.open, tip: 'Requires operator review' },
            { id: 'ACKNOWLEDGED', label: 'Acknowledged', count: counts.ack, tip: 'Flagged and under observation' },
            { id: 'RESOLVED', label: 'Resolved', count: counts.resolved, tip: 'Condition returned to normal' },
            { id: 'DISMISSED', label: 'Dismissed', count: counts.dismissed, tip: 'False positive or ignored' },
            { id: 'ALL', label: 'All', count: counts.total, tip: 'Full alert history' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              title={tab.tip}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                statusFilter === tab.id
                  ? 'bg-white dark:bg-[#171718] text-neutral-900 dark:text-neutral-100 shadow-xs'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100'
              }`}
            >
              <span>{tab.label}</span>
              <span className="text-[11px] px-1.5 py-0.2 rounded-full bg-neutral-200/60 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 tabular-nums">
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Group Duplicates Toggle */}
        <button
          onClick={() => setIsGrouped(!isGrouped)}
          className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-md border transition-colors cursor-pointer ${
            isGrouped
              ? 'border-blue-200 dark:border-blue-900 bg-blue-50/70 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400'
              : 'border-[#E5E5E5] dark:border-[#262626] bg-white dark:bg-[#171718] text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800'
          }`}
          title="Collapse repeating alerts into a single row with count"
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Group duplicates</span>
        </button>
      </div>

      {/* 3. Filter & Search Toolbar */}
      <div className="p-3 rounded-xl border border-[#E5E5E5] dark:border-[#262626] bg-[#FFFFFF] dark:bg-[#171718] flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px]">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[180px] max-w-sm">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search sensor, fault, diagnosis..."
              className="w-full pl-8 pr-3 py-1.5 rounded-md border border-[#E5E5E5] dark:border-[#262626] bg-neutral-50 dark:bg-neutral-900/50 text-neutral-800 dark:text-neutral-200 placeholder:text-neutral-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Sensor Filter */}
          <select
            value={sensorFilter}
            onChange={(e) => setSensorFilter(e.target.value)}
            className="py-1.5 px-2.5 rounded-md border border-[#E5E5E5] dark:border-[#262626] bg-neutral-50 dark:bg-neutral-900/50 text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
          >
            <option value="ALL">All sensors</option>
            <option value="TEMPERATURE">Temperature</option>
            <option value="PRESSURE">Pressure</option>
            <option value="HUMIDITY">Humidity</option>
          </select>

          {/* Severity Filter */}
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="py-1.5 px-2.5 rounded-md border border-[#E5E5E5] dark:border-[#262626] bg-neutral-50 dark:bg-neutral-900/50 text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
          >
            <option value="ALL">All severities</option>
            <option value="CRITICAL">Critical</option>
            <option value="WARNING">Warning</option>
          </select>

          {/* Sort By */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="py-1.5 px-2.5 rounded-md border border-[#E5E5E5] dark:border-[#262626] bg-neutral-50 dark:bg-neutral-900/50 text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
          >
            <option value="TIME_DESC">Newest first</option>
            <option value="TIME_ASC">Oldest first</option>
            <option value="SEVERITY">Highest severity</option>
          </select>
        </div>

        {/* Active Filters Reset */}
        {(statusFilter !== 'OPEN' || sensorFilter !== 'ALL' || severityFilter !== 'ALL' || searchQuery) && (
          <button
            onClick={() => {
              setStatusFilter('OPEN');
              setSensorFilter('ALL');
              setSeverityFilter('ALL');
              setSearchQuery('');
            }}
            className="text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 flex items-center gap-1 cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset filters</span>
          </button>
        )}
      </div>

      {/* 4. Bulk Action Floating Bar */}
      {selectedAlertIds.size > 0 && (
        <div className="p-3 rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50/90 dark:bg-blue-950/60 flex items-center justify-between gap-3 text-xs shadow-xs animate-in fade-in duration-150">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-blue-900 dark:text-blue-100">
              {selectedAlertIds.size} selected
            </span>
            <span className="text-blue-600 dark:text-blue-400">·</span>
            <button
              onClick={() => setSelectedAlertIds(new Set())}
              className="text-blue-700 dark:text-blue-300 underline cursor-pointer"
            >
              Deselect all
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => executeBulkAction('ACKNOWLEDGE', Array.from(selectedAlertIds), 'Acknowledged')}
              className="px-2.5 py-1 rounded-md bg-white dark:bg-[#171718] border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/40 font-medium cursor-pointer"
            >
              Acknowledge
            </button>
            <button
              onClick={() => executeBulkAction('RESOLVE', Array.from(selectedAlertIds), 'Resolved')}
              className="px-2.5 py-1 rounded-md bg-white dark:bg-[#171718] border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/40 font-medium cursor-pointer"
            >
              Resolve
            </button>
            <button
              onClick={() => executeBulkAction('DISMISS', Array.from(selectedAlertIds), 'Dismissed')}
              className="px-2.5 py-1 rounded-md bg-white dark:bg-[#171718] border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 font-medium cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* 5. Alerts Data View (Table on Desktop, Cards on Mobile) */}
      <div className="rounded-xl border border-[#E5E5E5] dark:border-[#262626] bg-[#FFFFFF] dark:bg-[#171718] overflow-hidden">
        {filteredAlerts.length === 0 ? (
          <div className="py-16 text-center text-xs text-neutral-400 dark:text-neutral-500">
            <AlertCircle className="w-6 h-6 mx-auto mb-2 text-neutral-300 dark:text-neutral-600" />
            <p className="font-medium text-neutral-700 dark:text-neutral-300">No alerts found</p>
            <p className="mt-0.5">No alerts match the selected status and filter criteria.</p>
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[680px]">
            <table className="w-full text-left text-xs border-collapse">
              {/* Sticky Table Header */}
              <thead className="sticky top-0 bg-[#FAFAFA] dark:bg-[#151516] border-b border-[#E5E5E5] dark:border-[#262626] text-neutral-500 dark:text-neutral-400 z-10">
                <tr>
                  <th className="py-2.5 px-3 w-8">
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      ref={el => el && (el.indeterminate = isSomeSelected)}
                      onChange={handleToggleSelectAll}
                      className="rounded border-[#D1D5DB] text-blue-600 focus:ring-blue-500 cursor-pointer"
                      aria-label="Select all alerts"
                    />
                  </th>
                  <th className="py-2.5 px-3 font-medium">Time</th>
                  <th className="py-2.5 px-3 font-medium">Sensor</th>
                  <th className="py-2.5 px-3 font-medium">Fault Mode</th>
                  <th className="py-2.5 px-3 font-medium">Severity</th>
                  <th className="py-2.5 px-3 font-medium">Status</th>
                  <th className="py-2.5 px-3 font-medium">Diagnosis</th>
                  <th className="py-2.5 px-3 font-medium text-right">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-[#F0F0F0] dark:divide-[#222223]">
                {isGrouped && groupedData ? (
                  groupedData.map((group) => {
                    const isExpanded = expandedGroupKeys.has(group.groupKey);
                    const groupItemIds = group.items.map(i => i.id);
                    const isGroupAllSelected = groupItemIds.every(id => selectedAlertIds.has(id));
                    const isGroupSomeSelected = groupItemIds.some(id => selectedAlertIds.has(id)) && !isGroupAllSelected;

                    return (
                      <React.Fragment key={group.groupKey}>
                        {/* Master Group Row */}
                        <tr className="hover:bg-neutral-50/80 dark:hover:bg-neutral-800/40 transition-colors bg-neutral-50/30 dark:bg-neutral-900/20">
                          <td className="py-3 px-3">
                            <input
                              type="checkbox"
                              checked={isGroupAllSelected}
                              ref={el => el && (el.indeterminate = isGroupSomeSelected)}
                              onChange={() => handleSelectGroup(group.items)}
                              className="rounded border-[#D1D5DB] text-blue-600 focus:ring-blue-500 cursor-pointer"
                            />
                          </td>

                          {/* Time with Full Date/Time Tooltip */}
                          <td className="py-3 px-3 tabular-nums text-neutral-600 dark:text-neutral-400 whitespace-nowrap">
                            <span title={`First seen: ${formatFullDateTime(group.firstSeen)}\nLast seen: ${formatFullDateTime(group.lastSeen)}`}>
                              {formatRelativeTime(group.lastSeen)}
                            </span>
                          </td>

                          {/* Sensor */}
                          <td className="py-3 px-3 font-medium text-neutral-900 dark:text-neutral-100 whitespace-nowrap">
                            {formatSensorName(group.sensor)}
                          </td>

                          {/* Fault Mode + Count Badge + Simulated Tag */}
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-neutral-900 dark:text-neutral-100">
                                {formatFaultType(group.fault_type)}
                              </span>
                              {group.count > 1 && (
                                <span className="text-[11px] font-semibold px-1.5 py-0.2 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 tabular-nums">
                                  ×{group.count}
                                </span>
                              )}
                              {group.is_simulated && (
                                <span className="text-[10px] font-medium px-1.5 py-0.2 rounded bg-purple-100 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300">
                                  Simulated
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-neutral-400 font-mono mt-0.5">
                              {group.fault_type}
                            </div>
                          </td>

                          {/* Severity */}
                          <td className="py-3 px-3 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  group.severity === 'CRITICAL' ? 'bg-red-500' : 'bg-amber-500'
                                }`}
                              />
                              <span className="font-medium">
                                {formatSeverity(group.severity)}
                              </span>
                            </div>
                          </td>

                          {/* Status */}
                          <td className="py-3 px-3 whitespace-nowrap">
                            <span className="text-[11px] px-2 py-0.5 rounded-md border border-[#E5E5E5] dark:border-[#262626] font-medium">
                              {formatStatus(group.status)}
                            </span>
                          </td>

                          {/* Diagnosis / Summary */}
                          <td className="py-3 px-3 text-neutral-600 dark:text-neutral-400 max-w-xs truncate">
                            {group.items[0]?.diagnosis_message || group.items[0]?.message || 'Persistent anomaly on sensor feed'}
                          </td>

                          {/* Actions */}
                          <td className="py-3 px-3 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => onOpenInvestigate?.(group.items[0].id)}
                                className="px-2 py-1 text-[11px] font-medium rounded-md border border-[#E5E5E5] dark:border-[#262626] hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                              >
                                Investigate
                              </button>

                              {group.count > 1 && (
                                <button
                                  onClick={() => handleToggleGroup(group.groupKey)}
                                  className="p-1 rounded-md text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 cursor-pointer"
                                  title={isExpanded ? 'Collapse group' : 'Expand group'}
                                >
                                  {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>

                        {/* Expanded Child Rows */}
                        {isExpanded &&
                          group.items.map((subAlert) => (
                            <tr
                              key={subAlert.id}
                              className="bg-neutral-100/40 dark:bg-neutral-900/40 text-neutral-600 dark:text-neutral-400 text-[11px]"
                            >
                              <td className="py-2 px-3 pl-8">
                                <input
                                  type="checkbox"
                                  checked={selectedAlertIds.has(subAlert.id)}
                                  onChange={() => handleToggleSelectRow(subAlert.id)}
                                  className="rounded border-[#D1D5DB] text-blue-600 focus:ring-blue-500 cursor-pointer"
                                />
                              </td>
                              <td className="py-2 px-3 tabular-nums" title={formatFullDateTime(subAlert.timestamp)}>
                                {formatRelativeTime(subAlert.timestamp)}
                              </td>
                              <td className="py-2 px-3 font-medium text-neutral-700 dark:text-neutral-300">
                                {formatSensorName(subAlert.sensor)}
                              </td>
                              <td className="py-2 px-3 font-mono text-[10px]">
                                #{subAlert.id} · {subAlert.fault_type}
                              </td>
                              <td className="py-2 px-3">
                                {formatSeverity(subAlert.severity)}
                              </td>
                              <td className="py-2 px-3">
                                {formatStatus(subAlert.status)}
                              </td>
                              <td className="py-2 px-3 truncate max-w-xs">
                                {subAlert.diagnosis_message || subAlert.message}
                              </td>
                              <td className="py-2 px-3 text-right">
                                <button
                                  onClick={() => onOpenInvestigate?.(subAlert.id)}
                                  className="underline text-blue-600 dark:text-blue-400 cursor-pointer"
                                >
                                  Details
                                </button>
                              </td>
                            </tr>
                          ))}
                      </React.Fragment>
                    );
                  })
                ) : (
                  // Flat Rows View
                  filteredAlerts.map((alert) => (
                    <tr
                      key={alert.id}
                      className="hover:bg-neutral-50/80 dark:hover:bg-neutral-800/40 transition-colors"
                    >
                      <td className="py-3 px-3">
                        <input
                          type="checkbox"
                          checked={selectedAlertIds.has(alert.id)}
                          onChange={() => handleToggleSelectRow(alert.id)}
                          className="rounded border-[#D1D5DB] text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                      </td>
                      <td className="py-3 px-3 tabular-nums text-neutral-600 dark:text-neutral-400 whitespace-nowrap">
                        <span title={formatFullDateTime(alert.timestamp)}>
                          {formatRelativeTime(alert.timestamp)}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-medium text-neutral-900 dark:text-neutral-100 whitespace-nowrap">
                        {formatSensorName(alert.sensor)}
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-neutral-900 dark:text-neutral-100">
                            {formatFaultType(alert.fault_type)}
                          </span>
                          {alert.is_simulated && (
                            <span className="text-[10px] font-medium px-1.5 py-0.2 rounded bg-purple-100 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300">
                              Simulated
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-neutral-400 font-mono mt-0.5">
                          {alert.fault_type}
                        </div>
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              alert.severity === 'CRITICAL' ? 'bg-red-500' : 'bg-amber-500'
                            }`}
                          />
                          <span className="font-medium">
                            {formatSeverity(alert.severity)}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className="text-[11px] px-2 py-0.5 rounded-md border border-[#E5E5E5] dark:border-[#262626] font-medium">
                          {formatStatus(alert.status)}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-neutral-600 dark:text-neutral-400 max-w-xs truncate">
                        {alert.diagnosis_message || alert.message || alert.title}
                      </td>
                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        <button
                          onClick={() => onOpenInvestigate?.(alert.id)}
                          className="px-2.5 py-1 text-[11px] font-medium rounded-md border border-[#E5E5E5] dark:border-[#262626] hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                        >
                          Investigate
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
