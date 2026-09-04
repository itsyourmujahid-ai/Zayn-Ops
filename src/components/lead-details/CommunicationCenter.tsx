import React, { useMemo, useState } from 'react';
import {
  Phone,
  MessageSquare,
  Mail,
  Users,
  MapPin,
  StickyNote,
  Clock,
  Calendar,
  CalendarPlus,
  User,
  ArrowUpRight,
  Sparkles,
  Info,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react';
import {
  LeadRecord,
  ClientRecord,
  LeadActivityRecord,
  FollowUpRecord,
  CreateActivityInput,
} from '../../types/database';
import {
  CommunicationType,
  CommunicationSummaryData,
  LastContactInfo,
  NextActionInfo,
} from '../../types/communication';
import { CommunicationComposer } from './CommunicationComposer';
import { CommunicationHistoryList } from './CommunicationHistoryList';

interface CommunicationCenterProps {
  lead?: LeadRecord;
  client?: ClientRecord;
  activities: LeadActivityRecord[];
  followups: FollowUpRecord[];
  loadingActivities?: boolean;
  onLogActivity: (input: CreateActivityInput) => Promise<void>;
  onOpenScheduleFollowUp: (initialAction?: string) => void;
  hasAccess: boolean;
}

export const CommunicationCenter: React.FC<CommunicationCenterProps> = ({
  lead,
  client,
  activities,
  followups,
  loadingActivities = false,
  onLogActivity,
  onOpenScheduleFollowUp,
  hasAccess,
}) => {
  const [selectedComposerType, setSelectedComposerType] = useState<CommunicationType>('Call');

  const effectiveId = client ? client.source_lead_id : (lead?.id || '');
  const companyName = client?.company_name || lead?.company_name || '';
  const contactPerson = client?.contact_person || lead?.contact_person || '';
  const phone = client?.phone || lead?.phone || '';
  const whatsapp = client?.whatsapp || lead?.whatsapp || '';
  const email = client?.email || lead?.email || '';
  const assignedTo = client?.owner_id || lead?.assigned_to || '';

  // 1. Calculate Real Communication Summary (Section 10)
  const summary: CommunicationSummaryData = useMemo(() => {
    let callsCount = 0;
    let whatsappCount = 0;
    let emailsCount = 0;
    let meetingsCount = 0;
    let siteVisitsCount = 0;
    let notesCount = 0;

    activities.forEach((a) => {
      switch (a.activity_type) {
        case 'Call':
          callsCount++;
          break;
        case 'WhatsApp':
          whatsappCount++;
          break;
        case 'Email':
          emailsCount++;
          break;
        case 'Meeting':
          meetingsCount++;
          break;
        case 'Site Visit':
          siteVisitsCount++;
          break;
        case 'Note':
          notesCount++;
          break;
      }
    });

    return {
      callsCount,
      whatsappCount,
      emailsCount,
      meetingsCount,
      siteVisitsCount,
      notesCount,
      totalCommunications:
        callsCount + whatsappCount + emailsCount + meetingsCount + siteVisitsCount + notesCount,
    };
  }, [activities]);

  // 2. Determine Last Contact Information (Section 11)
  // Determined from the latest relevant communication Activity (Call, WhatsApp, Email, Meeting, Site Visit)
  const lastContactInfo: LastContactInfo | null = useMemo(() => {
    const relevantTypes: CommunicationType[] = ['Call', 'WhatsApp', 'Email', 'Meeting', 'Site Visit'];
    const contactActs = activities
      .filter((a) => relevantTypes.includes(a.activity_type as CommunicationType) && !a.is_system_activity)
      .sort((a, b) => {
        const timeA = new Date(a.activity_date || a.activity_at || a.created_at).getTime();
        const timeB = new Date(b.activity_date || b.activity_at || b.created_at).getTime();
        return timeB - timeA;
      });

    if (contactActs.length === 0) return null;
    const latest = contactActs[0];
    return {
      date: latest.activity_date || latest.activity_at || latest.created_at,
      type: latest.activity_type as CommunicationType,
      performedBy: latest.performed_by_name || 'Sales Rep',
      outcome: latest.outcome,
      notes: latest.notes || latest.description,
    };
  }, [activities]);

  // 3. Determine Next Action (Section 12)
  // Uses existing real follow-up records
  const nextActionInfo: NextActionInfo = useMemo(() => {
    const pendingFollowUps = followups
      .filter((f) => f.status === 'pending')
      .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());

    if (pendingFollowUps.length === 0) {
      return { isPending: false };
    }

    const nearest = pendingFollowUps[0];
    return {
      isPending: true,
      action: nearest.action,
      scheduledAt: nearest.scheduled_at,
      assignedToName: nearest.assigned_to_name,
    };
  }, [followups]);

  // Format Helper for timestamps
  const formatTimestamp = (isoString?: string) => {
    if (!isoString) return 'N/A';
    try {
      const date = new Date(isoString);
      if (isNaN(date.getTime())) return 'N/A';

      const now = new Date();
      const isToday =
        date.getDate() === now.getDate() &&
        date.getMonth() === now.getMonth() &&
        date.getFullYear() === now.getFullYear();

      const tomorrow = new Date(now);
      tomorrow.setDate(now.getDate() + 1);
      const isTomorrow =
        date.getDate() === tomorrow.getDate() &&
        date.getMonth() === tomorrow.getMonth() &&
        date.getFullYear() === tomorrow.getFullYear();

      const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      if (isToday) return `Today · ${timeStr}`;
      if (isTomorrow) return `Tomorrow · ${timeStr}`;
      return `${date.toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' })} · ${timeStr}`;
    } catch {
      return 'N/A';
    }
  };

  // Quick Action Launchers (Section 3)
  const cleanPhone = (phone || whatsapp || '').replace(/[^0-9+]/g, '');
  const cleanWhatsapp = (whatsapp || phone || '').replace(/[^0-9]/g, '');

  const handleQuickCall = () => {
    setSelectedComposerType('Call');
    if (cleanPhone) {
      window.open(`tel:${cleanPhone}`, '_self');
    }
  };

  const handleQuickWhatsApp = () => {
    setSelectedComposerType('WhatsApp');
    if (cleanWhatsapp) {
      window.open(`https://wa.me/${cleanWhatsapp}`, '_blank');
    }
  };

  const handleQuickEmail = () => {
    setSelectedComposerType('Email');
    if (email) {
      window.open(`mailto:${email}`, '_self');
    }
  };

  return (
    <div id="sales-communication-center" className="space-y-6">
      {/* SECTION 1: TOP INSIGHTS & SUMMARY STRIP */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        {/* Card A: Activity Summary Counts (Section 10) */}
        <div className="md:col-span-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 mb-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <span>Communication Summary</span>
            </h4>
            <span className="text-[11px] font-semibold text-slate-400">
              {summary.totalCommunications} total touches
            </span>
          </div>

          {/* 5 Compact Metric Cells */}
          <div className="grid grid-cols-5 gap-2 text-center">
            <div className="rounded-xl bg-indigo-50/70 border border-indigo-100/60 p-2">
              <Phone className="h-3.5 w-3.5 text-indigo-600 mx-auto mb-1" />
              <div className="text-sm font-black text-indigo-900">{summary.callsCount}</div>
              <div className="text-[10px] font-semibold text-indigo-700">Calls</div>
            </div>

            <div className="rounded-xl bg-emerald-50/70 border border-emerald-100/60 p-2">
              <MessageSquare className="h-3.5 w-3.5 text-emerald-600 mx-auto mb-1" />
              <div className="text-sm font-black text-emerald-900">{summary.whatsappCount}</div>
              <div className="text-[10px] font-semibold text-emerald-700">WhatsApp</div>
            </div>

            <div className="rounded-xl bg-blue-50/70 border border-blue-100/60 p-2">
              <Mail className="h-3.5 w-3.5 text-blue-600 mx-auto mb-1" />
              <div className="text-sm font-black text-blue-900">{summary.emailsCount}</div>
              <div className="text-[10px] font-semibold text-blue-700">Emails</div>
            </div>

            <div className="rounded-xl bg-purple-50/70 border border-purple-100/60 p-2">
              <Users className="h-3.5 w-3.5 text-purple-600 mx-auto mb-1" />
              <div className="text-sm font-black text-purple-900">{summary.meetingsCount}</div>
              <div className="text-[10px] font-semibold text-purple-700">Meetings</div>
            </div>

            <div className="rounded-xl bg-rose-50/70 border border-rose-100/60 p-2">
              <MapPin className="h-3.5 w-3.5 text-rose-600 mx-auto mb-1" />
              <div className="text-sm font-black text-rose-900">{summary.siteVisitsCount}</div>
              <div className="text-[10px] font-semibold text-rose-700">Visits</div>
            </div>
          </div>
        </div>

        {/* Card B: Last Contacted & Next Action (Section 11 & 12) */}
        <div className="md:col-span-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Last Contact Info */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs flex flex-col justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Last Contacted
              </span>
              {lastContactInfo ? (
                <div>
                  <div className="text-xs font-bold text-slate-900">
                    {formatTimestamp(lastContactInfo.date)}
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 text-[10px] font-bold">
                      {lastContactInfo.type}
                    </span>
                    {lastContactInfo.outcome && (
                      <span className="px-1.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700 text-[10px] font-semibold">
                        {lastContactInfo.outcome}
                      </span>
                    )}
                  </div>
                  <div className="mt-2 text-[11px] text-slate-500 flex items-center gap-1">
                    <User className="h-3 w-3 text-slate-400" />
                    <span>by <strong className="text-slate-700 font-semibold">{lastContactInfo.performedBy}</strong></span>
                  </div>
                </div>
              ) : (
                <div className="py-2">
                  <div className="text-xs font-semibold text-slate-400 italic">
                    No communication logged yet
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Log your first call or message using the composer below.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Next Action Info (Section 12) */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Next Action
                </span>
                {hasAccess && (
                  <button
                    type="button"
                    onClick={() => onOpenScheduleFollowUp()}
                    className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer hover:underline"
                  >
                    + Schedule
                  </button>
                )}
              </div>

              {nextActionInfo.isPending ? (
                <div>
                  <div className="text-xs font-bold text-indigo-900 flex items-center gap-1.5">
                    <CalendarPlus className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
                    <span>{nextActionInfo.action}</span>
                  </div>
                  <div className="mt-1 text-xs font-semibold text-slate-700">
                    {formatTimestamp(nextActionInfo.scheduledAt)}
                  </div>
                  {nextActionInfo.assignedToName && (
                    <div className="mt-2 text-[11px] text-slate-500 flex items-center gap-1">
                      <User className="h-3 w-3 text-slate-400" />
                      <span>assigned to <strong className="text-slate-700 font-semibold">{nextActionInfo.assignedToName}</strong></span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="py-2">
                  <div className="text-xs font-semibold text-slate-500">
                    No upcoming follow-up
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Keep deals active by scheduling regular follow-ups.
                  </p>
                  {hasAccess && (
                    <button
                      type="button"
                      onClick={() => onOpenScheduleFollowUp()}
                      className="mt-2 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition cursor-pointer"
                    >
                      <CalendarPlus className="h-3 w-3" />
                      <span>Schedule Follow-up</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 2: QUICK CONTACT BAR (Section 3) */}
      <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
        <div>
          <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
            <span>Quick Contact Launchers</span>
          </h4>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Opens your device dialer, WhatsApp Web, or Email client. Remember to log your notes below!
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Quick Call */}
          <button
            type="button"
            id="quick-action-call-btn"
            onClick={handleQuickCall}
            disabled={!cleanPhone}
            title={cleanPhone ? `Dial ${cleanPhone}` : 'No phone number available'}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-white hover:bg-indigo-50 text-indigo-700 border border-slate-200 hover:border-indigo-300 shadow-2xs transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Phone className="h-3.5 w-3.5 text-indigo-600" />
            <span>Call</span>
            <ExternalLink className="h-3 w-3 text-slate-400" />
          </button>

          {/* Quick WhatsApp */}
          <button
            type="button"
            id="quick-action-whatsapp-btn"
            onClick={handleQuickWhatsApp}
            disabled={!cleanWhatsapp}
            title={cleanWhatsapp ? `Message on WhatsApp` : 'No WhatsApp number available'}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-white hover:bg-emerald-50 text-emerald-700 border border-slate-200 hover:border-emerald-300 shadow-2xs transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <MessageSquare className="h-3.5 w-3.5 text-emerald-600" />
            <span>WhatsApp</span>
            <ExternalLink className="h-3 w-3 text-slate-400" />
          </button>

          {/* Quick Email */}
          <button
            type="button"
            id="quick-action-email-btn"
            onClick={handleQuickEmail}
            disabled={!email}
            title={email ? `Send Email to ${email}` : 'No email address available'}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-white hover:bg-blue-50 text-blue-700 border border-slate-200 hover:border-blue-300 shadow-2xs transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Mail className="h-3.5 w-3.5 text-blue-600" />
            <span>Email</span>
            <ExternalLink className="h-3 w-3 text-slate-400" />
          </button>
        </div>
      </div>

      {/* SECTION 3: COMMUNICATION COMPOSER (Section 2, 6, 7) */}
      {hasAccess ? (
        <CommunicationComposer
          leadId={effectiveId}
          companyName={companyName}
          contactPerson={contactPerson}
          defaultSalesmanId={assignedTo}
          initialType={selectedComposerType}
          onSubmit={onLogActivity}
          onRequestScheduleFollowup={() => onOpenScheduleFollowUp()}
        />
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-center">
          <p className="text-xs text-slate-500">
            You have view-only access to this record. Only the assigned representative or administrator can log new interactions.
          </p>
        </div>
      )}

      {/* SECTION 4: CHRONOLOGICAL COMMUNICATION HISTORY (Section 4 & 5) */}
      <div className="pt-2">
        <CommunicationHistoryList
          activities={activities}
          loading={loadingActivities}
          onScheduleFollowUp={hasAccess ? (action) => onOpenScheduleFollowUp(action) : undefined}
        />
      </div>
    </div>
  );
};
