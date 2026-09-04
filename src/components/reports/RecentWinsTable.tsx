import React from 'react';
import { Award, DollarSign, Calendar, User, ExternalLink, Building2 } from 'lucide-react';
import { RecentWinRecord } from '../../types/reports';
import { formatCurrency } from '../../utils/reportUtils';

interface RecentWinsTableProps {
  recentWins: RecentWinRecord[];
  isAdmin: boolean;
  onSelectLead?: (leadId: string) => void;
}

export const RecentWinsTable: React.FC<RecentWinsTableProps> = ({
  recentWins,
  isAdmin,
  onSelectLead,
}) => {
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden space-y-3">
      <div className="p-5 border-b border-slate-100 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Award className="h-4.5 w-4.5 text-emerald-600" />
            <h3 className="text-sm font-bold text-slate-900">Recent Won Deals &amp; Trophies</h3>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Recently closed revenue milestones and completed contracts
          </p>
        </div>
        <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md">
          {recentWins.length} Won Deals
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
              <th className="px-4 py-3">Company / Client</th>
              <th className="px-3 py-3">Contact Person</th>
              {isAdmin && <th className="px-3 py-3">Closing Salesman</th>}
              <th className="px-3 py-3">Lead Type</th>
              <th className="px-3 py-3">Won Date</th>
              <th className="px-4 py-3 text-right">Contract Value</th>
              {onSelectLead && <th className="px-3 py-3 text-right">Action</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-medium">
            {recentWins.length === 0 ? (
              <tr>
                <td
                  colSpan={isAdmin ? (onSelectLead ? 7 : 6) : onSelectLead ? 6 : 5}
                  className="px-6 py-8 text-center text-slate-400"
                >
                  No closed won deals recorded yet.
                </td>
              </tr>
            ) : (
              recentWins.map((win) => {
                return (
                  <tr
                    key={win.leadId}
                    className="hover:bg-slate-50/70 transition"
                  >
                    {/* Company */}
                    <td className="px-4 py-3 font-bold text-slate-900">
                      <div className="flex items-center gap-2">
                        <div className="p-1 rounded bg-emerald-100 text-emerald-700">
                          <Building2 className="h-3.5 w-3.5" />
                        </div>
                        <span>{win.companyName}</span>
                      </div>
                    </td>

                    {/* Contact Person */}
                    <td className="px-3 py-3 text-slate-600">
                      {win.contactPerson || '—'}
                    </td>

                    {/* Salesman */}
                    {isAdmin && (
                      <td className="px-3 py-3">
                        <span className="font-semibold text-slate-800">
                          {win.salesmanName}
                        </span>
                      </td>
                    )}

                    {/* Lead Type */}
                    <td className="px-3 py-3">
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium">
                        {win.leadType || 'Direct'}
                      </span>
                    </td>

                    {/* Won Date */}
                    <td className="px-3 py-3 text-slate-600">
                      {win.wonDateDisplay}
                    </td>

                    {/* Contract Value */}
                    <td className="px-4 py-3 text-right font-bold text-emerald-700">
                      {formatCurrency(win.estimatedValue)}
                    </td>

                    {/* Action */}
                    {onSelectLead && (
                      <td className="px-3 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => onSelectLead(win.leadId)}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 transition cursor-pointer"
                        >
                          View Deal
                          <ExternalLink className="h-3 w-3" />
                        </button>
                      </td>
                    )}
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
