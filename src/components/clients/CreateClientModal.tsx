import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Building2,
  Phone,
  MessageSquare,
  Mail,
  MapPin,
  User,
  AlertCircle,
  Loader2,
  CheckCircle2,
  ShieldAlert,
  HelpCircle,
  Sparkles,
} from 'lucide-react';
import { UserProfile, ClientRecord, CreateClientInput } from '../../types/database';
import {
  createClient,
  getActiveSalesmen,
  checkClientPotentialDuplicateSync,
} from '../../lib/dal';
import { useAuth } from '../../context/AuthContext';

interface CreateClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: (client: ClientRecord) => void;
  onViewExistingClient?: (clientId: string) => void;
  onOpenTransfer?: (client: ClientRecord) => void;
}

export const CreateClientModal: React.FC<CreateClientModalProps> = ({
  isOpen,
  onClose,
  onCreated,
  onViewExistingClient,
  onOpenTransfer,
}) => {
  const { userProfile, currentUser, isAdmin, isSuperAdmin, hasPermission } = useAuth();

  const [companyName, setCompanyName] = useState<string>('');
  const [contactPerson, setContactPerson] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [whatsapp, setWhatsapp] = useState<string>('');
  const [sameAsPhone, setSameAsPhone] = useState<boolean>(true);
  const [email, setEmail] = useState<string>('');
  const [address, setAddress] = useState<string>('');
  const [clientType, setClientType] = useState<string>('Corporate');
  const [source, setSource] = useState<string>('Direct Customer');
  const [notes, setNotes] = useState<string>('');
  const [selectedOwnerId, setSelectedOwnerId] = useState<string>('');

  const [teamMembers, setTeamMembers] = useState<UserProfile[]>([]);
  const [loadingTeam, setLoadingTeam] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Can reassign owner on creation: Admin or salesmen with LEADS_ASSIGN/CLIENTS_TRANSFER
  const canAssignOther = isAdmin || isSuperAdmin || hasPermission('LEADS_ASSIGN') || hasPermission('CLIENTS_TRANSFER');

  // Initialize
  useEffect(() => {
    if (isOpen) {
      setCompanyName('');
      setContactPerson('');
      setPhone('');
      setWhatsapp('');
      setSameAsPhone(true);
      setEmail('');
      setAddress('');
      setClientType('Corporate');
      setSource('Direct Existing Customer');
      setNotes('');
      setSubmitError(null);

      const myId = userProfile?.id || currentUser?.uid || '';
      setSelectedOwnerId(myId);

      setLoadingTeam(true);
      getActiveSalesmen()
        .then((users) => {
          setTeamMembers(users);
        })
        .catch((err) => console.warn('Failed to load team members:', err))
        .finally(() => setLoadingTeam(false));
    }
  }, [isOpen, userProfile?.id, currentUser?.uid]);

  // Sync WhatsApp with Phone if checkbox enabled
  const handlePhoneChange = (val: string) => {
    setPhone(val);
    if (sameAsPhone) {
      setWhatsapp(val);
    }
  };

  const handleCheckboxChange = (checked: boolean) => {
    setSameAsPhone(checked);
    if (checked) {
      setWhatsapp(phone);
    }
  };

  // Real-time Duplicate Check within the Company
  const duplicateState = useMemo(() => {
    if (!phone.trim() && !companyName.trim() && !email.trim()) {
      return { isHardDuplicate: false, hardDuplicateReason: '', softWarnings: [] as string[], existingMatch: undefined };
    }
    return checkClientPotentialDuplicateSync(
      {
        phone: phone.trim(),
        company_name: companyName.trim(),
        email: email.trim(),
      },
      userProfile?.company_id
    );
  }, [phone, companyName, email, userProfile?.company_id]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!contactPerson.trim() && !companyName.trim()) {
      setSubmitError('Client Name or Company Name is required.');
      return;
    }
    if (!phone.trim()) {
      setSubmitError('Phone number is required to register a client.');
      return;
    }

    if (duplicateState.isHardDuplicate) {
      setSubmitError(duplicateState.hardDuplicateReason || 'A client with this phone number already exists.');
      return;
    }

    const assignedOwner = teamMembers.find((u) => u.id === selectedOwnerId);
    const ownerName = assignedOwner?.full_name || userProfile?.full_name || currentUser?.displayName || 'Sales Representative';
    const effectiveCompName = companyName.trim() || contactPerson.trim();
    const effectiveContact = contactPerson.trim() || companyName.trim();

    const input: CreateClientInput = {
      name: effectiveContact,
      company_name: effectiveCompName,
      contact_person: effectiveContact,
      phone: phone.trim(),
      whatsapp: sameAsPhone ? phone.trim() : whatsapp.trim(),
      email: email.trim(),
      address: address.trim(),
      location: address.trim(),
      client_type: clientType,
      source: source,
      owner_id: selectedOwnerId || userProfile?.id || currentUser?.uid || '',
      owner_name: ownerName,
      status: 'Active',
      notes: notes.trim(),
      company_id: userProfile?.company_id,
    };

    try {
      setSubmitting(true);
      const created = await createClient(input);
      onCreated?.(created);
      onClose();
    } catch (err: any) {
      console.error('Failed to create client:', err);
      setSubmitError(err?.message || 'Failed to register client account. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-3 sm:p-4 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-xl rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden my-6 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-emerald-100 p-2.5 text-emerald-700 border border-emerald-200">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Add Customer / Client Account</h2>
              <p className="text-xs text-slate-500">
                Register a new or existing business client into your company portfolio.
              </p>
            </div>
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

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* HARD DUPLICATE PROTECTION WARNING (Requirement 4) */}
          {duplicateState.isHardDuplicate && duplicateState.existingMatch && (
            <div className="rounded-xl border border-rose-300 bg-rose-50/95 p-4 text-xs text-rose-950 shadow-xs space-y-3">
              <div className="flex items-center gap-2 text-rose-800 font-bold text-sm">
                <ShieldAlert className="h-5 w-5 text-rose-600 shrink-0" />
                <span>Client already exists</span>
              </div>

              <div className="bg-white rounded-xl border border-rose-200 p-3.5 space-y-2 shadow-2xs">
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <p className="font-bold text-slate-900 text-sm">
                      {duplicateState.existingMatch.company_name}
                    </p>
                    {(duplicateState.existingMatch.contact_person || duplicateState.existingMatch.name) && (
                      <p className="text-xs text-slate-600 mt-0.5">
                        <span className="font-medium text-slate-400">Client Name:</span>{' '}
                        {duplicateState.existingMatch.contact_person || duplicateState.existingMatch.name}
                      </p>
                    )}
                  </div>
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
                    {duplicateState.existingMatch.status}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1.5 border-t border-slate-100">
                  <div>
                    <span className="font-medium text-slate-500">Phone:</span>{' '}
                    <span className="font-semibold text-slate-800">{duplicateState.existingMatch.phone}</span>
                  </div>
                  <div>
                    <span className="font-medium text-slate-500">Current Owner:</span>{' '}
                    <span className="font-bold text-slate-900">
                      {duplicateState.existingMatch.owner_name || 'Team member'}
                    </span>
                  </div>
                </div>

                <div className="text-xs font-semibold text-rose-700 bg-rose-50 px-3 py-2 rounded-lg border border-rose-100">
                  “This client is already assigned to {duplicateState.existingMatch.owner_name || 'another representative'}.”
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                {onViewExistingClient && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onViewExistingClient(duplicateState.existingMatch!.id);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-700 transition cursor-pointer"
                  >
                    <span>View Client</span>
                  </button>
                )}
                {onOpenTransfer && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenTransfer(duplicateState.existingMatch!);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white font-bold text-xs hover:bg-indigo-700 transition cursor-pointer"
                  >
                    <span>Request / Transfer Ownership</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 font-semibold text-xs hover:bg-slate-50 transition cursor-pointer"
                >
                  <span>Cancel</span>
                </button>
              </div>
            </div>
          )}

          {/* SOFT DUPLICATE WARNINGS (Requirement 5) */}
          {!duplicateState.isHardDuplicate && duplicateState.softWarnings.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-800 flex items-start gap-2.5">
              <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <p className="font-bold text-amber-900">Possible existing client found:</p>
                {duplicateState.softWarnings.map((msg, idx) => (
                  <p key={idx} className="text-[11px] text-amber-700 font-medium">
                    • {msg}
                  </p>
                ))}
              </div>
            </div>
          )}

          {/* Submit Error */}
          {submitError && !duplicateState.isHardDuplicate && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
              <span>{submitError}</span>
            </div>
          )}

          {/* Section 1: Name & Company (Requirement 3: Name is required, Company Name optional) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Client / Contact Name <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <User className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  required
                  value={contactPerson}
                  onChange={(e) => setContactPerson(e.target.value)}
                  placeholder="E.g., Eng. Tariq Al-Balushi"
                  className="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-xs sm:text-sm text-slate-800 focus:border-emerald-600 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Company / Business Name
              </label>
              <div className="relative">
                <Building2 className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="E.g., Bahwan Contracting LLC"
                  className="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-xs sm:text-sm text-slate-800 focus:border-emerald-600 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Phone & WhatsApp */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                  onChange={(e) => handlePhoneChange(e.target.value)}
                  placeholder="+968 9123 4567"
                  className={`w-full rounded-lg border pl-9 pr-3 py-2 text-xs sm:text-sm text-slate-800 focus:outline-none ${
                    duplicateState.isHardDuplicate
                      ? 'border-rose-400 bg-rose-50/40 text-rose-900 focus:border-rose-600'
                      : 'border-slate-300 focus:border-emerald-600'
                  }`}
                />
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                Enforces duplicate prevention within your company.
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  WhatsApp Number
                </label>
                <label className="inline-flex items-center gap-1 text-[11px] text-slate-500 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sameAsPhone}
                    onChange={(e) => handleCheckboxChange(e.target.checked)}
                    className="rounded border-slate-300 text-emerald-600 focus:ring-0"
                  />
                  <span>Same as phone</span>
                </label>
              </div>
              <div className="relative">
                <MessageSquare className="absolute left-3 top-2.5 h-4 w-4 text-emerald-600" />
                <input
                  type="tel"
                  disabled={sameAsPhone}
                  value={sameAsPhone ? phone : whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  placeholder="+968 9123 4567"
                  className="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-xs sm:text-sm text-slate-800 disabled:bg-slate-50 disabled:text-slate-500 focus:border-emerald-600 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Email & Address */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                  placeholder="contact@bahwanmge.com"
                  className="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-xs sm:text-sm text-slate-800 focus:border-emerald-600 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Location / Address
              </label>
              <div className="relative">
                <MapPin className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Ruwi / Al Khuwair, Muscat"
                  className="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-xs sm:text-sm text-slate-800 focus:border-emerald-600 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Section 4: Type, Source & Owner */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Client Category
              </label>
              <select
                value={clientType}
                onChange={(e) => setClientType(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white py-2 px-3 text-xs sm:text-sm text-slate-800 focus:border-emerald-600 focus:outline-none"
              >
                <option value="Corporate">Corporate</option>
                <option value="Government">Government / Semi-Gov</option>
                <option value="SME">SME / Commercial</option>
                <option value="Retail / Individual">Retail / Individual</option>
                <option value="Fitout Partner">Fitout Partner</option>
                <option value="Consultant">Consultant</option>
                <option value="Direct Customer">Direct Customer</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Acquisition Source
              </label>
              <select
                value={source}
                onChange={(e) => setSource(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white py-2 px-3 text-xs sm:text-sm text-slate-800 focus:border-emerald-600 focus:outline-none"
              >
                <option value="Direct Existing Customer">Direct Existing Customer</option>
                <option value="Personal Network">Personal Network</option>
                <option value="Referral">Referral</option>
                <option value="Trade Exhibition">Trade Exhibition</option>
                <option value="Inbound Request">Inbound Request</option>
                <option value="Cold Visit / Prospecting">Cold Visit / Prospecting</option>
                <option value="Website">Website</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Account Owner
              </label>
              {canAssignOther && teamMembers.length > 0 ? (
                <select
                  value={selectedOwnerId}
                  onChange={(e) => setSelectedOwnerId(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white py-2 px-3 text-xs sm:text-sm font-medium text-slate-800 focus:border-emerald-600 focus:outline-none"
                >
                  {teamMembers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.full_name} {m.id === (userProfile?.id || currentUser?.uid) ? '(You)' : ''}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="rounded-lg bg-slate-50 border border-slate-200 py-2 px-3 text-xs font-semibold text-slate-800">
                  {userProfile?.full_name || currentUser?.displayName || 'My Account'}
                </div>
              )}
            </div>
          </div>

          {/* Section 5: Handover / Relationship Notes */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
              Account Handover & Business Background
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="E.g., Existing repeat client for HVAC and fitout supplies. Payment terms: 30 days credit..."
              className="w-full rounded-lg border border-slate-300 py-2 px-3 text-xs sm:text-sm text-slate-800 focus:border-emerald-600 focus:outline-none placeholder:text-slate-400"
            />
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || duplicateState.isHardDuplicate}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 disabled:opacity-50 transition cursor-pointer"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Registering Client...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Register Client</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
