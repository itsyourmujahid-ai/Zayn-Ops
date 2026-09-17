import React, { useState, useEffect } from 'react';
import {
  X,
  Briefcase,
  User,
  Phone,
  MessageSquare,
  Mail,
  MapPin,
  Tag,
  DollarSign,
  AlertCircle,
  Loader2,
  Calendar,
  Clock,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';
import {
  ClientRecord,
  LeadRecord,
  Priority,
  UserProfile,
  CreateLeadInput,
  FollowUpActionType,
} from '../../types/database';
import {
  createLead,
  createFollowUp,
  getActiveSalesmen,
  getUserDisplayName,
  createActivity,
} from '../../lib/dal';
import { useAuth } from '../../context/AuthContext';

interface CreateOpportunityModalProps {
  isOpen: boolean;
  onClose: () => void;
  client: ClientRecord;
  onSuccess?: (newLead: LeadRecord) => void;
}

export const CreateOpportunityModal: React.FC<CreateOpportunityModalProps> = ({
  isOpen,
  onClose,
  client,
  onSuccess,
}) => {
  const { userProfile, isAdmin } = useAuth();
  const [salesmenList, setSalesmenList] = useState<UserProfile[]>([]);

  // Pre-filled client fields (editable)
  const [companyName, setCompanyName] = useState<string>('');
  const [contactPerson, setContactPerson] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [whatsapp, setWhatsapp] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [location, setLocation] = useState<string>('');
  const [leadType, setLeadType] = useState<string>('b2b');

  // New Opportunity fields
  const [projectName, setProjectName] = useState<string>('');
  const [requirement, setRequirement] = useState<string>('');
  const [estimatedValue, setEstimatedValue] = useState<string>('');
  const [priority, setPriority] = useState<Priority>('Warm');
  const [assignedTo, setAssignedTo] = useState<string>('');

  // Optional initial follow-up
  const [scheduleInitialFollowup, setScheduleInitialFollowup] = useState<boolean>(false);
  const [followupAction, setFollowupAction] = useState<FollowUpActionType>('Customer Check-in');
  const [followupDate, setFollowupDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  });
  const [followupTime, setFollowupTime] = useState<string>('10:00');

  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      getActiveSalesmen()
        .then((list) => {
          setSalesmenList(list);
          // Default assigned_to to client's owner_id
          if (client.owner_id) {
            setAssignedTo(client.owner_id);
          } else if (list.length > 0) {
            setAssignedTo(list[0].id);
          }
        })
        .catch((err) => console.warn('Could not load salesmen:', err));

      setCompanyName(client.company_name || '');
      setContactPerson(client.contact_person || '');
      setPhone(client.phone || '');
      setWhatsapp(client.whatsapp || '');
      setEmail(client.email || '');
      setLocation(client.location || '');
      setLeadType(client.client_type || 'b2b');
      setProjectName('');
      setRequirement('');
      setEstimatedValue('');
      setPriority('Warm');
      setScheduleInitialFollowup(false);
      setError(null);
    }
  }, [isOpen, client]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!companyName.trim()) {
      setError('Company / Business Name is required.');
      return;
    }

    if (!projectName.trim()) {
      setError('Please provide an Opportunity Title or Project Name (e.g., Annual Maintenance, Branch Expansion).');
      return;
    }

    const assignedSalesmanId = isAdmin && assignedTo ? assignedTo : client.owner_id || userProfile?.id;
    if (!assignedSalesmanId) {
      setError('Responsible representative could not be determined.');
      return;
    }

    try {
      setSubmitting(true);

      const parsedValue = estimatedValue ? parseFloat(estimatedValue) : undefined;

      const leadPayload: CreateLeadInput = {
        company_name: companyName.trim(),
        contact_person: contactPerson.trim() || undefined,
        phone: phone.trim() || undefined,
        whatsapp: whatsapp.trim() || undefined,
        email: email.trim() || undefined,
        location: location.trim() || undefined,
        lead_type: leadType,
        source: 'Repeat Business',
        project_name: projectName.trim(),
        requirement: requirement.trim() || undefined,
        estimated_value: isNaN(parsedValue || NaN) ? undefined : parsedValue,
        priority,
        status: 'New',
        assigned_to: assignedSalesmanId,
        source_client_id: client.id, // Phase P Safe reference
        notes: `New Repeat Opportunity generated from Client account: ${client.company_name}.${requirement ? ` Requirement: ${requirement}` : ''}`,
      };

      // Create new lead document
      const newLead = await createLead(leadPayload, userProfile?.role);

      // Log relationship activity on the client timeline
      try {
        await createActivity({
          client_id: client.id,
          lead_id: client.source_lead_id || undefined,
          company_name: client.company_name,
          client_name: client.company_name,
          activity_type: 'Other',
          description: `New Repeat Opportunity: "${projectName.trim()}"`,
          outcome: 'Opportunity Created',
          notes: `Created new repeat pipeline deal "${projectName.trim()}" (Lead ID: ${newLead.id}) assigned to ${getUserDisplayName(assignedSalesmanId)}.`,
          metadata: {
            new_lead_id: newLead.id,
            source_client_id: client.id,
            estimated_value: parsedValue,
            company_name: client.company_name,
          },
        });
      } catch (actErr) {
        console.warn('Activity log notice for repeat opportunity:', actErr);
      }

      // Schedule optional initial follow-up on the newly created lead
      if (scheduleInitialFollowup && followupDate) {
        try {
          const combinedDateTime = new Date(`${followupDate}T${followupTime || '10:00'}:00`).toISOString();
          await createFollowUp({
            lead_id: newLead.id,
            company_name: newLead.company_name,
            contact_person: newLead.contact_person,
            phone: newLead.phone || newLead.whatsapp,
            action: followupAction,
            scheduled_at: combinedDateTime,
            notes: `Initial follow-up for repeat opportunity "${projectName.trim()}".`,
            assigned_to: assignedSalesmanId,
            status: 'pending',
          });
        } catch (fuErr) {
          console.warn('Follow-up creation notice for new opportunity:', fuErr);
        }
      }

      onSuccess?.(newLead);
      onClose();
    } catch (err: any) {
      console.error('Failed to create new opportunity:', err);
      setError(err.message || 'Failed to create new opportunity. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      id="modal-create-opportunity"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-3 sm:p-4 backdrop-blur-xs overflow-y-auto"
    >
      <div className="relative w-full max-w-2xl rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-8">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Create New Opportunity</h3>
              <p className="text-xs text-slate-500">
                Repeat business deal for <strong className="text-slate-800">{client.company_name}</strong>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Informational Banner */}
        <div className="bg-emerald-50/60 border-b border-emerald-100 px-6 py-3 flex items-start gap-2 text-xs text-emerald-900">
          <ShieldCheck className="h-4 w-4 text-emerald-700 shrink-0 mt-0.5" />
          <p className="text-[11px] leading-relaxed">
            This creates a <strong>separate new Lead</strong> in the pipeline with its own unique ID and stages, while preserving the existing Client relationship history. Linked safely via <code className="bg-emerald-100 px-1 py-0.5 rounded font-mono text-[10px]">source_client_id</code>.
          </p>
        </div>

        {/* Error notification */}
        {error && (
          <div className="m-6 mb-0 flex items-center gap-2 rounded-xl bg-rose-50 p-3 text-xs text-rose-700 border border-rose-200">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Opportunity Details Section */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Briefcase className="h-3.5 w-3.5 text-emerald-600" />
              <span>New Opportunity Details</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Opportunity Title / Requirement Name <span className="text-rose-500">*</span>
                </label>
                <input
                  id="input-opp-title"
                  type="text"
                  required
                  placeholder="e.g. Annual Maintenance Contract 2026, Branch Expansion Fitout"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-900 focus:border-emerald-600 focus:bg-white focus:outline-none font-medium"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Requirement / Scope Description
                </label>
                <textarea
                  id="input-opp-requirement"
                  rows={2}
                  placeholder="Describe the client's new requirement, specifications, or request..."
                  value={requirement}
                  onChange={(e) => setRequirement(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs text-slate-900 focus:border-emerald-600 focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Estimated Value (SAR)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs text-slate-400 font-bold">SAR</span>
                  <input
                    id="input-opp-value"
                    type="number"
                    min="0"
                    step="100"
                    placeholder="e.g. 75000"
                    value={estimatedValue}
                    onChange={(e) => setEstimatedValue(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-12 pr-3.5 py-2 text-xs text-slate-900 focus:border-emerald-600 focus:bg-white focus:outline-none font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Initial Priority
                </label>
                <select
                  id="select-opp-priority"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as Priority)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 focus:border-emerald-600 focus:bg-white focus:outline-none font-semibold cursor-pointer"
                >
                  <option value="Hot">Hot (Immediate closing expected)</option>
                  <option value="Warm">Warm (Active discussion)</option>
                  <option value="Cold">Cold (Long term exploration)</option>
                </select>
              </div>

              {/* Responsible Representative (Admin can reassign, Salesman defaults to self/owner) */}
              {isAdmin && (
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Assigned Sales Representative
                  </label>
                  <select
                    id="select-opp-assigned-to"
                    value={assignedTo}
                    onChange={(e) => setAssignedTo(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 focus:border-emerald-600 focus:bg-white focus:outline-none font-medium cursor-pointer"
                  >
                    {salesmenList.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.full_name} ({u.role}) {u.id === client.owner_id ? '• Current Client Owner' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Pre-filled Client Profile Section (Editable for this opportunity) */}
          <div className="space-y-3 pt-3 border-t border-slate-100">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <User className="h-3.5 w-3.5 text-slate-600" />
              <span>Client Information Review (Pre-filled)</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Company / Organization <span className="text-rose-500">*</span>
                </label>
                <input
                  id="input-opp-company"
                  type="text"
                  required
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 focus:border-emerald-600 focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Contact Person
                </label>
                <input
                  id="input-opp-contact-person"
                  type="text"
                  value={contactPerson}
                  onChange={(e) => setContactPerson(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 focus:border-emerald-600 focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Phone Number
                </label>
                <input
                  id="input-opp-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 focus:border-emerald-600 focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  WhatsApp Number
                </label>
                <input
                  id="input-opp-whatsapp"
                  type="tel"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 focus:border-emerald-600 focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Email Address
                </label>
                <input
                  id="input-opp-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 focus:border-emerald-600 focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Location / City
                </label>
                <input
                  id="input-opp-location"
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 focus:border-emerald-600 focus:bg-white focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Optional Initial Follow-up Checkbox */}
          <div className="pt-3 border-t border-slate-100">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                id="checkbox-schedule-opp-followup"
                type="checkbox"
                checked={scheduleInitialFollowup}
                onChange={(e) => setScheduleInitialFollowup(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
              />
              <span className="text-xs font-bold text-slate-800">
                Schedule initial follow-up for this opportunity
              </span>
            </label>

            {scheduleInitialFollowup && (
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3 rounded-xl bg-slate-50 p-3 border border-slate-200/80">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Action Type
                  </label>
                  <select
                    value={followupAction}
                    onChange={(e) => setFollowupAction(e.target.value as FollowUpActionType)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 font-medium"
                  >
                    <option value="Customer Check-in">Customer Check-in</option>
                    <option value="New Requirement">New Requirement</option>
                    <option value="Repeat Order Discussion">Repeat Order Discussion</option>
                    <option value="Meeting">Meeting</option>
                    <option value="Site Visit">Site Visit</option>
                    <option value="Quotation Follow-up">Quotation Follow-up</option>
                    <option value="Call">Call</option>
                    <option value="WhatsApp">WhatsApp</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    value={followupDate}
                    onChange={(e) => setFollowupDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Time
                  </label>
                  <input
                    type="time"
                    value={followupTime}
                    onChange={(e) => setFollowupTime(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              id="btn-submit-create-opp"
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-5 py-2 text-xs font-bold text-white shadow-sm transition cursor-pointer disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Creating Opportunity...</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  <span>Create Opportunity & Open Pipeline</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
