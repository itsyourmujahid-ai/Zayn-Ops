import React, { useState, useMemo } from 'react';
import {
  Users,
  CheckSquare,
  Square,
  Trophy,
  Activity,
  Building2,
  Clock,
  Target,
  Percent,
  ChevronRight,
  Sparkles,
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

interface SalesmanComparisonWidgetProps {
  salesmen: UserProfile[];
  leads: LeadRecord[];
  clients: ClientRecord[];
  followups: FollowUpRecord[];
  activities: LeadActivityRecord[];
  targets: TargetRecord[];
  onSelectView: (view: NavigationView, options?: any) => void;
}

export const SalesmanComparisonWidget: React.FC<SalesmanComparisonWidgetProps> = ({
  salesmen,
  leads,
  clients,
  followups,
  activities,
  targets,
  onSelectView,
}) => {
  // Initialize with first 2 salesmen selected by default
  const [selectedSalesmanIds, setSelectedSalesmanIds] = useState<string[]>(() => {
    return salesmen.slice(0, 2).map((s) => s.id);
  });

  const toggleSalesman = (id: string) => {
    setSelectedSalesmanIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    setSelectedSalesmanIds(salesmen.map((s) => s.id));
  };

  const clearAll = () => {
    setSelectedSalesmanIds([]);
  };

  // Compute metrics for each selected salesman
  const comparisonData = useMemo(() => {
    return selectedSalesmanIds.map((sId) => {
      const salesman = salesmen.find((s) => s.id === sId) || {
        id: sId,
        full_name: 'Unknown',
        email: '',
        role: 'SALESMAN',
        is_active: true,
        created_at: '',
        updated_at: '',
      };
      const sNameLower = (salesman.full_name || '').toLowerCase();
      const sEmail = (salesman.email || '').toLowerCase();

      // 1. Leads
      const assignedLeads = leads.filter((l) => {
        const isAssigned =
          l.assigned_to === sId ||
          l.assigned_to === `uid-${sNameLower}` ||
          (l.assigned_to && l.assigned_to.toLowerCase() === sEmail);
        return isAssigned && (l as any).status !== 'Archived';
      });

      // 2. Won & Lost
      const wonLeads = leads.filter((l) => {
        const isAssigned =
          l.assigned_to === sId ||
          l.assigned_to === `uid-${sNameLower}` ||
          (l.assigned_to && l.assigned_to.toLowerCase() === sEmail) ||
          (l as any).closed_by === sId;
        return isAssigned && (l.status === 'Won' || (l as any).stage === 'Won');
      });

      const lostLeads = leads.filter((l) => {
        const isAssigned =
          l.assigned_to === sId ||
          l.assigned_to === `uid-${sNameLower}` ||
          (l.assigned_to && l.assigned_to.toLowerCase() === sEmail);
        return isAssigned && (l.status === 'Lost' || (l as any).stage === 'Lost');
      });

      // 3. Clients
      const ownedClients = clients.filter((c) => {
        return (
          c.owner_id === sId ||
          (c as any).created_by === sId ||
          (c as any).salesman_id === sId
        );
      });

      // 4. Follow-ups
      const completedFollowups = followups.filter((f) => {
        const isAssigned =
          f.assigned_to === sId ||
          f.assigned_to === `uid-${sNameLower}` ||
          f.created_by === sId;
        return isAssigned && f.status === 'completed';
      });

      // 5. Activities
      const loggedActivities = activities.filter((a) => {
        return a.created_by === sId || (a as any).salesman_id === sId;
      });

      // 6. Target Achievement
      const activeTargets = targets.filter(
        (t) => t.salesman_id === sId && t.status === 'ACTIVE'
      );
      let targetAchievementPct = 0;
      if (activeTargets.length > 0) {
        const totalPct = activeTargets.reduce((sum, t) => {
          const res = calculateTargetProgress(t, leads, clients, followups, activities);
          return sum + res.percentage;
        }, 0);
        targetAchievementPct = Math.round(totalPct / activeTargets.length);
      }

      // 7. Conversion Rate
      const closedTotal = wonLeads.length + lostLeads.length;
      const conversionRate =
        closedTotal > 0
          ? Math.round((wonLeads.length / closedTotal) * 100)
          : assignedLeads.length > 0
          ? Math.round((wonLeads.length / assignedLeads.length) * 100)
          : 0;

      return {
        salesman,
        leadsCount: assignedLeads.length,
        wonCount: wonLeads.length,
        lostCount: lostLeads.length,
        clientsCount: ownedClients.length,
        followupsCount: completedFollowups.length,
        activitiesCount: loggedActivities.length,
        targetAchievementPct,
        conversionRate,
        targetsCount: activeTargets.length,
      };
    });
  }, [selectedSalesmanIds, salesmen, leads, clients, followups, activities, targets]);

  return (
    <div id="salesman-comparison-widget" className="rounded-2xl border border-slate-200 bg-white shadow-xs p-5 space-y-4">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-indigo-600" />
            <h3 className="text-sm font-bold text-slate-900">
              Sales Representative Benchmark &amp; Comparison
            </h3>
            <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
              {selectedSalesmanIds.length} Selected
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Select representatives below to contrast deal flow, closed wins, activity velocity, and targets
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={selectAll}
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 px-2 py-1 cursor-pointer"
          >
            Select All
          </button>
          <span className="text-slate-300">|</span>
          <button
            type="button"
            onClick={clearAll}
            className="text-xs font-semibold text-slate-500 hover:text-slate-700 px-2 py-1 cursor-pointer"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Checkbox Selector Bar */}
      <div className="flex flex-wrap items-center gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200">
        <span className="text-xs font-bold text-slate-700 mr-1">Compare:</span>
        {salesmen.map((salesman) => {
          const isSelected = selectedSalesmanIds.includes(salesman.id);
          return (
            <button
              key={salesman.id}
              id={`compare-salesman-toggle-${salesman.id}`}
              type="button"
              onClick={() => toggleSalesman(salesman.id)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition cursor-pointer ${
                isSelected
                  ? 'bg-indigo-50 border-indigo-300 text-indigo-800 shadow-2xs'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100/80'
              }`}
            >
              {isSelected ? (
                <CheckSquare className="h-3.5 w-3.5 text-indigo-600" />
              ) : (
                <Square className="h-3.5 w-3.5 text-slate-400" />
              )}
              <span>{salesman.full_name || salesman.email}</span>
            </button>
          );
        })}
      </div>

      {/* Comparison Grid / Cards */}
      {comparisonData.length === 0 ? (
        <div className="py-8 text-center text-slate-400 text-xs">
          Select at least one representative above to view benchmark comparisons.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-4">Metric</th>
                {comparisonData.map((d) => (
                  <th key={d.salesman.id} className="py-3 px-4 text-center">
                    <div className="font-bold text-slate-900 text-xs">
                      {d.salesman.full_name}
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        onSelectView('team', { selectedSalesmanId: d.salesman.id })
                      }
                      className="text-[10px] text-indigo-600 font-semibold hover:underline"
                    >
                      Profile →
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {/* Leads */}
              <tr className="hover:bg-slate-50/50">
                <td className="py-3 px-4 text-slate-700 font-bold flex items-center gap-2">
                  <Users className="h-3.5 w-3.5 text-indigo-500" />
                  <span>Leads Assigned</span>
                </td>
                {comparisonData.map((d) => (
                  <td key={d.salesman.id} className="py-3 px-4 text-center font-bold text-slate-900">
                    {d.leadsCount}
                  </td>
                ))}
              </tr>

              {/* Won */}
              <tr className="hover:bg-slate-50/50">
                <td className="py-3 px-4 text-emerald-800 font-bold flex items-center gap-2">
                  <Trophy className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Won Deals</span>
                </td>
                {comparisonData.map((d) => (
                  <td key={d.salesman.id} className="py-3 px-4 text-center font-black text-emerald-700">
                    {d.wonCount}
                  </td>
                ))}
              </tr>

              {/* Lost */}
              <tr className="hover:bg-slate-50/50">
                <td className="py-3 px-4 text-slate-600 font-bold flex items-center gap-2">
                  <span className="h-3.5 w-3.5 text-slate-400 font-black flex items-center justify-center">✕</span>
                  <span>Lost Deals</span>
                </td>
                {comparisonData.map((d) => (
                  <td key={d.salesman.id} className="py-3 px-4 text-center font-bold text-slate-600">
                    {d.lostCount}
                  </td>
                ))}
              </tr>

              {/* Clients */}
              <tr className="hover:bg-slate-50/50">
                <td className="py-3 px-4 text-teal-800 font-bold flex items-center gap-2">
                  <Building2 className="h-3.5 w-3.5 text-teal-600" />
                  <span>Clients Owned</span>
                </td>
                {comparisonData.map((d) => (
                  <td key={d.salesman.id} className="py-3 px-4 text-center font-bold text-teal-800">
                    {d.clientsCount}
                  </td>
                ))}
              </tr>

              {/* Follow-ups */}
              <tr className="hover:bg-slate-50/50">
                <td className="py-3 px-4 text-amber-800 font-bold flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5 text-amber-600" />
                  <span>Follow-ups Completed</span>
                </td>
                {comparisonData.map((d) => (
                  <td key={d.salesman.id} className="py-3 px-4 text-center font-bold text-slate-800">
                    {d.followupsCount}
                  </td>
                ))}
              </tr>

              {/* Activities */}
              <tr className="hover:bg-slate-50/50">
                <td className="py-3 px-4 text-purple-800 font-bold flex items-center gap-2">
                  <Activity className="h-3.5 w-3.5 text-purple-600" />
                  <span>Activities Logged</span>
                </td>
                {comparisonData.map((d) => (
                  <td key={d.salesman.id} className="py-3 px-4 text-center font-bold text-purple-900">
                    {d.activitiesCount}
                  </td>
                ))}
              </tr>

              {/* Target Achievement */}
              <tr className="hover:bg-slate-50/50 bg-indigo-50/20">
                <td className="py-3 px-4 text-indigo-900 font-bold flex items-center gap-2">
                  <Target className="h-3.5 w-3.5 text-indigo-600" />
                  <span>Target Quota Progress</span>
                </td>
                {comparisonData.map((d) => (
                  <td key={d.salesman.id} className="py-3 px-4 text-center">
                    <span className="font-black text-indigo-700 text-xs">
                      {d.targetsCount > 0 ? `${d.targetAchievementPct}%` : 'No Target'}
                    </span>
                  </td>
                ))}
              </tr>

              {/* Conversion Rate */}
              <tr className="hover:bg-slate-50/50 bg-teal-50/20">
                <td className="py-3 px-4 text-teal-900 font-bold flex items-center gap-2">
                  <Percent className="h-3.5 w-3.5 text-teal-600" />
                  <span>Conversion Rate</span>
                </td>
                {comparisonData.map((d) => (
                  <td key={d.salesman.id} className="py-3 px-4 text-center">
                    <span className="font-black text-teal-800 text-xs">
                      {d.conversionRate}%
                    </span>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
