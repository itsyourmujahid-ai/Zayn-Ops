import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  Filter,
  Plus,
  Building2,
  Phone,
  MessageSquare,
  Mail,
  Flame,
  Calendar,
  Layers,
  MapPin,
  User,
  UserCheck,
  RotateCcw,
  Loader2,
  DollarSign,
  Briefcase,
  AlertTriangle,
  ChevronRight,
  Clock,
  ExternalLink,
} from 'lucide-react';
import { Badge } from '../components/common/Badge';
import { BulkActionToolbar } from '../components/common/BulkActionToolbar';
import { LeadRecord, UserProfile } from '../types/database';
import { subscribeToLeads, getAllUsers, getUserDisplayName } from '../lib/dal';
import { useAuth } from '../context/AuthContext';

interface LeadsPageProps {
  onOpenAddLead: () => void;
  onSelectLead?: (leadId: string) => void;
  initialStage?: string;
  initialPriority?: string;
  initialSalesman?: string;
}

export const LeadsPage: React.FC<LeadsPageProps> = ({
  onOpenAddLead,
  onSelectLead,
  initialStage,
  initialPriority,
  initialSalesman,
}) => {
  const { userProfile, currentUser, isAdmin } = useAuth();
  const [leads, setLeads] = useState<LeadRecord[]>([]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedLeadIdNotice, setSelectedLeadIdNotice] = useState<string | null>(null);
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(new Set());

  // Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStage, setSelectedStage] = useState(initialStage || 'all');
  const [selectedPriority, setSelectedPriority] = useState(initialPriority || 'all');
  const [selectedLeadType, setSelectedLeadType] = useState('all');
  const [selectedLocation, setSelectedLocation] = useState('all');
  const [selectedSalesman, setSelectedSalesman] = useState(initialSalesman || 'all');

  useEffect(() => {
    if (initialStage) setSelectedStage(initialStage);
  }, [initialStage]);

  useEffect(() => {
    if (initialPriority) setSelectedPriority(initialPriority);
  }, [initialPriority]);

  useEffect(() => {
    if (initialSalesman) setSelectedSalesman(initialSalesman);
  }, [initialSalesman]);

  // Load team users for display names and admin filter
  useEffect(() => {
    let isMounted = true;
    async function loadUsers() {
      try {
        const usersList = await getAllUsers();
        if (isMounted) {
          setAllUsers(usersList);
        }
      } catch (e: any) {
        console.warn('Error loading users list:', e);
      }
    }
    loadUsers();
    return () => {
      isMounted = false;
    };
  }, []);

  // Real-time Firestore Leads Subscription
  useEffect(() => {
    setLoading(true);
    setError(null);
    const activeUserId = userProfile?.id || currentUser?.uid;

    const unsubscribe = subscribeToLeads(
      (updatedLeads) => {
        setLeads(updatedLeads);
        setLoading(false);
        setError(null);
      },
      userProfile?.role,
      (err: any) => {
        console.warn('Leads subscription notification:', err);
        setError(
          err?.message?.includes('permission')
            ? 'Permission error: You are only authorized to view your assigned prospective client leads.'
            : 'Unable to stream live Firestore updates. Using offline synchronized cache.'
        );
        setLoading(false);
      },
      activeUserId
    );

    return () => unsubscribe();
  }, [userProfile?.role, userProfile?.id, currentUser?.uid]);

  // Extract distinct locations from leads for location filter dropdown
  const availableLocations = useMemo(() => {
    const set = new Set<string>();
    leads.forEach((l) => {
      if (l.location && l.location.trim()) {
        set.add(l.location.trim());
      }
    });
    return Array.from(set).sort();
  }, [leads]);

  // Extract distinct lead types
  const availableLeadTypes = useMemo(() => {
    const defaultTypes = ['b2b', 'b2c', 'enterprise', 'government', 'sme'];
    const set = new Set<string>(defaultTypes);
    leads.forEach((l) => {
      if (l.lead_type && l.lead_type.trim()) {
        set.add(l.lead_type.toLowerCase().trim());
      }
    });
    return Array.from(set).sort();
  }, [leads]);

  // Combined Filters & Full-Text Search Calculation
  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      // 1. Search across: Company Name, Contact Person, Phone, WhatsApp, Email
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const rawDigits = q.replace(/[^0-9]/g, '');

        const matchCompany = lead.company_name?.toLowerCase().includes(q);
        const matchContact = lead.contact_person?.toLowerCase().includes(q);
        const matchEmail = lead.email?.toLowerCase().includes(q);

        const phoneDigits = lead.phone?.replace(/[^0-9]/g, '') || '';
        const whatsappDigits = lead.whatsapp?.replace(/[^0-9]/g, '') || '';
        const matchPhone =
          (rawDigits.length > 2 && phoneDigits.includes(rawDigits)) ||
          lead.phone?.toLowerCase().includes(q);
        const matchWhatsApp =
          (rawDigits.length > 2 && whatsappDigits.includes(rawDigits)) ||
          lead.whatsapp?.toLowerCase().includes(q);
        const matchLocation = lead.location?.toLowerCase().includes(q);

        if (
          !matchCompany &&
          !matchContact &&
          !matchPhone &&
          !matchWhatsApp &&
          !matchEmail &&
          !matchLocation
        ) {
          return false;
        }
      }

      // 2. Stage / Status Filter
      if (selectedStage !== 'all' && lead.status.toLowerCase() !== selectedStage.toLowerCase()) {
        return false;
      }

      // 3. Priority Filter
      if (
        selectedPriority !== 'all' &&
        lead.priority.toLowerCase() !== selectedPriority.toLowerCase()
      ) {
        return false;
      }

      // 4. Lead Type Filter
      if (
        selectedLeadType !== 'all' &&
        lead.lead_type?.toLowerCase() !== selectedLeadType.toLowerCase()
      ) {
        return false;
      }

      // 5. Location Filter
      if (
        selectedLocation !== 'all' &&
        lead.location?.toLowerCase() !== selectedLocation.toLowerCase()
      ) {
        return false;
      }

      // 6. Admin-Only Salesman Filter
      if (isAdmin && selectedSalesman !== 'all') {
        const leadOwner = lead.assigned_to || '';
        if (leadOwner !== selectedSalesman) {
          const ownerName = getUserDisplayName(leadOwner, allUsers).toLowerCase();
          if (
            !ownerName.includes(selectedSalesman.toLowerCase()) &&
            leadOwner !== selectedSalesman
          ) {
            return false;
          }
        }
      }

      return true;
    });
  }, [
    leads,
    searchQuery,
    selectedStage,
    selectedPriority,
    selectedLeadType,
    selectedLocation,
    selectedSalesman,
    isAdmin,
    allUsers,
  ]);

  const salesmenUsers = allUsers.filter(
    (u) => u.role === 'SALESMAN' || u.role === 'sales_rep'
  );

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedStage('all');
    setSelectedPriority('all');
    setSelectedLeadType('all');
    setSelectedLocation('all');
    setSelectedSalesman('all');
  };

  const toggleLeadSelect = (leadId: string) => {
    setSelectedLeadIds((prev) => {
      const next = new Set(prev);
      if (next.has(leadId)) {
        next.delete(leadId);
      } else {
        next.add(leadId);
      }
      return next;
    });
  };

  const handleToggleSelectAll = () => {
    if (selectedLeadIds.size === filteredLeads.length && filteredLeads.length > 0) {
      setSelectedLeadIds(new Set());
    } else {
      setSelectedLeadIds(new Set(filteredLeads.map((l) => l.id)));
    }
  };

  const selectedLeadsList = useMemo(() => {
    return leads.filter((l) => selectedLeadIds.has(l.id));
  }, [leads, selectedLeadIds]);

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    selectedStage !== 'all' ||
    selectedPriority !== 'all' ||
    selectedLeadType !== 'all' ||
    selectedLocation !== 'all' ||
    (isAdmin && selectedSalesman !== 'all');

  const handleLeadRowClick = (lead: LeadRecord) => {
    // Prime the route for /leads/{leadId}
    if (typeof window !== 'undefined' && window.history) {
      window.history.pushState({ leadId: lead.id }, '', `/leads/${lead.id}`);
    }
    setSelectedLeadIdNotice(lead.id);
    if (onSelectLead) {
      onSelectLead(lead.id);
    }
    setTimeout(() => {
      setSelectedLeadIdNotice(null);
    }, 4000);
  };

  return (
    <div className="space-y-4">
      {/* Header & Quick Action */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-900">Leads Directory</h2>
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600 border border-slate-200">
              {filteredLeads.length} {filteredLeads.length === 1 ? 'lead' : 'leads'}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {isAdmin
              ? 'Administrator Overview: Full visibility across all sales representatives and pipeline accounts.'
              : `Sales Representative Pipeline: Viewing your assigned prospective client accounts (${
                  userProfile?.full_name || 'My Pipeline'
                }).`}
          </p>
        </div>
        <button
          id="btn-add-lead-top"
          type="button"
          onClick={onOpenAddLead}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-xs sm:text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 transition self-start sm:self-auto cursor-pointer shrink-0"
        >
          <Plus className="h-4 w-4" />
          <span>+ Add Lead</span>
        </button>
      </div>

      {/* Selected Lead Route Notice Banner */}
      {selectedLeadIdNotice && (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50/80 p-3 text-xs text-indigo-900 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <ExternalLink className="h-4 w-4 text-indigo-600 shrink-0" />
            <span>
              Route prepared for <strong>/leads/{selectedLeadIdNotice}</strong>. (Lead Details &amp;
              Timeline module will be integrated in the upcoming phase).
            </span>
          </div>
          <button
            type="button"
            onClick={() => setSelectedLeadIdNotice(null)}
            className="text-xs text-indigo-700 hover:text-indigo-950 font-semibold cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Error / Warning Notice */}
      {error && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Search & Filter Bar */}
      <div className="rounded-xl border border-slate-200 bg-white p-3.5 sm:p-4 shadow-xs">
        <div className="flex flex-col gap-3">
          {/* Main Search Input */}
          <div className="relative w-full">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              id="search-leads-input"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by Company Name, Contact Person, Phone, WhatsApp, or Email..."
              className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-xs sm:text-sm focus:border-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-600"
            />
          </div>

          {/* Filters Row */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Admin-Only Salesman Filter Dropdown */}
            {isAdmin && (
              <div className="flex items-center">
                <select
                  id="filter-salesman-select"
                  value={selectedSalesman}
                  onChange={(e) => setSelectedSalesman(e.target.value)}
                  className="rounded-lg border border-indigo-200 py-1.5 px-3 text-xs focus:border-indigo-600 focus:outline-none bg-indigo-50/70 text-indigo-950 font-medium cursor-pointer"
                  title="Filter by Assigned Salesman (Admin Only)"
                >
                  <option value="all">All Salesmen</option>
                  {salesmenUsers.map((salesman) => (
                    <option key={salesman.id} value={salesman.id}>
                      👤 {salesman.full_name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Status / Stage Filter */}
            <select
              id="filter-stage-select"
              value={selectedStage}
              onChange={(e) => setSelectedStage(e.target.value)}
              className="rounded-lg border border-slate-300 py-1.5 px-3 text-xs focus:border-indigo-600 focus:outline-none bg-white text-slate-700 font-medium cursor-pointer"
            >
              <option value="all">All Stages</option>
              <option value="new">New</option>
              <option value="contacted">Contacted</option>
              <option value="interested">Interested</option>
              <option value="meeting">Meeting</option>
              <option value="quotation">Quotation</option>
              <option value="negotiation">Negotiation</option>
              <option value="won">Won</option>
              <option value="lost">Lost</option>
            </select>

            {/* Priority Filter */}
            <select
              id="filter-priority-select"
              value={selectedPriority}
              onChange={(e) => setSelectedPriority(e.target.value)}
              className="rounded-lg border border-slate-300 py-1.5 px-3 text-xs focus:border-indigo-600 focus:outline-none bg-white text-slate-700 font-medium cursor-pointer"
            >
              <option value="all">All Priorities</option>
              <option value="hot">🔥 Hot</option>
              <option value="warm">⚡ Warm</option>
              <option value="cold">❄️ Cold</option>
            </select>

            {/* Lead Type Filter */}
            <select
              id="filter-lead-type-select"
              value={selectedLeadType}
              onChange={(e) => setSelectedLeadType(e.target.value)}
              className="rounded-lg border border-slate-300 py-1.5 px-3 text-xs focus:border-indigo-600 focus:outline-none bg-white text-slate-700 font-medium cursor-pointer capitalize"
            >
              <option value="all">All Lead Types</option>
              {availableLeadTypes.map((type) => (
                <option key={type} value={type}>
                  {type.toUpperCase()}
                </option>
              ))}
            </select>

            {/* Location Filter */}
            {availableLocations.length > 0 && (
              <select
                id="filter-location-select"
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value)}
                className="rounded-lg border border-slate-300 py-1.5 px-3 text-xs focus:border-indigo-600 focus:outline-none bg-white text-slate-700 font-medium cursor-pointer"
              >
                <option value="all">All Locations</option>
                {availableLocations.map((loc) => (
                  <option key={loc} value={loc}>
                    📍 {loc}
                  </option>
                ))}
              </select>
            )}

            {/* Clear / Reset Filters Button */}
            {hasActiveFilters && (
              <button
                id="btn-clear-filters"
                type="button"
                onClick={handleResetFilters}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                title="Clear all active filters"
              >
                <RotateCcw className="h-3 w-3" />
                <span>Clear Filters</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Leads Table Container */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
            <Loader2 className="h-8 w-8 text-indigo-600 animate-spin mb-3" />
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Loading Real-Time Leads...
            </h4>
            <p className="text-[11px] text-slate-400 mt-1">
              Synchronizing Firestore database listener
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <th className="w-10 px-3 py-3 text-center">
                    <input
                      type="checkbox"
                      checked={selectedLeadIds.size > 0 && selectedLeadIds.size === filteredLeads.length}
                      ref={(input) => {
                        if (input) {
                          input.indeterminate = selectedLeadIds.size > 0 && selectedLeadIds.size < filteredLeads.length;
                        }
                      }}
                      onChange={handleToggleSelectAll}
                      aria-label="Select all leads"
                      className="h-4 w-4 rounded-sm border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                  </th>
                  <th className="px-4 py-3 sm:px-6">Company / Client</th>
                  <th className="px-4 py-3">Contact Person &amp; Info</th>
                  <th className="px-4 py-3">Lead Type</th>
                  <th className="px-4 py-3">Location</th>
                  <th className="px-4 py-3">Priority</th>
                  <th className="px-4 py-3">Status</th>
                  {isAdmin && <th className="px-4 py-3">Assigned Salesman</th>}
                  <th className="px-4 py-3">Created Date</th>
                  <th className="px-4 py-3 text-right">Quick Contact</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {filteredLeads.length === 0 ? (
                  <tr>
                    <td colSpan={isAdmin ? 10 : 9} className="px-6 py-14 text-center">
                      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                        <Building2 className="h-6 w-6" />
                      </div>
                      <h3 className="mt-3 text-sm font-semibold text-slate-900">
                        {hasActiveFilters
                          ? 'No leads match your search.'
                          : isAdmin
                          ? 'No leads have been created yet.'
                          : 'You currently have no assigned leads.'}
                      </h3>
                      <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
                        {hasActiveFilters
                          ? 'Try adjusting your search keywords, status, priority, lead type, or salesman filters.'
                          : isAdmin
                          ? 'Click the button below to add your first corporate lead to the database.'
                          : 'New prospective accounts assigned to you by the Admin will appear here in real-time.'}
                      </p>
                      <div className="mt-4 flex items-center justify-center gap-2">
                        {hasActiveFilters ? (
                          <button
                            type="button"
                            onClick={handleResetFilters}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                            <span>Clear Filters</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={onOpenAddLead}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 transition cursor-pointer"
                          >
                            <Plus className="h-3.5 w-3.5" />
                            <span>+ Add First Lead</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredLeads.map((lead) => {
                    const whatsappClean = (lead.whatsapp || lead.phone || '').replace(/[^0-9]/g, '');
                    const phoneClean = (lead.phone || '').replace(/[^0-9+]/g, '');
                    const assignedSalesmanName = getUserDisplayName(lead.assigned_to, allUsers);
                    const formattedCreatedDate = lead.created_at
                      ? new Date(lead.created_at).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })
                      : '—';

                    return (
                      <tr
                        key={lead.id}
                        id={`lead-row-${lead.id}`}
                        onClick={() => handleLeadRowClick(lead)}
                        className={`transition group cursor-pointer ${
                          selectedLeadIds.has(lead.id) ? 'bg-indigo-50/70' : 'hover:bg-indigo-50/40'
                        }`}
                        title="Click to view lead details"
                      >
                        {/* Row Selection Checkbox */}
                        <td
                          className="w-10 px-3 py-3.5 text-center"
                          onClick={(e) => {
                            e.stopPropagation();
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={selectedLeadIds.has(lead.id)}
                            onChange={() => toggleLeadSelect(lead.id)}
                            aria-label={`Select ${lead.company_name}`}
                            className="h-4 w-4 rounded-sm border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                          />
                        </td>

                        {/* Company / Account */}
                        <td className="px-4 py-3.5 sm:px-6">
                          <div className="font-semibold text-slate-900 group-hover:text-indigo-600 transition flex items-center gap-2">
                            <span>{lead.company_name}</span>
                            {lead.estimated_value && lead.estimated_value > 0 ? (
                              <span className="inline-flex items-center text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-md border border-emerald-200">
                                {lead.estimated_value.toLocaleString()} OMR
                              </span>
                            ) : null}
                          </div>
                          {lead.next_action && (
                            <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1">
                              <span className="text-slate-400 font-medium">Next:</span>
                              <span className="truncate max-w-[180px]">{lead.next_action}</span>
                            </div>
                          )}
                        </td>

                        {/* Contact Person & Contact Numbers */}
                        <td className="px-4 py-3.5">
                          <div className="text-xs font-medium text-slate-900 flex items-center gap-1">
                            <User className="h-3 w-3 text-slate-400" />
                            <span>{lead.contact_person || 'No Contact Person'}</span>
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5 font-mono">
                            {lead.phone || lead.whatsapp || lead.email || '—'}
                          </div>
                        </td>

                        {/* Lead Type */}
                        <td className="px-4 py-3.5">
                          <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 capitalize border border-slate-200">
                            {lead.lead_type ? lead.lead_type.replace('_', ' ') : 'B2B'}
                          </span>
                        </td>

                        {/* Location */}
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-1 text-xs text-slate-700">
                            <MapPin className="h-3 w-3 text-slate-400 shrink-0" />
                            <span className="truncate max-w-[120px]">
                              {lead.location || '—'}
                            </span>
                          </div>
                        </td>

                        {/* Priority */}
                        <td className="px-4 py-3.5">
                          <Badge priority={lead.priority?.toLowerCase() as any} size="sm">
                            {lead.priority}
                          </Badge>
                        </td>

                        {/* Status / Stage */}
                        <td className="px-4 py-3.5">
                          <Badge stage={lead.status?.toLowerCase() as any} size="sm">
                            {lead.status}
                          </Badge>
                        </td>

                        {/* Admin Assigned Salesman Column */}
                        {isAdmin && (
                          <td className="px-4 py-3.5">
                            <div className="inline-flex items-center gap-1.5 rounded-md bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-900 border border-indigo-200">
                              <UserCheck className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
                              <span className="truncate max-w-[120px] font-semibold">
                                {assignedSalesmanName}
                              </span>
                            </div>
                          </td>
                        )}

                        {/* Created Date */}
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-1 text-xs text-slate-500">
                            <Clock className="h-3 w-3 text-slate-400 shrink-0" />
                            <span>{formattedCreatedDate}</span>
                          </div>
                        </td>

                        {/* Quick Contact Actions (Stop event propagation so clicking icon doesn't trigger row click) */}
                        <td className="px-4 py-3.5 text-right">
                          <div
                            className="flex items-center justify-end gap-1.5"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {whatsappClean && (
                              <a
                                href={`https://wa.me/${whatsappClean}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="rounded-lg bg-emerald-50 p-1.5 text-emerald-600 hover:bg-emerald-100 transition shadow-2xs"
                                title="Chat on WhatsApp"
                              >
                                <MessageSquare className="h-4 w-4" />
                              </a>
                            )}
                            {phoneClean && (
                              <a
                                href={`tel:${phoneClean}`}
                                className="rounded-lg bg-indigo-50 p-1.5 text-indigo-600 hover:bg-indigo-100 transition shadow-2xs"
                                title="Call Phone"
                              >
                                <Phone className="h-4 w-4" />
                              </a>
                            )}
                            {lead.email && (
                              <a
                                href={`mailto:${lead.email}`}
                                className="rounded-lg bg-slate-100 p-1.5 text-slate-600 hover:bg-slate-200 transition shadow-2xs"
                                title="Send Email"
                              >
                                <Mail className="h-4 w-4" />
                              </a>
                            )}
                            <div className="text-slate-300 group-hover:text-indigo-600 transition pl-1">
                              <ChevronRight className="h-4 w-4" />
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Floating Bulk Action Bar for Selected Leads */}
      <BulkActionToolbar
        mode="leads"
        selectedItems={selectedLeadsList}
        allTeamUsers={allUsers}
        onClearSelection={() => setSelectedLeadIds(new Set())}
        onOperationComplete={() => setSelectedLeadIds(new Set())}
      />
    </div>
  );
};
