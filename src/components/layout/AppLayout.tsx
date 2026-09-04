import React from 'react';
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
  return (
    <div className="flex min-h-screen bg-[var(--bg-base)] text-[var(--text-main)] transition-colors duration-200">
      {/* Desktop & Tablet Sidebar */}
      <Sidebar
        currentView={currentView}
        onSelectView={onSelectView}
        onOpenAddLead={onOpenAddLead}
      />

      {/* Main Content Viewport */}
      <div className="flex flex-1 flex-col min-w-0 pb-20 md:pb-6">
        <TopHeader
          currentView={currentView}
          onOpenAddLead={onOpenAddLead}
          onSelectView={onSelectView}
          onSelectLead={onSelectLead}
          onOpenSearch={onOpenSearch}
        />
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <BottomNav
        currentView={currentView}
        onSelectView={onSelectView}
        onOpenAddLead={onOpenAddLead}
      />
    </div>
  );
};
