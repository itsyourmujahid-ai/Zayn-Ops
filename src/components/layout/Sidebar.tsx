import React, { useState, useEffect } from 'react';
import { motion, LayoutGroup } from 'motion/react';
import { LiquidButton } from '../liquid/LiquidButton';
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
  ShieldAlert,
  X,
  UserCheck,
  User,
  MessageSquareText,
  Target,
} from 'lucide-react';
import { NavigationView } from '../../types/crm';
import { useAuth } from '../../context/AuthContext';
import { ZaynLogo } from '../common/ZaynLogo';
import { liquidSpring } from '../../lib/motion';
import {
  subscribeToUserNotifications,
  subscribeToLeads,
  subscribeToClients,
  subscribeToNotDuplicates,
  subscribeToUnreadTeamMessages,
  getEffectiveCompanyId,
  DEFAULT_COMPANY_ID,
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

  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [unreadChatCount, setUnreadChatCount] = useState<number>(0);
  const [duplicateCount, setDuplicateCount] = useState<number>(0);

  useEffect(() => {
    if (isSuperAdmin || !currentUser?.uid) return;
    const unsub = subscribeToUserNotifications(currentUser.uid, (list) => {
      const unread = list.filter((n) => !n.is_read).length;
      setUnreadCount(unread);
    });
    return () => unsub();
  }, [currentUser?.uid, isSuperAdmin]);

  // Track unread team chat messages
  useEffect(() => {
    if (isSuperAdmin || !currentUser?.uid) return;
    const compId = userProfile?.company_id || getEffectiveCompanyId() || DEFAULT_COMPANY_ID;
    const unsub = subscribeToUnreadTeamMessages(currentUser.uid, compId, (count) => {
      setUnreadChatCount(count);
    });
    return () => unsub();
  }, [currentUser?.uid, userProfile?.company_id, isSuperAdmin]);

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
            { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
            { id: 'leads', label: 'Leads', icon: Users },
            ...(canViewClients ? [{ id: 'clients' as NavigationView, label: 'Clients', icon: Building2 }] : []),
            { id: 'pipeline', label: 'Pipeline', icon: Kanban },
            { id: 'followups', label: 'Follow-ups', icon: CalendarClock },
            { id: 'calendar', label: 'Calendar', icon: Calendar },
          ],
        },
        {
          title: 'Intelligence & Performance',
          items: [
            { id: 'search', label: 'Search', icon: Search },
            ...(canViewSegments ? [{ id: 'segments' as NavigationView, label: 'Segments & Tags', icon: Tag }] : []),
            ...(canViewReports ? [{ id: 'reports' as NavigationView, label: 'Reports & KPIs', icon: BarChart3 }] : []),
            { id: 'profile', label: 'Sales Targets', icon: Target },
            {
              id: 'communication-hub' as NavigationView,
              label: 'Team Chat',
              icon: MessageSquareText,
              badge: unreadChatCount > 0 ? unreadChatCount : undefined,
            },
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
                    label: 'Sales Team',
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
                    label: 'Import & Migration',
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
          title: 'Workspace',
          items: [
            { id: 'settings', label: 'Settings', icon: Settings },
          ],
        },
      ];

  return (
    <aside
      id={isMobileDrawer ? 'mobile-sidebar-drawer' : 'main-sidebar'}
      className={
        isMobileDrawer
          ? 'flex h-full w-full flex-col bg-white text-slate-900 overflow-hidden z-50 select-none'
          : 'hidden w-60 flex-col border-r border-slate-200/80 bg-white text-slate-900 md:flex md:h-screen md:sticky md:top-0 transition-colors duration-200 z-20 select-none'
      }
    >
      {/* ZaynOps Brand Header */}
      <div className="flex h-16 items-center justify-between px-5 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <ZaynLogo size={32} className="shrink-0 drop-shadow-2xs" />
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5 leading-none">
              <span className="text-sm font-bold tracking-tight text-slate-900">
                ZaynOps
              </span>
              <span className="h-1.5 w-1.5 rounded-full bg-[#0CB675]" />
            </div>
            <span
              className="text-[11px] font-medium text-slate-400 truncate max-w-[125px] mt-1"
              title={currentCompany?.name || 'Bahwan M&E'}
            >
              {isSuperAdmin ? 'Control Plane' : (currentCompany?.name || 'Bahwan M&E')}
            </span>
          </div>
        </div>

        {/* Close Drawer Button for Mobile */}
        {isMobileDrawer && onCloseDrawer && (
          <button
            id="close-mobile-drawer-btn"
            type="button"
            onClick={onCloseDrawer}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer"
            title="Close menu"
            aria-label="Close menu"
          >
            <X className="h-4 w-4" strokeWidth={1.75} />
          </button>
        )}
      </div>

      {/* Primary Action Button: + New Lead */}
      {canCreateLead && (
        <div className="px-3 pt-3 pb-2">
          <LiquidButton
            id="sidebar-add-lead-btn"
            variant="primary"
            size="md"
            onClick={() => {
              onOpenAddLead();
              if (isMobileDrawer && onCloseDrawer) onCloseDrawer();
            }}
            className="w-full py-2 text-xs font-bold shadow-[0_2px_8px_rgba(12,182,117,0.25)] flex items-center justify-center gap-2 cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
            <span>New Lead</span>
          </LiquidButton>
        </div>
      )}

      {/* Navigation Sections with Liquid Shared Motion Active Surface */}
      <LayoutGroup id="zaynops-sidebar-nav">
        <nav className="flex-1 space-y-5 px-3 py-3 overflow-y-auto">
          {navSections.map((section) => (
            <div key={section.title} className="space-y-0.5">
              <div className="px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
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
                    className={`group relative flex w-full items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer select-none ${
                      isActive
                        ? 'text-slate-950 font-bold'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/60'
                    }`}
                  >
                    {/* Fluid / Liquid Moving Active Background Surface */}
                    {isActive && (
                      <motion.div
                        layoutId="sidebar-active-indicator"
                        transition={{
                          type: 'spring',
                          stiffness: 420,
                          damping: 32,
                          mass: 0.8,
                        }}
                        className="absolute inset-0 rounded-lg bg-emerald-50 border border-emerald-500/30 shadow-[0_2px_8px_rgba(12,182,117,0.12)]"
                        style={{ zIndex: 0 }}
                      >
                        {/* Physical left liquid accent pip */}
                        <span className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-full bg-[#0CB675]" />
                      </motion.div>
                    )}

                    <div className="relative z-10 flex items-center gap-2.5">
                      <Icon
                        className={`h-4 w-4 transition-transform duration-200 ${
                          isActive
                            ? 'text-[#0CB675] scale-105'
                            : 'text-slate-500 group-hover:text-slate-800'
                        }`}
                        strokeWidth={isActive ? 2 : 1.75}
                      />
                      <span>{item.label}</span>
                    </div>

                    {item.badge !== undefined && (
                      <span
                        className={`relative z-10 rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                          isActive
                            ? 'bg-[#0CB675]/20 text-[#047857]'
                            : 'bg-slate-100 text-slate-600'
                        }`}
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
      </LayoutGroup>

      {/* Clean User Profile & Session Footer */}
      <div className="p-3 border-t border-slate-100 bg-white">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              onSelectView('profile');
              if (isMobileDrawer && onCloseDrawer) onCloseDrawer();
            }}
            className="flex items-center gap-2.5 min-w-0 text-left hover:opacity-85 transition cursor-pointer flex-1"
            title="View Profile"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-700 font-semibold text-xs border border-slate-200/80 shrink-0">
              {userProfile?.full_name?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold text-slate-900 truncate leading-tight">
                {userProfile?.full_name || 'CRM User'}
              </div>
              <div className="text-[10px] text-slate-500 font-medium truncate mt-0.5">
                {userProfile?.role || 'SALESMAN'}
              </div>
            </div>
          </button>

          <LiquidButton
            id="sidebar-logout-btn"
            variant="ghost"
            size="icon"
            onClick={signOut}
            title="Sign Out"
            className="text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg p-1.5"
          >
            <LogOut className="h-4 w-4" strokeWidth={1.75} />
          </LiquidButton>
        </div>
      </div>
    </aside>
  );
};
