import React from 'react';
import {
  AlertTriangle,
  AlertOctagon,
  Flame,
  UserX,
  Clock,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react';
import { AttentionRiskItem } from '../../types/reports';

interface AttentionRiskAnalysisProps {
  risks: AttentionRiskItem[];
  onSelectLead?: (leadId: string) => void;
  onOpenLeadsView?: () => void;
}

export const AttentionRiskAnalysis: React.FC<AttentionRiskAnalysisProps> = ({
  risks,
  onSelectLead,
  onOpenLeadsView,
}) => {
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-xs p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4.5 w-4.5 text-rose-600" />
            <h3 className="text-sm font-bold text-slate-900">Pipeline Risk &amp; Attention Radar</h3>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time detection of overdue tasks, unassigned prospects, and hot leads at risk of going cold
          </p>
        </div>
        <div className="text-xs font-semibold text-slate-500">
          Identified items:{' '}
          <span className={`font-bold ${risks.length > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
            {risks.length}
          </span>
        </div>
      </div>

      {risks.length === 0 ? (
        <div className="py-8 text-center flex flex-col items-center justify-center space-y-2">
          <div className="h-10 w-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div className="text-xs font-bold text-slate-800">Clean Operational Health</div>
          <p className="text-[11px] text-slate-400 max-w-sm">
            No overdue tasks or neglected hot leads detected. Your pipeline hygiene is in great condition.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {risks.map((item) => {
            const isHigh = item.severity === 'high';
            const isHot = item.category === 'hot_without_followup';
            const isUnassigned = item.category === 'unassigned';

            return (
              <div
                key={item.id}
                className={`p-3.5 rounded-lg border flex flex-col justify-between space-y-2 transition ${
                  isHigh
                    ? 'border-rose-200 bg-rose-50/40 hover:bg-rose-50/70'
                    : 'border-amber-200 bg-amber-50/40 hover:bg-amber-50/70'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-1.5">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                        isHigh ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {isHot ? '🔥 Hot Lead Risk' : isUnassigned ? 'Unassigned Lead' : 'Overdue Task'}
                    </span>
                    {item.salesmanName && (
                      <span className="text-[10px] font-semibold text-slate-500">
                        {item.salesmanName}
                      </span>
                    )}
                  </div>

                  <h4 className="text-xs font-bold text-slate-900 line-clamp-1">{item.title}</h4>
                  <p className="text-[11px] text-slate-600 leading-relaxed line-clamp-2">
                    {item.description}
                  </p>
                </div>

                {item.leadId && onSelectLead ? (
                  <button
                    type="button"
                    onClick={() => onSelectLead(item.leadId!)}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 transition cursor-pointer self-end pt-1"
                  >
                    Open Lead
                    <ArrowRight className="h-3 w-3" />
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
