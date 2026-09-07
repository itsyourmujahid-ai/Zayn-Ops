import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Users,
  Kanban,
  CalendarClock,
  Calendar,
  BarChart3,
  Bell,
  Settings,
  Plus,
  LogOut,
  ShieldCheck,
  Building2,
  Search,
  Tag,
  GitMerge,
  ArrowDownUp,
  Sparkles,
  Layers,
  Palette,
  ShieldAlert,
  X,
  UserCheck,
  User,
} from 'lucide-react';
import { NavigationView } from '../../types/crm';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { ZaynLogo } from '../common/ZaynLogo';
import {
  subscribeToUserNotifications,
  subscribeToLeads,
  subscribeToClients,
  subscribeToNotDuplicates,
} from '../../lib/dal';
import {
  findAllLeadDuplicateCandidates,
  findAllClientDuplicateCandidates,
} from '../../lib/dataQuality';
import { LeadRecord, ClientRecord, NotDuplicateRecord } from '../../types/database';

interface SidebarProps {
  currentView: NavigationView;
  onSelectView: (view: NavigationView) => void;
  onOpenAddLead: () => void;
  isMobileDrawer?: boolean;
  onCloseDrawer?: () => void;
}

interface NavItem {
  id: NavigationView;
  label: string;
  icon: React.ElementType;
  badge?: string | number;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onSelectView,
  onOpenAddLead,
  isMobileDrawer,
  onCloseDrawer,
}) => {
  const { currentUser, userProfile, isSuperAdmin, isAdmin, hasPermission, currentCompany, signOut } = useAuth();
  const canCreateLead = !isSuperAdmin && (isAdmin || hasPermission('LEADS_CREATE'));
  const canViewReports = !isSuperAdmin && (isAdmin || hasPermission('REPORTS_VIEW'));
  const canViewSegments = !isSuperAdmin && (isAdmin || hasPermission('SEGMENTS_VIEW'));
  const canViewClients = !isSuperAdmin && (isAdmin || hasPermission('CLIENTS_VIEW'));

  const { themeConfig } = useTheme();
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [duplicateCount, setDuplicateCount] = useState<number>(0);

  useEffect(() => {
    if (isSuperAdmin || !currentUser?.uid) return;
    const unsub = subscribeToUserNotifications(currentUser.uid, (list) => {
      const unread = list.filter((n) => !n.is_read).length;
      setUnreadCount(unread);
    });
    return () => unsub();
  }, [currentUser?.uid, isSuperAdmin]);

  // Track potential duplicate count for Admin badge (CRM users only)
  useEffect(() => {
    if (isSuperAdmin) return;
    let localLeads: LeadRecord[] = [];
    let localClients: ClientRecord[] = [];
    let localNotDups: NotDuplicateRecord[] = [];

    const recompute = () => {
      const activeL = localLeads.filter((l) => l.record_status !== 'merged');
      const activeC = localClients.filter((c) => c.record_status !== 'merged');
      const ld = findAllLeadDuplicateCandidates(activeL, localNotDups);
      const cd = findAllClientDuplicateCandidates(activeC, localNotDups);
      setDuplicateCount(ld.length + cd.length);
    };

    const unsubL = subscribeToLeads((l) => {
      localLeads = l;
      recompute();
    }, userProfile?.role);

    const unsubC = subscribeToClients((c) => {
      localClients = c;
      recompute();
    }, userProfile?.role);

    const unsubND = subscribeToNotDuplicates((nd) => {
      localNotDups = nd;
      recompute();
    });

    return () => {
      unsubL();
      unsubC();
      unsubND();
    };
  }, [userProfile?.role, isSuperAdmin]);

  const navSections: NavSection[] = isSuperAdmin
    ? [
        {
          title: 'Platform Control Plane',
          items: [
            {
              id: 'super-admin' as NavigationView,
              label: 'Platform Console',
              icon: ShieldAlert,
            },
          ],
        },
      ]
    : [
        {
          title: 'Core Pipeline',
          items: [
            { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
            { id: 'leads', label: 'Leads', icon: Users },
            { id: 'pipeline', label: 'Sales Pipeline', icon: Kanban },
            { id: 'followups', label: 'Follow-ups', icon: CalendarClock },
            { id: 'calendar', label: 'Sales Calendar', icon: Calendar },
            ...(canViewClients ? [{ id: 'clients' as NavigationView, label: 'Clients', icon: Building2 }] : []),
          ],
        },
        {
          title: 'Intelligence',
          items: [
            { id: 'search', label: 'Global Search', icon: Search },
            ...(canViewSegments ? [{ id: 'segments' as NavigationView, label: 'Segments & Tags', icon: Tag }] : []),
            ...(canViewReports ? [{ id: 'reports' as NavigationView, label: 'Reports & KPIs', icon: BarChart3 }] : []),
            {
              id: 'notifications',
              label: 'Notifications',
              icon: Bell,
              badge: unreadCount > 0 ? unreadCount : undefined,
            },
          ],
        },
        ...(userProfile?.role === 'ADMIN'
          ? [
              {
                title: 'Company Administration',
                items: [
                  {
                    id: 'team' as NavigationView,
                    label: 'Team',
                    icon: UserCheck,
                  },
                  {
                    id: 'data-quality' as NavigationView,
                    label: 'Data Quality',
                    icon: GitMerge,
                    badge: duplicateCount > 0 ? duplicateCount : undefined,
                  },
                  {
                    id: 'data-management' as NavigationView,
                    label: 'Data Management',
                    icon: ArrowDownUp,
                  },
                  {
                    id: 'audit' as NavigationView,
                    label: 'Audit Trail',
                    icon: ShieldCheck,
                  },
                ],
              },
            ]
          : []),
        {
          title: 'System & Account',
          items: [
            { id: 'profile', label: 'My Profile & Target', icon: User },
            { id: 'settings', label: 'Settings', icon: Settings },
          ],
        },
      ];

  return (
    <aside
      id={isMobileDrawer ? 'mobile-sidebar-drawer' : 'main-sidebar'}
      className={
        isMobileDrawer
          ? 'flex h-full w-full flex-col bg-[var(--bg-card)] text-[var(--text-main)] overflow-hidden z-50'
          : 'hidden w-64 flex-col border-r border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-main)] md:flex md:h-screen md:sticky md:top-0 shadow-md transition-colors duration-200 z-20'
      }
    >
      {/* ZaynOps App Branding */}
      <div className="flex h-[72px] items-center justify-between border-b border-[var(--border-color)] px-5">
        <div className="flex items-center gap-3">
          <ZaynLogo size={36} className="shrink-0" />
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-base font-bold tracking-tight text-[var(--text-main)]">
                ZaynOps
              </span>
              <span
                className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider"
                style={{
                  backgroundColor: 'var(--color-primary-subtle)',
                  color: 'var(--color-primary)',
                }}
              >
                CRM
              </span>
            </div>
            <div className="text-[11px] font-medium text-[var(--text-muted)] flex items-center gap-1">
              <span className="truncate max-w-[130px]" title={currentCompany?.name || 'ZaynOps Suite'}>
                {isSuperAdmin ? 'Global SaaS Root' : (currentCompany?.name || 'Enterprise Suite')}
              </span>
            </div>
          </div>
        </div>

        {/* Close Drawer Button for Mobile */}
        {isMobileDrawer && onCloseDrawer && (
          <button
            id="close-mobile-drawer-btn"
            type="button"
            onClick={onCloseDrawer}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-main)] hover:bg-[var(--bg-hover)] transition cursor-pointer"
            title="Close menu"
            aria-label="Close menu"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Primary CTA: + Add Lead */}
      {canCreateLead && (
        <div className="p-4">
          <button
            id="sidebar-add-lead-btn"
            type="button"
            onClick={() => {
              onOpenAddLead();
              if (isMobileDrawer && onCloseDrawer) onCloseDrawer();
            }}
            className="zaynos-btn-primary w-full text-xs uppercase tracking-wider py-2.5 shadow-sm active:scale-98"
          >
            <Plus className="h-4 w-4" />
            <span>New Lead</span>
          </button>
        </div>
      )}

      {/* Nav Sections */}
      <nav className="flex-1 space-y-4 px-3 py-2 overflow-y-auto">
        {navSections.map((section) => (
          <div key={section.title} className="space-y-1">
            <div className="px-3 pb-1 text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
              {section.title}
            </div>
            {section.items.map((item) => {
              const Icon = item.icon;
              const isActive = currentView === item.id;
              return (
                <button
                  key={item.id}
                  id={`nav-${item.id}`}
                  type="button"
                  onClick={() => {
                    onSelectView(item.id);
                    if (isMobileDrawer && onCloseDrawer) onCloseDrawer();
                  }}
                  className={`group flex w-full items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                    isActive
                      ? 'font-semibold shadow-2xs'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-main)] hover:bg-[var(--bg-hover)]'
                  }`}
                  style={
                    isActive
                      ? {
                          backgroundColor: 'var(--color-primary-subtle)',
                          color: 'var(--color-primary)',
                          borderLeft: '3px solid var(--color-primary)',
                        }
                      : undefined
                  }
                >
                  <div className="flex items-center gap-2.5">
                    <Icon
                      className={`h-4 w-4 transition-colors ${
                        isActive ? 'text-[var(--color-primary)]' : 'text-[var(--text-muted)] group-hover:text-[var(--text-main)]'
                      }`}
                    />
                    <span>{item.label}</span>
                  </div>
                  {item.badge !== undefined && (
                    <span
                      className="rounded-full px-1.5 py-0.5 text-[10px] font-bold border"
                      style={{
                        backgroundColor: 'var(--bg-elevated)',
                        borderColor: 'var(--border-color)',
                        color: 'var(--text-main)',
                      }}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Bottom User Profile & Theme Quick Info */}
      <div className="p-3 border-t border-[var(--border-color)] bg-[var(--bg-card)] space-y-2">
        {/* Active Theme Indicator */}
        <button
          type="button"
          onClick={() => {
            onSelectView('settings');
            if (isMobileDrawer && onCloseDrawer) onCloseDrawer();
          }}
          className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-[11px] border border-[var(--border-color)] bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] transition cursor-pointer"
          title="Change theme in Appearance settings"
        >
          <div className="flex items-center gap-2 min-w-0">
            <span
              className="h-2.5 w-2.5 rounded-full shrink-0 shadow-2xs"
              style={{ backgroundColor: 'var(--color-primary)' }}
            />
            <span className="font-semibold text-[var(--text-main)] truncate">
              {themeConfig.name}
            </span>
          </div>
          <Palette className="h-3.5 w-3.5 text-[var(--text-muted)] shrink-0 ml-1" />
        </button>

        {/* User Card */}
        <div className="flex items-center justify-between pt-1">
          <button
            type="button"
            onClick={() => {
              onSelectView('profile');
              if (isMobileDrawer && onCloseDrawer) onCloseDrawer();
            }}
            className="flex items-center gap-2 min-w-0 text-left hover:opacity-80 transition cursor-pointer flex-1"
            title="View My Profile & Targets"
          >
            <div
              className="flex h-8 w-8 items-center justify-center rounded-full font-bold text-xs shrink-0 border"
              style={{
                backgroundColor: 'var(--color-primary-subtle)',
                color: 'var(--color-primary)',
                borderColor: 'var(--color-primary-border)',
              }}
            >
              {userProfile?.full_name?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold text-[var(--text-main)] truncate leading-tight">
                {userProfile?.full_name || 'CRM User'}
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span
                  className="text-[9px] font-bold px-1 py-0.2 rounded uppercase tracking-wider"
                  style={{
                    backgroundColor: 'var(--bg-elevated)',
                    color: 'var(--text-secondary)',
                  }}
                >
                  {userProfile?.role || 'SALESMAN'}
                </span>
                <span className="text-[10px] text-[var(--text-muted)] truncate max-w-[90px]">
                  {userProfile?.email}
                </span>
              </div>
            </div>
          </button>

          <button
            id="sidebar-logout-btn"
            type="button"
            onClick={signOut}
            title="Sign Out"
            className="rounded-lg p-1.5 text-[var(--text-muted)] hover:text-[var(--danger)] hover:bg-[var(--bg-hover)] transition cursor-pointer"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
};
