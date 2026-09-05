import React, { useState } from 'react';
import { NavigationView } from '../../types/crm';
import { Sidebar } from './Sidebar';
import { TopHeader } from './TopHeader';
import { BottomNav } from './BottomNav';

interface AppLayoutProps {
  currentView: NavigationView;
  onSelectView: (view: NavigationView) => void;
  onOpenAddLead: () => void;
  onSelectLead?: (leadId: string) => void;
  onOpenSearch?: () => void;
  children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({
  currentView,
  onSelectView,
  onOpenAddLead,
  onSelectLead,
  onOpenSearch,
  children,
}) => {
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState<boolean>(false);

  return (
    <div className="flex min-h-screen bg-[var(--bg-base)] text-[var(--text-main)] transition-colors duration-200">
      {/* Desktop & Tablet Sidebar */}
      <Sidebar
        currentView={currentView}
        onSelectView={onSelectView}
        onOpenAddLead={onOpenAddLead}
      />

      {/* Mobile Drawer Overlay Backdrop */}
      {isMobileDrawerOpen && (
        <div
          id="mobile-drawer-backdrop"
          onClick={() => setIsMobileDrawerOpen(false)}
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs md:hidden transition-opacity"
          aria-hidden="true"
        />
      )}

      {/* Mobile Drawer Slide-out Panel */}
      <div
        id="mobile-drawer-container"
        className={`fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] transform bg-[var(--bg-card)] border-r border-[var(--border-color)] transition-transform duration-250 ease-out md:hidden flex flex-col shadow-2xl ${
          isMobileDrawerOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation drawer"
      >
        <Sidebar
          currentView={currentView}
          onSelectView={(view) => {
            onSelectView(view);
            setIsMobileDrawerOpen(false);
          }}
          onOpenAddLead={() => {
            onOpenAddLead();
            setIsMobileDrawerOpen(false);
          }}
          isMobileDrawer={true}
          onCloseDrawer={() => setIsMobileDrawerOpen(false)}
        />
      </div>

      {/* Main Content Viewport */}
      <div className="flex flex-1 flex-col min-w-0 pb-20 md:pb-6">
        <TopHeader
          currentView={currentView}
          onOpenAddLead={onOpenAddLead}
          onSelectView={onSelectView}
          onSelectLead={onSelectLead}
          onOpenSearch={onOpenSearch}
          onToggleMobileMenu={() => setIsMobileDrawerOpen((prev) => !prev)}
        />
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <BottomNav
        currentView={currentView}
        onSelectView={(view) => {
          onSelectView(view);
          setIsMobileDrawerOpen(false);
        }}
        onOpenAddLead={onOpenAddLead}
        onToggleMobileMenu={() => setIsMobileDrawerOpen((prev) => !prev)}
      />
    </div>
  );
};
