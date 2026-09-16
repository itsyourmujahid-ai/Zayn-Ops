import React, { useMemo } from 'react';
import {
  ArrowRightLeft,
  Users,
  Building2,
  Clock,
  ExternalLink,
  MessageSquare,
  ShieldAlert,
  ArrowRight,
  Send,
  UserCheck,
} from 'lucide-react';
import {
  LeadTransferRecord,
  ClientTransferRecord,
  LeadActivityRecord,
  UserProfile,
} from '../../types/database';
import { NavigationView } from '../../types/crm';

interface TransferIntelligenceWidgetProps {
  leadTransfers: LeadTransferRecord[];
  clientTransfers: ClientTransferRecord[];
  activities: LeadActivityRecord[];
  salesmen: UserProfile[];
  onSelectView: (view: NavigationView, options?: any) => void;
}

export const TransferIntelligenceWidget: React.FC<TransferIntelligenceWidgetProps> = ({
  leadTransfers,
  clientTransfers,
  activities,
  salesmen,
  onSelectView,
}) => {
  const totalLeadTransfers = leadTransfers.length;
  const totalClientTransfers = clientTransfers.length;
  const totalCRMActivities = activities.length;

  // Calculate most transferred salesmen (who was either from_user or to_user)
  const transferFrequency = useMemo(() => {
    const repMap = new Map<
      string,
      { name: string; sent: number; received: number; total: number }
    >();

    const addTransfer = (fromId?: string, fromName?: string, toId?: string, toName?: string) => {
      if (fromId) {
        if (!repMap.has(fromId)) {
          repMap.set(fromId, {
            name: fromName || salesmen.find((s) => s.id === fromId)?.full_name || 'Rep',
            sent: 0,
            received: 0,
            total: 0,
          });
        }
        const r = repMap.get(fromId)!;
        r.sent += 1;
        r.total += 1;
      }

      if (toId) {
        if (!repMap.has(toId)) {
          repMap.set(toId, {
            name: toName || salesmen.find((s) => s.id === toId)?.full_name || 'Rep',
            sent: 0,
            received: 0,
            total: 0,
          });
        }
        const r = repMap.get(toId)!;
        r.received += 1;
        r.total += 1;
      }
    };

    leadTransfers.forEach((lt) => {
      addTransfer(lt.from_user_id || lt.previous_owner, lt.from_user_name || lt.previous_owner_name, lt.to_user_id, lt.to_user_name);
    });

    clientTransfers.forEach((ct) => {
      addTransfer(ct.from_user_id || ct.previous_owner, ct.from_user_name || ct.previous_owner_name, ct.to_user_id, ct.to_user_name);
    });

    return Array.from(repMap.values()).sort((a, b) => b.total - a.total).slice(0, 4);
  }, [leadTransfers, clientTransfers, salesmen]);

  // Combine and sort recent transfers (top 5)
  const recentTransfers = useMemo(() => {
    const combined: Array<{
      id: string;
      type: 'Lead' | 'Client';
      name: string;
      fromName: string;
      toName: string;
      timestamp: string;
      reason?: string;
    }> = [];

    leadTransfers.forEach((lt) => {
      combined.push({
        id: lt.id,
        type: 'Lead',
        name: (lt as any).lead_name || 'Lead Account',
        fromName: lt.from_user_name || lt.previous_owner_name || 'Previous Rep',
        toName: lt.to_user_name || 'New Rep',
        timestamp: lt.transferred_at || lt.timestamp || '',
        reason: lt.reason,
      });
    });

    clientTransfers.forEach((ct) => {
      combined.push({
        id: ct.id,
        type: 'Client',
        name: ct.client_name || 'Client Account',
        fromName: ct.from_user_name || ct.previous_owner_name || 'Previous Rep',
        toName: ct.to_user_name || 'New Rep',
        timestamp: ct.transferred_at || ct.timestamp || '',
        reason: ct.reason,
      });
    });

    return combined
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 5);
  }, [leadTransfers, clientTransfers]);

  return (
    <div id="transfer-intelligence-widget" className="rounded-2xl border border-slate-200 bg-white shadow-xs p-5 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <ArrowRightLeft className="h-4 w-4 text-indigo-600" />
            <h3 className="text-sm font-bold text-slate-900">
              Transfer Intelligence &amp; Reassignment Flow
            </h3>
            <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
              {totalLeadTransfers + totalClientTransfers} Total Reassignments
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Audit trails for account reassignments, territorial changes, and representative handovers
          </p>
        </div>

        <button
          type="button"
          onClick={() => onSelectView('communication-hub')}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-indigo-600 text-xs font-bold transition shadow-2xs cursor-pointer"
        >
          <MessageSquare className="h-3.5 w-3.5" />
          <span>Communication Hub</span>
        </button>
      </div>

      {/* KPI Counters */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-3.5 rounded-xl border border-blue-100 bg-blue-50/50">
          <span className="text-[11px] font-bold text-blue-800 uppercase tracking-wider">
            Lead Transfers
          </span>
          <div className="text-2xl font-black text-blue-900 mt-1">
            {totalLeadTransfers}
          </div>
          <span className="text-[10px] text-blue-600">Reassigned leads</span>
        </div>

        <div className="p-3.5 rounded-xl border border-teal-100 bg-teal-50/50">
          <span className="text-[11px] font-bold text-teal-800 uppercase tracking-wider">
            Client Transfers
          </span>
          <div className="text-2xl font-black text-teal-900 mt-1">
            {totalClientTransfers}
          </div>
          <span className="text-[10px] text-teal-600">Account ownership transfers</span>
        </div>

        <div className="p-3.5 rounded-xl border border-purple-100 bg-purple-50/50">
          <span className="text-[11px] font-bold text-purple-800 uppercase tracking-wider">
            Internal CRM Events
          </span>
          <div className="text-2xl font-black text-purple-900 mt-1">
            {totalCRMActivities}
          </div>
          <span className="text-[10px] text-purple-600">Activities &amp; communications</span>
        </div>
      </div>

      {/* Two Columns: Most Transferred Reps & Recent Transfers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-1">
        {/* Most Transferred Reps */}
        <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2.5">
          <div className="text-xs font-bold text-slate-800 flex items-center justify-between">
            <span>Most Active Reassignment Reps:</span>
            <Users className="h-3.5 w-3.5 text-slate-400" />
          </div>

          {transferFrequency.length === 0 ? (
            <p className="text-xs text-slate-400 py-3 text-center">
              No account reassignments recorded yet.
            </p>
          ) : (
            <div className="space-y-2">
              {transferFrequency.map((item) => (
                <div
                  key={item.name}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-white border border-slate-200 text-xs"
                >
                  <span className="font-bold text-slate-900">{item.name}</span>
                  <div className="flex items-center gap-3 text-[11px]">
                    <span className="text-amber-700">Sent: <strong>{item.sent}</strong></span>
                    <span className="text-emerald-700">Received: <strong>{item.received}</strong></span>
                    <span className="font-black text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
                      {item.total} total
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Transfers Log */}
        <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2.5">
          <div className="text-xs font-bold text-slate-800 flex items-center justify-between">
            <span>Recent Ownership Transfers:</span>
            <button
              type="button"
              onClick={() => onSelectView('communication-hub')}
              className="text-[11px] text-indigo-600 hover:underline font-bold"
            >
              Full Log →
            </button>
          </div>

          {recentTransfers.length === 0 ? (
            <p className="text-xs text-slate-400 py-3 text-center">
              No transfers logged yet in the system.
            </p>
          ) : (
            <div className="space-y-2">
              {recentTransfers.map((t) => (
                <div
                  key={t.id}
                  className="p-2.5 rounded-lg bg-white border border-slate-200 text-xs space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 flex items-center gap-1.5">
                      <span
                        className={`px-1.5 py-0.2 rounded-sm text-[9px] font-bold ${
                          t.type === 'Lead'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-teal-100 text-teal-700'
                        }`}
                      >
                        {t.type}
                      </span>
                      <span>{t.name}</span>
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {t.timestamp ? new Date(t.timestamp).toLocaleDateString() : ''}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-slate-600">
                    <span className="text-slate-500">{t.fromName}</span>
                    <ArrowRight className="h-3 w-3 text-slate-400" />
                    <span className="font-semibold text-slate-800">{t.toName}</span>
                  </div>
                  {t.reason && (
                    <p className="text-[10px] text-slate-400 italic truncate">
                      "{t.reason}"
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
