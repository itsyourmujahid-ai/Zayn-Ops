import React, { useState, useRef } from 'react';
import {
  Phone,
  MessageSquare,
  Mail,
  Users,
  MapPin,
  StickyNote,
  Send,
  Loader2,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  CalendarPlus,
  ChevronDown,
  Sparkles,
} from 'lucide-react';
import {
  CommunicationType,
  COMMUNICATION_OUTCOMES,
} from '../../types/communication';
import { CreateActivityInput, FollowUpActionType } from '../../types/database';
import { useAuth } from '../../context/AuthContext';

interface CommunicationComposerProps {
  leadId?: string;
  clientId?: string;
  entityType?: 'Lead' | 'Client';
  companyName: string;
  contactPerson?: string;
  defaultSalesmanId: string;
  initialType?: CommunicationType;
  onActivitySaved?: (activityId?: string) => void;
  onRequestScheduleFollowup?: () => void;
  onSubmit: (input: CreateActivityInput) => Promise<void>;
}

const TYPE_CONFIG: Record<
  CommunicationType,
  {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    accentColor: string;
    btnColor: string;
    badgeColor: string;
  }
> = {
  Call: {
    label: 'Phone Call',
    icon: Phone,
    accentColor: 'border-indigo-500 text-indigo-700 bg-indigo-50/70',
    btnColor: 'bg-indigo-600 hover:bg-indigo-700 text-white',
    badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  },
  WhatsApp: {
    label: 'WhatsApp',
    icon: MessageSquare,
    accentColor: 'border-emerald-500 text-emerald-700 bg-emerald-50/70',
    btnColor: 'bg-emerald-600 hover:bg-emerald-700 text-white',
    badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  Email: {
    label: 'Email',
    icon: Mail,
    accentColor: 'border-blue-500 text-blue-700 bg-blue-50/70',
    btnColor: 'bg-blue-600 hover:bg-blue-700 text-white',
    badgeColor: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  Meeting: {
    label: 'Meeting',
    icon: Users,
    accentColor: 'border-purple-500 text-purple-700 bg-purple-50/70',
    btnColor: 'bg-purple-600 hover:bg-purple-700 text-white',
    badgeColor: 'bg-purple-50 text-purple-700 border-purple-200',
  },
  'Site Visit': {
    label: 'Site Visit',
    icon: MapPin,
    accentColor: 'border-rose-500 text-rose-700 bg-rose-50/70',
    btnColor: 'bg-rose-600 hover:bg-rose-700 text-white',
    badgeColor: 'bg-rose-50 text-rose-700 border-rose-200',
  },
  Note: {
    label: 'Internal Note',
    icon: StickyNote,
    accentColor: 'border-slate-500 text-slate-700 bg-slate-100',
    btnColor: 'bg-slate-800 hover:bg-slate-900 text-white',
    badgeColor: 'bg-slate-100 text-slate-700 border-slate-200',
  },
};

export const CommunicationComposer: React.FC<CommunicationComposerProps> = ({
  leadId,
  clientId,
  entityType,
  companyName,
  contactPerson,
  defaultSalesmanId,
  initialType = 'Call',
  onActivitySaved,
  onRequestScheduleFollowup,
  onSubmit,
}) => {
  const { userProfile, currentUser } = useAuth();

  const [communicationType, setCommunicationType] = useState<CommunicationType>(initialType);
  const [outcome, setOutcome] = useState<string>(
    COMMUNICATION_OUTCOMES[initialType]?.[0] || 'Connected'
  );

  // Dynamic Type-Specific Fields
  const [notes, setNotes] = useState<string>('');
  const [whatsappContext, setWhatsappContext] = useState<string>('');
  const [emailSubject, setEmailSubject] = useState<string>('');
  const [meetingDateTime, setMeetingDateTime] = useState<string>('');

  // Inline Follow-up Checkbox
  const [scheduleFollowupInline, setScheduleFollowupInline] = useState<boolean>(false);
  const [followupAction, setFollowupAction] = useState<FollowUpActionType>('Call');
  const [followupDate, setFollowupDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 2);
    return d.toISOString().split('T')[0];
  });
  const [followupTime, setFollowupTime] = useState<string>('10:00');

  // UI Feedback States
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);
  const [showSmartFollowupSuggestion, setShowSmartFollowupSuggestion] = useState<boolean>(false);

  // Duplicate submission protection cooldown
  const lastSubmitTimeRef = useRef<number>(0);

  const handleTypeSelect = (type: CommunicationType) => {
    setCommunicationType(type);
    const outcomes = COMMUNICATION_OUTCOMES[type];
    if (outcomes && outcomes.length > 0) {
      setOutcome(outcomes[0]);
    } else {
      setOutcome('');
    }
    setError(null);
  };

  const handleReset = () => {
    setNotes('');
    setWhatsappContext('');
    setEmailSubject('');
    setMeetingDateTime('');
    setScheduleFollowupInline(false);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // 1. Validation Checks: Either leadId or clientId must be present
    if (!leadId && !clientId) {
      setError('Target lead or client is required to save communication activity.');
      return;
    }

    const trimmedNotes = notes.trim();
    if (communicationType === 'Note' && !trimmedNotes) {
      setError('Please write note content before saving.');
      return;
    }

    if (communicationType === 'Email' && !emailSubject.trim() && !trimmedNotes) {
      setError('Please provide an email subject or meeting/email notes.');
      return;
    }

    if (!trimmedNotes && !whatsappContext.trim() && communicationType !== 'Note') {
      setError('Please provide notes or outcome summary for this communication.');
      return;
    }

    // 2. Duplicate submission prevention (2.5s debounce + submitting state)
    const now = Date.now();
    if (submitting || now - lastSubmitTimeRef.current < 2500) {
      return;
    }
    lastSubmitTimeRef.current = now;

    // 3. User info
    const performerId = userProfile?.id || currentUser?.uid || '';
    const performerName =
      userProfile?.full_name || currentUser?.displayName || currentUser?.email?.split('@')[0] || 'Sales Rep';

    // 4. Construct Activity Payload
    let fullDescription = trimmedNotes;
    const metadataPayload: Record<string, any> = {
      communication_source: 'communication_center_composer',
      company_name: companyName,
      client_id: clientId,
    };

    if (communicationType === 'WhatsApp') {
      if (whatsappContext.trim()) {
        metadataPayload.message_context = whatsappContext.trim();
        fullDescription = `[WhatsApp: ${outcome}] "${whatsappContext.trim()}" — ${trimmedNotes}`;
      } else {
        fullDescription = `[WhatsApp: ${outcome}] ${trimmedNotes}`;
      }
    } else if (communicationType === 'Email') {
      if (emailSubject.trim()) {
        metadataPayload.email_subject = emailSubject.trim();
        fullDescription = `[Email: ${emailSubject.trim()}] (${outcome}) — ${trimmedNotes}`;
      } else {
        fullDescription = `[Email: ${outcome}] ${trimmedNotes}`;
      }
    } else if (communicationType === 'Meeting') {
      if (meetingDateTime) {
        metadataPayload.meeting_datetime = meetingDateTime;
      }
      fullDescription = `[Meeting Result: ${outcome}] ${trimmedNotes}`;
    } else if (communicationType === 'Site Visit') {
      fullDescription = `[Site Visit: ${outcome}] ${trimmedNotes}`;
    } else if (communicationType === 'Call') {
      fullDescription = `[Call: ${outcome}] ${trimmedNotes}`;
    }

    // Follow-up payload if checked inline
    let nextFollowupPayload: { action_type: string; scheduled_at: string } | undefined = undefined;
    if (scheduleFollowupInline && followupDate) {
      const combinedDateTime = new Date(`${followupDate}T${followupTime || '10:00'}:00`).toISOString();
      nextFollowupPayload = {
        action_type: followupAction,
        scheduled_at: combinedDateTime,
      };
    }

    const nowIso = new Date().toISOString();

    const activityInput: CreateActivityInput = {
      lead_id: leadId || undefined,
      client_id: clientId || undefined,
      client_name: clientId ? companyName : undefined,
      company_name: companyName,
      contact_person: contactPerson,
      activity_type: communicationType,
      outcome: outcome || '',
      description: fullDescription || `${communicationType} interaction recorded (${outcome || 'Completed'}).`,
      notes: trimmedNotes,
      activity_date: nowIso,
      activity_at: nowIso,
      performed_by: performerId,
      performed_by_name: performerName,
      is_system_activity: false,
      metadata: metadataPayload,
      next_followup: nextFollowupPayload,
    };

    try {
      setSubmitting(true);
      await onSubmit(activityInput);

      // Handle Success
      const typeLabel = TYPE_CONFIG[communicationType]?.label || communicationType;
      setSuccessBanner(`${typeLabel} logged successfully! Activity updated on Timeline.`);

      if (!scheduleFollowupInline) {
        // Show Smart Follow-up Suggestion
        setShowSmartFollowupSuggestion(true);
      } else {
        setShowSmartFollowupSuggestion(false);
      }

      handleReset();
      if (onActivitySaved) {
        onActivitySaved();
      }

      // Auto-dismiss banner after 6 seconds
      setTimeout(() => {
        setSuccessBanner(null);
      }, 6000);
    } catch (err: any) {
      console.error('Error in CommunicationComposer:', err);
      setError(err?.message || 'Failed to save communication activity. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const currentTypeConfig = TYPE_CONFIG[communicationType] || TYPE_CONFIG.Call;
  const CurrentIcon = currentTypeConfig.icon;

  return (
    <div
      id="communication-composer-card"
      className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs space-y-4"
    >
      {/* Header with Type Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3.5">
        <div className="flex items-center gap-2.5">
          <div className={`p-2 rounded-xl border ${currentTypeConfig.accentColor}`}>
            <CurrentIcon className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <span>Log Communication Activity</span>
              <span className="text-[10px] font-semibold text-slate-400 font-normal">
                (Saves directly to Timeline)
              </span>
            </h3>
            <p className="text-xs text-slate-500">
              Manual interaction composer for {contactPerson ? `${contactPerson} at ` : ''}{companyName}
            </p>
          </div>
        </div>

        {/* Action Type Pills */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
          {(['Call', 'WhatsApp', 'Email', 'Meeting', 'Site Visit', 'Note'] as CommunicationType[]).map((t) => {
            const isSelected = communicationType === t;
            const config = TYPE_CONFIG[t];
            const Icon = config.icon;
            return (
              <button
                key={t}
                type="button"
                id={`composer-type-btn-${t.toLowerCase().replace(/\s+/g, '-')}`}
                onClick={() => handleTypeSelect(t)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                  isSelected
                    ? `${config.btnColor} shadow-2xs`
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{t}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Success Banner */}
      {successBanner && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-800 flex items-center justify-between animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span className="font-semibold">{successBanner}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessBanner(null)}
            className="text-xs font-bold text-emerald-700 hover:underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Smart Follow-up Suggestion Banner (Section 7) */}
      {showSmartFollowupSuggestion && (
        <div className="rounded-xl bg-amber-50/90 border border-amber-200/90 p-3.5 text-xs text-amber-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-amber-100 rounded-lg text-amber-800 shrink-0">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <p className="font-bold text-amber-900">Need another follow-up for this lead?</p>
              <p className="text-[11px] text-amber-700">
                Keep the deal momentum going by setting your next touchpoint reminder.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              type="button"
              onClick={() => setShowSmartFollowupSuggestion(false)}
              className="px-2.5 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-100/60 rounded-md transition cursor-pointer"
            >
              No, thanks
            </button>
            {onRequestScheduleFollowup && (
              <button
                type="button"
                id="composer-smart-followup-schedule-btn"
                onClick={() => {
                  setShowSmartFollowupSuggestion(false);
                  onRequestScheduleFollowup();
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold bg-amber-800 text-white rounded-lg hover:bg-amber-900 shadow-2xs transition cursor-pointer"
              >
                <CalendarPlus className="h-3.5 w-3.5" />
                <span>Yes, schedule follow-up</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-800 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Form Fields */}
      <form onSubmit={handleSubmit} className="space-y-3.5">
        {/* Row 1: Outcome & Context Fields (Depending on type) */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          {/* Outcome Dropdown (For Call, WhatsApp, Email, Meeting, Site Visit) */}
          {communicationType !== 'Note' && (
            <div className="sm:col-span-4">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                {communicationType === 'Meeting' || communicationType === 'Site Visit'
                  ? 'Result / Outcome'
                  : 'Outcome / Response'}
              </label>
              <select
                id="composer-outcome-select"
                value={outcome}
                onChange={(e) => setOutcome(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-slate-50/50 py-2 px-3 text-xs font-semibold text-slate-800 shadow-2xs focus:border-indigo-600 focus:bg-white focus:outline-none cursor-pointer"
              >
                {COMMUNICATION_OUTCOMES[communicationType]?.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* WhatsApp Specific: Message / Context */}
          {communicationType === 'WhatsApp' && (
            <div className="sm:col-span-8">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                Message Context / Sent Summary
              </label>
              <input
                type="text"
                id="composer-whatsapp-context"
                value={whatsappContext}
                onChange={(e) => setWhatsappContext(e.target.value)}
                placeholder="e.g. Sent PDF catalog and pricing estimate for commercial tower"
                className="w-full rounded-xl border border-slate-300 bg-white py-2 px-3 text-xs text-slate-800 placeholder-slate-400 focus:border-emerald-600 focus:outline-none"
              />
            </div>
          )}

          {/* Email Specific: Subject */}
          {communicationType === 'Email' && (
            <div className="sm:col-span-8">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                Email Subject
              </label>
              <input
                type="text"
                id="composer-email-subject"
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                placeholder="e.g. Formal Quotation #QT-2026-042 - Granite Tiles"
                className="w-full rounded-xl border border-slate-300 bg-white py-2 px-3 text-xs text-slate-800 placeholder-slate-400 focus:border-blue-600 focus:outline-none"
              />
            </div>
          )}

          {/* Meeting Specific: Date & Time (Optional) */}
          {communicationType === 'Meeting' && (
            <div className="sm:col-span-8">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                Meeting Date &amp; Time (Optional)
              </label>
              <input
                type="datetime-local"
                id="composer-meeting-datetime"
                value={meetingDateTime}
                onChange={(e) => setMeetingDateTime(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white py-2 px-3 text-xs text-slate-800 focus:border-purple-600 focus:outline-none"
              />
            </div>
          )}
        </div>

        {/* Row 2: Notes / Details */}
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
            {communicationType === 'Note'
              ? 'Note Content'
              : `${communicationType} Interaction Notes & Key Details`}
          </label>
          <textarea
            id="composer-notes-textarea"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={
              communicationType === 'Call'
                ? 'Discussed requirements, customer requested follow-up next Monday with revised scope...'
                : communicationType === 'WhatsApp'
                ? 'Client confirmed receipt of drawings, will review with engineering team tonight...'
                : communicationType === 'Email'
                ? 'Email delivered to procurement team. Waiting for signed copy of agreement...'
                : communicationType === 'Meeting'
                ? 'Met at client office. Reviewed site blueprints and confirmed budget ceiling...'
                : communicationType === 'Site Visit'
                ? 'Inspected foundation ready state. Measurements matched structural drawings...'
                : 'Enter internal lead remarks, stakeholder preferences, or project updates...'
            }
            className="w-full rounded-xl border border-slate-300 bg-white p-3 text-xs text-slate-800 placeholder-slate-400 focus:border-indigo-600 focus:outline-none leading-relaxed"
          />
        </div>

        {/* Row 3: Inline Follow-up Option (Section 6 & 7) */}
        <div className="pt-2 border-t border-slate-100 space-y-3">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-semibold text-slate-700">
              <input
                type="checkbox"
                id="composer-schedule-followup-checkbox"
                checked={scheduleFollowupInline}
                onChange={(e) => setScheduleFollowupInline(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
              />
              <span className="flex items-center gap-1.5">
                <CalendarPlus className="h-3.5 w-3.5 text-indigo-600" />
                <span>Schedule Next Follow-up with this log</span>
              </span>
            </label>

            {scheduleFollowupInline && (
              <span className="text-[10px] text-indigo-600 font-semibold bg-indigo-50 px-2 py-0.5 rounded-full">
                Assigned to Responsible Salesman
              </span>
            )}
          </div>

          {/* Inline Follow-up Fields if toggled */}
          {scheduleFollowupInline && (
            <div className="p-3 bg-indigo-50/40 rounded-xl border border-indigo-100 grid grid-cols-1 sm:grid-cols-3 gap-3 animate-in fade-in duration-150">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Action Type
                </label>
                <select
                  id="composer-followup-action"
                  value={followupAction}
                  onChange={(e) => setFollowupAction(e.target.value as FollowUpActionType)}
                  className="w-full rounded-lg border border-slate-300 bg-white py-1.5 px-2.5 text-xs font-semibold text-slate-800 focus:outline-none cursor-pointer"
                >
                  <option value="Call">Phone Call</option>
                  <option value="WhatsApp">WhatsApp</option>
                  <option value="Email">Email</option>
                  <option value="Meeting">Meeting</option>
                  <option value="Site Visit">Site Visit</option>
                  <option value="Quotation Follow-up">Quotation Follow-up</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Scheduled Date
                </label>
                <input
                  type="date"
                  id="composer-followup-date"
                  value={followupDate}
                  onChange={(e) => setFollowupDate(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white py-1.5 px-2.5 text-xs text-slate-800 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Scheduled Time
                </label>
                <input
                  type="time"
                  id="composer-followup-time"
                  value={followupTime}
                  onChange={(e) => setFollowupTime(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white py-1.5 px-2.5 text-xs text-slate-800 focus:outline-none"
                />
              </div>
            </div>
          )}
        </div>

        {/* Row 4: Submit Buttons */}
        <div className="flex items-center justify-between pt-1">
          <button
            type="button"
            onClick={handleReset}
            disabled={submitting}
            className="text-xs font-medium text-slate-500 hover:text-slate-700 hover:underline cursor-pointer disabled:opacity-50"
          >
            Clear Fields
          </button>

          <div className="flex items-center gap-2">
            <button
              type="submit"
              id="composer-save-activity-btn"
              disabled={submitting}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold shadow-xs transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${currentTypeConfig.btnColor}`}
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Saving Activity...</span>
                </>
              ) : (
                <>
                  <Send className="h-3.5 w-3.5" />
                  <span>Save {communicationType} Activity</span>
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
