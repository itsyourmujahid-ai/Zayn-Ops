import React from 'react';
import {
  Plus,
  CalendarPlus,
  AlertCircle,
  Users,
  Calendar,
  Layers,
  Sparkles,
  ArrowRight,
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
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-900">
              Quick Actions
            </span>
            <span className="hidden sm:inline text-xs text-slate-400 ml-2">
              Instant CRM workflows
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Action 1: Add Lead */}
          <button
            type="button"
            id="quick-action-add-lead"
            onClick={onOpenAddLead}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 shadow-xs transition cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Lead</span>
          </button>

          {/* Action 2: Schedule Follow-up */}
          <button
            type="button"
            id="quick-action-schedule-followup"
            onClick={onOpenScheduleFollowUp}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
          >
            <CalendarPlus className="h-3.5 w-3.5 text-indigo-600" />
            <span>Schedule Follow-up</span>
          </button>

          {/* Role-specific Actions */}
          {isAdmin ? (
            <>
              <button
                type="button"
                id="quick-action-view-overdue"
                onClick={() => onSelectView('followups', { followupTab: 'overdue' })}
                className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition cursor-pointer"
              >
                <AlertCircle className="h-3.5 w-3.5 text-rose-600" />
                <span>View Overdue Tasks</span>
              </button>

              <button
                type="button"
                id="quick-action-manage-team"
                onClick={() => onSelectView('settings')}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
              >
                <Users className="h-3.5 w-3.5 text-slate-600" />
                <span>Manage Sales Team</span>
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                id="quick-action-view-today"
                onClick={() => onSelectView('followups', { followupTab: 'today' })}
                className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100 transition cursor-pointer"
              >
                <Calendar className="h-3.5 w-3.5 text-amber-600" />
                <span>View Today's Tasks</span>
              </button>

              <button
                type="button"
                id="quick-action-view-my-leads"
                onClick={() => onSelectView('leads')}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
              >
                <Layers className="h-3.5 w-3.5 text-slate-600" />
                <span>View My Leads</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
