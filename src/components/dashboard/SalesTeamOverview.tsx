import React from 'react';
import {
  Users,
  UserCheck,
  Flame,
  Calendar,
  AlertCircle,
  Trophy,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';
import { FollowUpRecord, LeadRecord, UserProfile } from '../../types/database';
import { isFollowUpDueToday, isFollowUpOverdue } from '../../utils/dashboardUtils';

interface SalesTeamOverviewProps {
  salesmen: UserProfile[];
  leads: LeadRecord[];
  followups: FollowUpRecord[];
  onSelectSalesman?: (salesmanId: string) => void;
}

export const SalesTeamOverview: React.FC<SalesTeamOverviewProps> = ({
  salesmen,
  leads,
  followups,
  onSelectSalesman,
}) => {
  // Aggregate stats dynamically per salesman from real live data
  const teamMetrics = salesmen.map((salesman) => {
    const assignedLeads = leads.filter(
      (l) =>
        l.assigned_to === salesman.id ||
        l.assigned_to === `uid-${salesman.full_name?.toLowerCase()}` ||
        (salesman.email && l.assigned_to === salesman.email)
    );

    const totalAssigned = assignedLeads.length;
    const activeLeads = assignedLeads.filter(
      (l) => l.status !== 'Won' && l.status !== 'Lost'
    ).length;
    const hotLeads = assignedLeads.filter((l) => l.priority === 'Hot').length;
    const wonLeads = assignedLeads.filter((l) => l.status === 'Won').length;
    const lostLeads = assignedLeads.filter((l) => l.status === 'Lost').length;

    // Follow-ups for this salesman
    const salesmanFollowups = followups.filter(
      (f) =>
        f.status === 'pending' &&
        (f.assigned_to === salesman.id ||
          f.assigned_to === `uid-${salesman.full_name?.toLowerCase()}` ||
          (salesman.email && f.assigned_to === salesman.email))
    );

    const dueToday = salesmanFollowups.filter((f) => isFollowUpDueToday(f)).length;
    const overdue = salesmanFollowups.filter((f) => isFollowUpOverdue(f)).length;

    return {
      salesman,
      totalAssigned,
      activeLeads,
      hotLeads,
      wonLeads,
      lostLeads,
      dueToday,
      overdue,
    };
  });

  return (
    <div
      id="admin-sales-team-overview"
      className="flex flex-col rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden"
    >
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5 bg-slate-50/50">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-indigo-600" />
          <h3 className="text-sm font-bold text-slate-900">Sales Team Performance</h3>
        </div>
        <span className="text-xs text-slate-400 font-medium">
          {salesmen.length} Active Representatives
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              <th className="py-3 px-4">Salesman</th>
              <th className="py-3 px-2 text-center">Assigned</th>
              <th className="py-3 px-2 text-center">Active</th>
              <th className="py-3 px-2 text-center">Hot</th>
              <th className="py-3 px-2 text-center">Due Today</th>
              <th className="py-3 px-2 text-center">Overdue</th>
              <th className="py-3 px-2 text-center">Won</th>
              <th className="py-3 px-2 text-center">Lost</th>
              <th className="py-3 px-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {teamMetrics.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-8 text-center text-slate-400">
                  No active salesmen accounts registered.
                </td>
              </tr>
            ) : (
              teamMetrics.map(
                ({
                  salesman,
                  totalAssigned,
                  activeLeads,
                  hotLeads,
                  wonLeads,
                  lostLeads,
                  dueToday,
                  overdue,
                }) => {
                  const initials = salesman.full_name
                    ? salesman.full_name
                        .split(' ')
                        .map((n) => n[0])
                        .join('')
                        .toUpperCase()
                        .substring(0, 2)
                    : 'SR';

                  return (
                    <tr
                      key={salesman.id}
                      onClick={() => onSelectSalesman && onSelectSalesman(salesman.id)}
                      className="hover:bg-slate-50/80 transition cursor-pointer group"
                    >
                      {/* Salesman info */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-100 font-bold text-indigo-700 text-xs">
                            {initials}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 group-hover:text-indigo-600 transition">
                              {salesman.full_name}
                            </div>
                            <div className="text-[11px] text-slate-400">
                              {salesman.email}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Total Assigned */}
                      <td className="py-3 px-2 text-center font-bold text-slate-800">
                        {totalAssigned}
                      </td>

                      {/* Active Leads */}
                      <td className="py-3 px-2 text-center">
                        <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 font-semibold text-blue-700">
                          {activeLeads}
                        </span>
                      </td>

                      {/* Hot Leads */}
                      <td className="py-3 px-2 text-center">
                        {hotLeads > 0 ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 font-bold text-amber-700">
                            <Flame className="h-3 w-3 text-amber-500 fill-amber-500" />
                            {hotLeads}
                          </span>
                        ) : (
                          <span className="text-slate-400">0</span>
                        )}
                      </td>

                      {/* Due Today */}
                      <td className="py-3 px-2 text-center">
                        {dueToday > 0 ? (
                          <span className="inline-flex items-center gap-0.5 rounded-md bg-amber-100 px-2 py-0.5 font-bold text-amber-900">
                            <Calendar className="h-3 w-3 text-amber-600" />
                            {dueToday}
                          </span>
                        ) : (
                          <span className="text-slate-400">0</span>
                        )}
                      </td>

                      {/* Overdue */}
                      <td className="py-3 px-2 text-center">
                        {overdue > 0 ? (
                          <span className="inline-flex items-center gap-0.5 rounded-md bg-rose-100 px-2 py-0.5 font-bold text-rose-700 animate-pulse">
                            <AlertCircle className="h-3 w-3 text-rose-600" />
                            {overdue}
                          </span>
                        ) : (
                          <span className="text-slate-400">0</span>
                        )}
                      </td>

                      {/* Won Deals */}
                      <td className="py-3 px-2 text-center">
                        <span className="inline-flex items-center gap-0.5 rounded-md bg-emerald-50 px-2 py-0.5 font-bold text-emerald-700">
                          <Trophy className="h-3 w-3 text-emerald-600" />
                          {wonLeads}
                        </span>
                      </td>

                      {/* Lost Deals */}
                      <td className="py-3 px-2 text-center">
                        <span className="inline-flex items-center gap-0.5 rounded-md bg-slate-100 px-2 py-0.5 font-medium text-slate-600">
                          {lostLeads}
                        </span>
                      </td>

                      {/* View Leads Action */}
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectSalesman && onSelectSalesman(salesman.id);
                          }}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition cursor-pointer"
                        >
                          <span>Leads</span>
                          <ArrowRight className="h-3 w-3" />
                        </button>
                      </td>
                    </tr>
                  );
                }
              )
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
