import React, { useState, useEffect } from 'react';
import {
  X,
  Phone,
  MessageSquare,
  Mail,
  Users,
  FileText,
  StickyNote,
  MapPin,
  Clock,
  Calendar,
  User,
  Plus,
  Loader2,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import { ActivityType, CreateActivityInput } from '../../types/database';
import { useAuth } from '../../context/AuthContext';

interface LogActivityModalProps {
  isOpen: boolean;
  onClose: () => void;
  leadId: string;
  companyName: string;
  initialType?: ActivityType;
  onSubmit: (input: CreateActivityInput) => Promise<void>;
}

const ACTIVITY_OUTCOMES: Record<string, string[]> = {
  Call: ['Connected', 'No Answer', 'Busy', 'Call Back Later', 'Wrong Number', 'Other'],
  WhatsApp: ['Sent', 'Replied', 'Interested', 'No Reply', 'Not Interested', 'Other'],
  Email: ['Sent', 'Replied', 'No Reply', 'Interested', 'Not Interested', 'Other'],
  Meeting: ['Successful', 'Interested', 'Follow-up Required', 'No Show', 'Not Interested', 'Other'],
  'Site Visit': ['Successful', 'Requirement Confirmed', 'Follow-up Required', 'No Contact', 'Not Interested', 'Other'],
  Note: ['General Note', 'Internal Remark', 'Project Update', 'Requirement Note'],
  Quotation: ['Quotation Sent', 'Quotation Discussed', 'Revision Requested', 'Accepted', 'Rejected', 'Under Review'],
  Other: ['Completed', 'Follow-up Needed', 'Requirement Received', 'Other'],
};

export const LogActivityModal: React.FC<LogActivityModalProps> = ({
  isOpen,
  onClose,
  leadId,
  companyName,
  initialType = 'Call',
  onSubmit,
}) => {
  const { userProfile, currentUser } = useAuth();
  const [activityType, setActivityType] = useState<ActivityType>(initialType);
  const [outcome, setOutcome] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [activityDate, setActivityDate] = useState<string>('');
  const [activityTime, setActivityTime] = useState<string>('');
  
  // Follow-up scheduling
  const [scheduleFollowup, setScheduleFollowup] = useState<boolean>(false);
  const [followupDate, setFollowupDate] = useState<string>('');
  const [followupTime, setFollowupTime] = useState<string>('10:00');
  const [followupAction, setFollowupAction] = useState<string>('Call');

  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize date & time whenever modal opens
  useEffect(() => {
    if (isOpen) {
      const now = new Date();
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const dd = String(now.getDate()).padStart(2, '0');
      const hh = String(now.getHours()).padStart(2, '0');
      const min = String(now.getMinutes()).padStart(2, '0');

      setActivityType(initialType);
      const defaultOutcomes = ACTIVITY_OUTCOMES[initialType] || ACTIVITY_OUTCOMES.Other;
      setOutcome(defaultOutcomes[0] || '');
      setNotes('');
      setActivityDate(`${yyyy}-${mm}-${dd}`);
      setActivityTime(`${hh}:${min}`);
      setScheduleFollowup(false);
      
      // Default follow-up date (3 days later)
      const nextDate = new Date();
      nextDate.setDate(nextDate.getDate() + 3);
      const nextYyyy = nextDate.getFullYear();
      const nextMm = String(nextDate.getMonth() + 1).padStart(2, '0');
      const nextDd = String(nextDate.getDate()).padStart(2, '0');
      setFollowupDate(`${nextYyyy}-${nextMm}-${nextDd}`);
      setFollowupTime('10:00');
      setFollowupAction('Call');
      setError(null);
    }
  }, [isOpen, initialType]);

  // Update default outcome when activity type changes
  const handleTypeChange = (newType: ActivityType) => {
    setActivityType(newType);
    const outcomes = ACTIVITY_OUTCOMES[newType] || ACTIVITY_OUTCOMES.Other;
    setOutcome(outcomes[0] || '');
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!activityType) {
      setError('Please select an activity type.');
      return;
    }

    // Check date time validity
    let activityTimestamp = new Date().toISOString();
    if (activityDate && activityTime) {
      const enteredDate = new Date(`${activityDate}T${activityTime}:00`);
      if (isNaN(enteredDate.getTime())) {
        setError('Please enter a valid activity date and time.');
        return;
      }

      // Check for future timestamps on completed activity
      const maxFutureTolerance = new Date().getTime() + 5 * 60 * 1000; // 5 mins tolerance
      if (enteredDate.getTime() > maxFutureTolerance) {
        setError('Activity timestamp cannot be set in the future. For future appointments, schedule a follow-up below.');
        return;
      }
      activityTimestamp = enteredDate.toISOString();
    }

    let nextFollowupData: { action_type: string; scheduled_at: string } | undefined = undefined;
    if (scheduleFollowup) {
      if (!followupDate) {
        setError('Please select a date for the scheduled follow-up.');
        return;
      }
      const fuDateTime = new Date(`${followupDate}T${followupTime || '09:00'}:00`);
      if (isNaN(fuDateTime.getTime())) {
        setError('Please provide a valid follow-up date and time.');
        return;
      }
      nextFollowupData = {
        action_type: followupAction,
        scheduled_at: fuDateTime.toISOString(),
      };
    }

    const performerId = userProfile?.id || currentUser?.uid || '';
    const performerName = userProfile?.full_name || currentUser?.displayName || currentUser?.email?.split('@')[0] || 'Sales Rep';

    try {
      setSubmitting(true);
      await onSubmit({
        lead_id: leadId,
        activity_type: activityType,
        outcome: outcome || '',
        description: notes.trim() || `${activityType} interaction recorded (${outcome || 'Completed'}).`,
        notes: notes.trim(),
        activity_date: activityTimestamp,
        activity_at: activityTimestamp,
        performed_by: performerId,
        performed_by_name: performerName,
        is_system_activity: false,
        next_followup: nextFollowupData,
      });
      onClose();
    } catch (err: any) {
      console.error('Failed to log activity:', err);
      setError(err?.message || 'Failed to save activity log. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const activityTypeButtons: { type: ActivityType; label: string; icon: React.ReactNode; color: string }[] = [
    { type: 'Call', label: 'Call', icon: <Phone className="h-4 w-4" />, color: 'hover:border-indigo-500 hover:text-indigo-600' },
    { type: 'WhatsApp', label: 'WhatsApp', icon: <MessageSquare className="h-4 w-4" />, color: 'hover:border-emerald-500 hover:text-emerald-600' },
    { type: 'Email', label: 'Email', icon: <Mail className="h-4 w-4" />, color: 'hover:border-blue-500 hover:text-blue-600' },
    { type: 'Meeting', label: 'Meeting', icon: <Users className="h-4 w-4" />, color: 'hover:border-purple-500 hover:text-purple-600' },
    { type: 'Quotation', label: 'Quotation', icon: <FileText className="h-4 w-4" />, color: 'hover:border-amber-500 hover:text-amber-600' },
    { type: 'Site Visit', label: 'Site Visit', icon: <MapPin className="h-4 w-4" />, color: 'hover:border-rose-500 hover:text-rose-600' },
    { type: 'Note', label: 'Note', icon: <StickyNote className="h-4 w-4" />, color: 'hover:border-slate-500 hover:text-slate-600' },
    { type: 'Other', label: 'Other', icon: <HelpCircle className="h-4 w-4" />, color: 'hover:border-slate-500 hover:text-slate-600' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-3 sm:p-4 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/80 px-5 py-4">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <span>Log Lead Activity</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5 truncate max-w-sm">
              Account: <strong className="text-slate-700">{companyName}</strong>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          {error && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* 1. Activity Type Selector Grid */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
              Activity Type <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-4 gap-2">
              {activityTypeButtons.map((btn) => {
                const isSelected = activityType === btn.type;
                return (
                  <button
                    key={btn.type}
                    type="button"
                    onClick={() => handleTypeChange(btn.type)}
                    className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-xs font-semibold transition cursor-pointer ${
                      isSelected
                        ? 'border-indigo-600 bg-indigo-50/90 text-indigo-700 shadow-xs ring-1 ring-indigo-600'
                        : `border-slate-200 bg-white text-slate-700 ${btn.color} hover:bg-slate-50`
                    }`}
                  >
                    <span className="mb-1">{btn.icon}</span>
                    <span className="text-[11px] truncate w-full text-center">{btn.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Outcome / Result Dropdown */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
              Interaction Result / Outcome <span className="text-rose-500">*</span>
            </label>
            <select
              id="activity-outcome-select"
              value={outcome}
              onChange={(e) => setOutcome(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white py-2 px-3 text-xs sm:text-sm font-medium text-slate-800 focus:border-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-600 cursor-pointer"
            >
              {(ACTIVITY_OUTCOMES[activityType] || ACTIVITY_OUTCOMES.Other).map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>

          {/* 3. Detailed Notes */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Activity Notes / Discussion Summary
              </label>
              <span className="text-[11px] text-slate-400">Recommended</span>
            </div>
            <textarea
              id="activity-notes-input"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={`E.g., Discussed product specifications, client requested glass samples, budget approved...`}
              className="w-full rounded-lg border border-slate-300 py-2 px-3 text-xs sm:text-sm text-slate-800 focus:border-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-600 placeholder:text-slate-400"
            />
          </div>

          {/* 4. Activity Date & Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                Activity Date
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={activityDate}
                  onChange={(e) => setActivityDate(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 py-1.5 px-3 text-xs font-medium text-slate-800 focus:border-indigo-600 focus:outline-none"
                />
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                Activity Time
              </label>
              <div className="relative">
                <input
                  type="time"
                  value={activityTime}
                  onChange={(e) => setActivityTime(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 py-1.5 px-3 text-xs font-medium text-slate-800 focus:border-indigo-600 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* 5. Performed By (Display current user) */}
          <div className="flex items-center justify-between rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-xs">
            <div className="flex items-center gap-2 text-slate-600">
              <User className="h-3.5 w-3.5 text-indigo-600" />
              <span>Logged by:</span>
              <strong className="text-slate-900">
                {userProfile?.full_name || currentUser?.email?.split('@')[0]}
              </strong>
            </div>
            <span className="rounded-md bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-800 uppercase">
              {userProfile?.role || 'SALESMAN'}
            </span>
          </div>

          {/* 6. Next Follow-up Section */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 space-y-3">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={scheduleFollowup}
                  onChange={(e) => setScheduleFollowup(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
                <span className="text-xs font-bold text-slate-900">
                  Schedule Next Follow-up
                </span>
              </label>
              <span className="text-[11px] text-slate-500 font-medium">Optional</span>
            </div>

            {scheduleFollowup && (
              <div className="pt-2 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-2.5 animate-in fade-in duration-150">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Follow-up Action
                  </label>
                  <select
                    value={followupAction}
                    onChange={(e) => setFollowupAction(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white py-1.5 px-2.5 text-xs text-slate-800 font-medium focus:border-indigo-600 focus:outline-none cursor-pointer"
                  >
                    <option value="Call">📞 Call</option>
                    <option value="WhatsApp">💬 WhatsApp</option>
                    <option value="Email">✉️ Email</option>
                    <option value="Meeting">👥 Meeting</option>
                    <option value="Site Visit">📍 Site Visit</option>
                    <option value="Quotation">📄 Quotation</option>
                    <option value="Other">📌 Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Due Date
                  </label>
                  <input
                    type="date"
                    value={followupDate}
                    onChange={(e) => setFollowupDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white py-1.5 px-2.5 text-xs text-slate-800 font-medium focus:border-indigo-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Due Time
                  </label>
                  <input
                    type="time"
                    value={followupTime}
                    onChange={(e) => setFollowupTime(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white py-1.5 px-2.5 text-xs text-slate-800 font-medium focus:border-indigo-600 focus:outline-none"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50 transition cursor-pointer"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Saving Activity...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Save Activity Log</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
