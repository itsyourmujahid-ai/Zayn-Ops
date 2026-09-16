import React from 'react';
import {
  Plus,
  CalendarPlus,
  AlertCircle,
  Users,
  Calendar,
  Layers,
} from 'lucide-react';
import { UserRole } from '../../types/database';
import { NavigationView } from '../../types/crm';

interface QuickActionsBarProps {
  role?: UserRole;
  onOpenAddLead: () => void;
  onOpenScheduleFollowUp: () => void;
  onSelectView: (view: NavigationView, options?: any) => void;
}

export const QuickActionsBar: React.FC<QuickActionsBarProps> = ({
  role,
  onOpenAddLead,
  onOpenScheduleFollowUp,
  onSelectView,
}) => {
  const isAdmin = role?.toUpperCase() === 'ADMIN';

  return (
    <div className="rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-2xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-[#0CB675]" />
          <span className="text-xs font-semibold text-slate-900">
            Workspace Shortcuts
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Action 1: Add Lead */}
          <button
            type="button"
            id="quick-action-add-lead"
            onClick={onOpenAddLead}
            className="zaynops-btn-primary py-1.5 px-3 text-xs font-semibold flex items-center gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
            <span>New Lead</span>
          </button>

          {/* Action 2: Schedule Follow-up */}
          <button
            type="button"
            id="quick-action-schedule-followup"
            onClick={onOpenScheduleFollowUp}
            className="zaynops-btn-secondary py-1.5 px-3 text-xs font-medium flex items-center gap-1.5"
          >
            <CalendarPlus className="h-3.5 w-3.5 text-slate-500" strokeWidth={1.75} />
            <span>Schedule Follow-up</span>
          </button>

          {/* Role-specific Actions */}
          {isAdmin ? (
            <>
              <button
                type="button"
                id="quick-action-view-overdue"
                onClick={() => onSelectView('followups', { followupTab: 'overdue' })}
                className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200/80 bg-rose-50/60 px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-100 transition cursor-pointer"
              >
                <AlertCircle className="h-3.5 w-3.5 text-rose-600" strokeWidth={1.75} />
                <span>Overdue Tasks</span>
              </button>

              <button
                type="button"
                id="quick-action-manage-team"
                onClick={() => onSelectView('team')}
                className="zaynops-btn-secondary py-1.5 px-3 text-xs font-medium flex items-center gap-1.5"
              >
                <Users className="h-3.5 w-3.5 text-slate-500" strokeWidth={1.75} />
                <span>Sales Team</span>
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                id="quick-action-view-today"
                onClick={() => onSelectView('followups', { followupTab: 'today' })}
                className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200/80 bg-amber-50/60 px-3 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-100 transition cursor-pointer"
              >
                <Calendar className="h-3.5 w-3.5 text-amber-600" strokeWidth={1.75} />
                <span>Today's Actions</span>
              </button>

              <button
                type="button"
                id="quick-action-view-my-leads"
                onClick={() => onSelectView('leads')}
                className="zaynops-btn-secondary py-1.5 px-3 text-xs font-medium flex items-center gap-1.5"
              >
                <Layers className="h-3.5 w-3.5 text-slate-500" strokeWidth={1.75} />
                <span>My Leads</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
