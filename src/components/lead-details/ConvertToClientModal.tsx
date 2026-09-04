import React, { useState, useEffect } from 'react';
import {
  X,
  Building,
  UserCheck,
  AlertCircle,
  Loader2,
  CheckCircle2,
  ShieldCheck,
  User,
  Phone,
  MessageSquare,
  Mail,
  MapPin,
  Tag,
} from 'lucide-react';
import { LeadRecord, ClientRecord, ClientStatus, UserProfile } from '../../types/database';
import { getActiveSalesmen, createClientFromLead } from '../../lib/dal';
import { useAuth } from '../../context/AuthContext';

interface ConvertToClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  lead: LeadRecord;
  onConverted: (client: ClientRecord) => void;
}

export const ConvertToClientModal: React.FC<ConvertToClientModalProps> = ({
  isOpen,
  onClose,
  lead,
  onConverted,
}) => {
  const { userProfile, currentUser, isAdmin } = useAuth();

  const [companyName, setCompanyName] = useState<string>('');
  const [contactPerson, setContactPerson] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [whatsapp, setWhatsapp] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [location, setLocation] = useState<string>('');
  const [clientType, setClientType] = useState<string>('b2b');
  const [status, setStatus] = useState<ClientStatus>('Active');
  const [ownerId, setOwnerId] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  const [salesmen, setSalesmen] = useState<UserProfile[]>([]);
  const [loadingSalesmen, setLoadingSalesmen] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && lead) {
      setCompanyName(lead.company_name || '');
      setContactPerson(lead.contact_person || '');
      setPhone(lead.phone || '');
      setWhatsapp(lead.whatsapp || lead.phone || '');
      setEmail(lead.email || '');
      setLocation(lead.location || '');
      setClientType(lead.lead_type || 'b2b');
      setStatus('Active');
      setOwnerId(lead.assigned_to || userProfile?.id || '');
      setNotes(
        lead.notes
          ? `Converted from Won Lead (${lead.project_name || lead.company_name}). Initial notes: ${lead.notes}`
          : `Converted from Won Lead (${lead.project_name || lead.company_name}).`
      );
      setError(null);

      if (isAdmin) {
        setLoadingSalesmen(true);
        getActiveSalesmen()
          .then((list) => {
            setSalesmen(list);
          })
          .catch((e) => {
            console.warn('Failed to fetch salesmen for client conversion:', e);
          })
          .finally(() => {
            setLoadingSalesmen(false);
          });
      }
    }
  }, [isOpen, lead, isAdmin, userProfile?.id]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!companyName.trim()) {
      setError('Company name is required.');
      return;
    }

    try {
      setSubmitting(true);
      const effectiveOwnerId = isAdmin ? (ownerId || lead.assigned_to) : (lead.assigned_to || userProfile?.id || '');

      const newClient = await createClientFromLead(
        {
          lead_id: lead.id,
          company_name: companyName.trim(),
          contact_person: contactPerson.trim() || undefined,
          phone: phone.trim() || undefined,
          whatsapp: whatsapp.trim() || undefined,
          email: email.trim() || undefined,
          location: location.trim() || undefined,
          client_type: clientType,
          status,
          owner_id: effectiveOwnerId,
          notes: notes.trim() || undefined,
        },
        userProfile?.role
      );

      onConverted(newClient);
      onClose();
    } catch (err: any) {
      console.error('Lead conversion failed:', err);
      setError(err?.message || 'Failed to convert lead to client. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-3 sm:p-4 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-xl rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-8">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/80 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-emerald-50 p-2.5 text-emerald-600 border border-emerald-100">
              <Building className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 tracking-tight">
                Convert Lead to Client Account
              </h3>
              <p className="text-xs text-slate-500">
                Establish an official customer record for sales closing & ongoing management
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Informational Banner */}
        <div className="bg-emerald-50/70 border-b border-emerald-100 px-6 py-3 flex items-start gap-2.5 text-xs text-emerald-900">
          <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
          <p>
            <strong>Source Lead Preserved:</strong> Converting this Won deal creates a permanent customer profile in the Clients directory. The original Lead record and its timeline remain intact as the immutable historical source.
          </p>
        </div>

        {/* Body Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Company Name */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
              Client Company Name <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Building className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                required
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Enterprise name"
                className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-xs sm:text-sm font-semibold text-slate-900 focus:border-emerald-600 focus:outline-none"
              />
            </div>
          </div>

          {/* Contact Person & Email */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Primary Contact Person
              </label>
              <div className="relative">
                <User className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={contactPerson}
                  onChange={(e) => setContactPerson(e.target.value)}
                  placeholder="Full name"
                  className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-xs sm:text-sm text-slate-800 focus:border-emerald-600 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Official Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="client@company.com"
                  className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-xs sm:text-sm text-slate-800 focus:border-emerald-600 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Phone & WhatsApp */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Direct Phone
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+966 5x xxx xxxx"
                  className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-xs sm:text-sm text-slate-800 focus:border-emerald-600 focus:outline-none"
                />
              </div>
            </div>

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
                  placeholder="+966 5x xxx xxxx"
                  className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-xs sm:text-sm text-slate-800 focus:border-emerald-600 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Location & Client Type */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Headquarters / City
              </label>
              <div className="relative">
                <MapPin className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Riyadh, Jeddah, Dammam..."
                  className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-xs sm:text-sm text-slate-800 focus:border-emerald-600 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Client Classification
              </label>
              <div className="relative">
                <Tag className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <select
                  value={clientType}
                  onChange={(e) => setClientType(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-xs sm:text-sm font-medium text-slate-800 focus:border-emerald-600 focus:outline-none cursor-pointer"
                >
                  <option value="b2b">B2B Commercial</option>
                  <option value="enterprise">Enterprise Corporate</option>
                  <option value="channel_partner">Channel Partner</option>
                  <option value="vendor">Vendor / Supplier</option>
                  <option value="individual">Individual Client</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>
          </div>

          {/* Account Status & Portfolio Owner */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Initial Account Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as ClientStatus)}
                className="w-full rounded-lg border border-slate-300 py-2 px-3 text-xs sm:text-sm font-semibold text-slate-800 focus:border-emerald-600 focus:outline-none cursor-pointer"
              >
                <option value="Active">Active Customer Account</option>
                <option value="Inactive">Inactive / On Hold</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Account Owner (Sales Representative)
              </label>
              {isAdmin ? (
                loadingSalesmen ? (
                  <div className="flex items-center gap-2 py-2 text-xs text-slate-500">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-600" />
                    <span>Loading team...</span>
                  </div>
                ) : (
                  <select
                    value={ownerId}
                    onChange={(e) => setOwnerId(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 py-2 px-3 text-xs sm:text-sm font-semibold text-slate-800 focus:border-emerald-600 focus:outline-none cursor-pointer"
                  >
                    {salesmen.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.full_name} ({s.email}) {s.id === lead.assigned_to ? '(Lead Owner)' : ''}
                      </option>
                    ))}
                  </select>
                )
              ) : (
                <div className="rounded-lg border border-slate-200 bg-slate-50 py-2 px-3 text-xs font-semibold text-slate-700 flex items-center justify-between">
                  <span>Assigned Owner:</span>
                  <span className="text-emerald-700 font-bold">Your Account (Salesman)</span>
                </div>
              )}
            </div>
          </div>

          {/* Conversion Handover Notes */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
              Handover & Relationship Notes
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Closing notes, account nuances, key stakeholders, payment terms..."
              className="w-full rounded-lg border border-slate-300 py-2 px-3 text-xs sm:text-sm text-slate-800 focus:border-emerald-600 focus:outline-none placeholder:text-slate-400"
            />
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
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
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 disabled:opacity-50 transition cursor-pointer"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Converting Deal...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Complete Conversion to Client</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
