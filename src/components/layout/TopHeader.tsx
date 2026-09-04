import React, { useState, useRef, useEffect } from 'react';
import { Plus, Search, Palette, Check, LogOut, ShieldCheck, ChevronDown } from 'lucide-react';
import { NavigationView } from '../../types/crm';
import { useAuth } from '../../context/AuthContext';
import { useTheme, ZaynOsThemeId } from '../../context/ThemeContext';
import { NotificationBell } from '../notifications/NotificationBell';
import { ZaynLogo } from '../common/ZaynLogo';

interface TopHeaderProps {
  currentView: NavigationView;
  onOpenAddLead: () => void;
  onSelectView: (view: NavigationView) => void;
  onSelectLead?: (leadId: string) => void;
  onOpenSearch?: () => void;
}

export const TopHeader: React.FC<TopHeaderProps> = ({
  currentView,
  onOpenAddLead,
  onSelectView,
  onSelectLead,
  onOpenSearch,
}) => {
  const { userProfile, signOut } = useAuth();
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
        return 'Executive Sales Dashboard';
      case 'leads':
        return 'Lead Pipeline Management';
      case 'clients':
        return 'Client Accounts & Accounts';
      case 'calendar':
        return 'Sales Calendar & Visits';
      case 'segments':
        return 'Segments & Tag Taxonomy';
      case 'pipeline':
        return 'Interactive Deal Pipeline';
      case 'followups':
        return 'Follow-ups & Due Actions';
      case 'reports':
        return 'Analytics & Conversion Reports';
      case 'notifications':
        return 'System Notifications';
      case 'audit':
        return 'Security Audit Trail';
      case 'data-quality':
        return 'Data Quality & Deduplication';
      case 'data-management':
        return 'Import, Export & Bulk Ops';
      case 'settings':
        return 'ZaynOs CRM Settings';
      case 'search':
        return 'Unified Search Engine';
      default:
        return 'Sales CRM';
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
      className="sticky top-0 z-30 flex h-[72px] w-full items-center justify-between border-b border-[var(--border-color)] bg-[var(--bg-card)] px-4 sm:px-8 shadow-xs transition-colors duration-200"
    >
      <div className="flex items-center gap-4 flex-1 max-w-xl">
        {/* Global Search trigger */}
        <div
          onClick={onOpenSearch}
          className="relative w-full max-w-md hidden sm:flex items-center rounded-xl border border-[var(--border-color)] bg-[var(--input-bg)] py-2 pl-9 pr-3 text-xs text-[var(--text-muted)] hover:border-[var(--color-primary)] transition cursor-pointer shadow-2xs"
        >
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-[var(--text-muted)]" />
          <span className="truncate">Search leads, clients, companies, follow-ups...</span>
          <kbd className="ml-auto hidden md:inline-flex items-center rounded border border-[var(--border-color)] bg-[var(--bg-elevated)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--text-muted)]">
            ⌘K /
          </kbd>
        </div>

        {/* Mobile Page Title with Brand Mark */}
        <div className="sm:hidden flex items-center gap-2">
          <ZaynLogo size={28} rounded="rounded-md" className="shadow-2xs border border-[var(--border-color)]" />
          <h1 className="text-sm font-bold text-[var(--text-main)] truncate max-w-[170px]">
            {getPageTitle(currentView)}
          </h1>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        {/* Mobile Quick Search Button */}
        <button
          id="mobile-search-btn"
          type="button"
          onClick={onOpenSearch}
          className="sm:hidden flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:text-[var(--text-main)] transition cursor-pointer"
          title="Search CRM"
          aria-label="Search CRM"
        >
          <Search className="h-4 w-4" />
        </button>

        {/* ZaynOs Quick Theme Selector in TopBar */}
        <div className="relative" ref={themeMenuRef}>
          <button
            type="button"
            id="theme-selector-topbar-btn"
            onClick={() => setShowThemeMenu(!showThemeMenu)}
            className="flex items-center gap-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] px-2.5 py-1.5 text-xs font-semibold text-[var(--text-main)] hover:bg-[var(--bg-hover)] transition cursor-pointer shadow-2xs"
            title="Switch Theme"
          >
            <span
              className="h-2.5 w-2.5 rounded-full shrink-0 shadow-2xs"
              style={{ backgroundColor: 'var(--color-primary)' }}
            />
            <span className="hidden lg:inline text-[11px] font-medium text-[var(--text-muted)]">Theme:</span>
            <span className="hidden sm:inline text-xs font-semibold truncate max-w-[110px]">
              {themeConfig.name.split('&')[0].trim()}
            </span>
            <ChevronDown className="h-3 w-3 text-[var(--text-muted)] opacity-70" />
          </button>

          {showThemeMenu && (
            <div className="absolute right-0 mt-2 w-72 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] p-2 shadow-xl z-50 animate-in fade-in zoom-in-95 duration-100">
              <div className="px-3 py-2 border-b border-[var(--border-color)] flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                  ZaynOs Visual Theme
                </span>
                <span className="text-[10px] text-[var(--text-muted)]">Instant Apply</span>
              </div>
              <div className="space-y-1.5 py-2">
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
                      className={`w-full flex items-center justify-between p-2 rounded-lg text-left transition cursor-pointer border ${
                        isSelected
                          ? 'border-[var(--color-primary)] bg-[var(--bg-hover)]'
                          : 'border-transparent hover:bg-[var(--bg-hover)]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className="flex h-5 w-5 items-center justify-center rounded-full border shrink-0"
                          style={{
                            backgroundColor: t.bgBase,
                            borderColor: t.borderColor,
                          }}
                        >
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: t.colorPrimary }}
                          />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-[var(--text-main)] truncate">
                            {t.name}
                          </div>
                          <div className="text-[10px] text-[var(--text-muted)]">
                            {t.style}
                          </div>
                        </div>
                      </div>
                      {isSelected && (
                        <Check
                          className="h-4 w-4 shrink-0"
                          style={{ color: 'var(--color-primary)' }}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
              <div className="pt-2 border-t border-[var(--border-color)] px-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowThemeMenu(false);
                    onSelectView('settings');
                  }}
                  className="w-full text-center text-[11px] font-semibold text-[var(--color-primary)] hover:underline py-1"
                >
                  Manage Appearance in Settings →
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Real-Time Notification Bell */}
        <NotificationBell
          onSelectLead={onSelectLead}
          onNavigateToNotifications={() => onSelectView('notifications')}
          onNavigateToFollowups={() => onSelectView('followups')}
        />

        {/* Quick Global Add Lead Button */}
        <button
          id="global-add-lead-btn"
          type="button"
          onClick={onOpenAddLead}
          className="zaynos-btn-primary text-xs uppercase tracking-wider py-2 px-3 shadow-xs"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Add Lead</span>
        </button>

        {/* User Profile Menu */}
        <div className="relative" ref={profileMenuRef}>
          <button
            id="user-profile-header-btn"
            type="button"
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            className="flex h-9 w-9 items-center justify-center rounded-full font-bold text-xs shadow-xs border transition cursor-pointer hover:opacity-90"
            style={{
              backgroundColor: 'var(--bg-elevated)',
              borderColor: 'var(--border-color)',
              color: 'var(--text-main)',
            }}
            title={userProfile?.full_name || 'User Profile'}
          >
            {userInitials}
          </button>

          {showProfileMenu && (
            <div className="absolute right-0 mt-2 w-60 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] p-2 shadow-xl z-50 animate-in fade-in zoom-in-95 duration-100">
              <div className="border-b border-[var(--border-color)] px-3 py-2 text-xs">
                <p className="font-semibold text-[var(--text-main)] truncate">
                  {userProfile?.full_name || 'CRM User'}
                </p>
                <p className="text-[var(--text-muted)] text-[11px] truncate">
                  {userProfile?.email || 'Authenticated User'}
                </p>
                <div
                  className="mt-1.5 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                  style={{
                    backgroundColor: 'var(--color-primary-subtle)',
                    color: 'var(--color-primary)',
                  }}
                >
                  Role: {userProfile?.role || 'SALESMAN'}
                </div>
              </div>

              <div className="pt-1 space-y-0.5">
                <button
                  type="button"
                  onClick={() => {
                    setShowProfileMenu(false);
                    onSelectView('settings');
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-[var(--text-main)] hover:bg-[var(--bg-hover)] transition cursor-pointer"
                >
                  <Palette className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                  <span>Theme &amp; Appearance</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowProfileMenu(false);
                    onSelectView('notifications');
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-[var(--text-main)] hover:bg-[var(--bg-hover)] transition cursor-pointer"
                >
                  <span>Notifications</span>
                </button>
                {userProfile?.role === 'ADMIN' && (
                  <button
                    type="button"
                    id="profile-menu-audit-btn"
                    onClick={() => {
                      setShowProfileMenu(false);
                      onSelectView('audit');
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-[var(--color-primary)] hover:bg-[var(--bg-hover)] transition cursor-pointer"
                  >
                    <ShieldCheck className="h-3.5 w-3.5" />
                    <span>Security Audit Logs</span>
                  </button>
                )}
                <div className="my-1 border-t border-[var(--border-color)]" />
                <button
                  type="button"
                  onClick={() => {
                    setShowProfileMenu(false);
                    signOut();
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-[var(--danger)] hover:bg-[var(--bg-hover)] transition cursor-pointer"
                >
                  <LogOut className="h-3.5 w-3.5" />
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
