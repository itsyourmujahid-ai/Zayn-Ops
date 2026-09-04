import React, { useState, useEffect, useMemo } from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  GitMerge,
  CheckCircle2,
  Filter,
  Search,
  ArrowRight,
  ExternalLink,
  Sparkles,
  Building2,
  User,
  Phone,
  Mail,
  RefreshCw,
  EyeOff,
  Check,
  X,
  TrendingUp,
  HelpCircle,
} from 'lucide-react';
import {
  LeadRecord,
  ClientRecord,
  DuplicateMatchCandidate,
  NotDuplicateRecord,
} from '../types/database';
import {
  subscribeToLeads,
  subscribeToClients,
  subscribeToNotDuplicates,
  markAsNotDuplicate,
  unmarkNotDuplicate,
} from '../lib/dal';
import {
  findAllLeadDuplicateCandidates,
  findAllClientDuplicateCandidates,
  evaluateDatabaseCompleteness,
} from '../lib/dataQuality';
import { RecordMergeModal } from '../components/data-quality/RecordMergeModal';
import { useAuth } from '../context/AuthContext';

interface DataQualityPageProps {
  onNavigateToLead?: (leadId: string) => void;
  onNavigateToClient?: (clientId: string) => void;
}

export const DataQualityPage: React.FC<DataQualityPageProps> = ({
  onNavigateToLead,
  onNavigateToClient,
}) => {
  const { userProfile, isAdmin } = useAuth();

  const [leads, setLeads] = useState<LeadRecord[]>([]);
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [notDuplicates, setNotDuplicates] = useState<NotDuplicateRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Active Tab
  const [activeTab, setActiveTab] = useState<'duplicates' | 'dismissed' | 'hygiene'>('duplicates');

  // Filters
  const [entityFilter, setEntityFilter] = useState<'all' | 'Lead' | 'Client'>('all');
  const [confidenceFilter, setConfidenceFilter] = useState<'all' | 'high' | 'medium'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Selected pair for Merge Modal
  const [activeMergeCandidate, setActiveMergeCandidate] = useState<DuplicateMatchCandidate | null>(
    null
  );

  // Notification / Feedback banner
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // Real-time subscriptions
  useEffect(() => {
    setLoading(true);
    const unsubLeads = subscribeToLeads(
      (allLeads) => {
        setLeads(allLeads);
      },
      userProfile?.role,
      undefined,
      undefined,
      true // include merged records for comprehensive audits
    );

    const unsubClients = subscribeToClients(
      (allClients) => {
        setClients(allClients);
      },
      userProfile?.role,
      undefined,
      undefined,
      true // include merged
    );

    const unsubNotDuplicates = subscribeToNotDuplicates((records) => {
      setNotDuplicates(records);
      setLoading(false);
    });

    return () => {
      unsubLeads();
      unsubClients();
      unsubNotDuplicates();
    };
  }, [userProfile?.role]);

  // Exclude already merged records from active duplicate detection
  const activeLeads = useMemo(() => leads.filter((l) => l.record_status !== 'merged'), [leads]);
  const activeClients = useMemo(
    () => clients.filter((c) => c.record_status !== 'merged'),
    [clients]
  );

  // Calculate potential duplicate candidates
  const leadDuplicates = useMemo(() => {
    return findAllLeadDuplicateCandidates(activeLeads, notDuplicates);
  }, [activeLeads, notDuplicates]);

  const clientDuplicates = useMemo(() => {
    return findAllClientDuplicateCandidates(activeClients, notDuplicates);
  }, [activeClients, notDuplicates]);

  const allDuplicates = useMemo(() => {
    return [...leadDuplicates, ...clientDuplicates].sort(
      (a, b) => b.confidence_score - a.confidence_score
    );
  }, [leadDuplicates, clientDuplicates]);

  // Data completeness health analysis
  const hygieneReport = useMemo(() => {
    return evaluateDatabaseCompleteness(activeLeads, activeClients);
  }, [activeLeads, activeClients]);

  // Filtered duplicates
  const filteredDuplicates = useMemo(() => {
    return allDuplicates.filter((candidate) => {
      if (entityFilter !== 'all' && candidate.entity_type !== entityFilter) return false;
      if (confidenceFilter === 'high' && candidate.confidence_score < 90) return false;
      if (
        confidenceFilter === 'medium' &&
        (candidate.confidence_score >= 90 || candidate.confidence_score < 70)
      ) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesA =
          candidate.record_a.company_name?.toLowerCase().includes(q) ||
          candidate.record_a.phone?.includes(q) ||
          candidate.record_a.contact_person?.toLowerCase().includes(q);
        const matchesB =
          candidate.record_b.company_name?.toLowerCase().includes(q) ||
          candidate.record_b.phone?.includes(q) ||
          candidate.record_b.contact_person?.toLowerCase().includes(q);
        return matchesA || matchesB;
      }
      return true;
    });
  }, [allDuplicates, entityFilter, confidenceFilter, searchQuery]);

  const handleDismiss = async (candidate: DuplicateMatchCandidate) => {
    if (!isAdmin) {
      setActionNotice('Administrator permissions required to dismiss duplicate alerts.');
      return;
    }
    try {
      await markAsNotDuplicate(
        candidate.record_a.id,
        candidate.record_b.id,
        candidate.entity_type
      );
      setActionNotice(
        `Marked ${candidate.entity_type} pair (${candidate.record_a.company_name} & ${candidate.record_b.company_name}) as distinct.`
      );
      setTimeout(() => setActionNotice(null), 4000);
    } catch (e: any) {
      setActionNotice(`Failed to dismiss: ${e?.message || 'Error occurred'}`);
    }
  };

  const handleRestoreDismissed = async (pairId: string) => {
    if (!isAdmin) return;
    try {
      await unmarkNotDuplicate(pairId);
      setActionNotice('Restored pair back to active duplicate evaluation.');
      setTimeout(() => setActionNotice(null), 4000);
    } catch (e: any) {
      setActionNotice(`Error restoring pair: ${e?.message}`);
    }
  };

  // High confidence count
  const highConfidenceCount = allDuplicates.filter((d) => d.confidence_score >= 90).length;

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner & Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Data Quality & Deduplication
            </h1>
            <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700 border border-indigo-200">
              Phase S Engine
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-0.5">
            Identify potential duplicates across Leads and Clients, resolve field conflicts safely, and audit database health.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-2xs">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            <span>Role: {userProfile?.role || 'User'}</span>
          </div>
        </div>
      </div>

      {actionNotice && (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50/90 p-3.5 text-sm text-indigo-900 shadow-2xs flex items-center justify-between">
          <span>{actionNotice}</span>
          <button
            type="button"
            onClick={() => setActionNotice(null)}
            className="text-indigo-600 hover:text-indigo-900 font-bold"
          >
            ×
          </button>
        </div>
      )}

      {/* KPI Stats Overview */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Data Cleanliness Score */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Cleanliness Health
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                hygieneReport.score >= 90
                  ? 'bg-emerald-100 text-emerald-800'
                  : hygieneReport.score >= 75
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-rose-100 text-rose-800'
              }`}
            >
              {hygieneReport.score}%
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold tracking-tight text-slate-900">
              {hygieneReport.score}/100
            </span>
            <span className="text-xs text-slate-400">composite</span>
          </div>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className={`h-full transition-all duration-500 ${
                hygieneReport.score >= 90
                  ? 'bg-emerald-500'
                  : hygieneReport.score >= 75
                  ? 'bg-amber-500'
                  : 'bg-rose-500'
              }`}
              style={{ width: `${hygieneReport.score}%` }}
            />
          </div>
        </div>

        {/* Potential Duplicate Pairs */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Potential Duplicates
            </span>
            <GitMerge className="h-4 w-4 text-amber-500" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold tracking-tight text-slate-900">
              {allDuplicates.length}
            </span>
            <span className="text-xs text-amber-600 font-medium">
              ({highConfidenceCount} high confidence)
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            {leadDuplicates.length} Leads • {clientDuplicates.length} Clients
          </p>
        </div>

        {/* Dismissed ("Not Duplicates") */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Dismissed Pairs
            </span>
            <EyeOff className="h-4 w-4 text-slate-400" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold tracking-tight text-slate-900">
              {notDuplicates.length}
            </span>
            <span className="text-xs text-slate-400">verified distinct</span>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Manually reviewed by Administrators
          </p>
        </div>

        {/* Incomplete / Invalid Records */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Data Gaps
            </span>
            <AlertTriangle className="h-4 w-4 text-rose-500" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold tracking-tight text-slate-900">
              {hygieneReport.issues.length}
            </span>
            <span className="text-xs text-rose-600 font-medium">records missing info</span>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Phone, Email, or Closing Dates missing
          </p>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <div className="border-b border-slate-200">
        <nav className="flex space-x-6">
          <button
            type="button"
            id="tab-duplicates"
            onClick={() => setActiveTab('duplicates')}
            className={`flex items-center gap-2 border-b-2 py-3 px-1 text-sm font-semibold transition ${
              activeTab === 'duplicates'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'
            }`}
          >
            <GitMerge className="h-4 w-4" />
            <span>Potential Duplicates</span>
            {allDuplicates.length > 0 && (
              <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-bold text-indigo-700">
                {allDuplicates.length}
              </span>
            )}
          </button>

          <button
            type="button"
            id="tab-dismissed"
            onClick={() => setActiveTab('dismissed')}
            className={`flex items-center gap-2 border-b-2 py-3 px-1 text-sm font-semibold transition ${
              activeTab === 'dismissed'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'
            }`}
          >
            <EyeOff className="h-4 w-4" />
            <span>Dismissed Pairs</span>
            {notDuplicates.length > 0 && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                {notDuplicates.length}
              </span>
            )}
          </button>

          <button
            type="button"
            id="tab-hygiene"
            onClick={() => setActiveTab('hygiene')}
            className={`flex items-center gap-2 border-b-2 py-3 px-1 text-sm font-semibold transition ${
              activeTab === 'hygiene'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'
            }`}
          >
            <AlertTriangle className="h-4 w-4" />
            <span>Data Hygiene & Missing Fields</span>
            {hygieneReport.issues.length > 0 && (
              <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-700">
                {hygieneReport.issues.length}
              </span>
            )}
          </button>
        </nav>
      </div>

      {/* Tab 1: Potential Duplicates */}
      {activeTab === 'duplicates' && (
        <div className="space-y-4">
          {/* Controls & Filter Bar */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                id="search-duplicates-input"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by company, phone, or contact..."
                className="w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            <div className="flex items-center gap-3">
              <select
                id="filter-entity-select"
                value={entityFilter}
                onChange={(e) => setEntityFilter(e.target.value as any)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 focus:border-indigo-500 focus:outline-none"
              >
                <option value="all">All Records (Leads & Clients)</option>
                <option value="Lead">Leads Only</option>
                <option value="Client">Clients Only</option>
              </select>

              <select
                id="filter-confidence-select"
                value={confidenceFilter}
                onChange={(e) => setConfidenceFilter(e.target.value as any)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 focus:border-indigo-500 focus:outline-none"
              >
                <option value="all">All Match Levels</option>
                <option value="high">High Confidence (90%+)</option>
                <option value="medium">Medium Confidence (70-89%)</option>
              </select>
            </div>
          </div>

          {/* Duplicates List */}
          {filteredDuplicates.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-2xs">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 mb-3">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <h3 className="text-base font-semibold text-slate-900">No Potential Duplicates Found</h3>
              <p className="text-sm text-slate-500 max-w-md mx-auto mt-1">
                Your database is in great shape! No matching phone numbers, emails, or company names were detected.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredDuplicates.map((candidate) => {
                const recA = candidate.record_a;
                const recB = candidate.record_b;
                const isHigh = candidate.confidence_score >= 90;

                return (
                  <div
                    key={candidate.pair_id}
                    className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs transition hover:shadow-xs"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between pb-4 border-b border-slate-100">
                      <div className="flex items-center gap-3">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                            isHigh
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {candidate.confidence_score}% Match Confidence
                        </span>
                        <span className="text-xs font-semibold text-slate-600">
                          {candidate.entity_type} Duplicate Candidate
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {candidate.match_reasons.map((reason, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700"
                          >
                            <Sparkles className="w-3 h-3 text-indigo-500" />
                            <span>{reason}</span>
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Side-by-side card preview */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-4">
                      {/* Record A */}
                      <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                            Record 1 ({candidate.entity_type})
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              candidate.entity_type === 'Lead'
                                ? onNavigateToLead?.(recA.id)
                                : onNavigateToClient?.(recA.id)
                            }
                            className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                          >
                            <span>Open Details</span>
                            <ExternalLink className="w-3 h-3" />
                          </button>
                        </div>
                        <div className="font-bold text-slate-900 text-base">{recA.company_name}</div>
                        <div className="mt-2 space-y-1 text-xs text-slate-600">
                          <div className="flex items-center gap-2">
                            <User className="w-3.5 h-3.5 text-slate-400" />
                            <span>{recA.contact_person || <span className="text-slate-400 italic">No contact</span>}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Phone className="w-3.5 h-3.5 text-slate-400" />
                            <span>{recA.phone || <span className="text-slate-400 italic">No phone</span>}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Mail className="w-3.5 h-3.5 text-slate-400" />
                            <span>{recA.email || <span className="text-slate-400 italic">No email</span>}</span>
                          </div>
                        </div>
                      </div>

                      {/* Record B */}
                      <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                            Record 2 ({candidate.entity_type})
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              candidate.entity_type === 'Lead'
                                ? onNavigateToLead?.(recB.id)
                                : onNavigateToClient?.(recB.id)
                            }
                            className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                          >
                            <span>Open Details</span>
                            <ExternalLink className="w-3 h-3" />
                          </button>
                        </div>
                        <div className="font-bold text-slate-900 text-base">{recB.company_name}</div>
                        <div className="mt-2 space-y-1 text-xs text-slate-600">
                          <div className="flex items-center gap-2">
                            <User className="w-3.5 h-3.5 text-slate-400" />
                            <span>{recB.contact_person || <span className="text-slate-400 italic">No contact</span>}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Phone className="w-3.5 h-3.5 text-slate-400" />
                            <span>{recB.phone || <span className="text-slate-400 italic">No phone</span>}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Mail className="w-3.5 h-3.5 text-slate-400" />
                            <span>{recB.email || <span className="text-slate-400 italic">No email</span>}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center justify-end gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => handleDismiss(candidate)}
                        className="rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition"
                      >
                        Not a Duplicate (Dismiss)
                      </button>

                      <button
                        type="button"
                        onClick={() => setActiveMergeCandidate(candidate)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-indigo-700 active:scale-98 transition"
                      >
                        <GitMerge className="w-3.5 h-3.5" />
                        <span>Review & Merge</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Dismissed Pairs ("Not Duplicates") */}
      {activeTab === 'dismissed' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
            <h3 className="text-sm font-bold text-slate-900">
              Verified Distinct Records ({notDuplicates.length})
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              These record pairs have been evaluated by an administrator and flagged as legitimate, distinct entities. They will not trigger duplicate warnings or appear in duplicate detection.
            </p>
          </div>

          {notDuplicates.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-2xs">
              <p className="text-sm text-slate-500">No records have been marked as &apos;Not Duplicate&apos; yet.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
              {notDuplicates.map((item) => {
                const leadA = leads.find((l) => l.id === item.record_a_id);
                const leadB = leads.find((l) => l.id === item.record_b_id);
                const clientA = clients.find((c) => c.id === item.record_a_id);
                const clientB = clients.find((c) => c.id === item.record_b_id);

                const nameA = leadA?.company_name || clientA?.company_name || item.record_a_id;
                const nameB = leadB?.company_name || clientB?.company_name || item.record_b_id;

                return (
                  <div key={item.id} className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 hover:bg-slate-50">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
                          {item.entity_type}
                        </span>
                        <span className="font-semibold text-sm text-slate-900">{nameA}</span>
                        <span className="text-slate-400 font-medium">and</span>
                        <span className="font-semibold text-sm text-slate-900">{nameB}</span>
                      </div>
                      <div className="text-xs text-slate-400 mt-1">
                        Dismissed by {item.marked_by_name || 'Admin'} on {new Date(item.created_at).toLocaleDateString()}
                      </div>
                    </div>

                    <div>
                      <button
                        type="button"
                        onClick={() => handleRestoreDismissed(item.id)}
                        className="text-xs font-medium text-indigo-600 hover:text-indigo-800 underline"
                      >
                        Reopen as Potential Duplicate
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Data Completeness & Hygiene */}
      {activeTab === 'hygiene' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
            <h3 className="text-sm font-bold text-slate-900">
              Data Quality Audit ({hygieneReport.issues.length} Records With Incomplete Information)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              High-performing sales teams require complete contact profiles. Clean up records missing phone numbers, emails, contact persons, or expected closing dates.
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
            <div className="divide-y divide-slate-100">
              {hygieneReport.issues.map((issue) => (
                <div key={issue.record_id} className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 hover:bg-slate-50">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
                        {issue.entity_type}
                      </span>
                      <span className="font-bold text-sm text-slate-900">{issue.company_name}</span>
                    </div>

                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {issue.missing_fields.map((field) => (
                        <span key={field} className="rounded bg-rose-50 text-rose-700 px-2 py-0.5 text-[11px] font-medium border border-rose-200">
                          Missing {field.replace('_', ' ')}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <button
                      type="button"
                      onClick={() =>
                        issue.entity_type === 'Lead'
                          ? onNavigateToLead?.(issue.record_id)
                          : onNavigateToClient?.(issue.record_id)
                      }
                      className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition"
                    >
                      <span>Update Record</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Record Merge Modal */}
      {activeMergeCandidate && (
        <RecordMergeModal
          isOpen={true}
          onClose={() => setActiveMergeCandidate(null)}
          entityType={activeMergeCandidate.entity_type}
          recordA={activeMergeCandidate.record_a}
          recordB={activeMergeCandidate.record_b}
          matchReason={activeMergeCandidate.match_reasons.join(' • ')}
          matchScore={activeMergeCandidate.confidence_score}
          onMergeSuccess={(survivingId) => {
            setActionNotice(
              `Successfully merged ${activeMergeCandidate.entity_type} records into master record (${survivingId}).`
            );
            setActiveMergeCandidate(null);
            setTimeout(() => setActionNotice(null), 5000);
          }}
          onMarkNotDuplicate={() => {
            setActionNotice('Pair dismissed as not duplicates.');
            setActiveMergeCandidate(null);
            setTimeout(() => setActionNotice(null), 4000);
          }}
        />
      )}
    </div>
  );
};
