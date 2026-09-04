import React, { useState, useEffect, useMemo } from 'react';
import {
  Layers,
  Filter,
  Tag as TagIcon,
  Bookmark,
  Plus,
  Trash2,
  Edit2,
  Check,
  ChevronRight,
  RefreshCw,
  Search,
  Building2,
  User,
  Phone,
  Mail,
  MapPin,
  Calendar,
  DollarSign,
  AlertCircle,
  SlidersHorizontal,
  X,
  ExternalLink,
} from 'lucide-react';
import {
  LeadRecord,
  ClientRecord,
  TagRecord,
  SavedSegmentRecord,
  SegmentFilterCriteria,
} from '../types/database';
import {
  getLocalLeads,
  getLocalClients,
  getLocalTags,
  getLocalSavedSegments,
  subscribeToTags,
  subscribeToSavedSegments,
  getEffectiveUserRole,
  getEffectiveUserId,
  getEffectiveUserName,
  createSavedSegment,
  updateSavedSegment,
  deleteSavedSegment,
  addTagToLead,
  removeTagFromLead,
  addTagToClient,
  removeTagFromClient,
} from '../lib/dal';
import { TagBadge } from '../components/TagBadge';
import { TagSelectorModal } from '../components/TagSelectorModal';
import { BulkTagModal } from '../components/BulkTagModal';

interface SegmentsPageProps {
  onNavigateToLead: (leadId: string) => void;
  onNavigateToClient: (clientId: string) => void;
  onNavigateToSettingsTags?: () => void;
}

export const SegmentsPage: React.FC<SegmentsPageProps> = ({
  onNavigateToLead,
  onNavigateToClient,
  onNavigateToSettingsTags,
}) => {
  const currentRole = getEffectiveUserRole();
  const currentUserId = getEffectiveUserId();
  const currentUserName = getEffectiveUserName();
  const isAdmin = currentRole === 'ADMIN';

  // Data states
  const [leads, setLeads] = useState<LeadRecord[]>([]);
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [tags, setTags] = useState<TagRecord[]>([]);
  const [savedSegments, setSavedSegments] = useState<SavedSegmentRecord[]>([]);

  // Active Segment View
  const [activeTab, setActiveTab] = useState<'Lead' | 'Client' | 'Both'>('Lead');

  // Filter state
  const [filterCriteria, setFilterCriteria] = useState<SegmentFilterCriteria>({
    tags: [],
    tag_mode: 'ANY',
    stages: [],
    statuses: [],
    priorities: [],
    assigned_to: '',
    date_field: 'created_at',
    date_from: '',
    date_to: '',
    min_value: undefined,
    max_value: undefined,
    city: '',
  });

  // Text search inside filtered results
  const [searchQuery, setSearchQuery] = useState('');

  // Bulk Selection
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([]);
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [bulkModalType, setBulkModalType] = useState<'lead' | 'client'>('lead');

  // Tag Selector Modal for Single Item
  const [singleTagItem, setSingleTagItem] = useState<{
    type: 'Lead' | 'Client';
    id: string;
    name: string;
    currentTags: string[];
  } | null>(null);

  // Saved Segment Modal (Create / Edit)
  const [isSavedSegmentModalOpen, setIsSavedSegmentModalOpen] = useState(false);
  const [editingSegment, setEditingSegment] = useState<SavedSegmentRecord | null>(null);
  const [segmentFormName, setSegmentFormName] = useState('');
  const [segmentFormDesc, setSegmentFormDesc] = useState('');
  const [saveModalError, setSaveModalError] = useState<string | null>(null);

  // Active executed segment ID for highlighting
  const [activeSegmentId, setActiveSegmentId] = useState<string | null>(null);

  // Load initial data and subscribe
  useEffect(() => {
    setLeads(getLocalLeads());
    setClients(getLocalClients());
    setTags(getLocalTags());
    setSavedSegments(getLocalSavedSegments());

    const unsubTags = subscribeToTags((newTags) => setTags(newTags));
    const unsubSegments = subscribeToSavedSegments((newSegs) => setSavedSegments(newSegs));

    const handleDataChange = () => {
      setLeads(getLocalLeads());
      setClients(getLocalClients());
    };
    window.addEventListener('crm_leads_changed', handleDataChange);
    window.addEventListener('crm_clients_changed', handleDataChange);

    return () => {
      unsubTags();
      unsubSegments();
      window.removeEventListener('crm_leads_changed', handleDataChange);
      window.removeEventListener('crm_clients_changed', handleDataChange);
    };
  }, []);

  // 1. Authorized Record Scoping (Salesman vs Admin)
  const authorizedLeads = useMemo(() => {
    if (isAdmin) return leads;
    return leads.filter((l) => l.assigned_to === currentUserId || l.created_by === currentUserId);
  }, [leads, isAdmin, currentUserId]);

  const authorizedClients = useMemo(() => {
    if (isAdmin) return clients;
    return clients.filter((c) => c.owner_id === currentUserId);
  }, [clients, isAdmin, currentUserId]);

  // 2. Dynamic Segment Evaluation Function
  const evaluateRecordMatch = (
    item: LeadRecord | ClientRecord,
    isLead: boolean,
    criteria: SegmentFilterCriteria
  ): boolean => {
    // A. Tag Filtering
    if (criteria.tags && criteria.tags.length > 0) {
      const itemTags = Array.isArray(item.tags) ? item.tags.map((t) => t.toLowerCase()) : [];
      if (criteria.tag_mode === 'ALL') {
        const hasAll = criteria.tags.every((t) => itemTags.includes(t.toLowerCase()));
        if (!hasAll) return false;
      } else {
        const hasAny = criteria.tags.some((t) => itemTags.includes(t.toLowerCase()));
        if (!hasAny) return false;
      }
    }

    // B. Stage & Status
    if (isLead) {
      const lead = item as LeadRecord;
      if (criteria.stages && criteria.stages.length > 0) {
        if (!criteria.stages.includes(lead.status)) return false;
      }
      if (criteria.priorities && criteria.priorities.length > 0) {
        if (!criteria.priorities.includes(lead.priority)) return false;
      }
    } else {
      const client = item as ClientRecord;
      if (criteria.statuses && criteria.statuses.length > 0) {
        if (!criteria.statuses.includes(client.status)) return false;
      }
    }

    // C. Owner / Assigned Salesman
    if (criteria.assigned_to) {
      if (isLead) {
        const lead = item as LeadRecord;
        if (lead.assigned_to !== criteria.assigned_to) return false;
      } else {
        const client = item as ClientRecord;
        if (client.owner_id !== criteria.assigned_to) return false;
      }
    }

    // D. Location / City
    if (criteria.city && criteria.city.trim()) {
      const q = criteria.city.trim().toLowerCase();
      const loc = (item.location || '').toLowerCase();
      if (!loc.includes(q)) return false;
    }

    // E. Date Range
    const dateField = criteria.date_field || 'created_at';
    const targetDateStr = (item as any)[dateField];
    if (targetDateStr) {
      const itemTime = new Date(targetDateStr).getTime();
      if (criteria.date_from) {
        const fromTime = new Date(criteria.date_from).getTime();
        if (itemTime < fromTime) return false;
      }
      if (criteria.date_to) {
        const toTime = new Date(criteria.date_to + 'T23:59:59.999Z').getTime();
        if (itemTime > toTime) return false;
      }
    }

    // F. Value Range (estimated_value on leads, or total_deal_value where applicable)
    if (criteria.min_value !== undefined && criteria.min_value > 0) {
      const val = isLead ? (item as LeadRecord).estimated_value || 0 : 0;
      if (val < criteria.min_value) return false;
    }
    if (criteria.max_value !== undefined && criteria.max_value > 0) {
      const val = isLead ? (item as LeadRecord).estimated_value || 0 : 0;
      if (val > criteria.max_value) return false;
    }

    return true;
  };

  // 3. Filtered Results for Current Active Criteria
  const filteredLeads = useMemo(() => {
    if (activeTab === 'Client') return [];
    return authorizedLeads.filter((lead) => {
      if (!evaluateRecordMatch(lead, true, filterCriteria)) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = (lead.company_name || '').toLowerCase().includes(q);
        const matchesContact = (lead.contact_person || '').toLowerCase().includes(q);
        const matchesPhone = (lead.phone || '').includes(q);
        const matchesProject = (lead.project_name || '').toLowerCase().includes(q);
        const matchesTags = (lead.tags || []).some((t) => t.toLowerCase().includes(q));
        return matchesName || matchesContact || matchesPhone || matchesProject || matchesTags;
      }
      return true;
    });
  }, [authorizedLeads, activeTab, filterCriteria, searchQuery]);

  const filteredClients = useMemo(() => {
    if (activeTab === 'Lead') return [];
    return authorizedClients.filter((client) => {
      if (!evaluateRecordMatch(client, false, filterCriteria)) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = (client.company_name || '').toLowerCase().includes(q);
        const matchesContact = (client.contact_person || '').toLowerCase().includes(q);
        const matchesPhone = (client.phone || '').includes(q);
        const matchesTags = (client.tags || []).some((t) => t.toLowerCase().includes(q));
        return matchesName || matchesContact || matchesPhone || matchesTags;
      }
      return true;
    });
  }, [authorizedClients, activeTab, filterCriteria, searchQuery]);

  // Total count for current results
  const totalCount =
    activeTab === 'Lead'
      ? filteredLeads.length
      : activeTab === 'Client'
      ? filteredClients.length
      : filteredLeads.length + filteredClients.length;

  // 4. Precompute dynamic counts for each saved segment (evaluated strictly against authorized data!)
  const savedSegmentCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    savedSegments.forEach((seg) => {
      let count = 0;
      if (seg.entity_type === 'Lead' || seg.entity_type === 'Both') {
        count += authorizedLeads.filter((l) => evaluateRecordMatch(l, true, seg.filter_definition)).length;
      }
      if (seg.entity_type === 'Client' || seg.entity_type === 'Both') {
        count += authorizedClients.filter((c) => evaluateRecordMatch(c, false, seg.filter_definition)).length;
      }
      counts[seg.id] = count;
    });
    return counts;
  }, [savedSegments, authorizedLeads, authorizedClients]);

  // Handle 1-click execution of a saved segment
  const handleApplySavedSegment = (segment: SavedSegmentRecord) => {
    setActiveSegmentId(segment.id);
    setActiveTab(segment.entity_type);
    setFilterCriteria(segment.filter_definition);
    setSelectedLeadIds([]);
    setSelectedClientIds([]);
  };

  const handleResetFilters = () => {
    setActiveSegmentId(null);
    setFilterCriteria({
      tags: [],
      tag_mode: 'ANY',
      stages: [],
      statuses: [],
      priorities: [],
      assigned_to: '',
      date_field: 'created_at',
      date_from: '',
      date_to: '',
      min_value: undefined,
      max_value: undefined,
      city: '',
    });
    setSearchQuery('');
    setSelectedLeadIds([]);
    setSelectedClientIds([]);
  };

  // Toggle single tag in criteria
  const handleToggleCriteriaTag = (tagName: string) => {
    setActiveSegmentId(null);
    const current = filterCriteria.tags || [];
    if (current.includes(tagName)) {
      setFilterCriteria({ ...filterCriteria, tags: current.filter((t) => t !== tagName) });
    } else {
      setFilterCriteria({ ...filterCriteria, tags: [...current, tagName] });
    }
  };

  // Toggle stage in criteria
  const handleToggleStage = (stage: string) => {
    setActiveSegmentId(null);
    const current = filterCriteria.stages || [];
    if (current.includes(stage)) {
      setFilterCriteria({ ...filterCriteria, stages: current.filter((s) => s !== stage) });
    } else {
      setFilterCriteria({ ...filterCriteria, stages: [...current, stage] });
    }
  };

  // Toggle priority in criteria
  const handleTogglePriority = (priority: string) => {
    setActiveSegmentId(null);
    const current = filterCriteria.priorities || [];
    if (current.includes(priority)) {
      setFilterCriteria({ ...filterCriteria, priorities: current.filter((p) => p !== priority) });
    } else {
      setFilterCriteria({ ...filterCriteria, priorities: [...current, priority] });
    }
  };

  // Toggle client status in criteria
  const handleToggleStatus = (status: string) => {
    setActiveSegmentId(null);
    const current = filterCriteria.statuses || [];
    if (current.includes(status)) {
      setFilterCriteria({ ...filterCriteria, statuses: current.filter((s) => s !== status) });
    } else {
      setFilterCriteria({ ...filterCriteria, statuses: [...current, status] });
    }
  };

  // Open Save Segment Modal
  const handleOpenSaveModal = () => {
    setEditingSegment(null);
    setSegmentFormName('');
    setSegmentFormDesc('');
    setSaveModalError(null);
    setIsSavedSegmentModalOpen(true);
  };

  const handleOpenEditSegmentModal = (seg: SavedSegmentRecord, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingSegment(seg);
    setSegmentFormName(seg.name);
    setSegmentFormDesc(seg.description || '');
    setSaveModalError(null);
    setIsSavedSegmentModalOpen(true);
  };

  const handleSaveSegmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!segmentFormName.trim()) {
      setSaveModalError('Please enter a segment name.');
      return;
    }

    try {
      if (editingSegment) {
        await updateSavedSegment(editingSegment.id, {
          name: segmentFormName.trim(),
          description: segmentFormDesc.trim(),
          entity_type: activeTab,
          filter_definition: filterCriteria,
        });
      } else {
        const newSeg = await createSavedSegment({
          name: segmentFormName.trim(),
          description: segmentFormDesc.trim(),
          entity_type: activeTab,
          filter_definition: filterCriteria,
        });
        setActiveSegmentId(newSeg.id);
      }
      setIsSavedSegmentModalOpen(false);
    } catch (err: any) {
      setSaveModalError(err?.message || 'Failed to save segment.');
    }
  };

  const handleDeleteSavedSegment = async (segId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this saved segment definition?')) {
      try {
        await deleteSavedSegment(segId);
        if (activeSegmentId === segId) setActiveSegmentId(null);
      } catch (err: any) {
        alert(err?.message || 'Failed to delete segment.');
      }
    }
  };

  // Bulk Tagging Handlers
  const handleOpenBulkTag = (type: 'lead' | 'client') => {
    setBulkModalType(type);
    setBulkModalOpen(true);
  };

  const handleSelectAllLeads = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedLeadIds(filteredLeads.map((l) => l.id));
    } else {
      setSelectedLeadIds([]);
    }
  };

  const handleSelectAllClients = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedClientIds(filteredClients.map((c) => c.id));
    } else {
      setSelectedClientIds([]);
    }
  };

  // Single Item Tag Editor Handlers
  const handleSaveSingleTag = async (tagName: string) => {
    if (!singleTagItem) return;
    if (singleTagItem.type === 'Lead') {
      await addTagToLead(singleTagItem.id, tagName);
    } else {
      await addTagToClient(singleTagItem.id, tagName);
    }
    setSingleTagItem({
      ...singleTagItem,
      currentTags: [...singleTagItem.currentTags, tagName],
    });
  };

  const handleRemoveSingleTag = async (tagName: string) => {
    if (!singleTagItem) return;
    if (singleTagItem.type === 'Lead') {
      await removeTagFromLead(singleTagItem.id, tagName);
    } else {
      await removeTagFromClient(singleTagItem.id, tagName);
    }
    setSingleTagItem({
      ...singleTagItem,
      currentTags: singleTagItem.currentTags.filter((t) => t !== tagName),
    });
  };

  // Distinct sales reps for filter dropdown
  const allSalesmen = useMemo(() => {
    const map = new Map<string, string>();
    leads.forEach((l) => {
      if (l.assigned_to) map.set(l.assigned_to, l.assigned_to_name || l.assigned_to);
    });
    clients.forEach((c) => {
      if (c.owner_id) map.set(c.owner_id, c.owner_name || c.owner_id);
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [leads, clients]);

  return (
    <div id="segments-dashboard-container" className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-indigo-50 text-indigo-700 rounded-lg">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                Customer & Lead Segments
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Target high-value prospects and client cohorts with dynamic tag logic and multi-attribute filters
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isAdmin && (
            <button
              type="button"
              id="btn-save-current-segment"
              onClick={handleOpenSaveModal}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-medium transition-colors shadow-xs"
            >
              <Bookmark className="w-3.5 h-3.5" />
              Save Filter as Segment
            </button>
          )}
          {isAdmin && onNavigateToSettingsTags && (
            <button
              type="button"
              id="btn-manage-taxonomy"
              onClick={onNavigateToSettingsTags}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-medium transition-colors shadow-xs"
            >
              <TagIcon className="w-3.5 h-3.5 text-slate-500" />
              Manage Taxonomy
            </button>
          )}
        </div>
      </div>

      {/* 1-Click Saved Segments Shelf */}
      <div id="saved-segments-shelf" className="bg-slate-50/80 border border-slate-200 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Bookmark className="w-4 h-4 text-indigo-600" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Saved Segment Presets
            </h2>
            <span className="text-[11px] text-slate-500">
              (Live dynamic counts based on your authorized portfolio)
            </span>
          </div>
          {activeSegmentId && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
            >
              Clear Active Preset
            </button>
          )}
        </div>

        {savedSegments.length === 0 ? (
          <p className="text-xs text-slate-400 italic">
            No saved segments created yet. {isAdmin && 'Configure filters below and click "Save Filter as Segment".'}
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {savedSegments.map((seg) => {
              const isCurrent = activeSegmentId === seg.id;
              const count = savedSegmentCounts[seg.id] ?? 0;
              return (
                <div
                  key={seg.id}
                  id={`saved-segment-card-${seg.id}`}
                  onClick={() => handleApplySavedSegment(seg)}
                  className={`group relative p-3 rounded-lg border text-left cursor-pointer transition-all ${
                    isCurrent
                      ? 'bg-indigo-50 border-indigo-300 ring-2 ring-indigo-500/20'
                      : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-xs'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-slate-900 truncate">
                          {seg.name}
                        </span>
                        <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                          {seg.entity_type}
                        </span>
                      </div>
                      {seg.description && (
                        <p className="text-[11px] text-slate-500 truncate mt-0.5">{seg.description}</p>
                      )}
                    </div>
                    <span
                      className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                        isCurrent
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-100 text-slate-700 group-hover:bg-indigo-50 group-hover:text-indigo-700'
                      }`}
                    >
                      {count}
                    </span>
                  </div>

                  {/* Criteria Tags pills */}
                  {seg.filter_definition.tags && seg.filter_definition.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {seg.filter_definition.tags.slice(0, 2).map((t) => (
                        <span
                          key={t}
                          className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded border border-slate-200 truncate max-w-[100px]"
                        >
                          #{t}
                        </span>
                      ))}
                      {seg.filter_definition.tags.length > 2 && (
                        <span className="text-[10px] text-slate-400">
                          +{seg.filter_definition.tags.length - 2}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Admin controls */}
                  {isAdmin && (
                    <div className="absolute top-2 right-2 hidden group-hover:flex items-center gap-1 bg-white/95 rounded-md px-1 py-0.5 shadow-xs border border-slate-200">
                      <button
                        type="button"
                        onClick={(e) => handleOpenEditSegmentModal(seg, e)}
                        className="p-1 text-slate-500 hover:text-indigo-600"
                        title="Edit segment"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleDeleteSavedSegment(seg.id, e)}
                        className="p-1 text-slate-500 hover:text-rose-600"
                        title="Delete segment"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Main View Tabs (Lead / Client / Both) */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
          {(['Lead', 'Client', 'Both'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              id={`tab-segment-${tab.toLowerCase()}`}
              onClick={() => {
                setActiveTab(tab);
                setSelectedLeadIds([]);
                setSelectedClientIds([]);
              }}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-all ${
                activeTab === tab
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab === 'Lead'
                ? `Lead Segments (${filteredLeads.length})`
                : tab === 'Client'
                ? `Client Segments (${filteredClients.length})`
                : `Unified Cohort (${totalCount})`}
            </button>
          ))}
        </div>

        {/* Total match summary */}
        <div className="text-xs text-slate-500">
          Showing <span className="font-semibold text-slate-800">{totalCount}</span> authorized record(s) matching criteria
        </div>
      </div>

      {/* Advanced Filter Matrix */}
      <div id="segment-filter-matrix" className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-500" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Filter Criteria
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Tag Match Mode: ANY vs ALL */}
            <div className="flex items-center gap-1.5 text-xs text-slate-600">
              <span className="font-medium">Tag Match:</span>
              <div className="inline-flex rounded-md p-0.5 bg-slate-100 border border-slate-200">
                <button
                  type="button"
                  id="btn-tag-mode-any"
                  onClick={() => setFilterCriteria({ ...filterCriteria, tag_mode: 'ANY' })}
                  className={`px-2 py-0.5 text-[11px] font-medium rounded ${
                    filterCriteria.tag_mode === 'ANY'
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  ANY (OR)
                </button>
                <button
                  type="button"
                  id="btn-tag-mode-all"
                  onClick={() => setFilterCriteria({ ...filterCriteria, tag_mode: 'ALL' })}
                  className={`px-2 py-0.5 text-[11px] font-medium rounded ${
                    filterCriteria.tag_mode === 'ALL'
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  ALL (AND)
                </button>
              </div>
            </div>

            <button
              type="button"
              id="btn-reset-filters"
              onClick={handleResetFilters}
              className="text-xs text-slate-500 hover:text-slate-800 font-medium underline"
            >
              Reset All
            </button>
          </div>
        </div>

        {/* Available Tags Multi-Select Bar */}
        <div>
          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-2">
            Filter by Tags
          </label>
          {tags.length === 0 ? (
            <p className="text-xs text-slate-400 italic">No tags created in the system.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {tags.map((tag) => {
                const isSelected = (filterCriteria.tags || []).includes(tag.name);
                return (
                  <button
                    key={tag.id}
                    type="button"
                    id={`btn-filter-tag-${tag.id}`}
                    onClick={() => handleToggleCriteriaTag(tag.name)}
                    className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-md border transition-all ${
                      isSelected
                        ? 'bg-indigo-600 border-indigo-600 text-white shadow-xs'
                        : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <span>{tag.name}</span>
                    {tag.type !== 'Both' && (
                      <span
                        className={`text-[9px] uppercase px-1 rounded ${
                          isSelected ? 'bg-indigo-700 text-indigo-100' : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {tag.type}
                      </span>
                    )}
                    {isSelected && <Check className="w-3 h-3 text-white" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Secondary Attributes Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 pt-3 border-t border-slate-100">
          {/* Stage / Status Filter */}
          {activeTab !== 'Client' ? (
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1.5">
                Lead Stages
              </label>
              <div className="flex flex-wrap gap-1">
                {['New', 'Contacted', 'Meeting', 'Quotation', 'Negotiation', 'Won', 'Lost'].map(
                  (stage) => {
                    const isSelected = (filterCriteria.stages || []).includes(stage);
                    return (
                      <button
                        key={stage}
                        type="button"
                        onClick={() => handleToggleStage(stage)}
                        className={`text-xs px-2 py-0.5 rounded border transition-colors ${
                          isSelected
                            ? 'bg-indigo-100 border-indigo-300 text-indigo-800 font-semibold'
                            : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {stage}
                      </button>
                    );
                  }
                )}
              </div>
            </div>
          ) : (
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1.5">
                Client Status
              </label>
              <div className="flex flex-wrap gap-1">
                {['Active', 'Inactive'].map((status) => {
                  const isSelected = (filterCriteria.statuses || []).includes(status);
                  return (
                    <button
                      key={status}
                      type="button"
                      onClick={() => handleToggleStatus(status)}
                      className={`text-xs px-2 py-0.5 rounded border transition-colors ${
                        isSelected
                          ? 'bg-indigo-100 border-indigo-300 text-indigo-800 font-semibold'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {status}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Lead Priority Filter */}
          {activeTab !== 'Client' && (
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1.5">
                Priority
              </label>
              <div className="flex flex-wrap gap-1">
                {['Hot', 'Warm', 'Cold'].map((p) => {
                  const isSelected = (filterCriteria.priorities || []).includes(p);
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => handleTogglePriority(p)}
                      className={`text-xs px-2 py-0.5 rounded border transition-colors ${
                        isSelected
                          ? 'bg-indigo-100 border-indigo-300 text-indigo-800 font-semibold'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {p}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Sales Representative / Owner (Admin Only) */}
          {isAdmin && (
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1.5">
                Assigned Salesman
              </label>
              <select
                id="select-filter-salesman"
                value={filterCriteria.assigned_to || ''}
                onChange={(e) =>
                  setFilterCriteria({ ...filterCriteria, assigned_to: e.target.value })
                }
                className="w-full text-xs border border-slate-200 rounded-md p-1.5 bg-white text-slate-700"
              >
                <option value="">All Representatives</option>
                {allSalesmen.map((rep) => (
                  <option key={rep.id} value={rep.id}>
                    {rep.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* City / Location */}
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1.5">
              City / Location
            </label>
            <input
              type="text"
              id="input-filter-city"
              placeholder="e.g. Muscat, Sohar..."
              value={filterCriteria.city || ''}
              onChange={(e) => setFilterCriteria({ ...filterCriteria, city: e.target.value })}
              className="w-full text-xs border border-slate-200 rounded-md p-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Date & Value Range Collapsible/Sub-row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 pt-2 border-t border-slate-100 text-xs">
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
              Date Filter
            </label>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="date"
                value={filterCriteria.date_from || ''}
                onChange={(e) =>
                  setFilterCriteria({ ...filterCriteria, date_from: e.target.value })
                }
                className="w-full border border-slate-200 rounded p-1 text-[11px]"
                title="From Date"
              />
              <input
                type="date"
                value={filterCriteria.date_to || ''}
                onChange={(e) => setFilterCriteria({ ...filterCriteria, date_to: e.target.value })}
                className="w-full border border-slate-200 rounded p-1 text-[11px]"
                title="To Date"
              />
            </div>
          </div>

          {activeTab !== 'Client' && (
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                Estimated Value (OMR)
              </label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  placeholder="Min"
                  value={filterCriteria.min_value ?? ''}
                  onChange={(e) =>
                    setFilterCriteria({
                      ...filterCriteria,
                      min_value: e.target.value ? Number(e.target.value) : undefined,
                    })
                  }
                  className="w-full border border-slate-200 rounded p-1 text-[11px]"
                />
                <input
                  type="number"
                  placeholder="Max"
                  value={filterCriteria.max_value ?? ''}
                  onChange={(e) =>
                    setFilterCriteria({
                      ...filterCriteria,
                      max_value: e.target.value ? Number(e.target.value) : undefined,
                    })
                  }
                  className="w-full border border-slate-200 rounded p-1 text-[11px]"
                />
              </div>
            </div>
          )}

          {/* Instant Search Bar */}
          <div className="md:col-span-2">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
              Search Within Filtered Cohort
            </label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                id="input-cohort-search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search company name, contact person, phone, tags..."
                className="w-full pl-8 pr-3 py-1.5 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Bulk Action Bar (when records are selected) */}
      {(selectedLeadIds.length > 0 || selectedClientIds.length > 0) && (
        <div
          id="segment-bulk-action-bar"
          className="sticky top-4 z-20 bg-indigo-900 text-white rounded-xl px-5 py-3 shadow-lg flex flex-col sm:flex-row items-center justify-between gap-3 animate-in slide-in-from-top-2"
        >
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold bg-indigo-800 px-2.5 py-1 rounded-full text-indigo-100">
              {selectedLeadIds.length + selectedClientIds.length} Selected
            </span>
            <span className="text-xs text-indigo-200">
              {selectedLeadIds.length > 0 && `${selectedLeadIds.length} Leads`}
              {selectedLeadIds.length > 0 && selectedClientIds.length > 0 && ' & '}
              {selectedClientIds.length > 0 && `${selectedClientIds.length} Clients`}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {selectedLeadIds.length > 0 && (
              <button
                type="button"
                id="btn-bulk-tag-leads"
                onClick={() => handleOpenBulkTag('lead')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white text-indigo-900 rounded-lg text-xs font-semibold hover:bg-indigo-50 transition-colors"
              >
                <TagIcon className="w-3.5 h-3.5" />
                Manage Tags for Selected Leads
              </button>
            )}

            {selectedClientIds.length > 0 && (
              <button
                type="button"
                id="btn-bulk-tag-clients"
                onClick={() => handleOpenBulkTag('client')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white text-indigo-900 rounded-lg text-xs font-semibold hover:bg-indigo-50 transition-colors"
              >
                <TagIcon className="w-3.5 h-3.5" />
                Manage Tags for Selected Clients
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setSelectedLeadIds([]);
                setSelectedClientIds([]);
              }}
              className="text-xs text-indigo-300 hover:text-white px-2 py-1"
            >
              Deselect All
            </button>
          </div>
        </div>
      )}

      {/* Results Container */}
      <div className="space-y-6">
        {/* LEADS TABLE */}
        {(activeTab === 'Lead' || activeTab === 'Both') && (
          <div id="segment-leads-results" className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
            <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-800">
                  Matching Leads ({filteredLeads.length})
                </h3>
              </div>
              {filteredLeads.length > 0 && (
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={
                        filteredLeads.length > 0 &&
                        selectedLeadIds.length === filteredLeads.length
                      }
                      onChange={handleSelectAllLeads}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>Select all {filteredLeads.length} leads</span>
                  </label>
                </div>
              )}
            </div>

            {filteredLeads.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                <Building2 className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                No leads match the selected tag and attribute criteria.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-600">
                  <thead className="bg-slate-50/50 text-[11px] font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-100">
                    <tr>
                      <th className="py-2.5 px-3 w-8">
                        <span className="sr-only">Select</span>
                      </th>
                      <th className="py-2.5 px-4 font-semibold">Lead Company</th>
                      <th className="py-2.5 px-4 font-semibold">Contact & Location</th>
                      <th className="py-2.5 px-3 font-semibold">Stage & Priority</th>
                      <th className="py-2.5 px-4 font-semibold">Assigned Salesman</th>
                      <th className="py-2.5 px-4 font-semibold">Assigned Tags</th>
                      <th className="py-2.5 px-3 text-right font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredLeads.map((lead) => {
                      const isSelected = selectedLeadIds.includes(lead.id);
                      return (
                        <tr
                          key={lead.id}
                          id={`segment-lead-row-${lead.id}`}
                          className={`hover:bg-slate-50/80 transition-colors ${
                            isSelected ? 'bg-indigo-50/40' : ''
                          }`}
                        >
                          <td className="py-3 px-3">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedLeadIds([...selectedLeadIds, lead.id]);
                                } else {
                                  setSelectedLeadIds(selectedLeadIds.filter((id) => id !== lead.id));
                                }
                              }}
                              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                            />
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-semibold text-slate-900">{lead.company_name}</div>
                            {lead.project_name && (
                              <div className="text-[11px] text-slate-500">{lead.project_name}</div>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <div className="text-slate-800">{lead.contact_person || '—'}</div>
                            <div className="text-[11px] text-slate-500">
                              {lead.location || lead.phone || '—'}
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-1.5">
                              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 text-indigo-700">
                                {lead.status}
                              </span>
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                                  lead.priority === 'Hot'
                                    ? 'bg-rose-50 text-rose-700'
                                    : lead.priority === 'Warm'
                                    ? 'bg-amber-50 text-amber-700'
                                    : 'bg-slate-100 text-slate-600'
                                }`}
                              >
                                {lead.priority}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="text-slate-700 font-medium">
                              {lead.assigned_to_name || 'Unassigned'}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex flex-wrap gap-1 max-w-xs">
                              {Array.isArray(lead.tags) && lead.tags.length > 0 ? (
                                lead.tags.map((tagName) => {
                                  const tagDef = tags.find(
                                    (t) => t.name.toLowerCase() === tagName.toLowerCase()
                                  );
                                  return (
                                    <TagBadge
                                      key={tagName}
                                      name={tagName}
                                      color={tagDef?.color}
                                      size="sm"
                                    />
                                  );
                                })
                              ) : (
                                <span className="text-[11px] text-slate-400 italic">No tags</span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-3 text-right">
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                id={`btn-tag-lead-${lead.id}`}
                                onClick={() =>
                                  setSingleTagItem({
                                    type: 'Lead',
                                    id: lead.id,
                                    name: lead.company_name,
                                    currentTags: lead.tags || [],
                                  })
                                }
                                className="p-1 text-slate-400 hover:text-indigo-600 rounded"
                                title="Edit tags"
                              >
                                <TagIcon className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                id={`btn-view-lead-${lead.id}`}
                                onClick={() => onNavigateToLead(lead.id)}
                                className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] font-medium transition-colors"
                              >
                                View <ExternalLink className="w-3 h-3" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* CLIENTS TABLE */}
        {(activeTab === 'Client' || activeTab === 'Both') && (
          <div id="segment-clients-results" className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
            <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-800">
                  Matching Clients ({filteredClients.length})
                </h3>
              </div>
              {filteredClients.length > 0 && (
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={
                        filteredClients.length > 0 &&
                        selectedClientIds.length === filteredClients.length
                      }
                      onChange={handleSelectAllClients}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>Select all {filteredClients.length} clients</span>
                  </label>
                </div>
              )}
            </div>

            {filteredClients.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                <Building2 className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                No clients match the selected tag and attribute criteria.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-600">
                  <thead className="bg-slate-50/50 text-[11px] font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-100">
                    <tr>
                      <th className="py-2.5 px-3 w-8">
                        <span className="sr-only">Select</span>
                      </th>
                      <th className="py-2.5 px-4 font-semibold">Client Company</th>
                      <th className="py-2.5 px-4 font-semibold">Primary Contact & Location</th>
                      <th className="py-2.5 px-3 font-semibold">Client Status</th>
                      <th className="py-2.5 px-4 font-semibold">Portfolio Owner</th>
                      <th className="py-2.5 px-4 font-semibold">Assigned Tags</th>
                      <th className="py-2.5 px-3 text-right font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredClients.map((client) => {
                      const isSelected = selectedClientIds.includes(client.id);
                      return (
                        <tr
                          key={client.id}
                          id={`segment-client-row-${client.id}`}
                          className={`hover:bg-slate-50/80 transition-colors ${
                            isSelected ? 'bg-indigo-50/40' : ''
                          }`}
                        >
                          <td className="py-3 px-3">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedClientIds([...selectedClientIds, client.id]);
                                } else {
                                  setSelectedClientIds(
                                    selectedClientIds.filter((id) => id !== client.id)
                                  );
                                }
                              }}
                              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                            />
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-semibold text-slate-900">
                              {client.company_name}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              Type: {(client.client_type || 'Client').toUpperCase()}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="text-slate-800">{client.contact_person || '—'}</div>
                            <div className="text-[11px] text-slate-500">
                              {client.location || client.phone || '—'}
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                client.status === 'Active'
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {client.status}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="text-slate-700 font-medium">
                              {client.owner_name || 'Assigned Rep'}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex flex-wrap gap-1 max-w-xs">
                              {Array.isArray(client.tags) && client.tags.length > 0 ? (
                                client.tags.map((tagName) => {
                                  const tagDef = tags.find(
                                    (t) => t.name.toLowerCase() === tagName.toLowerCase()
                                  );
                                  return (
                                    <TagBadge
                                      key={tagName}
                                      name={tagName}
                                      color={tagDef?.color}
                                      size="sm"
                                    />
                                  );
                                })
                              ) : (
                                <span className="text-[11px] text-slate-400 italic">No tags</span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-3 text-right">
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                id={`btn-tag-client-${client.id}`}
                                onClick={() =>
                                  setSingleTagItem({
                                    type: 'Client',
                                    id: client.id,
                                    name: client.company_name,
                                    currentTags: client.tags || [],
                                  })
                                }
                                className="p-1 text-slate-400 hover:text-indigo-600 rounded"
                                title="Edit tags"
                              >
                                <TagIcon className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                id={`btn-view-client-${client.id}`}
                                onClick={() => onNavigateToClient(client.id)}
                                className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] font-medium transition-colors"
                              >
                                View <ExternalLink className="w-3 h-3" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Save Segment Definition Modal */}
      {isSavedSegmentModalOpen && (
        <div
          id="save-segment-modal-backdrop"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in"
          onClick={() => setIsSavedSegmentModalOpen(false)}
        >
          <div
            id="save-segment-modal-panel"
            className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <form onSubmit={handleSaveSegmentSubmit}>
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                    <Bookmark className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-slate-800">
                      {editingSegment ? 'Edit Saved Segment' : 'Save Filter Definition'}
                    </h3>
                    <p className="text-xs text-slate-500">
                      Save active filter conditions as a 1-click global preset
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsSavedSegmentModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 p-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5 space-y-4">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Segment Name *
                  </label>
                  <input
                    type="text"
                    id="input-segment-name"
                    required
                    placeholder="e.g. VIP Repeat Clients, Hot Commercial Prospects"
                    value={segmentFormName}
                    onChange={(e) => setSegmentFormName(e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Description (Optional)
                  </label>
                  <textarea
                    id="input-segment-desc"
                    rows={2}
                    placeholder="Brief description of this customer cohort..."
                    value={segmentFormDesc}
                    onChange={(e) => setSegmentFormDesc(e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>

                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-1">
                  <span className="font-semibold text-slate-700 block">Preset Summary:</span>
                  <div className="text-slate-600">
                    • Target Entity: <span className="font-medium text-slate-800">{activeTab}</span>
                  </div>
                  {filterCriteria.tags && filterCriteria.tags.length > 0 && (
                    <div className="text-slate-600">
                      • Tags ({filterCriteria.tag_mode}):{' '}
                      <span className="font-medium text-slate-800">
                        {filterCriteria.tags.join(', ')}
                      </span>
                    </div>
                  )}
                  {filterCriteria.stages && filterCriteria.stages.length > 0 && (
                    <div className="text-slate-600">
                      • Stages:{' '}
                      <span className="font-medium text-slate-800">
                        {filterCriteria.stages.join(', ')}
                      </span>
                    </div>
                  )}
                  {filterCriteria.priorities && filterCriteria.priorities.length > 0 && (
                    <div className="text-slate-600">
                      • Priorities:{' '}
                      <span className="font-medium text-slate-800">
                        {filterCriteria.priorities.join(', ')}
                      </span>
                    </div>
                  )}
                </div>

                {saveModalError && (
                  <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600">
                    {saveModalError}
                  </div>
                )}
              </div>

              <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsSavedSegmentModalOpen(false)}
                  className="px-3 py-1.5 border border-slate-200 rounded-md text-xs font-medium text-slate-700 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  id="btn-submit-save-segment"
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-xs font-medium transition-colors"
                >
                  {editingSegment ? 'Save Changes' : 'Create Preset'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Tagging Modal */}
      <BulkTagModal
        isOpen={bulkModalOpen}
        onClose={() => setBulkModalOpen(false)}
        entityType={bulkModalType}
        selectedIds={bulkModalType === 'lead' ? selectedLeadIds : selectedClientIds}
        onComplete={() => {
          setLeads(getLocalLeads());
          setClients(getLocalClients());
          setSelectedLeadIds([]);
          setSelectedClientIds([]);
        }}
      />

      {/* Single Item Tag Modal */}
      {singleTagItem && (
        <TagSelectorModal
          isOpen={true}
          onClose={() => setSingleTagItem(null)}
          entityType={singleTagItem.type}
          currentTags={singleTagItem.currentTags}
          onSelectTag={handleSaveSingleTag}
          onRemoveTag={handleRemoveSingleTag}
          isAdmin={isAdmin}
          onOpenTagManagement={onNavigateToSettingsTags}
          title={`Tags for ${singleTagItem.name}`}
        />
      )}
    </div>
  );
};
