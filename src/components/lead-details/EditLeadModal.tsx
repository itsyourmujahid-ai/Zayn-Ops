import React, { useState, useEffect } from 'react';
import { X, Building, User, Phone, MessageSquare, Mail, MapPin, Briefcase, DollarSign, Calendar, FileText, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { LeadRecord, LeadType, ProjectType } from '../../types/database';

interface EditLeadModalProps {
  isOpen: boolean;
  onClose: () => void;
  lead: LeadRecord;
  onSave: (updatedData: Partial<LeadRecord>) => Promise<void>;
}

const LEAD_TYPES: LeadType[] = [
  'Interior Designer',
  'Contractor',
  'Architect',
  'Direct Client',
  'Commercial Client',
  'Consultant',
  'Other',
];

const PROJECT_TYPES: ProjectType[] = [
  'Residential',
  'Commercial',
  'Industrial',
  'Hospitality',
  'Healthcare',
  'Retail',
  'Mixed Use',
  'Other',
];

export const EditLeadModal: React.FC<EditLeadModalProps> = ({
  isOpen,
  onClose,
  lead,
  onSave,
}) => {
  const [companyName, setCompanyName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [email, setEmail] = useState('');
  const [location, setLocation] = useState('');
  const [leadType, setLeadType] = useState<LeadType>('Direct Client');
  const [projectName, setProjectName] = useState('');
  const [projectType, setProjectType] = useState<ProjectType>('Commercial');
  const [requirement, setRequirement] = useState('');
  const [estimatedValue, setEstimatedValue] = useState<string>('');
  const [expectedClosingDate, setExpectedClosingDate] = useState('');
  const [notes, setNotes] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && lead) {
      setCompanyName(lead.company_name || '');
      setContactPerson(lead.contact_person || '');
      setPhone(lead.phone || '');
      setWhatsapp(lead.whatsapp || '');
      setEmail(lead.email || '');
      setLocation(lead.location || '');
      setLeadType(lead.lead_type || 'Direct Client');
      setProjectName(lead.project_name || '');
      setProjectType(lead.project_type || 'Commercial');
      setRequirement(lead.requirement || '');
      setEstimatedValue(lead.estimated_value ? String(lead.estimated_value) : '');
      setExpectedClosingDate(lead.expected_closing_date ? lead.expected_closing_date.split('T')[0] : '');
      setNotes(lead.notes || '');
      setError(null);
    }
  }, [isOpen, lead]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!companyName.trim()) {
      setError('Company Name is required.');
      return;
    }
    if (!phone.trim()) {
      setError('Primary phone number is required.');
      return;
    }

    try {
      setSaving(true);
      await onSave({
        company_name: companyName.trim(),
        contact_person: contactPerson.trim(),
        phone: phone.trim(),
        whatsapp: whatsapp.trim() || undefined,
        email: email.trim() || undefined,
        location: location.trim(),
        lead_type: leadType,
        project_name: projectName.trim() || undefined,
        project_type: projectType,
        requirement: requirement.trim() || undefined,
        estimated_value: estimatedValue ? parseFloat(estimatedValue) : undefined,
        expected_closing_date: expectedClosingDate || undefined,
        notes: notes.trim() || undefined,
      });
      onClose();
    } catch (err: any) {
      console.error('Failed to update lead info:', err);
      setError(err?.message || 'Failed to update lead information. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-3 sm:p-4 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-2xl rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/80 px-6 py-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">Edit Lead Information</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Update core contact and project requirements for this account.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {error && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Company Name */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Company Name <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Building className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  required
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-xs sm:text-sm text-slate-800 font-medium focus:border-indigo-600 focus:outline-none"
                />
              </div>
            </div>

            {/* Contact Person */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Contact Person
              </label>
              <div className="relative">
                <User className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={contactPerson}
                  onChange={(e) => setContactPerson(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-xs sm:text-sm text-slate-800 font-medium focus:border-indigo-600 focus:outline-none"
                />
              </div>
            </div>

            {/* Phone */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Primary Phone <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-xs sm:text-sm text-slate-800 font-medium focus:border-indigo-600 focus:outline-none"
                />
              </div>
            </div>

            {/* WhatsApp */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                WhatsApp Number
              </label>
              <div className="relative">
                <MessageSquare className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="tel"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-xs sm:text-sm text-slate-800 font-medium focus:border-indigo-600 focus:outline-none"
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-xs sm:text-sm text-slate-800 font-medium focus:border-indigo-600 focus:outline-none"
                />
              </div>
            </div>

            {/* Location */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Location / City
              </label>
              <div className="relative">
                <MapPin className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-xs sm:text-sm text-slate-800 font-medium focus:border-indigo-600 focus:outline-none"
                />
              </div>
            </div>

            {/* Lead Type */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Lead Type / Category
              </label>
              <select
                value={leadType}
                onChange={(e) => setLeadType(e.target.value as LeadType)}
                className="w-full rounded-lg border border-slate-300 bg-white py-2 px-3 text-xs sm:text-sm text-slate-800 font-medium focus:border-indigo-600 focus:outline-none cursor-pointer"
              >
                {LEAD_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            {/* Project Name */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Project Name
              </label>
              <div className="relative">
                <Briefcase className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-xs sm:text-sm text-slate-800 font-medium focus:border-indigo-600 focus:outline-none"
                />
              </div>
            </div>

            {/* Project Type */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Project Sector
              </label>
              <select
                value={projectType}
                onChange={(e) => setProjectType(e.target.value as ProjectType)}
                className="w-full rounded-lg border border-slate-300 bg-white py-2 px-3 text-xs sm:text-sm text-slate-800 font-medium focus:border-indigo-600 focus:outline-none cursor-pointer"
              >
                {PROJECT_TYPES.map((pt) => (
                  <option key={pt} value={pt}>
                    {pt}
                  </option>
                ))}
              </select>
            </div>

            {/* Estimated Value */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Estimated Deal Value (SAR)
              </label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={estimatedValue}
                  onChange={(e) => setEstimatedValue(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-xs sm:text-sm text-slate-800 font-medium focus:border-indigo-600 focus:outline-none"
                />
              </div>
            </div>

            {/* Expected Closing Date */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Expected Closing Date
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="date"
                  value={expectedClosingDate}
                  onChange={(e) => setExpectedClosingDate(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-xs sm:text-sm text-slate-800 font-medium focus:border-indigo-600 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Requirement */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
              Project Requirements / Scope
            </label>
            <textarea
              rows={2}
              value={requirement}
              onChange={(e) => setRequirement(e.target.value)}
              className="w-full rounded-lg border border-slate-300 py-2 px-3 text-xs sm:text-sm text-slate-800 focus:border-indigo-600 focus:outline-none"
            />
          </div>

          {/* Internal Notes */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
              General Notes
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-lg border border-slate-300 py-2 px-3 text-xs sm:text-sm text-slate-800 focus:border-indigo-600 focus:outline-none"
            />
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50 transition cursor-pointer"
            >
              {saving ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Saving Changes...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Save Changes</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
