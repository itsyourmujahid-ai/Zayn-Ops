import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Building2,
  User,
  Phone,
  MessageSquare,
  Mail,
  MapPin,
  Tag,
  Flame,
  FileText,
  CheckCircle2,
  Calendar,
  DollarSign,
  UserCheck,
  AlertTriangle,
  GitMerge,
} from 'lucide-react';
import { LeadPriority } from '../../types/crm';
import { createLead, getActiveSalesmen, getAllUsers, getLeads, getLocalNotDuplicates } from '../../lib/dal';
import { findPotentialMatchesForLeadInput } from '../../lib/dataQuality';
import { useAuth } from '../../context/AuthContext';
import { UserProfile, LeadRecord, NotDuplicateRecord } from '../../types/database';

interface QuickAddLeadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (lead?: LeadRecord) => void;
}

export const QuickAddLeadModal: React.FC<QuickAddLeadModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { userProfile, currentUser, isAdmin } = useAuth();
  const [salesmenList, setSalesmenList] = useState<UserProfile[]>([]);
  const [assignedTo, setAssignedTo] = useState<string>('');

  const [companyName, setCompanyName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [email, setEmail] = useState('');
  const [leadType, setLeadType] = useState('b2b');
  const [location, setLocation] = useState('');
  const [leadSource, setLeadSource] = useState('referral');
  const [priority, setPriority] = useState<LeadPriority>('warm');
  const [nextAction, setNextAction] = useState('');
  const [nextFollowupDate, setNextFollowupDate] = useState('');
  const [estimatedValue, setEstimatedValue] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Duplicate Prevention State
  const [existingLeads, setExistingLeads] = useState<LeadRecord[]>([]);
  const [notDuplicates, setNotDuplicates] = useState<NotDuplicateRecord[]>([]);
  const [overrideDuplicateWarning, setOverrideDuplicateWarning] = useState<boolean>(false);

  // Fetch active salesmen and existing leads when modal opens
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    async function loadData() {
      try {
        const [salesmen, allLeads] = await Promise.all([
          getActiveSalesmen(),
          getLeads({ userRole: 'ADMIN' }),
        ]);
        if (isMounted) {
          setSalesmenList(salesmen);
          setExistingLeads(allLeads);
          setNotDuplicates(getLocalNotDuplicates());
          if (salesmen.length > 0 && !assignedTo) {
            setAssignedTo(salesmen[0].id);
          }
        }
      } catch (e) {
        console.warn('Error loading salesmen or leads for deduplication check:', e);
      }
    }
    loadData();
    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  // Real-time duplicate detection
  const duplicateMatches = useMemo(() => {
    if (!companyName.trim() && !phone.trim() && !whatsapp.trim() && !email.trim()) {
      return [];
    }
    return findPotentialMatchesForLeadInput(
      {
        company_name: companyName,
        contact_person: contactPerson,
        phone,
        whatsapp,
        email,
      },
      existingLeads,
      notDuplicates
    );
  }, [companyName, contactPerson, phone, whatsapp, email, existingLeads, notDuplicates]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim()) {
      setError('Company / Business Name is required.');
      return;
    }

    if (isAdmin && !assignedTo) {
      setError('Please select a Salesman to assign this lead to.');
      return;
    }

    if (duplicateMatches.length > 0 && !overrideDuplicateWarning) {
      setError('Potential duplicate records detected. Please review the duplicate warning below and check the override confirmation box if this is a distinct customer.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const priorityMap: Record<LeadPriority, 'Hot' | 'Warm' | 'Cold'> = {
        hot: 'Hot',
        warm: 'Warm',
        cold: 'Cold',
      };

      const effectiveAssignedTo = isAdmin
        ? assignedTo
        : userProfile?.id || currentUser?.uid || 'uid-salesman';

      const created = await createLead(
        {
          company_name: companyName.trim(),
          contact_person: contactPerson.trim(),
          phone: phone.trim(),
          whatsapp: whatsapp.trim(),
          email: email.trim(),
          lead_type: leadType as any,
          location: location.trim(),
          source: leadSource as any,
          priority: priorityMap[priority],
          status: 'New',
          notes: notes.trim(),
          next_action: nextAction.trim(),
          next_followup_date: nextFollowupDate ? new Date(nextFollowupDate).toISOString() : '',
          estimated_value: estimatedValue ? parseFloat(estimatedValue) || 0 : 0,
          assigned_to: effectiveAssignedTo,
        },
        userProfile?.role
      );

      // Reset form
      setCompanyName('');
      setContactPerson('');
      setPhone('');
      setWhatsapp('');
      setEmail('');
      setLocation('');
      setNotes('');
      setNextAction('');
      setNextFollowupDate('');
      setEstimatedValue('');

      if (onSuccess) {
        onSuccess(created);
      }
      onClose();
    } catch (err: any) {
      console.error('Error creating lead:', err);
      setError(err.message || 'Failed to save lead. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      id="quick-add-lead-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs"
    >
      <div
        id="quick-add-lead-modal-container"
        className="w-full max-w-xl rounded-xl bg-white shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-50">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Quick Lead Entry
            </h2>
            <p className="text-xs text-slate-500">
              Add client details quickly. Company Name is mandatory.
            </p>
          </div>
          <button
            id="close-add-lead-modal-btn"
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {error && (
            <div className="rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700 font-medium">
              {error}
            </div>
          )}

          {/* Phase S: Duplicate Prevention Warning Banner */}
          {duplicateMatches.length > 0 && (
            <div
              id="duplicate-prevention-banner"
              className="rounded-xl border border-amber-300 bg-amber-50/90 p-4 shadow-2xs space-y-3"
            >
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="flex-1 text-xs">
                  <div className="font-bold text-amber-900 text-sm flex items-center gap-2">
                    <span>Possible Duplicate Record Detected</span>
                    <span className="bg-amber-200 text-amber-900 px-2 py-0.5 rounded-full text-[11px] font-semibold">
                      {duplicateMatches[0].confidence_score}% Match
                    </span>
                  </div>
                  <p className="text-amber-800 mt-1">
                    An existing record shares matching contact info or business name:
                  </p>

                  <div className="mt-2 space-y-1.5">
                    {duplicateMatches.slice(0, 3).map((match, idx) => (
                      <div
                        key={idx}
                        className="flex flex-col sm:flex-row sm:items-center sm:justify-between bg-white/80 border border-amber-200 rounded-lg px-3 py-2 text-xs"
                      >
                        <div>
                          <span className="font-bold text-slate-900">{match.record_b.company_name}</span>
                          <span className="text-slate-500 ml-1.5 font-medium">({match.match_reasons.join(', ')})</span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5 sm:mt-0">
                          {match.record_b.contact_person && <span>{match.record_b.contact_person} • </span>}
                          {match.record_b.phone || match.record_b.email}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-amber-200/80 flex items-center gap-2">
                    <input
                      id="override-duplicate-checkbox"
                      type="checkbox"
                      checked={overrideDuplicateWarning}
                      onChange={(e) => setOverrideDuplicateWarning(e.target.checked)}
                      className="h-4 w-4 rounded border-amber-400 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                    <label
                      htmlFor="override-duplicate-checkbox"
                      className="text-xs font-semibold text-amber-950 cursor-pointer select-none"
                    >
                      I verify this is a distinct customer or separate inquiry (override warning)
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Company Name (Required) */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Company / Business Name <span className="text-rose-600">*</span>
            </label>
            <div className="relative">
              <Building2 className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                id="field-company-name"
                type="text"
                required
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="e.g. Acme Industries Ltd"
                className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm focus:border-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-600"
              />
            </div>
          </div>

          {/* Role-Based Salesman Assignment (Admin Only) */}
          {isAdmin && (
            <div className="rounded-lg border border-indigo-100 bg-indigo-50/50 p-3">
              <label className="block text-xs font-semibold text-indigo-950 mb-1 flex items-center gap-1.5">
                <UserCheck className="h-3.5 w-3.5 text-indigo-600" />
                <span>Assign To Salesman <span className="text-rose-600">*</span></span>
              </label>
              <select
                id="field-assigned-salesman"
                required
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                className="w-full rounded-lg border border-indigo-200 py-2 px-3 text-sm focus:border-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-600 bg-white font-medium text-slate-800"
              >
                {salesmenList.map((salesman) => (
                  <option key={salesman.id} value={salesman.id}>
                    {salesman.full_name} ({salesman.email})
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[11px] text-indigo-600">
                As Admin, specify the sales representative responsible for this account.
              </p>
            </div>
          )}

          {/* Contact Person & Priority */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Contact Person
              </label>
              <div className="relative">
                <User className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  id="field-contact-person"
                  type="text"
                  value={contactPerson}
                  onChange={(e) => setContactPerson(e.target.value)}
                  placeholder="e.g. John Doe"
                  className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm focus:border-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-600"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Priority
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {(['hot', 'warm', 'cold'] as LeadPriority[]).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPriority(p)}
                    className={`rounded-lg py-1.5 text-xs font-medium capitalize border transition cursor-pointer ${
                      priority === p
                        ? p === 'hot'
                          ? 'bg-rose-50 border-rose-400 text-rose-700 font-semibold'
                          : p === 'warm'
                          ? 'bg-amber-50 border-amber-400 text-amber-700 font-semibold'
                          : 'bg-sky-50 border-sky-400 text-sky-700 font-semibold'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Phone & WhatsApp */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Phone Number
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  id="field-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value);
                    if (!whatsapp) setWhatsapp(e.target.value);
                  }}
                  placeholder="+968 9000 0000"
                  className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm focus:border-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-600"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                WhatsApp Number
              </label>
              <div className="relative">
                <MessageSquare className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  id="field-whatsapp"
                  type="tel"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  placeholder="+968 9000 0000"
                  className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm focus:border-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-600"
                />
              </div>
            </div>
          </div>

          {/* Email & Location */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  id="field-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="client@company.com"
                  className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm focus:border-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-600"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Location / City
              </label>
              <div className="relative">
                <MapPin className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  id="field-location"
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Muscat, Oman"
                  className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm focus:border-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-600"
                />
              </div>
            </div>
          </div>

          {/* Next Action & Follow-up Date */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Next Action
              </label>
              <input
                id="field-next-action"
                type="text"
                value={nextAction}
                onChange={(e) => setNextAction(e.target.value)}
                placeholder="e.g. Send formal quote, Follow-up call"
                className="w-full rounded-lg border border-slate-300 py-2 px-3 text-sm focus:border-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Follow-up Date
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  id="field-next-followup-date"
                  type="date"
                  value={nextFollowupDate}
                  onChange={(e) => setNextFollowupDate(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm focus:border-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-600 bg-white"
                />
              </div>
            </div>
          </div>

          {/* Estimated Value & Source */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Estimated Value (OMR)
              </label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  id="field-estimated-value"
                  type="number"
                  step="any"
                  value={estimatedValue}
                  onChange={(e) => setEstimatedValue(e.target.value)}
                  placeholder="e.g. 2500"
                  className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm focus:border-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-600"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Lead Source
              </label>
              <select
                id="field-lead-source"
                value={leadSource}
                onChange={(e) => setLeadSource(e.target.value)}
                className="w-full rounded-lg border border-slate-300 py-2 px-3 text-sm focus:border-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-600 bg-white"
              >
                <option value="referral">Client Referral</option>
                <option value="phone_inquiry">Direct Phone Call</option>
                <option value="whatsapp">WhatsApp Inquiry</option>
                <option value="website">Website / Landing Page</option>
                <option value="exhibition">Exhibition / Trade Fair</option>
                <option value="cold_outreach">Cold Outreach</option>
                <option value="google">Google Search</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          {/* Initial Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Initial Notes / Requirement
            </label>
            <textarea
              id="field-notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Key requirements, client expectations, or discussion context..."
              className="w-full rounded-lg border border-slate-300 p-2.5 text-sm focus:border-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-600"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              id="submit-quick-add-lead-btn"
              type="submit"
              disabled={loading}
              className="rounded-lg bg-indigo-600 px-5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 transition disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
            >
              {loading ? (
                <>
                  <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span>Saving Lead...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Save Lead</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
