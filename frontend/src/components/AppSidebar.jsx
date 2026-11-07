import React from 'react';
import {
  Activity,
  Radio,
  AlertTriangle,
  Layers,
  Flame,
  Sliders,
  FlaskConical,
  ChevronLeft,
  ChevronRight,
  Shield,
  X
} from 'lucide-react';

const MAIN_NAV_ITEMS = [
  { id: 'overview', label: 'Overview', icon: Activity },
  { id: 'telemetry', label: 'Sensors', icon: Radio },
  { id: 'incidents', label: 'Alerts', icon: AlertTriangle },
  { id: 'diagnostics', label: 'Model performance', icon: Layers },
  { id: 'simulator', label: 'Fault simulator', icon: Flame },
  { id: 'settings', label: 'Settings', icon: Sliders },
];

const ADVANCED_NAV_ITEMS = [
  { id: 'experiments', label: 'Experiments', icon: FlaskConical },
];

export default function AppSidebar({
  activePage,
  onSelectPage,
  setActivePage,
  incidentCount = 0,
  collapsed,
  isCollapsed: propIsCollapsed,
  onToggleCollapse,
  setIsCollapsed,
  isMobileOpen,
  mobileOpen,
  onCloseMobile,
  setMobileOpen
}) {
  const isCollapsed = collapsed !== undefined ? collapsed : (propIsCollapsed || false);
  const handleSelectPage = onSelectPage || setActivePage || (() => {});
  const handleCloseMobile = onCloseMobile || (setMobileOpen ? () => setMobileOpen(false) : () => {});
  const handleToggle = onToggleCollapse || (setIsCollapsed ? () => setIsCollapsed(!isCollapsed) : () => {});
  const isMobileActive = isMobileOpen !== undefined ? isMobileOpen : Boolean(mobileOpen);

  const renderNavItem = (item) => {
    const Icon = item.icon;
    const isActive = activePage === item.id;
    const hasUnreadAlerts = item.id === 'incidents' && incidentCount > 0;

    return (
      <button
        key={item.id}
        onClick={() => {
          handleSelectPage(item.id);
          handleCloseMobile();
        }}
        title={isCollapsed ? item.label : undefined}
        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-normal transition-colors cursor-pointer ${
          isActive
            ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400 font-medium'
            : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100/70 dark:text-neutral-400 dark:hover:text-neutral-200 dark:hover:bg-neutral-800/60'
        }`}
      >
        <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-neutral-500 dark:text-neutral-400'}`} />
        {!isCollapsed && (
          <span className="truncate flex-1 text-left">{item.label}</span>
        )}
        {!isCollapsed && hasUnreadAlerts && (
          <span className="text-[11px] font-medium px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 dark:bg-red-950/60 dark:text-red-400 tabular-nums">
            {incidentCount}
          </span>
        )}
      </button>
    );
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileActive && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs md:hidden"
          onClick={handleCloseMobile}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 md:static flex flex-col transition-all duration-200 border-r border-[#E5E5E5] dark:border-[#262626] bg-[#FFFFFF] dark:bg-[#121213]
          ${isMobileActive ? 'translate-x-0 w-60' : '-translate-x-full md:translate-x-0'}
          ${isCollapsed ? 'md:w-16' : 'md:w-60'}
        `}
      >
        {/* Brand Header */}
        <div className="h-14 flex items-center justify-between px-4 border-b border-[#E5E5E5] dark:border-[#262626]">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-7 h-7 rounded-md bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center shrink-0 text-neutral-800 dark:text-neutral-200">
              <Shield className="w-4 h-4" />
            </div>
            {!isCollapsed && (
              <span className="font-semibold text-sm tracking-tight text-neutral-900 dark:text-neutral-100">
                SkyGuard
              </span>
            )}
          </div>

          {/* Mobile close button */}
          <button
            onClick={handleCloseMobile}
            className="md:hidden p-1 text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 py-3 px-2 space-y-1 overflow-y-auto">
          {MAIN_NAV_ITEMS.map(renderNavItem)}

          {/* Advanced Section */}
          <div className="pt-4 pb-1">
            {!isCollapsed ? (
              <div className="px-3 text-[11px] font-medium text-neutral-400 dark:text-neutral-500 uppercase tracking-wider mb-1">
                Advanced
              </div>
            ) : (
              <div className="my-2 border-t border-[#E5E5E5] dark:border-[#262626]" />
            )}
            {ADVANCED_NAV_ITEMS.map(renderNavItem)}
          </div>
        </nav>

        {/* Footer Collapse Toggle (Desktop) */}
        <div className="hidden md:flex p-2 border-t border-[#E5E5E5] dark:border-[#262626]">
          <button
            onClick={handleToggle}
            className="w-full py-1.5 flex items-center justify-center rounded-md text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 dark:hover:text-neutral-300 dark:hover:bg-neutral-800/60 transition-colors"
            title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>
      </aside>
    </>
  );
}
