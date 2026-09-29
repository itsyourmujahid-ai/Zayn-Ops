import React, { useState, useEffect } from 'react';
import {
  X,
  Phone,
  MessageSquare,
  Mail,
  Users,
  MapPin,
  Clock,
  Calendar,
  Building2,
  CalendarPlus,
  Loader2,
  AlertCircle,
  StickyNote,
} from 'lucide-react';
import { ClientRecord, ActivityType, FollowUpActionType, UserProfile } from '../../types/database';
import { createActivity, createFollowUp } from '../../lib/dal';
import { useAuth } from '../../context/AuthContext';

interface AddClientActivityModalProps {
  isOpen: boolean;
  client: ClientRecord;
  initialType?: ActivityType;
  users?: UserProfile[];
  onClose: () => void;
  onActivityAdded?: () => void;
}

const CLIENT_ACTIVITY_TYPES: { type: ActivityType; label: string; icon: any }[] = [
  { type: 'Call', label: 'Phone Call', icon: Phone },
  { type: 'WhatsApp', label: 'WhatsApp', icon: MessageSquare },
  { type: 'Meeting', label: 'Meeting', icon: Users },
  { type: 'Site Visit', label: 'Site Visit', icon: MapPin },
  { type: 'Email', label: 'Email', icon: Mail },
  { type: 'Note', label: 'Note', icon: StickyNote },
];

const OUTCOMES_BY_TYPE: Record<string, string[]> = {
  Call: ['Connected', 'No Answer', 'Busy', 'Call Back Later', 'Wrong Number', 'Requirement Discussed', 'Other'],
  WhatsApp: ['Replied & Interested', 'Message Sent', 'Information Requested', 'No Reply', 'Follow-up Needed', 'Other'],
  Email: ['Sent', 'Replied', 'Proposal Discussed', 'No Reply', 'Other'],
  Meeting: ['Successful', 'Follow-up Required', 'Requirements Confirmed', 'Terms Discussed', 'Rescheduled', 'Other'],
  'Site Visit': ['Site Inspected', 'Requirements Confirmed', 'Measurements Taken', 'Follow-up Required', 'Other'],
  Note: ['General Note', 'Relationship Update', 'Important Requirement', 'Internal Note'],
};

export const AddClientActivityModal: React.FC<AddClientActivityModalProps> = ({
  isOpen,
  client,
  initialType = 'Call',
  users = [],
  onClose,
  onActivityAdded,
}) => {
  const { userProfile, currentUser } = useAuth();

  const [activityType, setActivityType] = useState<ActivityType>(initialType);
  const [outcome, setOutcome] = useState<string>('Connected');
  const [date, setDate] = useState<string>('');
  const [time, setTime] = useState<string>('');
  const [location, setLocation] = useState<string>(client.location || '');
  const [purpose, setPurpose] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  // Next action / Follow-up integration
  const [scheduleNextFollowUp, setScheduleNextFollowUp] = useState<boolean>(false);
  const [nextActionType, setNextActionType] = useState<FollowUpActionType>('Call');
  const [nextFollowUpDate, setNextFollowUpDate] = useState<string>('');
  const [nextFollowUpTime, setNextFollowUpTime] = useState<string>('10:00');
  const [nextActionNotes, setNextActionNotes] = useState<string>('');

  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      const now = new Date();
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const dd = String(now.getDate()).padStart(2, '0');
      const hh = String(now.getHours()).padStart(2, '0');
      const min = String(now.getMinutes()).padStart(2, '0');

      setDate(`${yyyy}-${mm}-${dd}`);
      setTime(`${hh}:${min}`);

      // Next follow-up default: 3 days out
      const nextDate = new Date();
      nextDate.setDate(nextDate.getDate() + 3);
      const nYyyy = nextDate.getFullYear();
      const nMm = String(nextDate.getMonth() + 1).padStart(2, '0');
      const nDd = String(nextDate.getDate()).padStart(2, '0');
      setNextFollowUpDate(`${nYyyy}-${nMm}-${nDd}`);
      setNextFollowUpTime('10:00');

      setActivityType(initialType);
      const defaults = OUTCOMES_BY_TYPE[initialType] || OUTCOMES_BY_TYPE.Call;
      setOutcome(defaults[0] || 'Completed');
      setLocation(client.location || '');
      setPurpose('');
      setNotes('');
      setScheduleNextFollowUp(false);
      setNextActionType('Call');
      setNextActionNotes('');
      setError(null);
    }
  }, [isOpen, initialType, client]);

  if (!isOpen) return null;

  const handleTypeSelect = (type: ActivityType) => {
    setActivityType(type);
    const defaults = OUTCOMES_BY_TYPE[type] || ['Completed'];
    setOutcome(defaults[0] || 'Completed');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!notes.trim() && !purpose.trim() && activityType === 'Note') {
      setError('Please enter your note or details.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const activityIso = date && time ? new Date(`${date}T${time}:00`).toISOString() : new Date().toISOString();
      const userName = userProfile?.full_name || 'Team Member';
      const userId = userProfile?.id || currentUser?.uid || '';

      let detailedDescription = '';
      if (activityType === 'Call') {
        detailedDescription = `Phone Call with ${client.contact_person || client.company_name} · ${outcome}`;
      } else if (activityType === 'WhatsApp') {
        detailedDescription = `WhatsApp message · ${outcome}`;
      } else if (activityType === 'Meeting') {
        detailedDescription = `Meeting ${purpose ? `(${purpose})` : ''} · ${outcome}`;
      } else if (activityType === 'Site Visit') {
        detailedDescription = `Site Visit ${location ? `at ${location}` : ''} · ${outcome}`;
      } else if (activityType === 'Email') {
        detailedDescription = `Email communication · ${outcome}`;
      } else {
        detailedDescription = `Client Note recorded`;
      }

      // 1. Create client activity
      await createActivity({
        client_id: client.id,
        company_name: client.company_name,
        client_name: client.contact_person || client.name || client.company_name,
        contact_person: client.contact_person || client.name,
        activity_type: activityType,
        description: detailedDescription,
        outcome: outcome,
        notes: notes.trim(),
        activity_date: activityIso,
        activity_at: activityIso,
        performed_by: userId,
        performed_by_name: userName,
        metadata: {
          location: (activityType === 'Site Visit' || activityType === 'Meeting') ? location : undefined,
          purpose: purpose || undefined,
          next_action: scheduleNextFollowUp ? nextActionNotes || `${nextActionType} scheduled` : undefined,
        },
      });

      // 2. Seamless Follow-up and Calendar Synchronization
      if (scheduleNextFollowUp && nextFollowUpDate) {
        const scheduledIso = new Date(`${nextFollowUpDate}T${nextFollowUpTime || '10:00'}:00`).toISOString();
        await createFollowUp({
          client_id: client.id,
          entity_type: 'Client',
          company_name: client.company_name,
          contact_person: client.contact_person || client.name,
          phone: client.phone || client.whatsapp,
          email: client.email,
          action: nextActionType,
          scheduled_at: scheduledIso,
          notes: nextActionNotes.trim() || `Follow-up after ${activityType}: ${outcome}`,
          assigned_to: client.owner_id || userId,
          status: 'pending',
        });
      }

      if (onActivityAdded) {
        onActivityAdded();
      }
      onClose();
    } catch (err: any) {
      console.error('Failed to log client activity:', err);
      setError(err.message || 'Could not record client activity.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      id="modal-add-client-activity"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs overflow-y-auto"
    >
      <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-100 my-8">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
                Client Activity
              </span>
              <span className="text-xs text-slate-400">·</span>
              <span className="text-xs font-semibold text-slate-600 truncate max-w-[200px]">
                {client.company_name}
              </span>
            </div>
            <h3 className="text-base font-bold text-slate-900 mt-1">
              Record Relationship Interaction
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-rose-50 p-3 text-xs text-rose-700 border border-rose-200">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Client Target Banner - Explicitly establishes context without asking for lead */}
          <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
            <div className="flex items-center gap-2 truncate">
              <Building2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <div className="truncate">
                <span className="font-bold text-slate-900">{client.company_name}</span>
                {client.contact_person && (
                  <span className="text-slate-500 ml-1.5 font-medium">
                    ({client.contact_person})
                  </span>
                )}
              </div>
            </div>
            <span className="text-[11px] font-semibold text-slate-500 shrink-0">
              Account
            </span>
          </div>

          {/* Activity Type Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Activity Type
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
              {CLIENT_ACTIVITY_TYPES.map((item) => {
                const Icon = item.icon;
                const isSelected = activityType === item.type;
                return (
                  <button
                    key={item.type}
                    type="button"
                    onClick={() => handleTypeSelect(item.type)}
                    className={`flex flex-col items-center justify-center p-2 rounded-xl border text-xs font-semibold transition cursor-pointer ${
                      isSelected
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-500/20 shadow-2xs'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Icon className={`h-4 w-4 mb-1 ${isSelected ? 'text-emerald-700' : 'text-slate-500'}`} />
                    <span className="text-[11px] truncate w-full text-center">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Date & Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Date
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 py-2 pl-8 pr-3 text-xs text-slate-800 focus:border-emerald-600 focus:outline-none"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Time
              </label>
              <div className="relative">
                <Clock className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 py-2 pl-8 pr-3 text-xs text-slate-800 focus:border-emerald-600 focus:outline-none"
                  required
                />
              </div>
            </div>
          </div>

          {/* Outcome */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Outcome
            </label>
            <select
              value={outcome}
              onChange={(e) => setOutcome(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white py-2 px-3 text-xs font-medium text-slate-800 focus:border-emerald-600 focus:outline-none cursor-pointer"
            >
              {(OUTCOMES_BY_TYPE[activityType] || ['Completed', 'Other']).map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>

          {/* Purpose (For Meeting / Site Visit) */}
          {(activityType === 'Meeting' || activityType === 'Site Visit') && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Purpose
              </label>
              <input
                type="text"
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                placeholder="e.g. Discuss upcoming commercial project / technical requirements"
                className="w-full rounded-xl border border-slate-300 py-2 px-3 text-xs text-slate-800 focus:border-emerald-600 focus:outline-none placeholder:text-slate-400"
              />
            </div>
          )}

          {/* Location (For Site Visit or Meeting) */}
          {(activityType === 'Site Visit' || activityType === 'Meeting') && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Location
              </label>
              <div className="relative">
                <MapPin className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Client office / Site address"
                  className="w-full rounded-xl border border-slate-300 py-2 pl-8 pr-3 text-xs text-slate-800 focus:border-emerald-600 focus:outline-none placeholder:text-slate-400"
                />
              </div>
            </div>
          )}

          {/* Notes / Discussion Details */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Discussion &amp; Notes
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="What was discussed? What did the client request? Key agreements..."
              className="w-full rounded-xl border border-slate-300 p-3 text-xs text-slate-800 focus:border-emerald-600 focus:outline-none placeholder:text-slate-400 resize-none"
            />
          </div>

          {/* Next Action & Follow-up Section (Section 13 & 14 workflow) */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={scheduleNextFollowUp}
                  onChange={(e) => setScheduleNextFollowUp(e.target.checked)}
                  className="h-4 w-4 rounded-sm border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                />
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <CalendarPlus className="h-3.5 w-3.5 text-emerald-700" />
                  Schedule Next Follow-up on Calendar
                </span>
              </label>
            </div>

            {scheduleNextFollowUp && (
              <div className="space-y-3 pt-2 border-t border-slate-200/80">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Action Type
                    </label>
                    <select
                      value={nextActionType}
                      onChange={(e) => setNextActionType(e.target.value as FollowUpActionType)}
                      className="w-full rounded-lg border border-slate-300 bg-white py-1.5 px-2.5 text-xs font-medium text-slate-800 focus:border-emerald-600 focus:outline-none"
                    >
                      <option value="Call">Call</option>
                      <option value="Site Visit">Site Visit</option>
                      <option value="Meeting">Meeting</option>
                      <option value="Send Proposal">Send Proposal</option>
                      <option value="Customer Check-in">Customer Check-in</option>
                      <option value="Payment Follow-up">Check-in</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Scheduled Date
                    </label>
                    <input
                      type="date"
                      value={nextFollowUpDate}
                      onChange={(e) => setNextFollowUpDate(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white py-1.5 px-2.5 text-xs text-slate-800 focus:border-emerald-600 focus:outline-none"
                      required={scheduleNextFollowUp}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Next Action Notes
                  </label>
                  <input
                    type="text"
                    value={nextActionNotes}
                    onChange={(e) => setNextActionNotes(e.target.value)}
                    placeholder="e.g. Call on Monday regarding updated drawings"
                    className="w-full rounded-lg border border-slate-300 bg-white py-1.5 px-2.5 text-xs text-slate-800 focus:border-emerald-600 focus:outline-none placeholder:text-slate-400"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="zaynops-btn-primary py-2 px-5 text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>Save Activity</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
