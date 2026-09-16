import React, { useState } from 'react';
import {
  Users,
  Search,
  Trophy,
  UserCheck,
  Target,
  ArrowRight,
  ExternalLink,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Building2,
  Clock,
} from 'lucide-react';
import {
  UserProfile,
  LeadRecord,
  ClientRecord,
  FollowUpRecord,
  LeadActivityRecord,
  TargetRecord,
} from '../../types/database';
import { NavigationView } from '../../types/crm';
import { calculateTargetProgress } from '../../utils/targetUtils';

interface SalesmanPerformanceTableProps {
  salesmen: UserProfile[];
  leads: LeadRecord[];
  clients: ClientRecord[];
  followups: FollowUpRecord[];
  activities: LeadActivityRecord[];
  targets: TargetRecord[];
  onSelectView: (view: NavigationView, options?: any) => void;
}

export const SalesmanPerformanceTable: React.FC<SalesmanPerformanceTableProps> = ({
  salesmen,
  leads,
  clients,
  followups,
  activities,
  targets,
  onSelectView,
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  // Compute metrics per salesman
  const salesmenRows = salesmen.map((salesman) => {
    const sId = salesman.id;
    const sNameLower = (salesman.full_name || '').toLowerCase();
    const sEmail = (salesman.email || '').toLowerCase();

    // 1. Leads Assigned (Current active ownership, excluding archived)
    const assignedLeads = leads.filter((l) => {
      const isAssigned =
        l.assigned_to === sId ||
        l.assigned_to === `uid-${sNameLower}` ||
        (l.assigned_to && l.assigned_to.toLowerCase() === sEmail);
      const isNotArchived = (l as any).status !== 'Archived';
      return isAssigned && isNotArchived;
    });
    const leadsCount = assignedLeads.length;

    // 2. Won Leads
    const wonLeads = leads.filter((l) => {
      const isAssigned =
        l.assigned_to === sId ||
        l.assigned_to === `uid-${sNameLower}` ||
        (l.assigned_to && l.assigned_to.toLowerCase() === sEmail) ||
        (l as any).closed_by === sId;
      const isWon = l.status === 'Won' || (l as any).stage === 'Won';
      return isAssigned && isWon;
    });
    const wonCount = wonLeads.length;

    // 3. Lost Leads
    const lostLeads = leads.filter((l) => {
      const isAssigned =
        l.assigned_to === sId ||
        l.assigned_to === `uid-${sNameLower}` ||
        (l.assigned_to && l.assigned_to.toLowerCase() === sEmail);
      const isLost = l.status === 'Lost' || (l as any).stage === 'Lost';
      return isAssigned && isLost;
    });
    const lostCount = lostLeads.length;

    // 4. Clients Owned
    const ownedClients = clients.filter((c) => {
      return (
        c.owner_id === sId ||
        (c as any).created_by === sId ||
        (c as any).salesman_id === sId
      );
    });
    const clientsCount = ownedClients.length;

    // 5. Follow-ups Completed
    const completedFollowups = followups.filter((f) => {
      const isAssigned =
        f.assigned_to === sId ||
        f.assigned_to === `uid-${sNameLower}` ||
        f.created_by === sId ||
        (f.assigned_to && f.assigned_to.toLowerCase() === sEmail);
      return isAssigned && f.status === 'completed';
    });
    const followupsCompletedCount = completedFollowups.length;

    // 6. Target Progress
    const salesmanTargets = targets.filter(
      (t) => t.salesman_id === sId && t.status === 'ACTIVE'
    );
    // Find primary target (prioritize LEADS_MANAGED or LEADS_WON)
    const primaryTarget =
      salesmanTargets.find((t) => t.target_type === 'LEADS_MANAGED') ||
      salesmanTargets.find((t) => t.target_type === 'LEADS_WON') ||
      salesmanTargets[0];

    let targetValueDisplay = '-';
    let progressPct = 0;
    let targetStatus: string = 'Not Started';
    let targetStatusColor = 'text-slate-500 bg-slate-100 border-slate-200';

    if (primaryTarget) {
      const progress = calculateTargetProgress(primaryTarget, leads, clients, followups, activities);
      targetValueDisplay = `${primaryTarget.target_value}`;
      progressPct = progress.percentage;
      targetStatus = progress.status;
      targetStatusColor = progress.statusColor;
    }

    return {
      salesman,
      leadsCount,
      wonCount,
      lostCount,
      clientsCount,
      followupsCompletedCount,
      targetValueDisplay,
      progressPct,
      targetStatus,
      targetStatusColor,
      hasTarget: !!primaryTarget,
      targetType: primaryTarget?.target_type,
    };
  });

  const filteredRows = salesmenRows.filter((r) => {
    const q = searchTerm.toLowerCase().trim();
    if (!q) return true;
    return (
      (r.salesman.full_name || '').toLowerCase().includes(q) ||
      (r.salesman.email || '').toLowerCase().includes(q)
    );
  });

  return (
    <div id="salesman-performance-table-container" className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
      {/* Table Header & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 border-b border-slate-200 bg-slate-50/50">
        <div>
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-indigo-600" />
            <h3 className="text-sm font-bold text-slate-900">
              Salesman Performance Table
            </h3>
            <span className="text-[11px] font-semibold text-slate-500 bg-white px-2 py-0.5 rounded-full border border-slate-200">
              {salesmen.length} Representatives
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time individual performance metrics, client counts, and target quota progress
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              id="salesman-table-search"
              type="text"
              placeholder="Search representative..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 w-48 sm:w-56"
            />
          </div>
        </div>
      </div>

      {/* Table Content */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              <th className="py-3 px-4">Salesman</th>
              <th className="py-3 px-3 text-center">Leads</th>
              <th className="py-3 px-3 text-center">Won</th>
              <th className="py-3 px-3 text-center">Lost</th>
              <th className="py-3 px-3 text-center">Clients</th>
              <th className="py-3 px-3 text-center">Follow-ups</th>
              <th className="py-3 px-3 text-center">Target</th>
              <th className="py-3 px-4 text-center">Progress</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-8 text-center text-slate-400 text-xs">
                  {searchTerm ? 'No representatives match your search query.' : 'No active sales representatives registered.'}
                </td>
              </tr>
            ) : (
              filteredRows.map((row) => (
                <tr
                  key={row.salesman.id}
                  id={`salesman-perf-row-${row.salesman.id}`}
                  className="hover:bg-slate-50/80 transition"
                >
                  {/* Salesman Info */}
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center justify-center border border-indigo-200 uppercase">
                        {(row.salesman.full_name || 'S').slice(0, 2)}
                      </div>
                      <div>
                        <div className="font-bold text-slate-900 text-xs">
                          {row.salesman.full_name || 'Sales Representative'}
                        </div>
                        <div className="text-[11px] text-slate-400 font-normal">
                          {row.salesman.email || 'No email configured'}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Leads */}
                  <td className="py-3.5 px-3 text-center">
                    <span className="inline-block font-bold text-slate-900 bg-slate-100 px-2.5 py-0.5 rounded-full">
                      {row.leadsCount}
                    </span>
                  </td>

                  {/* Won */}
                  <td className="py-3.5 px-3 text-center">
                    <span className="inline-block font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                      {row.wonCount}
                    </span>
                  </td>

                  {/* Lost */}
                  <td className="py-3.5 px-3 text-center">
                    <span className="inline-block font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
                      {row.lostCount}
                    </span>
                  </td>

                  {/* Clients */}
                  <td className="py-3.5 px-3 text-center">
                    <span className="inline-block font-bold text-teal-800 bg-teal-50 border border-teal-200 px-2.5 py-0.5 rounded-full">
                      {row.clientsCount}
                    </span>
                  </td>

                  {/* Follow-ups */}
                  <td className="py-3.5 px-3 text-center">
                    <span className="inline-block font-bold text-indigo-900 bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 rounded-full">
                      {row.followupsCompletedCount}
                    </span>
                  </td>

                  {/* Target */}
                  <td className="py-3.5 px-3 text-center">
                    {row.hasTarget ? (
                      <span className="font-bold text-slate-800">
                        {row.targetValueDisplay}
                      </span>
                    ) : (
                      <span className="text-slate-400 italic">None</span>
                    )}
                  </td>

                  {/* Progress */}
                  <td className="py-3.5 px-4 text-center">
                    {row.hasTarget ? (
                      <div className="w-32 mx-auto">
                        <div className="flex items-center justify-between text-[10px] font-bold mb-1">
                          <span className="text-slate-700">{row.progressPct}%</span>
                          <span
                            className={`px-1.5 py-0.2 rounded-sm border text-[9px] font-bold ${row.targetStatusColor}`}
                          >
                            {row.targetStatus}
                          </span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              row.progressPct >= 100
                                ? 'bg-emerald-500'
                                : row.progressPct >= 50
                                ? 'bg-indigo-500'
                                : 'bg-amber-500'
                            }`}
                            style={{ width: `${Math.min(100, row.progressPct)}%` }}
                          />
                        </div>
                      </div>
                    ) : (
                      <span className="text-slate-400 text-[11px]">-</span>
                    )}
                  </td>

                  {/* Actions: View Profile */}
                  <td className="py-3.5 px-4 text-right whitespace-nowrap">
                    <button
                      id={`view-salesman-profile-btn-${row.salesman.id}`}
                      type="button"
                      onClick={() =>
                        onSelectView('team', { selectedSalesmanId: row.salesman.id })
                      }
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 hover:border-indigo-300 text-indigo-600 font-bold text-xs transition cursor-pointer shadow-2xs"
                    >
                      <span>View Profile</span>
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
