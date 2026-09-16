import React, { useState, useRef, useEffect } from 'react';
import { Plus, Search, Palette, Check, LogOut, ShieldCheck, ShieldAlert, ChevronDown, Menu, User } from 'lucide-react';
import { NavigationView } from '../../types/crm';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { NotificationBell } from '../notifications/NotificationBell';
import { ZaynLogo } from '../common/ZaynLogo';

interface TopHeaderProps {
  currentView: NavigationView;
  onOpenAddLead: () => void;
  onSelectView: (view: NavigationView) => void;
  onSelectLead?: (leadId: string) => void;
  onOpenSearch?: () => void;
  onToggleMobileMenu?: () => void;
}

export const TopHeader: React.FC<TopHeaderProps> = ({
  currentView,
  onOpenAddLead,
  onSelectView,
  onSelectLead,
  onOpenSearch,
  onToggleMobileMenu,
}) => {
  const { userProfile, signOut, isSuperAdmin, isAdmin, hasPermission } = useAuth();
  const canCreateLead = !isSuperAdmin && (isAdmin || hasPermission('LEADS_CREATE'));
  const { theme, setTheme, availableThemes, themeConfig } = useTheme();
  const [showProfileMenu, setShowProfileMenu] = useState<boolean>(false);
  const [showThemeMenu, setShowThemeMenu] = useState<boolean>(false);

  const themeMenuRef = useRef<HTMLDivElement>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  // Close menus on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (themeMenuRef.current && !themeMenuRef.current.contains(e.target as Node)) {
        setShowThemeMenu(false);
      }
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
        setShowProfileMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getPageTitle = (view: NavigationView) => {
    switch (view) {
      case 'dashboard':
        return 'Overview';
      case 'leads':
        return 'Leads';
      case 'clients':
        return 'Clients';
      case 'calendar':
        return 'Sales Calendar';
      case 'segments':
        return 'Segments & Tags';
      case 'pipeline':
        return 'Sales Pipeline';
      case 'followups':
        return 'Follow-ups';
      case 'reports':
        return 'Reports & KPIs';
      case 'notifications':
        return 'Notifications';
      case 'communication-hub':
        return 'Communication Hub';
      case 'audit':
        return 'Audit Trail';
      case 'data-quality':
        return 'Data Quality';
      case 'data-management':
        return 'Import & Migration';
      case 'settings':
        return 'Settings';
      case 'profile':
        return 'Sales Targets';
      case 'super-admin':
        return 'Platform Console';
      case 'search':
        return 'Search';
      default:
        return 'CRM';
    }
  };

  const userInitials = userProfile?.full_name
    ? userProfile.full_name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : 'ZO';

  return (
    <header
      id="top-header"
      className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-slate-200/80 bg-white/95 backdrop-blur-xs px-4 sm:px-8 select-none"
    >
      <div className="flex items-center gap-3 sm:gap-4 flex-1 max-w-xl">
        {/* Mobile Navigation Drawer Button */}
        {onToggleMobileMenu && (
          <button
            id="mobile-nav-toggle-btn"
            type="button"
            onClick={onToggleMobileMenu}
            className="md:hidden flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 transition cursor-pointer shrink-0"
            title="Open Navigation Menu"
            aria-label="Open Navigation Menu"
          >
            <Menu className="h-4 w-4" strokeWidth={1.75} />
          </button>
        )}

        {/* Global Search trigger (Company CRM users only) */}
        {!isSuperAdmin ? (
          <div
            onClick={onOpenSearch}
            className="relative w-full max-w-md hidden sm:flex items-center rounded-lg border border-slate-200/90 bg-slate-50/50 py-1.5 pl-9 pr-3 text-xs text-slate-600 hover:border-slate-300 hover:bg-white transition cursor-pointer"
          >
            <Search className="absolute left-3 top-2 h-3.5 w-3.5 text-slate-500" strokeWidth={1.75} />
            <span className="truncate">Search leads, clients, companies...</span>
            <kbd className="ml-auto hidden md:inline-flex items-center rounded border border-slate-200 bg-white px-1.5 py-0.2 text-[10px] font-medium text-slate-500">
              ⌘K /
            </kbd>
          </div>
        ) : (
          <div className="hidden sm:flex items-center gap-2 text-xs font-semibold text-slate-900">
            <ShieldAlert className="h-4 w-4 text-amber-500" strokeWidth={1.75} />
            <span>Platform Governance Console</span>
          </div>
        )}

        {/* Mobile Page Title with Brand Mark */}
        <div className="sm:hidden flex items-center gap-2">
          <ZaynLogo size={24} className="shrink-0" />
          <h1 className="text-sm font-semibold text-slate-900 truncate max-w-[140px]">
            {isSuperAdmin ? 'Platform' : getPageTitle(currentView)}
          </h1>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-2.5">
        {/* Mobile Quick Search Button */}
        {!isSuperAdmin && (
          <button
            id="mobile-search-btn"
            type="button"
            onClick={onOpenSearch}
            className="sm:hidden flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-600 hover:text-slate-900 transition cursor-pointer"
            title="Search CRM"
            aria-label="Search CRM"
          >
            <Search className="h-3.5 w-3.5" strokeWidth={1.75} />
          </button>
        )}

        {/* ZaynOps Theme Switcher */}
        <div className="relative" ref={themeMenuRef}>
          <button
            type="button"
            id="theme-selector-topbar-btn"
            onClick={() => setShowThemeMenu(!showThemeMenu)}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200/90 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition cursor-pointer"
            title="Switch Theme"
          >
            <span
              className="h-2 w-2 rounded-full shrink-0"
              style={{ backgroundColor: themeConfig.colorPrimary }}
            />
            <span className="hidden sm:inline text-[11px] text-slate-600 truncate max-w-[95px]">
              {themeConfig.name.replace('ZaynOps ', '')}
            </span>
            <ChevronDown className="h-3 w-3 text-slate-500" strokeWidth={1.75} />
          </button>

          {showThemeMenu && (
            <div className="absolute right-0 mt-1.5 w-64 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg z-50 animate-in fade-in zoom-in-95 duration-100">
              <div className="px-2.5 py-1.5 border-b border-slate-100 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Visual Environment
              </div>
              <div className="space-y-0.5 py-1">
                {availableThemes.map((t) => {
                  const isSelected = theme === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        setTheme(t.id);
                        setShowThemeMenu(false);
                      }}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition cursor-pointer text-xs ${
                        isSelected
                          ? 'bg-slate-100 font-semibold text-slate-900'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: t.colorPrimary }}
                        />
                        <span>{t.name}</span>
                      </div>
                      {isSelected && (
                        <Check className="h-3.5 w-3.5 text-[#0CB675]" strokeWidth={2.5} />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Real-Time Notification Bell */}
        {!isSuperAdmin && (
          <NotificationBell
            onSelectLead={onSelectLead}
            onNavigateToNotifications={() => onSelectView('notifications')}
            onNavigateToFollowups={() => onSelectView('followups')}
          />
        )}

        {/* Global Add Lead CTA */}
        {canCreateLead && (
          <button
            id="global-add-lead-btn"
            type="button"
            onClick={onOpenAddLead}
            className="zaynops-btn-primary text-xs font-semibold py-1.5 px-3 flex items-center gap-1.5 shadow-xs"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
            <span className="hidden sm:inline">New Lead</span>
          </button>
        )}

        {/* User Profile Menu */}
        <div className="relative" ref={profileMenuRef}>
          <button
            id="user-profile-header-btn"
            type="button"
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 font-semibold text-xs text-slate-700 border border-slate-200 transition cursor-pointer hover:bg-slate-200"
            title={userProfile?.full_name || 'User Profile'}
          >
            {userInitials}
          </button>

          {showProfileMenu && (
            <div className="absolute right-0 mt-1.5 w-56 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg z-50 animate-in fade-in zoom-in-95 duration-100">
              <div className="border-b border-slate-100 px-2.5 py-2">
                <p className="font-semibold text-xs text-slate-900 truncate">
                  {userProfile?.full_name || 'CRM User'}
                </p>
                <p className="text-slate-500 text-[10px] truncate mt-0.5">
                  {userProfile?.email}
                </p>
                <div className="mt-1.5 inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.2 text-[9px] font-semibold text-slate-700 uppercase tracking-wider">
                  {userProfile?.role || 'SALESMAN'}
                </div>
              </div>

              <div className="pt-1 space-y-0.5">
                <button
                  type="button"
                  id="profile-menu-my-profile-btn"
                  onClick={() => {
                    setShowProfileMenu(false);
                    onSelectView('profile');
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                >
                  <User className="h-3.5 w-3.5 text-slate-500" strokeWidth={1.75} />
                  <span>My Target &amp; Quota</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowProfileMenu(false);
                    onSelectView('settings');
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                >
                  <Palette className="h-3.5 w-3.5 text-slate-500" strokeWidth={1.75} />
                  <span>Appearance</span>
                </button>
                {userProfile?.role === 'ADMIN' && (
                  <button
                    type="button"
                    id="profile-menu-audit-btn"
                    onClick={() => {
                      setShowProfileMenu(false);
                      onSelectView('audit');
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                  >
                    <ShieldCheck className="h-3.5 w-3.5 text-slate-500" strokeWidth={1.75} />
                    <span>Audit Logs</span>
                  </button>
                )}
                {isSuperAdmin && (
                  <button
                    type="button"
                    id="profile-menu-superadmin-btn"
                    onClick={() => {
                      setShowProfileMenu(false);
                      onSelectView('super-admin');
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                  >
                    <ShieldAlert className="h-3.5 w-3.5 text-slate-500" strokeWidth={1.75} />
                    <span>Super Admin Console</span>
                  </button>
                )}
                <div className="my-1 border-t border-slate-100" />
                <button
                  type="button"
                  onClick={() => {
                    setShowProfileMenu(false);
                    signOut();
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                >
                  <LogOut className="h-3.5 w-3.5" strokeWidth={1.75} />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
