import React, { useState } from 'react';
import { Layers, Compass, Building, Percent, DollarSign, ArrowUpRight } from 'lucide-react';
import { DimensionBreakdown } from '../../types/reports';
import { formatCurrency } from '../../utils/reportUtils';

interface LeadSourceAndTypeChartsProps {
  sourceBreakdown: DimensionBreakdown[];
  typeBreakdown: DimensionBreakdown[];
}

export const LeadSourceAndTypeCharts: React.FC<LeadSourceAndTypeChartsProps> = ({
  sourceBreakdown,
  typeBreakdown,
}) => {
  const [activeTab, setActiveTab] = useState<'source' | 'type'>('source');

  const currentList = activeTab === 'source' ? sourceBreakdown : typeBreakdown;

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-xs p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <Compass className="h-4.5 w-4.5 text-indigo-600" />
            <h3 className="text-sm font-bold text-slate-900">Lead Source &amp; Client Type Analytics</h3>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Identify your highest converting lead acquisition channels and corporate customer archetypes
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
          <button
            type="button"
            onClick={() => setActiveTab('source')}
            className={`px-3 py-1 rounded-md text-xs font-semibold transition cursor-pointer ${
              activeTab === 'source'
                ? 'bg-white text-indigo-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Lead Sources ({sourceBreakdown.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('type')}
            className={`px-3 py-1 rounded-md text-xs font-semibold transition cursor-pointer ${
              activeTab === 'type'
                ? 'bg-white text-indigo-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Lead Types ({typeBreakdown.length})
          </button>
        </div>
      </div>

      {/* Table & Visualization */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
              <th className="px-4 py-3">{activeTab === 'source' ? 'Acquisition Channel / Source' : 'Industry / Client Type'}</th>
              <th className="px-3 py-3 text-center">Total Volume</th>
              <th className="px-3 py-3 text-center">Share %</th>
              <th className="px-3 py-3 text-center">Active</th>
              <th className="px-3 py-3 text-center">Won</th>
              <th className="px-3 py-3 text-center">Lost</th>
              <th className="px-3 py-3 text-center">Win Rate %</th>
              <th className="px-4 py-3 text-right">Estimated Value</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-medium">
            {currentList.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-6 py-8 text-center text-slate-400">
                  No data available for this dimension in the selected period.
                </td>
              </tr>
            ) : (
              currentList.map((item) => {
                return (
                  <tr key={item.name} className="hover:bg-slate-50/70 transition">
                    <td className="px-4 py-3 font-bold text-slate-900 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0" />
                      {item.name}
                    </td>
                    <td className="px-3 py-3 text-center font-bold text-slate-800">
                      {item.totalLeads}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <div className="w-12 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-indigo-500 rounded-full"
                            style={{ width: `${Math.min(100, item.percentageOfTotal)}%` }}
                          />
                        </div>
                        <span className="text-[11px] font-semibold text-slate-500">
                          {item.percentageOfTotal}%
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-semibold">
                        {item.activeLeads}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-semibold">
                        {item.wonLeads}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-center text-slate-500">
                      {item.lostLeads}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span
                        className={`font-bold ${
                          item.conversionRate >= 30
                            ? 'text-emerald-600'
                            : item.conversionRate > 0
                            ? 'text-indigo-600'
                            : 'text-slate-400'
                        }`}
                      >
                        {item.conversionRateDisplay}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-slate-900">
                      {formatCurrency(item.estimatedValue)}
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
