import React, { useState } from 'react';
import {
  Clock,
  CheckCircle2,
  AlertCircle,
  Calendar,
  RotateCcw,
  XCircle,
  Activity,
  Phone,
  MessageCircle,
  Mail,
  Users,
  MapPin,
  FileText,
  Bookmark,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';
import {
  FollowUpRecord,
  LeadActivityRecord,
  UserProfile,
  ActivityType,
} from '../../types/database';
import { NavigationView } from '../../types/crm';

interface FollowupActivityPerformanceWidgetProps {
  followups: FollowUpRecord[];
  activities: LeadActivityRecord[];
  salesmen: UserProfile[];
  onSelectView: (view: NavigationView, options?: any) => void;
}

export const FollowupActivityPerformanceWidget: React.FC<FollowupActivityPerformanceWidgetProps> = ({
  followups,
  activities,
  salesmen,
  onSelectView,
}) => {
  const [activeTab, setActiveTab] = useState<'followups' | 'activities'>('followups');

  // Follow-up calculations
  const pendingFollowups = followups.filter((f) => f.status === 'pending');
  const completedFollowups = followups.filter((f) => f.status === 'completed');
  const cancelledFollowups = followups.filter((f) => f.status === 'cancelled');
  const rescheduledFollowups = followups.filter((f) => (f as any).status === 'rescheduled');

  const overdueFollowups = followups.filter((f) => {
    if (f.status !== 'pending') return false;
    const dueTime = new Date(`${f.scheduled_date}T${f.scheduled_time || '23:59:00'}`).getTime();
    return !isNaN(dueTime) && dueTime < Date.now();
  });

  // Breakdown follow-ups by salesman
  const followupSalesmanRows = salesmen.map((salesman) => {
    const sId = salesman.id;
    const sEmail = (salesman.email || '').toLowerCase();
    const sNameLower = (salesman.full_name || '').toLowerCase();

    const repFollowups = followups.filter((f) => {
      return (
        f.assigned_to === sId ||
        f.assigned_to === `uid-${sNameLower}` ||
        f.created_by === sId ||
        (f.assigned_to && f.assigned_to.toLowerCase() === sEmail)
      );
    });

    const pending = repFollowups.filter((f) => f.status === 'pending').length;
    const completed = repFollowups.filter((f) => f.status === 'completed').length;
    const overdue = repFollowups.filter((f) => {
      if (f.status !== 'pending') return false;
      const dueTime = new Date(`${f.scheduled_date}T${f.scheduled_time || '23:59:00'}`).getTime();
      return !isNaN(dueTime) && dueTime < Date.now();
    }).length;

    return {
      salesman,
      pending,
      completed,
      overdue,
      total: repFollowups.length,
    };
  });

  // Activity calculations
  const countActivities = (typeStr: string) => {
    return activities.filter((a) => (a.activity_type || '').toLowerCase() === typeStr.toLowerCase()).length;
  };

  const callsCount = countActivities('call');
  const whatsappCount = countActivities('whatsapp');
  const emailsCount = countActivities('email');
  const meetingsCount = countActivities('meeting');
  const siteVisitsCount = countActivities('site_visit') + countActivities('site-visit');
  const quotationsCount = countActivities('quotation') + countActivities('quote');
  const notesCount = countActivities('note');
  const otherCount = activities.filter((a) => {
    const t = (a.activity_type || '').toLowerCase();
    return !['call', 'whatsapp', 'email', 'meeting', 'site_visit', 'site-visit', 'quotation', 'quote', 'note'].includes(t);
  }).length;

  // Breakdown activities by salesman
  const activitySalesmanRows = salesmen.map((salesman) => {
    const sId = salesman.id;
    const sEmail = (salesman.email || '').toLowerCase();

    const repActivities = activities.filter((a) => {
      return a.created_by === sId || (a as any).salesman_id === sId;
    });

    const calls = repActivities.filter((a) => (a.activity_type || '').toLowerCase() === 'call').length;
    const whatsapp = repActivities.filter((a) => (a.activity_type || '').toLowerCase() === 'whatsapp').length;
    const emails = repActivities.filter((a) => (a.activity_type || '').toLowerCase() === 'email').length;
    const meetings = repActivities.filter((a) => (a.activity_type || '').toLowerCase() === 'meeting').length;
    const siteVisits = repActivities.filter((a) => ['site_visit', 'site-visit'].includes((a.activity_type || '').toLowerCase())).length;
    const quotations = repActivities.filter((a) => ['quotation', 'quote'].includes((a.activity_type || '').toLowerCase())).length;

    return {
      salesman,
      total: repActivities.length,
      calls,
      whatsapp,
      emails,
      meetings,
      siteVisits,
      quotations,
    };
  });

  return (
    <div id="followup-activity-performance-widget" className="rounded-2xl border border-slate-200 bg-white shadow-xs p-5 space-y-4">
      {/* Widget Tabs Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-indigo-600" />
            <h3 className="text-sm font-bold text-slate-900">
              Operational Velocity: Follow-ups &amp; Activities
            </h3>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Monitor interaction frequency, overdue response times, and sales rep engagement
          </p>
        </div>

        {/* Tab Toggle */}
        <div className="inline-flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold">
          <button
            type="button"
            id="tab-followup-perf-btn"
            onClick={() => setActiveTab('followups')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
              activeTab === 'followups'
                ? 'bg-white text-indigo-700 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Follow-up Performance
          </button>
          <button
            type="button"
            id="tab-activity-perf-btn"
            onClick={() => setActiveTab('activities')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
              activeTab === 'activities'
                ? 'bg-white text-indigo-700 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Activity Volume
          </button>
        </div>
      </div>

      {/* Tab 1: Follow-up Performance */}
      {activeTab === 'followups' && (
        <div className="space-y-4">
          {/* Status Metrics Ribbon */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
            <button
              type="button"
              onClick={() => onSelectView('followups', { followupTab: 'pending' })}
              className="p-3 rounded-xl border border-amber-200 bg-amber-50/50 hover:bg-amber-100/50 transition text-left cursor-pointer"
            >
              <span className="text-[11px] font-bold text-amber-800 uppercase">Pending</span>
              <div className="text-xl font-black text-amber-900 mt-0.5">
                {pendingFollowups.length}
              </div>
              <span className="text-[10px] text-amber-700">Awaiting action →</span>
            </button>

            <button
              type="button"
              onClick={() => onSelectView('followups', { followupTab: 'completed' })}
              className="p-3 rounded-xl border border-emerald-200 bg-emerald-50/50 hover:bg-emerald-100/50 transition text-left cursor-pointer"
            >
              <span className="text-[11px] font-bold text-emerald-800 uppercase">Completed</span>
              <div className="text-xl font-black text-emerald-900 mt-0.5">
                {completedFollowups.length}
              </div>
              <span className="text-[10px] text-emerald-700">Executed tasks →</span>
            </button>

            <button
              type="button"
              onClick={() => onSelectView('followups', { followupTab: 'overdue' })}
              className="p-3 rounded-xl border border-rose-200 bg-rose-50/60 hover:bg-rose-100/60 transition text-left cursor-pointer"
            >
              <span className="text-[11px] font-bold text-rose-900 uppercase">Overdue</span>
              <div className="text-xl font-black text-rose-700 mt-0.5">
                {overdueFollowups.length}
              </div>
              <span className="text-[10px] text-rose-600">Needs urgency →</span>
            </button>

            <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 text-left">
              <span className="text-[11px] font-bold text-slate-600 uppercase">Rescheduled</span>
              <div className="text-xl font-black text-slate-800 mt-0.5">
                {rescheduledFollowups.length}
              </div>
              <span className="text-[10px] text-slate-500">Date updated</span>
            </div>

            <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 text-left">
              <span className="text-[11px] font-bold text-slate-500 uppercase">Cancelled</span>
              <div className="text-xl font-black text-slate-700 mt-0.5">
                {cancelledFollowups.length}
              </div>
              <span className="text-[10px] text-slate-400">Closed out</span>
            </div>
          </div>

          {/* Follow-up Breakdown By Salesman */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-2.5 px-4">Salesman</th>
                  <th className="py-2.5 px-3 text-center">Pending</th>
                  <th className="py-2.5 px-3 text-center">Completed</th>
                  <th className="py-2.5 px-3 text-center">Overdue</th>
                  <th className="py-2.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {followupSalesmanRows.map((r) => (
                  <tr key={r.salesman.id} className="hover:bg-slate-50 transition">
                    <td className="py-3 px-4 font-bold text-slate-900">
                      {r.salesman.full_name}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <button
                        type="button"
                        onClick={() => onSelectView('followups', { followupTab: 'pending' })}
                        className="font-bold text-amber-800 bg-amber-50 px-2.5 py-0.5 rounded-full hover:bg-amber-100"
                      >
                        {r.pending}
                      </button>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <button
                        type="button"
                        onClick={() => onSelectView('followups', { followupTab: 'completed' })}
                        className="font-bold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full hover:bg-emerald-100"
                      >
                        {r.completed}
                      </button>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <button
                        type="button"
                        onClick={() => onSelectView('followups', { followupTab: 'overdue' })}
                        className={`font-bold px-2.5 py-0.5 rounded-full ${
                          r.overdue > 0
                            ? 'text-rose-800 bg-rose-100 hover:bg-rose-200'
                            : 'text-slate-400 bg-slate-100'
                        }`}
                      >
                        {r.overdue}
                      </button>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => onSelectView('followups')}
                        className="text-indigo-600 font-bold hover:underline"
                      >
                        View Follow-ups →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Activity Performance */}
      {activeTab === 'activities' && (
        <div className="space-y-4">
          {/* Activity Category Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
            <div className="p-3 rounded-xl border border-slate-200 bg-white text-center shadow-2xs">
              <Phone className="h-4 w-4 text-blue-600 mx-auto mb-1" />
              <div className="text-base font-black text-slate-900">{callsCount}</div>
              <span className="text-[10px] font-bold text-slate-500 uppercase">Calls</span>
            </div>

            <div className="p-3 rounded-xl border border-slate-200 bg-white text-center shadow-2xs">
              <MessageCircle className="h-4 w-4 text-emerald-600 mx-auto mb-1" />
              <div className="text-base font-black text-slate-900">{whatsappCount}</div>
              <span className="text-[10px] font-bold text-slate-500 uppercase">WhatsApp</span>
            </div>

            <div className="p-3 rounded-xl border border-slate-200 bg-white text-center shadow-2xs">
              <Mail className="h-4 w-4 text-indigo-600 mx-auto mb-1" />
              <div className="text-base font-black text-slate-900">{emailsCount}</div>
              <span className="text-[10px] font-bold text-slate-500 uppercase">Emails</span>
            </div>

            <div className="p-3 rounded-xl border border-slate-200 bg-white text-center shadow-2xs">
              <Users className="h-4 w-4 text-purple-600 mx-auto mb-1" />
              <div className="text-base font-black text-slate-900">{meetingsCount}</div>
              <span className="text-[10px] font-bold text-slate-500 uppercase">Meetings</span>
            </div>

            <div className="p-3 rounded-xl border border-slate-200 bg-white text-center shadow-2xs">
              <MapPin className="h-4 w-4 text-teal-600 mx-auto mb-1" />
              <div className="text-base font-black text-slate-900">{siteVisitsCount}</div>
              <span className="text-[10px] font-bold text-slate-500 uppercase">Site Visits</span>
            </div>

            <div className="p-3 rounded-xl border border-slate-200 bg-white text-center shadow-2xs">
              <FileText className="h-4 w-4 text-amber-600 mx-auto mb-1" />
              <div className="text-base font-black text-slate-900">{quotationsCount}</div>
              <span className="text-[10px] font-bold text-slate-500 uppercase">Quotations</span>
            </div>

            <div className="p-3 rounded-xl border border-slate-200 bg-white text-center shadow-2xs">
              <Bookmark className="h-4 w-4 text-slate-600 mx-auto mb-1" />
              <div className="text-base font-black text-slate-900">{notesCount}</div>
              <span className="text-[10px] font-bold text-slate-500 uppercase">Notes</span>
            </div>

            <div className="p-3 rounded-xl border border-slate-200 bg-white text-center shadow-2xs">
              <Activity className="h-4 w-4 text-slate-400 mx-auto mb-1" />
              <div className="text-base font-black text-slate-700">{otherCount}</div>
              <span className="text-[10px] font-bold text-slate-400 uppercase">Other</span>
            </div>
          </div>

          {/* Activity Breakdown By Salesman */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-2.5 px-4">Salesman</th>
                  <th className="py-2.5 px-2 text-center">Total</th>
                  <th className="py-2.5 px-2 text-center">Calls</th>
                  <th className="py-2.5 px-2 text-center">WhatsApp</th>
                  <th className="py-2.5 px-2 text-center">Emails</th>
                  <th className="py-2.5 px-2 text-center">Meetings</th>
                  <th className="py-2.5 px-2 text-center">Quotes</th>
                  <th className="py-2.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {activitySalesmanRows.map((r) => (
                  <tr key={r.salesman.id} className="hover:bg-slate-50 transition">
                    <td className="py-3 px-4 font-bold text-slate-900">
                      {r.salesman.full_name}
                    </td>
                    <td className="py-3 px-2 text-center font-black text-indigo-700">
                      {r.total}
                    </td>
                    <td className="py-3 px-2 text-center text-slate-700">{r.calls}</td>
                    <td className="py-3 px-2 text-center text-slate-700">{r.whatsapp}</td>
                    <td className="py-3 px-2 text-center text-slate-700">{r.emails}</td>
                    <td className="py-3 px-2 text-center text-slate-700">{r.meetings}</td>
                    <td className="py-3 px-2 text-center text-slate-700">{r.quotations}</td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => onSelectView('communication-hub')}
                        className="text-indigo-600 font-bold hover:underline"
                      >
                        Activity Log →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
