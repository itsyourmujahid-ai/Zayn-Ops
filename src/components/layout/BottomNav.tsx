import React from 'react';
import {
  LayoutDashboard,
  Users,
  Building2,
  CalendarClock,
  Plus,
  Menu,
} from 'lucide-react';
import { NavigationView } from '../../types/crm';

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
  const isOtherView = ![
    'dashboard',
    'leads',
    'followups',
  ].includes(currentView);

  return (
    <nav
      id="mobile-bottom-nav"
      className="fixed bottom-0 left-0 right-0 z-40 flex h-16 items-center justify-around border-t border-[var(--border-color)] bg-[var(--bg-card)] px-2 shadow-lg md:hidden transition-colors duration-200"
    >
      {/* Dashboard */}
      <button
        id="mobile-nav-dashboard"
        type="button"
        onClick={() => onSelectView('dashboard')}
        className="flex min-h-[44px] min-w-[56px] flex-col items-center justify-center gap-1 px-1 text-xs transition cursor-pointer"
        style={{
          color: currentView === 'dashboard' ? 'var(--color-primary)' : 'var(--text-secondary)',
          fontWeight: currentView === 'dashboard' ? 700 : 500,
        }}
        aria-label="Dashboard"
      >
        <LayoutDashboard className="h-5 w-5" />
        <span className="text-[10px]">Dashboard</span>
      </button>

      {/* Leads */}
      <button
        id="mobile-nav-leads"
        type="button"
        onClick={() => onSelectView('leads')}
        className="flex min-h-[44px] min-w-[56px] flex-col items-center justify-center gap-1 px-1 text-xs transition cursor-pointer"
        style={{
          color: currentView === 'leads' ? 'var(--color-primary)' : 'var(--text-secondary)',
          fontWeight: currentView === 'leads' ? 700 : 500,
        }}
        aria-label="Leads"
      >
        <Users className="h-5 w-5" />
        <span className="text-[10px]">Leads</span>
      </button>

      {/* Center + Add Lead Button */}
      <button
        id="mobile-nav-add-lead"
        type="button"
        onClick={onOpenAddLead}
        className="-mt-5 flex h-12 w-12 items-center justify-center rounded-full shadow-lg transition active:scale-95 cursor-pointer"
        style={{
          backgroundColor: 'var(--color-primary)',
          color: 'var(--text-inverse)',
          boxShadow: '0 4px 14px var(--shadow-color)',
        }}
        aria-label="Add Lead"
      >
        <Plus className="h-6 w-6 stroke-[2.5]" />
      </button>

      {/* Follow-ups */}
      <button
        id="mobile-nav-followups"
        type="button"
        onClick={() => onSelectView('followups')}
        className="flex min-h-[44px] min-w-[56px] flex-col items-center justify-center gap-1 px-1 text-xs transition cursor-pointer"
        style={{
          color: currentView === 'followups' ? 'var(--color-primary)' : 'var(--text-secondary)',
          fontWeight: currentView === 'followups' ? 700 : 500,
        }}
        aria-label="Follow-ups"
      >
        <CalendarClock className="h-5 w-5" />
        <span className="text-[10px]">Follow-ups</span>
      </button>

      {/* Menu / Drawer Toggle */}
      {onToggleMobileMenu ? (
        <button
          id="mobile-nav-more"
          type="button"
          onClick={onToggleMobileMenu}
          className="flex min-h-[44px] min-w-[56px] flex-col items-center justify-center gap-1 px-1 text-xs transition cursor-pointer"
          style={{
            color: isOtherView ? 'var(--color-primary)' : 'var(--text-secondary)',
            fontWeight: isOtherView ? 700 : 500,
          }}
          aria-label="More views"
        >
          <Menu className="h-5 w-5" />
          <span className="text-[10px]">Menu</span>
        </button>
      ) : (
        <button
          id="mobile-nav-clients"
          type="button"
          onClick={() => onSelectView('clients')}
          className="flex min-h-[44px] min-w-[56px] flex-col items-center justify-center gap-1 px-1 text-xs transition cursor-pointer"
          style={{
            color: currentView === 'clients' ? 'var(--color-primary)' : 'var(--text-secondary)',
            fontWeight: currentView === 'clients' ? 700 : 500,
          }}
          aria-label="Clients"
        >
          <Building2 className="h-5 w-5" />
          <span className="text-[10px]">Clients</span>
        </button>
      )}
    </nav>
  );
};
