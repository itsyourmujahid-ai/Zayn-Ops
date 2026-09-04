import React, { useState, useMemo } from 'react';
import {
  Users,
  Search,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  Award,
  AlertTriangle,
  Flame,
  CheckCircle2,
  DollarSign,
  Activity,
  Percent,
} from 'lucide-react';
import { SalesmanPerformanceMetric } from '../../types/reports';
import { formatCurrency } from '../../utils/reportUtils';

interface SalesTeamPerformanceTableProps {
  teamMetrics: SalesmanPerformanceMetric[];
  onSelectSalesman?: (salesmanId: string) => void;
}

type SortField =
  | 'salesmanName'
  | 'totalLeads'
  | 'activeLeads'
  | 'hotLeads'
  | 'wonLeads'
  | 'lostLeads'
  | 'conversionRate'
  | 'totalActivities'
  | 'completedFollowups'
  | 'overdueFollowups'
  | 'pipelineValue';

export const SalesTeamPerformanceTable: React.FC<SalesTeamPerformanceTableProps> = ({
  teamMetrics,
  onSelectSalesman,
}) => {
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('totalLeads');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const filteredAndSorted = useMemo(() => {
    const list = teamMetrics.filter((m) => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        m.salesmanName.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q)
      );
    });

    return list.sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];

      if (typeof valA === 'string') {
        valA = (valA as string).toLowerCase();
        valB = ((valB as string) || '').toLowerCase();
        return sortDirection === 'asc'
          ? (valA as string).localeCompare(valB as string)
          : (valB as string).localeCompare(valA as string);
      }

      const numA = Number(valA) || 0;
      const numB = Number(valB) || 0;
      return sortDirection === 'asc' ? numA - numB : numB - numA;
    });
  }, [teamMetrics, search, sortField, sortDirection]);

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden space-y-3">
      {/* Header */}
      <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Users className="h-4.5 w-4.5 text-indigo-600" />
            <h3 className="text-sm font-bold text-slate-900">Sales Representative Performance Matrix</h3>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Team comparison: lead distribution, closing efficiency, daily activity, and pipeline value
          </p>
        </div>

        {/* Search */}
        <div className="relative w-full md:w-64">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search representative..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-none focus:border-indigo-500"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
              <th
                onClick={() => handleSort('salesmanName')}
                className="px-4 py-3 cursor-pointer hover:bg-slate-100 transition whitespace-nowrap"
              >
                <div className="flex items-center gap-1">
                  Representative
                  <ArrowUpDown className="h-3 w-3 text-slate-400" />
                </div>
              </th>
              <th
                onClick={() => handleSort('totalLeads')}
                className="px-3 py-3 text-center cursor-pointer hover:bg-slate-100 transition whitespace-nowrap"
              >
                <div className="flex items-center justify-center gap-1">
                  Total Leads
                  <ArrowUpDown className="h-3 w-3 text-slate-400" />
                </div>
              </th>
              <th
                onClick={() => handleSort('activeLeads')}
                className="px-3 py-3 text-center cursor-pointer hover:bg-slate-100 transition whitespace-nowrap"
              >
                <div className="flex items-center justify-center gap-1">
                  Active
                  <ArrowUpDown className="h-3 w-3 text-slate-400" />
                </div>
              </th>
              <th
                onClick={() => handleSort('hotLeads')}
                className="px-3 py-3 text-center cursor-pointer hover:bg-slate-100 transition whitespace-nowrap"
              >
                <div className="flex items-center justify-center gap-1">
                  🔥 Hot
                  <ArrowUpDown className="h-3 w-3 text-slate-400" />
                </div>
              </th>
              <th
                onClick={() => handleSort('wonLeads')}
                className="px-3 py-3 text-center cursor-pointer hover:bg-slate-100 transition whitespace-nowrap"
              >
                <div className="flex items-center justify-center gap-1">
                  Won
                  <ArrowUpDown className="h-3 w-3 text-slate-400" />
                </div>
              </th>
              <th
                onClick={() => handleSort('lostLeads')}
                className="px-3 py-3 text-center cursor-pointer hover:bg-slate-100 transition whitespace-nowrap"
              >
                <div className="flex items-center justify-center gap-1">
                  Lost
                  <ArrowUpDown className="h-3 w-3 text-slate-400" />
                </div>
              </th>
              <th
                onClick={() => handleSort('conversionRate')}
                className="px-3 py-3 text-center cursor-pointer hover:bg-slate-100 transition whitespace-nowrap"
              >
                <div className="flex items-center justify-center gap-1">
                  Win Rate %
                  <ArrowUpDown className="h-3 w-3 text-slate-400" />
                </div>
              </th>
              <th
                onClick={() => handleSort('totalActivities')}
                className="px-3 py-3 text-center cursor-pointer hover:bg-slate-100 transition whitespace-nowrap"
              >
                <div className="flex items-center justify-center gap-1">
                  Activities
                  <ArrowUpDown className="h-3 w-3 text-slate-400" />
                </div>
              </th>
              <th
                onClick={() => handleSort('completedFollowups')}
                className="px-3 py-3 text-center cursor-pointer hover:bg-slate-100 transition whitespace-nowrap"
              >
                <div className="flex items-center justify-center gap-1">
                  Completed FUs
                  <ArrowUpDown className="h-3 w-3 text-slate-400" />
                </div>
              </th>
              <th
                onClick={() => handleSort('overdueFollowups')}
                className="px-3 py-3 text-center cursor-pointer hover:bg-slate-100 transition whitespace-nowrap"
              >
                <div className="flex items-center justify-center gap-1">
                  Overdue FUs
                  <ArrowUpDown className="h-3 w-3 text-slate-400" />
                </div>
              </th>
              <th
                onClick={() => handleSort('pipelineValue')}
                className="px-4 py-3 text-right cursor-pointer hover:bg-slate-100 transition whitespace-nowrap"
              >
                <div className="flex items-center justify-end gap-1">
                  Pipeline Value
                  <ArrowUpDown className="h-3 w-3 text-slate-400" />
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-medium">
            {filteredAndSorted.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-6 py-8 text-center text-slate-400">
                  No sales representatives found.
                </td>
              </tr>
            ) : (
              filteredAndSorted.map((rep) => {
                return (
                  <tr
                    key={rep.salesmanId}
                    className="hover:bg-slate-50/70 transition"
                  >
                    {/* Representative Info */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="h-7 w-7 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs uppercase shrink-0">
                          {rep.salesmanName.substring(0, 2)}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900">{rep.salesmanName}</div>
                          <div className="text-[10px] text-slate-400">{rep.email}</div>
                        </div>
                      </div>
                    </td>

                    {/* Total Leads */}
                    <td className="px-3 py-3 text-center font-bold text-slate-900">
                      {rep.totalLeads}
                    </td>

                    {/* Active */}
                    <td className="px-3 py-3 text-center">
                      <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-bold">
                        {rep.activeLeads}
                      </span>
                    </td>

                    {/* Hot */}
                    <td className="px-3 py-3 text-center">
                      {rep.hotLeads > 0 ? (
                        <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-700 font-bold">
                          {rep.hotLeads}
                        </span>
                      ) : (
                        <span className="text-slate-400">0</span>
                      )}
                    </td>

                    {/* Won */}
                    <td className="px-3 py-3 text-center">
                      <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold">
                        {rep.wonLeads}
                      </span>
                    </td>

                    {/* Lost */}
                    <td className="px-3 py-3 text-center text-slate-500">
                      {rep.lostLeads}
                    </td>

                    {/* Conversion Rate */}
                    <td className="px-3 py-3 text-center">
                      <span
                        className={`font-bold ${
                          rep.conversionRate >= 30
                            ? 'text-emerald-600'
                            : rep.conversionRate > 0
                            ? 'text-indigo-600'
                            : 'text-slate-400'
                        }`}
                      >
                        {rep.conversionRateDisplay}
                      </span>
                    </td>

                    {/* Activities */}
                    <td className="px-3 py-3 text-center font-semibold text-purple-700">
                      {rep.totalActivities}
                    </td>

                    {/* Completed FUs */}
                    <td className="px-3 py-3 text-center font-semibold text-emerald-700">
                      {rep.completedFollowups}
                    </td>

                    {/* Overdue FUs */}
                    <td className="px-3 py-3 text-center">
                      {rep.overdueFollowups > 0 ? (
                        <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 font-bold">
                          {rep.overdueFollowups}
                        </span>
                      ) : (
                        <span className="text-slate-400">0</span>
                      )}
                    </td>

                    {/* Pipeline Value */}
                    <td className="px-4 py-3 text-right font-bold text-slate-900">
                      {formatCurrency(rep.pipelineValue)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
