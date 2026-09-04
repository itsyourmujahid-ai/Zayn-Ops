import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  ArrowRight,
  Clock,
  Trash2,
  CornerDownLeft,
  SlidersHorizontal,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  searchUnifiedCRM,
  getRecentSearches,
  saveRecentSearch,
  removeRecentSearch,
  clearRecentSearches,
} from '../../lib/search';
import { UnifiedSearchResult, RecentSearchItem } from '../../types/search';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectLead: (leadId: string) => void;
  onSelectClient: (clientId: string) => void;
  onNavigateToSearchPage: (query: string) => void;
  initialQuery?: string;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({
  isOpen,
  onClose,
  onSelectLead,
  onSelectClient,
  onNavigateToSearchPage,
  initialQuery = '',
}) => {
  const { userProfile, currentUser } = useAuth();
  const [query, setQuery] = useState<string>(initialQuery);
  const [recentSearches, setRecentSearches] = useState<RecentSearchItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync recent searches on open and upon storage events
  useEffect(() => {
    if (isOpen) {
      setRecentSearches(getRecentSearches());
      setQuery(initialQuery);
      setSelectedIndex(0);
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 50);
    }
  }, [isOpen, initialQuery]);

  useEffect(() => {
    const handleRecentChanged = () => {
      setRecentSearches(getRecentSearches());
    };
    window.addEventListener('crm_recent_searches_changed', handleRecentChanged);
    return () => window.removeEventListener('crm_recent_searches_changed', handleRecentChanged);
  }, []);

  // Debounced search evaluation
  const [debouncedQuery, setDebouncedQuery] = useState<string>(initialQuery);
  useEffect(() => {
    setIsLoading(true);
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
      setIsLoading(false);
    }, 200);
    return () => clearTimeout(timer);
  }, [query]);

  // Execute unified search with role security
  const results = useMemo(() => {
    if (!debouncedQuery.trim()) {
      return { leads: [], clients: [], followups: [], activities: [], totalCount: 0 };
    }
    return searchUnifiedCRM(
      debouncedQuery,
      { type: 'all' },
      userProfile?.role,
      currentUser?.uid
    );
  }, [debouncedQuery, userProfile?.role, currentUser?.uid]);

  // Flattened items for keyboard navigation in modal (capped at top 4 per category)
  const flattenedDisplayResults = useMemo(() => {
    const items: UnifiedSearchResult[] = [];
    results.leads.slice(0, 4).forEach((i) => items.push(i));
    results.clients.slice(0, 4).forEach((i) => items.push(i));
    results.followups.slice(0, 4).forEach((i) => items.push(i));
    results.activities.slice(0, 4).forEach((i) => items.push(i));
    return items;
  }, [results]);

  // Reset selected index when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [flattenedDisplayResults]);

  // Keyboard navigation inside modal
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      if (flattenedDisplayResults.length === 0) {
        if (e.key === 'Enter' && query.trim()) {
          e.preventDefault();
          saveRecentSearch(query.trim());
          onClose();
          onNavigateToSearchPage(query.trim());
        }
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < flattenedDisplayResults.length - 1 ? prev + 1 : 0
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev > 0 ? prev - 1 : flattenedDisplayResults.length - 1
        );
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const selected = flattenedDisplayResults[selectedIndex];
        if (selected) {
          handleSelectResult(selected);
        } else if (query.trim()) {
          saveRecentSearch(query.trim());
          onClose();
          onNavigateToSearchPage(query.trim());
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, flattenedDisplayResults, selectedIndex, query]);

  if (!isOpen) return null;

  const handleSelectResult = (item: UnifiedSearchResult) => {
    if (query.trim()) {
      saveRecentSearch(query.trim());
    }
    onClose();

    if (item.type === 'lead') {
      if (item.leadId) onSelectLead(item.leadId);
    } else if (item.type === 'client') {
      if (item.clientId) onSelectClient(item.clientId);
    } else if (item.type === 'followup' || item.type === 'activity') {
      // Direct context routing: navigate to parent Lead or Client
      if (item.leadId) {
        onSelectLead(item.leadId);
      } else if (item.clientId) {
        onSelectClient(item.clientId);
      }
    }
  };

  const handleViewAllResults = () => {
    if (query.trim()) {
      saveRecentSearch(query.trim());
      onClose();
      onNavigateToSearchPage(query.trim());
    }
  };

  const renderBadge = (item: UnifiedSearchResult) => {
    if (!item.badgeText) return null;
    let colorCls = 'bg-slate-100 text-slate-700';
    if (item.badgeVariant === 'green') colorCls = 'bg-emerald-50 text-emerald-700 border-emerald-200';
    else if (item.badgeVariant === 'red') colorCls = 'bg-rose-50 text-rose-700 border-rose-200';
    else if (item.badgeVariant === 'amber') colorCls = 'bg-amber-50 text-amber-700 border-amber-200';
    else if (item.badgeVariant === 'purple') colorCls = 'bg-purple-50 text-purple-700 border-purple-200';
    else if (item.badgeVariant === 'blue') colorCls = 'bg-indigo-50 text-indigo-700 border-indigo-200';

    return (
      <span
        className={`inline-flex items-center rounded-sm px-1.5 py-0.5 text-[10px] font-semibold border ${colorCls}`}
      >
        {item.badgeText}
      </span>
    );
  };

  return (
    <div
      id="global-search-overlay"
      className="fixed inset-0 z-50 flex items-start justify-center p-3 sm:p-6 bg-slate-900/50 backdrop-blur-xs transition-opacity animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="global-search-palette"
        className="w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Header Bar */}
        <div className="relative flex items-center border-b border-slate-200 px-4 py-3 sm:px-6">
          <Search className="h-5 w-5 text-slate-400 shrink-0 mr-3" />
          <input
            ref={inputRef}
            id="modal-search-input"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search leads, clients, follow-ups, activities..."
            className="w-full bg-transparent text-sm sm:text-base font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none"
            autoComplete="off"
            spellCheck="false"
          />

          <div className="flex items-center gap-2 ml-3">
            {isLoading && (
              <div className="h-4 w-4 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin" />
            )}
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  inputRef.current?.focus();
                }}
                className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition cursor-pointer"
                title="Clear input"
              >
                <X className="h-4 w-4" />
              </button>
            )}
            <kbd className="hidden sm:inline-flex items-center rounded border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
              ESC
            </kbd>
          </div>
        </div>

        {/* Search Content Body */}
        <div className="max-h-[65vh] overflow-y-auto p-2 sm:p-4 divide-y divide-slate-100">
          {/* STATE 1: Empty Query - Recent Searches & Tips */}
          {!query.trim() && (
            <div className="space-y-4 py-2">
              {recentSearches.length > 0 ? (
                <div>
                  <div className="flex items-center justify-between px-3 py-1.5">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      <Clock className="h-3.5 w-3.5" />
                      <span>Recent Searches</span>
                    </div>
                    <button
                      type="button"
                      onClick={clearRecentSearches}
                      className="text-[11px] font-medium text-slate-400 hover:text-rose-600 transition cursor-pointer"
                    >
                      Clear all
                    </button>
                  </div>

                  <div className="mt-1 space-y-1">
                    {recentSearches.map((item) => (
                      <div
                        key={item.id}
                        className="group flex items-center justify-between rounded-xl px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                        onClick={() => {
                          setQuery(item.query);
                        }}
                      >
                        <div className="flex items-center gap-3">
                          <Search className="h-3.5 w-3.5 text-slate-400 group-hover:text-indigo-600 transition" />
                          <span className="font-medium text-slate-800">{item.query}</span>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeRecentSearch(item.id);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-600 transition rounded"
                          title="Remove search"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* CRM Scope Hint Cards */}
              <div className="px-3 py-2">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Unified Search Scope
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50/60 p-2.5">
                    <Users className="h-4 w-4 text-indigo-600 shrink-0" />
                    <div className="text-left">
                      <p className="text-xs font-semibold text-slate-800">Leads</p>
                      <p className="text-[10px] text-slate-500">Pipeline prospects</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50/60 p-2.5">
                    <Building2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    <div className="text-left">
                      <p className="text-xs font-semibold text-slate-800">Clients</p>
                      <p className="text-[10px] text-slate-500">Converted accounts</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50/60 p-2.5">
                    <CalendarClock className="h-4 w-4 text-amber-600 shrink-0" />
                    <div className="text-left">
                      <p className="text-xs font-semibold text-slate-800">Follow-ups</p>
                      <p className="text-[10px] text-slate-500">Scheduled actions</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50/60 p-2.5">
                    <ActivityIcon className="h-4 w-4 text-blue-600 shrink-0" />
                    <div className="text-left">
                      <p className="text-xs font-semibold text-slate-800">Activities</p>
                      <p className="text-[10px] text-slate-500">Timeline events</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STATE 2: Query Entered with Results */}
          {query.trim() && results.totalCount > 0 && (
            <div className="space-y-4 py-2">
              {/* Category: Leads */}
              {results.leads.length > 0 && (
                <div>
                  <div className="flex items-center justify-between px-3 py-1.5">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-wider">
                      <Users className="h-3.5 w-3.5 text-indigo-600" />
                      <span>Leads</span>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600">
                        {results.leads.length}
                      </span>
                    </div>
                  </div>

                  <div className="mt-1 space-y-1">
                    {results.leads.slice(0, 4).map((item) => {
                      const itemFlatIndex = flattenedDisplayResults.indexOf(item);
                      const isSelected = itemFlatIndex === selectedIndex;
                      return (
                        <div
                          key={item.id}
                          onClick={() => handleSelectResult(item)}
                          className={`group flex items-center justify-between rounded-xl px-3 py-2.5 transition cursor-pointer ${
                            isSelected
                              ? 'bg-indigo-50 border border-indigo-200'
                              : 'hover:bg-slate-50 border border-transparent'
                          }`}
                        >
                          <div className="flex items-start gap-3 min-w-0">
                            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700">
                              <Users className="h-4 w-4" />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-semibold text-slate-900 truncate">
                                  {item.title}
                                </span>
                                {renderBadge(item)}
                              </div>
                              <p className="text-xs text-slate-500 truncate">{item.subtitle}</p>
                              {item.description && (
                                <p className="text-[11px] text-slate-400 truncate mt-0.5">
                                  {item.description}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Quick Actions (Call, WhatsApp, Email) */}
                          <div className="flex items-center gap-1 shrink-0 ml-2">
                            {item.phone && (
                              <a
                                href={`tel:${item.phone}`}
                                onClick={(e) => e.stopPropagation()}
                                className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-white rounded-lg transition"
                                title={`Call ${item.phone}`}
                              >
                                <Phone className="h-3.5 w-3.5" />
                              </a>
                            )}
                            {item.whatsapp && (
                              <a
                                href={`https://wa.me/${item.whatsapp.replace(/\D/g, '')}`}
                                target="_blank"
                                rel="noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-white rounded-lg transition"
                                title={`WhatsApp ${item.whatsapp}`}
                              >
                                <MessageSquare className="h-3.5 w-3.5" />
                              </a>
                            )}
                            {item.email && (
                              <a
                                href={`mailto:${item.email}`}
                                onClick={(e) => e.stopPropagation()}
                                className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-white rounded-lg transition"
                                title={`Email ${item.email}`}
                              >
                                <Mail className="h-3.5 w-3.5" />
                              </a>
                            )}
                            <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-indigo-600 transition ml-1" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Category: Clients */}
              {results.clients.length > 0 && (
                <div>
                  <div className="flex items-center justify-between px-3 py-1.5">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-wider">
                      <Building2 className="h-3.5 w-3.5 text-emerald-600" />
                      <span>Clients</span>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600">
                        {results.clients.length}
                      </span>
                    </div>
                  </div>

                  <div className="mt-1 space-y-1">
                    {results.clients.slice(0, 4).map((item) => {
                      const itemFlatIndex = flattenedDisplayResults.indexOf(item);
                      const isSelected = itemFlatIndex === selectedIndex;
                      return (
                        <div
                          key={item.id}
                          onClick={() => handleSelectResult(item)}
                          className={`group flex items-center justify-between rounded-xl px-3 py-2.5 transition cursor-pointer ${
                            isSelected
                              ? 'bg-emerald-50 border border-emerald-200'
                              : 'hover:bg-slate-50 border border-transparent'
                          }`}
                        >
                          <div className="flex items-start gap-3 min-w-0">
                            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                              <Building2 className="h-4 w-4" />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-semibold text-slate-900 truncate">
                                  {item.title}
                                </span>
                                {renderBadge(item)}
                              </div>
                              <p className="text-xs text-slate-500 truncate">{item.subtitle}</p>
                              {item.description && (
                                <p className="text-[11px] text-slate-400 truncate mt-0.5">
                                  {item.description}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0 ml-2">
                            {item.phone && (
                              <a
                                href={`tel:${item.phone}`}
                                onClick={(e) => e.stopPropagation()}
                                className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-white rounded-lg transition"
                                title={`Call ${item.phone}`}
                              >
                                <Phone className="h-3.5 w-3.5" />
                              </a>
                            )}
                            {item.whatsapp && (
                              <a
                                href={`https://wa.me/${item.whatsapp.replace(/\D/g, '')}`}
                                target="_blank"
                                rel="noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-white rounded-lg transition"
                                title={`WhatsApp ${item.whatsapp}`}
                              >
                                <MessageSquare className="h-3.5 w-3.5" />
                              </a>
                            )}
                            {item.email && (
                              <a
                                href={`mailto:${item.email}`}
                                onClick={(e) => e.stopPropagation()}
                                className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-white rounded-lg transition"
                                title={`Email ${item.email}`}
                              >
                                <Mail className="h-3.5 w-3.5" />
                              </a>
                            )}
                            <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-emerald-600 transition ml-1" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Category: Follow-ups */}
              {results.followups.length > 0 && (
                <div>
                  <div className="flex items-center justify-between px-3 py-1.5">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-wider">
                      <CalendarClock className="h-3.5 w-3.5 text-amber-600" />
                      <span>Follow-ups</span>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600">
                        {results.followups.length}
                      </span>
                    </div>
                  </div>

                  <div className="mt-1 space-y-1">
                    {results.followups.slice(0, 4).map((item) => {
                      const itemFlatIndex = flattenedDisplayResults.indexOf(item);
                      const isSelected = itemFlatIndex === selectedIndex;
                      return (
                        <div
                          key={item.id}
                          onClick={() => handleSelectResult(item)}
                          className={`group flex items-center justify-between rounded-xl px-3 py-2.5 transition cursor-pointer ${
                            isSelected
                              ? 'bg-amber-50 border border-amber-200'
                              : 'hover:bg-slate-50 border border-transparent'
                          }`}
                        >
                          <div className="flex items-start gap-3 min-w-0">
                            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                              <CalendarClock className="h-4 w-4" />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-semibold text-slate-900 truncate">
                                  {item.title}
                                </span>
                                {renderBadge(item)}
                              </div>
                              <p className="text-xs text-slate-500 truncate">{item.subtitle}</p>
                              {item.description && (
                                <p className="text-[11px] text-slate-400 truncate mt-0.5">
                                  {item.description}
                                </p>
                              )}
                            </div>
                          </div>
                          <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-amber-600 transition shrink-0 ml-2" />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Category: Activities */}
              {results.activities.length > 0 && (
                <div>
                  <div className="flex items-center justify-between px-3 py-1.5">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-wider">
                      <ActivityIcon className="h-3.5 w-3.5 text-blue-600" />
                      <span>Activities</span>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600">
                        {results.activities.length}
                      </span>
                    </div>
                  </div>

                  <div className="mt-1 space-y-1">
                    {results.activities.slice(0, 4).map((item) => {
                      const itemFlatIndex = flattenedDisplayResults.indexOf(item);
                      const isSelected = itemFlatIndex === selectedIndex;
                      return (
                        <div
                          key={item.id}
                          onClick={() => handleSelectResult(item)}
                          className={`group flex items-center justify-between rounded-xl px-3 py-2.5 transition cursor-pointer ${
                            isSelected
                              ? 'bg-blue-50 border border-blue-200'
                              : 'hover:bg-slate-50 border border-transparent'
                          }`}
                        >
                          <div className="flex items-start gap-3 min-w-0">
                            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
                              <ActivityIcon className="h-4 w-4" />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-semibold text-slate-900 truncate">
                                  {item.title}
                                </span>
                                {renderBadge(item)}
                              </div>
                              <p className="text-xs text-slate-500 truncate">{item.subtitle}</p>
                              {item.description && (
                                <p className="text-[11px] text-slate-400 truncate mt-0.5">
                                  {item.description}
                                </p>
                              )}
                            </div>
                          </div>
                          <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-blue-600 transition shrink-0 ml-2" />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STATE 3: Query Entered but No Results */}
          {query.trim() && results.totalCount === 0 && !isLoading && (
            <div className="py-12 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                <Search className="h-6 w-6" />
              </div>
              <p className="mt-3 text-sm font-semibold text-slate-800">
                No matching CRM records found
              </p>
              <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
                We couldn&apos;t find anything matching &quot;{query}&quot;. Try searching by contact name, company name, phone digits, or location.
              </p>
            </div>
          )}
        </div>

        {/* Modal Footer with Actions & Hints */}
        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1">
              <kbd className="rounded border border-slate-200 bg-white px-1 py-0.5 text-[10px] font-semibold text-slate-600">
                ↑
              </kbd>
              <kbd className="rounded border border-slate-200 bg-white px-1 py-0.5 text-[10px] font-semibold text-slate-600">
                ↓
              </kbd>{' '}
              to navigate
            </span>
            <span className="inline-flex items-center gap-1">
              <kbd className="rounded border border-slate-200 bg-white px-1 py-0.5 text-[10px] font-semibold text-slate-600">
                ↵
              </kbd>{' '}
              to select
            </span>
          </div>

          {query.trim() && results.totalCount > 0 ? (
            <button
              type="button"
              onClick={handleViewAllResults}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700 transition cursor-pointer"
            >
              <span>View all {results.totalCount} results</span>
              <CornerDownLeft className="h-3.5 w-3.5" />
            </button>
          ) : (
            <div className="text-[11px] text-slate-400">
              Role: <span className="font-semibold text-slate-600">{userProfile?.role || 'SALESMAN'}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
