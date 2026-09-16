import React from 'react';
import {
  LayoutDashboard,
  Users,
  Building2,
  CalendarClock,
  Calendar,
  Plus,
  Menu,
} from 'lucide-react';
import { NavigationView } from '../../types/crm';
import { useAuth } from '../../context/AuthContext';

interface BottomNavProps {
  currentView: NavigationView;
  onSelectView: (view: NavigationView) => void;
  onOpenAddLead: () => void;
  onToggleMobileMenu?: () => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  currentView,
  onSelectView,
  onOpenAddLead,
  onToggleMobileMenu,
}) => {
  const { isAdmin, hasPermission } = useAuth();
  const canCreateLead = isAdmin || hasPermission('LEADS_CREATE');

  const isOtherView = ![
    'dashboard',
    'leads',
    'followups',
  ].includes(currentView);

  return (
    <nav
      id="mobile-bottom-nav"
      className="fixed bottom-0 left-0 right-0 z-40 flex h-14 items-center justify-around border-t border-slate-200/80 bg-white/95 backdrop-blur-xs px-2 shadow-xs md:hidden select-none"
    >
      {/* Dashboard */}
      <button
        id="mobile-nav-dashboard"
        type="button"
        onClick={() => onSelectView('dashboard')}
        className={`flex min-h-[44px] min-w-[52px] flex-col items-center justify-center gap-0.5 px-1 text-xs transition cursor-pointer ${
          currentView === 'dashboard'
            ? 'text-[#0CB675] font-semibold'
            : 'text-slate-500 hover:text-slate-900'
        }`}
        aria-label="Dashboard"
      >
        <LayoutDashboard className="h-4 w-4" strokeWidth={currentView === 'dashboard' ? 2 : 1.75} />
        <span className="text-[10px]">Overview</span>
      </button>

      {/* Leads */}
      <button
        id="mobile-nav-leads"
        type="button"
        onClick={() => onSelectView('leads')}
        className={`flex min-h-[44px] min-w-[52px] flex-col items-center justify-center gap-0.5 px-1 text-xs transition cursor-pointer ${
          currentView === 'leads'
            ? 'text-[#0CB675] font-semibold'
            : 'text-slate-500 hover:text-slate-900'
        }`}
        aria-label="Leads"
      >
        <Users className="h-4 w-4" strokeWidth={currentView === 'leads' ? 2 : 1.75} />
        <span className="text-[10px]">Leads</span>
      </button>

      {/* Center Action: + Add Lead if permitted, else Sales Calendar */}
      {canCreateLead ? (
        <button
          id="mobile-nav-add-lead"
          type="button"
          onClick={onOpenAddLead}
          className="-mt-4 flex h-10 w-10 items-center justify-center rounded-full bg-[#0CB675] text-white shadow-sm transition active:scale-95 cursor-pointer"
          aria-label="Add Lead"
        >
          <Plus className="h-5 w-5 stroke-[2.5]" />
        </button>
      ) : (
        <button
          id="mobile-nav-calendar"
          type="button"
          onClick={() => onSelectView('calendar')}
          className={`flex min-h-[44px] min-w-[52px] flex-col items-center justify-center gap-0.5 px-1 text-xs transition cursor-pointer ${
            currentView === 'calendar'
              ? 'text-[#0CB675] font-semibold'
              : 'text-slate-500 hover:text-slate-900'
          }`}
          aria-label="Calendar"
        >
          <Calendar className="h-4 w-4" strokeWidth={currentView === 'calendar' ? 2 : 1.75} />
          <span className="text-[10px]">Calendar</span>
        </button>
      )}

      {/* Follow-ups */}
      <button
        id="mobile-nav-followups"
        type="button"
        onClick={() => onSelectView('followups')}
        className={`flex min-h-[44px] min-w-[52px] flex-col items-center justify-center gap-0.5 px-1 text-xs transition cursor-pointer ${
          currentView === 'followups'
            ? 'text-[#0CB675] font-semibold'
            : 'text-slate-500 hover:text-slate-900'
        }`}
        aria-label="Follow-ups"
      >
        <CalendarClock className="h-4 w-4" strokeWidth={currentView === 'followups' ? 2 : 1.75} />
        <span className="text-[10px]">Follow-ups</span>
      </button>

      {/* Menu / Drawer Toggle */}
      {onToggleMobileMenu ? (
        <button
          id="mobile-nav-more"
          type="button"
          onClick={onToggleMobileMenu}
          className={`flex min-h-[44px] min-w-[52px] flex-col items-center justify-center gap-0.5 px-1 text-xs transition cursor-pointer ${
            isOtherView
              ? 'text-[#0CB675] font-semibold'
              : 'text-slate-500 hover:text-slate-900'
          }`}
          aria-label="More views"
        >
          <Menu className="h-4 w-4" strokeWidth={isOtherView ? 2 : 1.75} />
          <span className="text-[10px]">Menu</span>
        </button>
      ) : (
        <button
          id="mobile-nav-clients"
          type="button"
          onClick={() => onSelectView('clients')}
          className={`flex min-h-[44px] min-w-[52px] flex-col items-center justify-center gap-0.5 px-1 text-xs transition cursor-pointer ${
            currentView === 'clients'
              ? 'text-[#0CB675] font-semibold'
              : 'text-slate-500 hover:text-slate-900'
          }`}
          aria-label="Clients"
        >
          <Building2 className="h-4 w-4" strokeWidth={currentView === 'clients' ? 2 : 1.75} />
          <span className="text-[10px]">Clients</span>
        </button>
      )}
    </nav>
  );
};
