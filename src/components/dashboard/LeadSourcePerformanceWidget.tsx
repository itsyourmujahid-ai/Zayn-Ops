import React, { useMemo } from 'react';
import {
  Share2,
  Trophy,
  XCircle,
  Percent,
  ArrowRight,
  TrendingUp,
  Globe,
  Facebook,
  PhoneCall,
  UserCheck,
  Building,
} from 'lucide-react';
import { LeadRecord } from '../../types/database';
import { NavigationView } from '../../types/crm';

interface LeadSourcePerformanceWidgetProps {
  leads: LeadRecord[];
  onSelectView: (view: NavigationView, options?: any) => void;
}

export const LeadSourcePerformanceWidget: React.FC<LeadSourcePerformanceWidgetProps> = ({
  leads,
  onSelectView,
}) => {
  // Aggregate leads by source
  const sourceMetrics = useMemo(() => {
    const map = new Map<
      string,
      { source: string; total: number; won: number; lost: number; active: number }
    >();

    leads.forEach((lead) => {
      const srcRaw = lead.source || (lead as any).lead_source || 'Direct / Unspecified';
      const src = typeof srcRaw === 'string' && srcRaw.trim() ? srcRaw.trim() : 'Direct / Unspecified';

      if (!map.has(src)) {
        map.set(src, { source: src, total: 0, won: 0, lost: 0, active: 0 });
      }

      const item = map.get(src)!;
      item.total += 1;

      const statusLower = (lead.status || '').toLowerCase();
      if (statusLower === 'won') {
        item.won += 1;
      } else if (statusLower === 'lost') {
        item.lost += 1;
      } else {
        item.active += 1;
      }
    });

    const list = Array.from(map.values()).map((item) => {
      const closedTotal = item.won + item.lost;
      const conversionRateClosed =
        closedTotal > 0 ? Math.round((item.won / closedTotal) * 100) : 0;
      const conversionRateTotal =
        item.total > 0 ? Math.round((item.won / item.total) * 100) : 0;

      return {
        ...item,
        closedTotal,
        conversionRateClosed,
        conversionRateTotal,
      };
    });

    // Sort descending by total leads
    return list.sort((a, b) => b.total - a.total);
  }, [leads]);

  const maxLeads = Math.max(1, ...sourceMetrics.map((s) => s.total));

  return (
    <div id="lead-source-performance-widget" className="rounded-2xl border border-slate-200 bg-white shadow-xs p-5 space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <Share2 className="h-4 w-4 text-indigo-600" />
            <h3 className="text-sm font-bold text-slate-900">
              Lead Source Performance
            </h3>
            <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
              {sourceMetrics.length} Acquisition Channels
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Conversion rates and win distribution across marketing and referral channels
          </p>
        </div>
      </div>

      {sourceMetrics.length === 0 ? (
        <div className="py-8 text-center text-slate-400 text-xs">
          No lead source records available in this period.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-4">Channel / Source</th>
                <th className="py-3 px-3 text-center">Total Leads</th>
                <th className="py-3 px-3 text-center">Won Deals</th>
                <th className="py-3 px-3 text-center">Lost</th>
                <th className="py-3 px-4 text-center">Conversion Rate</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sourceMetrics.map((sm) => (
                <tr
                  key={sm.source}
                  id={`lead-source-row-${sm.source.toLowerCase().replace(/\s+/g, '-')}`}
                  className="hover:bg-slate-50/80 transition"
                >
                  {/* Source Name & Visual Bar */}
                  <td className="py-3.5 px-4">
                    <div className="font-bold text-slate-900 text-xs">{sm.source}</div>
                    <div className="mt-1 h-1.5 w-36 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-indigo-500"
                        style={{ width: `${Math.round((sm.total / maxLeads) * 100)}%` }}
                      />
                    </div>
                  </td>

                  {/* Total Leads */}
                  <td className="py-3.5 px-3 text-center">
                    <span className="font-black text-slate-800 bg-slate-100 px-2.5 py-0.5 rounded-full text-xs">
                      {sm.total}
                    </span>
                  </td>

                  {/* Won */}
                  <td className="py-3.5 px-3 text-center">
                    <span className="font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full text-xs">
                      {sm.won}
                    </span>
                  </td>

                  {/* Lost */}
                  <td className="py-3.5 px-3 text-center">
                    <span className="font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full text-xs">
                      {sm.lost}
                    </span>
                  </td>

                  {/* Conversion Rate */}
                  <td className="py-3.5 px-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <span className="font-black text-teal-800 text-xs">
                        {sm.conversionRateClosed}%
                      </span>
                      <span className="text-[10px] text-slate-400">
                        ({sm.won}/{sm.closedTotal || sm.total})
                      </span>
                    </div>
                  </td>

                  {/* Action */}
                  <td className="py-3.5 px-4 text-right">
                    <button
                      type="button"
                      onClick={() => onSelectView('leads')}
                      className="text-indigo-600 font-bold hover:underline inline-flex items-center gap-1 text-xs"
                    >
                      <span>Filter Leads</span>
                      <ArrowRight className="h-3 w-3" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
