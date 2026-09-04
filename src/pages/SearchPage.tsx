import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  X,
  Phone,
  MessageSquare,
  Mail,
  Users,
  Building2,
  CalendarClock,
  Activity as ActivityIcon,
  Filter,
  ArrowUpDown,
  RotateCcw,
  ExternalLink,
  ChevronRight,
  Clock,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { searchUnifiedCRM, saveRecentSearch } from '../lib/search';
import {
  UnifiedSearchResult,
  SearchFilterOptions,
  SearchResultType,
} from '../types/search';

interface SearchPageProps {
  initialQuery?: string;
  onSelectLead: (leadId: string) => void;
  onSelectClient: (clientId: string) => void;
}

export const SearchPage: React.FC<SearchPageProps> = ({
  initialQuery = '',
  onSelectLead,
  onSelectClient,
}) => {
  const { userProfile, currentUser } = useAuth();
  const [searchInput, setSearchInput] = useState<string>(initialQuery);
  const [activeQuery, setActiveQuery] = useState<string>(initialQuery);

  // Filters State
  const [activeType, setActiveType] = useState<'all' | SearchResultType>('all');
  const [leadStage, setLeadStage] = useState<string>('all');
  const [leadPriority, setLeadPriority] = useState<string>('all');
  const [clientStatus, setClientStatus] = useState<string>('all');
  const [followupStatus, setFollowupStatus] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'relevance' | 'date_desc' | 'date_asc' | 'title_asc'>('relevance');

  // Sync with initialQuery when prop changes
  useEffect(() => {
    if (initialQuery) {
      setSearchInput(initialQuery);
      setActiveQuery(initialQuery);
    }
  }, [initialQuery]);

  // Read URL query params on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const q = params.get('q');
      if (q) {
        setSearchInput(q);
        setActiveQuery(q);
      }
    }
  }, []);

  // Update URL whenever activeQuery changes
  const updateUrl = (queryToSet: string) => {
    if (typeof window !== 'undefined' && window.history) {
      const url = queryToSet ? `/search?q=${encodeURIComponent(queryToSet)}` : '/search';
      window.history.pushState({}, '', url);
    }
  };

  const handleSearchSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = searchInput.trim();
    setActiveQuery(trimmed);
    updateUrl(trimmed);
    if (trimmed) {
      saveRecentSearch(trimmed);
    }
  };

  const handleClear = () => {
    setSearchInput('');
    setActiveQuery('');
    updateUrl('');
  };

  const resetFilters = () => {
    setActiveType('all');
    setLeadStage('all');
    setLeadPriority('all');
    setClientStatus('all');
    setFollowupStatus('all');
    setSortBy('relevance');
  };

  const hasActiveFilters =
    activeType !== 'all' ||
    leadStage !== 'all' ||
    leadPriority !== 'all' ||
    clientStatus !== 'all' ||
    followupStatus !== 'all' ||
    sortBy !== 'relevance';

  // Perform search with security scoping
  const filterOptions: SearchFilterOptions = useMemo(
    () => ({
      type: activeType,
      leadStage,
      leadPriority,
      clientStatus,
      followupStatus,
      sortBy,
    }),
    [activeType, leadStage, leadPriority, clientStatus, followupStatus, sortBy]
  );

  const searchResults = useMemo(() => {
    return searchUnifiedCRM(
      activeQuery,
      filterOptions,
      userProfile?.role,
      currentUser?.uid
    );
  }, [activeQuery, filterOptions, userProfile?.role, currentUser?.uid]);

  const handleResultClick = (item: UnifiedSearchResult) => {
    if (item.type === 'lead' && item.leadId) {
      onSelectLead(item.leadId);
    } else if (item.type === 'client' && item.clientId) {
      onSelectClient(item.clientId);
    } else if (item.leadId) {
      onSelectLead(item.leadId);
    } else if (item.clientId) {
      onSelectClient(item.clientId);
    }
  };

  const renderBadge = (item: UnifiedSearchResult) => {
    if (!item.badgeText) return null;
    let colorCls = 'bg-slate-100 text-slate-700 border-slate-200';
    if (item.badgeVariant === 'green') colorCls = 'bg-emerald-50 text-emerald-700 border-emerald-200';
    else if (item.badgeVariant === 'red') colorCls = 'bg-rose-50 text-rose-700 border-rose-200';
    else if (item.badgeVariant === 'amber') colorCls = 'bg-amber-50 text-amber-700 border-amber-200';
    else if (item.badgeVariant === 'purple') colorCls = 'bg-purple-50 text-purple-700 border-purple-200';
    else if (item.badgeVariant === 'blue') colorCls = 'bg-indigo-50 text-indigo-700 border-indigo-200';

    return (
      <span
        className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold border ${colorCls}`}
      >
        {item.badgeText}
      </span>
    );
  };

  const renderItemCard = (item: UnifiedSearchResult) => {
    return (
      <div
        key={item.id}
        onClick={() => handleResultClick(item)}
        className="group relative flex flex-col sm:flex-row sm:items-center justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-xs transition hover:border-indigo-300 hover:shadow-md cursor-pointer"
      >
        <div className="flex items-start gap-3.5 min-w-0 flex-1">
          {/* Entity Icon Indicator */}
          <div
            className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-bold ${
              item.type === 'lead'
                ? 'bg-indigo-100 text-indigo-700'
                : item.type === 'client'
                ? 'bg-emerald-100 text-emerald-700'
                : item.type === 'followup'
                ? 'bg-amber-100 text-amber-700'
                : 'bg-blue-100 text-blue-700'
            }`}
          >
            {item.type === 'lead' && <Users className="h-5 w-5" />}
            {item.type === 'client' && <Building2 className="h-5 w-5" />}
            {item.type === 'followup' && <CalendarClock className="h-5 w-5" />}
            {item.type === 'activity' && <ActivityIcon className="h-5 w-5" />}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="text-base font-bold text-slate-900 group-hover:text-indigo-600 transition">
                {item.title}
              </span>
              {renderBadge(item)}
              {item.matchedFields.length > 0 && (
                <span className="text-[10px] text-slate-400">
                  Matches in: {item.matchedFields.join(', ')}
                </span>
              )}
            </div>

            {item.subtitle && (
              <p className="mt-0.5 text-xs font-medium text-slate-600 truncate">
                {item.subtitle}
              </p>
            )}

            {item.description && (
              <p className="mt-1 text-xs text-slate-500 line-clamp-2">
                {item.description}
              </p>
            )}

            {item.timestamp && (
              <p className="mt-1.5 text-[11px] text-slate-400 flex items-center gap-1">
                <Clock className="h-3 w-3" />
                <span>
                  Updated {new Date(item.timestamp).toLocaleDateString()} at{' '}
                  {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </p>
            )}
          </div>
        </div>

        {/* Action Controls */}
        <div className="mt-3 sm:mt-0 sm:ml-4 flex items-center justify-between sm:justify-end gap-2 shrink-0 pt-2 sm:pt-0 border-t border-slate-100 sm:border-0">
          <div className="flex items-center gap-1">
            {item.phone && (
              <a
                href={`tel:${item.phone}`}
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center justify-center h-8 w-8 rounded-lg border border-slate-200 text-slate-600 hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-600 transition"
                title={`Call ${item.phone}`}
              >
                <Phone className="h-4 w-4" />
              </a>
            )}
            {item.whatsapp && (
              <a
                href={`https://wa.me/${item.whatsapp.replace(/\D/g, '')}`}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center justify-center h-8 w-8 rounded-lg border border-slate-200 text-slate-600 hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-600 transition"
                title={`WhatsApp ${item.whatsapp}`}
              >
                <MessageSquare className="h-4 w-4" />
              </a>
            )}
            {item.email && (
              <a
                href={`mailto:${item.email}`}
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center justify-center h-8 w-8 rounded-lg border border-slate-200 text-slate-600 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-600 transition"
                title={`Email ${item.email}`}
              >
                <Mail className="h-4 w-4" />
              </a>
            )}
          </div>

          <button
            type="button"
            onClick={() => handleResultClick(item)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-indigo-600 hover:text-white transition cursor-pointer"
          >
            <span>Open</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div id="unified-search-page" className="space-y-6 animate-in fade-in duration-200">
      {/* Top Search Banner */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs">
        <div className="max-w-3xl">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
            Unified CRM Search
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-500">
            Instantly search all authorized Leads, Customer Accounts, Follow-up Schedules, and Timeline Activities.
          </p>

          <form onSubmit={handleSearchSubmit} className="mt-4 flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-3 h-5 w-5 text-slate-400" />
              <input
                id="search-page-input"
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search by company name, contact, phone digits, email, location..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50/70 py-2.5 pl-10 pr-10 text-sm sm:text-base font-medium text-slate-900 placeholder:text-slate-400 focus:border-indigo-600 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-600 transition"
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="absolute right-3 top-3 rounded-md p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition cursor-pointer"
                  title="Clear input"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <button
              type="submit"
              className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-indigo-700 active:scale-98 transition cursor-pointer shrink-0"
            >
              Search
            </button>
          </form>
        </div>
      </div>

      {/* Filter Tabs & Options */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs space-y-3">
        {/* Category Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          <button
            type="button"
            onClick={() => setActiveType('all')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
              activeType === 'all'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <span>All Results</span>
            <span
              className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                activeType === 'all' ? 'bg-indigo-700 text-white' : 'bg-slate-200 text-slate-600'
              }`}
            >
              {searchResults.totalCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveType('lead')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
              activeType === 'lead'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Users className="h-3.5 w-3.5" />
            <span>Leads</span>
            <span
              className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                activeType === 'lead' ? 'bg-indigo-700 text-white' : 'bg-slate-200 text-slate-600'
              }`}
            >
              {searchResults.leads.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveType('client')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
              activeType === 'client'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Building2 className="h-3.5 w-3.5" />
            <span>Clients</span>
            <span
              className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                activeType === 'client' ? 'bg-emerald-700 text-white' : 'bg-slate-200 text-slate-600'
              }`}
            >
              {searchResults.clients.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveType('followup')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
              activeType === 'followup'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <CalendarClock className="h-3.5 w-3.5" />
            <span>Follow-ups</span>
            <span
              className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                activeType === 'followup' ? 'bg-amber-700 text-white' : 'bg-slate-200 text-slate-600'
              }`}
            >
              {searchResults.followups.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveType('activity')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
              activeType === 'activity'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <ActivityIcon className="h-3.5 w-3.5" />
            <span>Activities</span>
            <span
              className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                activeType === 'activity' ? 'bg-blue-700 text-white' : 'bg-slate-200 text-slate-600'
              }`}
            >
              {searchResults.activities.length}
            </span>
          </button>
        </div>

        {/* Secondary Filter Dropdowns Bar */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 text-xs">
          {/* Stage filter for Leads */}
          {(activeType === 'all' || activeType === 'lead') && (
            <div className="flex items-center gap-1">
              <span className="text-slate-400 text-[11px] font-medium">Stage:</span>
              <select
                value={leadStage}
                onChange={(e) => setLeadStage(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-600"
              >
                <option value="all">All Stages</option>
                <option value="New">New</option>
                <option value="Contacted">Contacted</option>
                <option value="Interested">Interested</option>
                <option value="Meeting">Meeting</option>
                <option value="Quotation">Quotation</option>
                <option value="Negotiation">Negotiation</option>
                <option value="Won">Won</option>
                <option value="Lost">Lost</option>
              </select>
            </div>
          )}

          {/* Priority filter for Leads */}
          {(activeType === 'all' || activeType === 'lead') && (
            <div className="flex items-center gap-1">
              <span className="text-slate-400 text-[11px] font-medium">Priority:</span>
              <select
                value={leadPriority}
                onChange={(e) => setLeadPriority(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-600"
              >
                <option value="all">All Priorities</option>
                <option value="Hot">Hot</option>
                <option value="Warm">Warm</option>
                <option value="Cold">Cold</option>
              </select>
            </div>
          )}

          {/* Status filter for Clients */}
          {(activeType === 'all' || activeType === 'client') && (
            <div className="flex items-center gap-1">
              <span className="text-slate-400 text-[11px] font-medium">Client Status:</span>
              <select
                value={clientStatus}
                onChange={(e) => setClientStatus(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-600"
              >
                <option value="all">All Statuses</option>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
          )}

          {/* Status filter for Follow-ups */}
          {(activeType === 'all' || activeType === 'followup') && (
            <div className="flex items-center gap-1">
              <span className="text-slate-400 text-[11px] font-medium">Follow-up:</span>
              <select
                value={followupStatus}
                onChange={(e) => setFollowupStatus(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-600"
              >
                <option value="all">All Follow-ups</option>
                <option value="pending">Pending</option>
                <option value="completed">Completed</option>
                <option value="overdue">Overdue</option>
                <option value="rescheduled">Rescheduled</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          )}

          {/* Sorting */}
          <div className="flex items-center gap-1 ml-auto">
            <span className="text-slate-400 text-[11px] font-medium">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-600"
            >
              <option value="relevance">Relevance</option>
              <option value="date_desc">Newest First</option>
              <option value="date_asc">Oldest First</option>
              <option value="title_asc">Name (A-Z)</option>
            </select>
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition cursor-pointer"
            >
              <RotateCcw className="h-3 w-3" />
              <span>Reset Filters</span>
            </button>
          )}
        </div>
      </div>

      {/* Results Content Area */}
      <div className="space-y-6">
        {/* If user hasn't typed anything and no filters */}
        {!activeQuery && !hasActiveFilters && (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
              <Search className="h-7 w-7" />
            </div>
            <h2 className="mt-4 text-base font-bold text-slate-900">
              Enter a search query to search across the CRM
            </h2>
            <p className="mt-1 text-xs text-slate-500 max-w-md mx-auto">
              Find Leads, Accounts, Schedules, and Audit Trails by company name, contact person, phone number digits, or location.
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <span className="text-xs text-slate-400">Try searching:</span>
              {['Al Noor', 'Commercial', 'Tower', 'Hotel', '54', 'Quotation'].map((term) => (
                <button
                  key={term}
                  type="button"
                  onClick={() => {
                    setSearchInput(term);
                    setActiveQuery(term);
                    updateUrl(term);
                  }}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-600 transition cursor-pointer"
                >
                  &quot;{term}&quot;
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Results Found */}
        {searchResults.totalCount > 0 && (
          <div className="space-y-6">
            {/* View: All Categories Grouped */}
            {activeType === 'all' && (
              <>
                {/* Leads Section */}
                {searchResults.leads.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900 uppercase tracking-wider">
                        <Users className="h-4 w-4 text-indigo-600" />
                        <span>Leads ({searchResults.leads.length})</span>
                      </h2>
                      <button
                        type="button"
                        onClick={() => setActiveType('lead')}
                        className="text-xs font-semibold text-indigo-600 hover:underline"
                      >
                        View only Leads →
                      </button>
                    </div>
                    <div className="space-y-2">
                      {searchResults.leads.map(renderItemCard)}
                    </div>
                  </div>
                )}

                {/* Clients Section */}
                {searchResults.clients.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900 uppercase tracking-wider">
                        <Building2 className="h-4 w-4 text-emerald-600" />
                        <span>Clients ({searchResults.clients.length})</span>
                      </h2>
                      <button
                        type="button"
                        onClick={() => setActiveType('client')}
                        className="text-xs font-semibold text-emerald-600 hover:underline"
                      >
                        View only Clients →
                      </button>
                    </div>
                    <div className="space-y-2">
                      {searchResults.clients.map(renderItemCard)}
                    </div>
                  </div>
                )}

                {/* Follow-ups Section */}
                {searchResults.followups.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900 uppercase tracking-wider">
                        <CalendarClock className="h-4 w-4 text-amber-600" />
                        <span>Follow-ups ({searchResults.followups.length})</span>
                      </h2>
                      <button
                        type="button"
                        onClick={() => setActiveType('followup')}
                        className="text-xs font-semibold text-amber-600 hover:underline"
                      >
                        View only Follow-ups →
                      </button>
                    </div>
                    <div className="space-y-2">
                      {searchResults.followups.map(renderItemCard)}
                    </div>
                  </div>
                )}

                {/* Activities Section */}
                {searchResults.activities.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900 uppercase tracking-wider">
                        <ActivityIcon className="h-4 w-4 text-blue-600" />
                        <span>Activities ({searchResults.activities.length})</span>
                      </h2>
                      <button
                        type="button"
                        onClick={() => setActiveType('activity')}
                        className="text-xs font-semibold text-blue-600 hover:underline"
                      >
                        View only Activities →
                      </button>
                    </div>
                    <div className="space-y-2">
                      {searchResults.activities.map(renderItemCard)}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* View: Specific Category */}
            {activeType === 'lead' && (
              <div className="space-y-2">
                {searchResults.leads.map(renderItemCard)}
              </div>
            )}
            {activeType === 'client' && (
              <div className="space-y-2">
                {searchResults.clients.map(renderItemCard)}
              </div>
            )}
            {activeType === 'followup' && (
              <div className="space-y-2">
                {searchResults.followups.map(renderItemCard)}
              </div>
            )}
            {activeType === 'activity' && (
              <div className="space-y-2">
                {searchResults.activities.map(renderItemCard)}
              </div>
            )}
          </div>
        )}

        {/* No Results Found */}
        {(activeQuery || hasActiveFilters) && searchResults.totalCount === 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-xs">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
              <AlertCircle className="h-7 w-7" />
            </div>
            <h2 className="mt-4 text-base font-bold text-slate-900">
              No CRM records match your search
            </h2>
            <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
              We couldn&apos;t find any records matching &quot;{activeQuery}&quot; with current filter settings.
            </p>
            {hasActiveFilters && (
              <div className="mt-4">
                <button
                  type="button"
                  onClick={resetFilters}
                  className="rounded-lg bg-indigo-50 px-4 py-2 text-xs font-semibold text-indigo-600 hover:bg-indigo-100 transition cursor-pointer"
                >
                  Reset all filters
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
