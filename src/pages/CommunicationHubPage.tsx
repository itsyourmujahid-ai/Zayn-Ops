import React, { useState, useEffect, useMemo } from 'react';
import {
  MessageSquare,
  History,
  Users,
  Search,
  Filter,
  Download,
  Calendar,
  User,
  ArrowRight,
  Phone,
  Mail,
  Building,
  CheckCircle2,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  Clock,
  Briefcase,
  AlertCircle,
  FileText,
  Layers,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  LeadActivityRecord,
  LeadTransferRecord,
  ClientTransferRecord,
  UserProfile,
  ActivityType,
} from '../types/database';
import {
  subscribeToCompanyCommunications,
  subscribeToLeadTransfers,
  subscribeToClientTransfers,
  getAllUsers,
  getEffectiveCompanyId,
  getLeads,
  getClients,
} from '../lib/dal';

interface CommunicationHubPageProps {
  onSelectLead: (leadId: string) => void;
  onSelectClient: (clientId: string) => void;
}

type HubTab = 'communications' | 'lead-transfers' | 'client-transfers';
type DateFilter = 'all' | 'today' | 'yesterday' | 'last7' | 'last30';

const PAGE_SIZE = 25;

export const CommunicationHubPage: React.FC<CommunicationHubPageProps> = ({
  onSelectLead,
  onSelectClient,
}) => {
  const { userProfile, isSuperAdmin } = useAuth();

  // Active Tab
  const [activeTab, setActiveTab] = useState<HubTab>('communications');

  // Data states
  const [communications, setCommunications] = useState<LeadActivityRecord[]>([]);
  const [leadTransfers, setLeadTransfers] = useState<LeadTransferRecord[]>([]);
  const [clientTransfers, setClientTransfers] = useState<ClientTransferRecord[]>([]);
  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [leadsMap, setLeadsMap] = useState<Record<string, { name: string; contact?: string }>>({});
  const [clientsMap, setClientsMap] = useState<Record<string, { name: string; contact?: string }>>({});
  const [loading, setLoading] = useState<boolean>(true);

  // Filter states - Tab 1 Communications
  const [commSearch, setCommSearch] = useState<string>('');
  const [commSalesman, setCommSalesman] = useState<string>('all');
  const [commType, setCommType] = useState<string>('all');
  const [commDateRange, setCommDateRange] = useState<DateFilter>('all');
  const [commPage, setCommPage] = useState<number>(1);

  // Filter states - Tab 2 Lead Transfers
  const [leadTrSearch, setLeadTrSearch] = useState<string>('');
  const [leadTrFrom, setLeadTrFrom] = useState<string>('all');
  const [leadTrTo, setLeadTrTo] = useState<string>('all');
  const [leadTrBy, setLeadTrBy] = useState<string>('all');
  const [leadTrDateRange, setLeadTrDateRange] = useState<DateFilter>('all');
  const [leadTrPage, setLeadTrPage] = useState<number>(1);

  // Filter states - Tab 3 Client Transfers
  const [clientTrSearch, setClientTrSearch] = useState<string>('');
  const [clientTrFrom, setClientTrFrom] = useState<string>('all');
  const [clientTrTo, setClientTrTo] = useState<string>('all');
  const [clientTrBy, setClientTrBy] = useState<string>('all');
  const [clientTrDateRange, setClientTrDateRange] = useState<DateFilter>('all');
  const [clientTrPage, setClientTrPage] = useState<number>(1);

  const effectiveCompanyId = userProfile?.company_id || getEffectiveCompanyId() || '';

  // 1. Initial lookup loads
  useEffect(() => {
    let isMounted = true;
    getAllUsers()
      .then((users) => {
        if (!isMounted) return;
        // Tenant isolation: Only include users belonging to this company
        const companyUsers = users.filter(
          (u) => !effectiveCompanyId || !u.company_id || u.company_id === effectiveCompanyId
        );
        setUsersList(companyUsers);
      })
      .catch(() => {});

    getLeads({ userRole: 'ADMIN' })
      .then((allLeads) => {
        if (!isMounted) return;
        const map: Record<string, { name: string; contact?: string }> = {};
        allLeads.forEach((l) => {
          map[l.id] = { name: l.company_name, contact: l.contact_person };
        });
        setLeadsMap(map);
      })
      .catch(() => {});

    getClients()
      .then((allClients) => {
        if (!isMounted) return;
        const map: Record<string, { name: string; contact?: string }> = {};
        allClients.forEach((c) => {
          map[c.id] = { name: c.company_name, contact: c.contact_person };
        });
        setClientsMap(map);
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [effectiveCompanyId]);

  // 2. Subscriptions for Communications and Transfers
  useEffect(() => {
    setLoading(true);
    const unsubComm = subscribeToCompanyCommunications((data) => {
      setCommunications(data);
      setLoading(false);
    }, effectiveCompanyId);

    const unsubLeadTr = subscribeToLeadTransfers((data) => {
      setLeadTransfers(data);
    });

    const unsubClientTr = subscribeToClientTransfers((data) => {
      setClientTransfers(data);
    });

    return () => {
      unsubComm();
      unsubLeadTr();
      unsubClientTr();
    };
  }, [effectiveCompanyId]);

  // Salesmen options for dropdowns
  const companySalesmen = useMemo(() => {
    return usersList.filter(
      (u) => u.role === 'SALESMAN' || u.role === 'sales_rep' || u.role === 'ADMIN'
    );
  }, [usersList]);

  // Date range filter helper
  const matchesDateRange = (timestampStr: string | undefined, filter: DateFilter): boolean => {
    if (filter === 'all' || !timestampStr) return true;
    const itemDate = new Date(timestampStr);
    const now = new Date();

    if (filter === 'today') {
      return (
        itemDate.getFullYear() === now.getFullYear() &&
        itemDate.getMonth() === now.getMonth() &&
        itemDate.getDate() === now.getDate()
      );
    }
    if (filter === 'yesterday') {
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      return (
        itemDate.getFullYear() === yesterday.getFullYear() &&
        itemDate.getMonth() === yesterday.getMonth() &&
        itemDate.getDate() === yesterday.getDate()
      );
    }
    if (filter === 'last7') {
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return itemDate >= sevenDaysAgo;
    }
    if (filter === 'last30') {
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      return itemDate >= thirtyDaysAgo;
    }
    return true;
  };

  // -------------------------------------------------------------
  // Filtered & Paginated Communications (Tab 1)
  // -------------------------------------------------------------
  const filteredCommunications = useMemo(() => {
    return communications.filter((comm) => {
      // 1. Salesman filter
      if (commSalesman !== 'all') {
        if (comm.performed_by !== commSalesman && comm.created_by !== commSalesman) {
          return false;
        }
      }

      // 2. Type filter
      if (commType !== 'all') {
        if (comm.activity_type !== commType) {
          return false;
        }
      }

      // 3. Date range filter
      const commDate = comm.activity_at || comm.activity_date || comm.created_at;
      if (!matchesDateRange(commDate, commDateRange)) {
        return false;
      }

      // 4. Search query (Contact, Lead, Client, Notes, Performed By)
      if (commSearch.trim()) {
        const q = commSearch.toLowerCase().trim();
        const leadInfo = comm.lead_id ? leadsMap[comm.lead_id] : null;
        const clientInfo = comm.client_id ? clientsMap[comm.client_id] : null;

        const leadName = leadInfo?.name || comm.metadata?.company_name || '';
        const clientName = clientInfo?.name || comm.client_name || '';
        const contactPerson =
          leadInfo?.contact || clientInfo?.contact || comm.metadata?.contact_person || '';
        const desc = comm.description || '';
        const notes = comm.notes || '';
        const performer = comm.performed_by_name || '';

        const matches =
          leadName.toLowerCase().includes(q) ||
          clientName.toLowerCase().includes(q) ||
          contactPerson.toLowerCase().includes(q) ||
          desc.toLowerCase().includes(q) ||
          notes.toLowerCase().includes(q) ||
          performer.toLowerCase().includes(q);

        if (!matches) return false;
      }

      return true;
    });
  }, [communications, commSalesman, commType, commDateRange, commSearch, leadsMap, clientsMap]);

  const totalCommPages = Math.max(1, Math.ceil(filteredCommunications.length / PAGE_SIZE));
  const paginatedCommunications = useMemo(() => {
    const start = (commPage - 1) * PAGE_SIZE;
    return filteredCommunications.slice(start, start + PAGE_SIZE);
  }, [filteredCommunications, commPage]);

  // -------------------------------------------------------------
  // Filtered & Paginated Lead Transfers (Tab 2)
  // -------------------------------------------------------------
  const filteredLeadTransfers = useMemo(() => {
    return leadTransfers.filter((tr) => {
      // From salesman
      if (leadTrFrom !== 'all') {
        const fromId = tr.from_user_id || tr.previous_owner;
        if (fromId !== leadTrFrom) return false;
      }

      // To salesman
      if (leadTrTo !== 'all') {
        const toId = tr.to_user_id || tr.new_owner;
        if (toId !== leadTrTo) return false;
      }

      // Transferred by
      if (leadTrBy !== 'all') {
        if (tr.transferred_by !== leadTrBy) return false;
      }

      // Date range
      const trDate = tr.transferred_at || tr.timestamp;
      if (!matchesDateRange(trDate, leadTrDateRange)) return false;

      // Search query
      if (leadTrSearch.trim()) {
        const q = leadTrSearch.toLowerCase().trim();
        const leadName = tr.lead_name || leadsMap[tr.lead_id]?.name || '';
        const reason = tr.reason || '';
        const fromName = tr.from_user_name || tr.previous_owner_name || '';
        const toName = tr.to_user_name || tr.new_owner_name || '';
        const byName = tr.transferred_by_name || '';

        const matches =
          leadName.toLowerCase().includes(q) ||
          reason.toLowerCase().includes(q) ||
          fromName.toLowerCase().includes(q) ||
          toName.toLowerCase().includes(q) ||
          byName.toLowerCase().includes(q);

        if (!matches) return false;
      }

      return true;
    });
  }, [leadTransfers, leadTrFrom, leadTrTo, leadTrBy, leadTrDateRange, leadTrSearch, leadsMap]);

  const totalLeadTrPages = Math.max(1, Math.ceil(filteredLeadTransfers.length / PAGE_SIZE));
  const paginatedLeadTransfers = useMemo(() => {
    const start = (leadTrPage - 1) * PAGE_SIZE;
    return filteredLeadTransfers.slice(start, start + PAGE_SIZE);
  }, [filteredLeadTransfers, leadTrPage]);

  // -------------------------------------------------------------
  // Filtered & Paginated Client Transfers (Tab 3)
  // -------------------------------------------------------------
  const filteredClientTransfers = useMemo(() => {
    return clientTransfers.filter((tr) => {
      // From salesman
      if (clientTrFrom !== 'all') {
        if (tr.from_user_id !== clientTrFrom) return false;
      }

      // To salesman
      if (clientTrTo !== 'all') {
        if (tr.to_user_id !== clientTrTo) return false;
      }

      // Transferred by
      if (clientTrBy !== 'all') {
        if (tr.transferred_by !== clientTrBy) return false;
      }

      // Date range
      const trDate = tr.transferred_at || tr.timestamp;
      if (!matchesDateRange(trDate, clientTrDateRange)) return false;

      // Search query
      if (clientTrSearch.trim()) {
        const q = clientTrSearch.toLowerCase().trim();
        const clientName = tr.client_name || clientsMap[tr.client_id]?.name || '';
        const reason = tr.reason || '';
        const fromName = tr.from_user_name || '';
        const toName = tr.to_user_name || '';
        const byName = tr.transferred_by_name || '';

        const matches =
          clientName.toLowerCase().includes(q) ||
          reason.toLowerCase().includes(q) ||
          fromName.toLowerCase().includes(q) ||
          toName.toLowerCase().includes(q) ||
          byName.toLowerCase().includes(q);

        if (!matches) return false;
      }

      return true;
    });
  }, [clientTransfers, clientTrFrom, clientTrTo, clientTrBy, clientTrDateRange, clientTrSearch, clientsMap]);

  const totalClientTrPages = Math.max(1, Math.ceil(filteredClientTransfers.length / PAGE_SIZE));
  const paginatedClientTransfers = useMemo(() => {
    const start = (clientTrPage - 1) * PAGE_SIZE;
    return filteredClientTransfers.slice(start, start + PAGE_SIZE);
  }, [filteredClientTransfers, clientTrPage]);

  // -------------------------------------------------------------
  // CSV Export Handlers
  // -------------------------------------------------------------
  const exportCommunicationsCSV = () => {
    const headers = ['Date & Time', 'Salesman', 'Type', 'Entity', 'Entity Name', 'Contact Person', 'Notes'];
    const rows = filteredCommunications.map((c) => {
      const dt = new Date(c.activity_at || c.activity_date || c.created_at).toLocaleString();
      const entity = c.client_id ? 'Client' : 'Lead';
      const entityName = c.client_id
        ? clientsMap[c.client_id]?.name || c.client_name || 'Client'
        : leadsMap[c.lead_id || '']?.name || c.metadata?.company_name || 'Lead';
      const contact = c.client_id
        ? clientsMap[c.client_id]?.contact || ''
        : leadsMap[c.lead_id || '']?.contact || c.metadata?.contact_person || '';
      return [
        `"${dt}"`,
        `"${c.performed_by_name || 'Salesman'}"`,
        `"${c.activity_type}"`,
        `"${entity}"`,
        `"${entityName.replace(/"/g, '""')}"`,
        `"${contact.replace(/"/g, '""')}"`,
        `"${(c.notes || c.description || '').replace(/"/g, '""')}"`,
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    downloadBlob(csvContent, `zaynops_communications_${Date.now()}.csv`);
  };

  const exportLeadTransfersCSV = () => {
    const headers = ['Date & Time', 'Lead Name', 'From Salesman', 'To Salesman', 'Transferred By', 'Reason', 'Status'];
    const rows = filteredLeadTransfers.map((tr) => {
      const dt = new Date(tr.transferred_at || tr.timestamp || Date.now()).toLocaleString();
      const leadName = tr.lead_name || leadsMap[tr.lead_id]?.name || 'Lead';
      return [
        `"${dt}"`,
        `"${leadName.replace(/"/g, '""')}"`,
        `"${tr.from_user_name || tr.previous_owner_name || 'Unassigned'}"`,
        `"${tr.to_user_name || tr.new_owner_name || 'Unassigned'}"`,
        `"${tr.transferred_by_name || 'Administrator'}"`,
        `"${(tr.reason || '').replace(/"/g, '""')}"`,
        `"Completed"`,
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    downloadBlob(csvContent, `zaynops_lead_transfers_${Date.now()}.csv`);
  };

  const exportClientTransfersCSV = () => {
    const headers = ['Date & Time', 'Client Name', 'From Salesman', 'To Salesman', 'Transferred By', 'Reason', 'Status'];
    const rows = filteredClientTransfers.map((tr) => {
      const dt = new Date(tr.transferred_at || tr.timestamp || Date.now()).toLocaleString();
      const clientName = tr.client_name || clientsMap[tr.client_id]?.name || 'Client';
      return [
        `"${dt}"`,
        `"${clientName.replace(/"/g, '""')}"`,
        `"${tr.from_user_name || 'Unassigned'}"`,
        `"${tr.to_user_name || 'Unassigned'}"`,
        `"${tr.transferred_by_name || 'Administrator'}"`,
        `"${(tr.reason || '').replace(/"/g, '""')}"`,
        `"Completed"`,
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    downloadBlob(csvContent, `zaynops_client_transfers_${Date.now()}.csv`);
  };

  const downloadBlob = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // -------------------------------------------------------------
  // Security Guard: Company Admin ONLY
  // SUPER_ADMIN / VVIP: NO
  // Salesman: NO
  // Customer: NO
  // -------------------------------------------------------------
  if (isSuperAdmin) {
    return (
      <div className="max-w-4xl mx-auto py-12 px-4" id="communication-hub-vvip-blocked">
        <div className="rounded-2xl border border-red-200 bg-red-50/70 p-8 text-center shadow-xs">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-red-100 flex items-center justify-center text-red-600 mb-4 border border-red-200">
            <ShieldAlert className="h-7 w-7" />
          </div>
          <h2 className="text-lg font-bold text-red-950">Access Denied</h2>
          <p className="text-sm text-red-800 max-w-lg mx-auto mt-2">
            Access Denied: Platform Administrators cannot access tenant operational communications.
          </p>
          <div className="mt-6">
            <a
              href="/super-admin"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-600 text-white font-bold text-xs hover:bg-red-700 shadow-xs transition"
            >
              Redirect to: Super Admin Console
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (userProfile?.role !== 'ADMIN') {
    return (
      <div className="max-w-4xl mx-auto py-12 px-4" id="communication-hub-unauthorized">
        <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-8 text-center shadow-xs">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-amber-100 flex items-center justify-center text-amber-600 mb-4 border border-amber-200">
            <ShieldAlert className="h-7 w-7" />
          </div>
          <h2 className="text-lg font-bold text-amber-950">Company Administrator Access Required</h2>
          <p className="text-sm text-amber-800 max-w-lg mx-auto mt-2">
            The Communication Hub is reserved exclusively for Company Administrators to monitor company-wide communications and portfolio transfers.
          </p>
        </div>
      </div>
    );
  }

  // Type badge color and icon helper
  const getActivityBadge = (type: string) => {
    switch (type) {
      case 'Call':
        return {
          icon: <Phone className="h-3 w-3" />,
          className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        };
      case 'WhatsApp':
        return {
          icon: <MessageSquare className="h-3 w-3" />,
          className: 'bg-green-50 text-green-700 border-green-200',
        };
      case 'Email':
        return {
          icon: <Mail className="h-3 w-3" />,
          className: 'bg-sky-50 text-sky-700 border-sky-200',
        };
      case 'Meeting':
        return {
          icon: <Users className="h-3 w-3" />,
          className: 'bg-purple-50 text-purple-700 border-purple-200',
        };
      case 'Visit':
        return {
          icon: <Building className="h-3 w-3" />,
          className: 'bg-indigo-50 text-indigo-700 border-indigo-200',
        };
      case 'Transfer':
        return {
          icon: <History className="h-3 w-3" />,
          className: 'bg-amber-50 text-amber-700 border-amber-200',
        };
      default:
        return {
          icon: <FileText className="h-3 w-3" />,
          className: 'bg-slate-50 text-slate-700 border-slate-200',
        };
    }
  };

  return (
    <div className="space-y-6 pb-12" id="communication-hub-page">
      {/* 1. Header & Summary Stats */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold border border-indigo-100">
              <MessageSquare className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                Company Communication Hub
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Company-level monitoring center for client engagements, sales communications, and ownership handovers.
              </p>
            </div>
          </div>
        </div>

        {/* Live Metrics Cards */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-2.5">
            <MessageSquare className="h-4 w-4 text-indigo-600" />
            <div>
              <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Communications</div>
              <div className="text-sm font-bold text-slate-900">{communications.length}</div>
            </div>
          </div>

          <div className="px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-2.5">
            <History className="h-4 w-4 text-emerald-600" />
            <div>
              <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Lead Transfers</div>
              <div className="text-sm font-bold text-slate-900">{leadTransfers.length}</div>
            </div>
          </div>

          <div className="px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-2.5">
            <Briefcase className="h-4 w-4 text-sky-600" />
            <div>
              <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Client Transfers</div>
              <div className="text-sm font-bold text-slate-900">{clientTransfers.length}</div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Top Tabs Switcher */}
      <div className="border-b border-slate-200 bg-white px-3 pt-2 rounded-t-2xl shadow-2xs">
        <div className="flex items-center gap-2 overflow-x-auto">
          {/* Tab 1: Communications */}
          <button
            type="button"
            id="hub-tab-communications"
            onClick={() => setActiveTab('communications')}
            className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition cursor-pointer whitespace-nowrap ${
              activeTab === 'communications'
                ? 'border-indigo-600 text-indigo-700 bg-indigo-50/30'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
            }`}
          >
            <MessageSquare className="h-4 w-4" />
            <span>Communications</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-semibold ${
                activeTab === 'communications' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {communications.length}
            </span>
          </button>

          {/* Tab 2: Lead Transfers */}
          <button
            type="button"
            id="hub-tab-lead-transfers"
            onClick={() => setActiveTab('lead-transfers')}
            className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition cursor-pointer whitespace-nowrap ${
              activeTab === 'lead-transfers'
                ? 'border-indigo-600 text-indigo-700 bg-indigo-50/30'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
            }`}
          >
            <History className="h-4 w-4" />
            <span>Lead Transfers</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-semibold ${
                activeTab === 'lead-transfers' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {leadTransfers.length}
            </span>
          </button>

          {/* Tab 3: Client Transfers */}
          <button
            type="button"
            id="hub-tab-client-transfers"
            onClick={() => setActiveTab('client-transfers')}
            className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition cursor-pointer whitespace-nowrap ${
              activeTab === 'client-transfers'
                ? 'border-indigo-600 text-indigo-700 bg-indigo-50/30'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
            }`}
          >
            <Briefcase className="h-4 w-4" />
            <span>Client Transfers</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-semibold ${
                activeTab === 'client-transfers' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {clientTransfers.length}
            </span>
          </button>
        </div>
      </div>

      {/* 3. Tab Contents */}

      {/* ========================================================= */}
      {/* TAB 1: COMMUNICATIONS */}
      {/* ========================================================= */}
      {activeTab === 'communications' && (
        <div className="space-y-4 animate-in fade-in duration-150">
          {/* Controls & Filter Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3 flex-1">
              {/* Search */}
              <div className="relative min-w-[240px] flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  id="comm-search-input"
                  placeholder="Search contact, lead, client, notes..."
                  value={commSearch}
                  onChange={(e) => {
                    setCommSearch(e.target.value);
                    setCommPage(1);
                  }}
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
                />
              </div>

              {/* Salesman Filter */}
              <select
                id="comm-salesman-select"
                value={commSalesman}
                onChange={(e) => {
                  setCommSalesman(e.target.value);
                  setCommPage(1);
                }}
                className="px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition cursor-pointer"
              >
                <option value="all">All Salesmen</option>
                {companySalesmen.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.full_name || s.email}
                  </option>
                ))}
              </select>

              {/* Type Filter */}
              <select
                id="comm-type-select"
                value={commType}
                onChange={(e) => {
                  setCommType(e.target.value);
                  setCommPage(1);
                }}
                className="px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition cursor-pointer"
              >
                <option value="all">All Types</option>
                <option value="Call">Call</option>
                <option value="WhatsApp">WhatsApp</option>
                <option value="Email">Email</option>
                <option value="Meeting">Meeting</option>
                <option value="Visit">Visit</option>
                <option value="Note">Note</option>
                <option value="Transfer">Transfer</option>
              </select>

              {/* Date Range Filter */}
              <select
                id="comm-date-select"
                value={commDateRange}
                onChange={(e) => {
                  setCommDateRange(e.target.value as DateFilter);
                  setCommPage(1);
                }}
                className="px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition cursor-pointer"
              >
                <option value="all">All Time</option>
                <option value="today">Today</option>
                <option value="yesterday">Yesterday</option>
                <option value="last7">Last 7 Days</option>
                <option value="last30">Last 30 Days</option>
              </select>
            </div>

            {/* Export Action */}
            <button
              type="button"
              id="export-comm-btn"
              onClick={exportCommunicationsCSV}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 shadow-2xs transition cursor-pointer self-start md:self-auto"
            >
              <Download className="h-3.5 w-3.5 text-slate-500" />
              <span>Export CSV</span>
            </button>
          </div>

          {/* Communications Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs" id="communications-table">
                <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3.5 px-4">Date & Time</th>
                    <th className="py-3.5 px-4">Salesman</th>
                    <th className="py-3.5 px-4">Type</th>
                    <th className="py-3.5 px-4">Related Lead / Client</th>
                    <th className="py-3.5 px-4">Contact Person</th>
                    <th className="py-3.5 px-4 min-w-[220px]">Summary & Notes</th>
                    <th className="py-3.5 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {paginatedCommunications.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        <MessageSquare className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                        <p className="font-semibold text-sm text-slate-600">No communications found</p>
                        <p className="text-xs text-slate-400 mt-1">
                          No logged communications match your active filter criteria.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    paginatedCommunications.map((comm) => {
                      const dt = new Date(
                        comm.activity_at || comm.activity_date || comm.created_at
                      ).toLocaleString();
                      const badge = getActivityBadge(comm.activity_type);
                      const isClient = Boolean(comm.client_id);
                      const entityId = comm.client_id || comm.lead_id || '';
                      const entityName = isClient
                        ? clientsMap[entityId]?.name || comm.client_name || 'Client'
                        : leadsMap[entityId]?.name || comm.metadata?.company_name || 'Lead';
                      const contact = isClient
                        ? clientsMap[entityId]?.contact || '-'
                        : leadsMap[entityId]?.contact || comm.metadata?.contact_person || '-';

                      return (
                        <tr
                          key={comm.id}
                          className="hover:bg-slate-50/60 transition"
                          id={`comm-row-${comm.id}`}
                        >
                          <td className="py-3.5 px-4 whitespace-nowrap text-slate-500 font-medium text-[11px]">
                            {dt}
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <div className="flex items-center gap-2 font-bold text-slate-900">
                              <div className="w-6 h-6 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-[10px] text-slate-600 font-bold uppercase">
                                {(comm.performed_by_name || 'S').charAt(0)}
                              </div>
                              <span>{comm.performed_by_name || 'Salesman'}</span>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${badge.className}`}
                            >
                              {badge.icon}
                              <span>{comm.activity_type}</span>
                            </span>
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => {
                                if (isClient) {
                                  onSelectClient(entityId);
                                } else {
                                  onSelectLead(entityId);
                                }
                              }}
                              className="font-semibold text-indigo-600 hover:text-indigo-800 hover:underline flex items-center gap-1 cursor-pointer"
                            >
                              <span>{entityName}</span>
                              <ExternalLink className="h-3 w-3 inline" />
                            </button>
                            <span className="text-[10px] text-slate-400 block mt-0.5">
                              {isClient ? 'Client Account' : 'Lead'}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap text-slate-600">
                            {contact}
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="text-slate-800 font-medium line-clamp-2 text-xs">
                              {comm.description || comm.notes || '-'}
                            </div>
                            {comm.outcome && (
                              <span className="text-[10px] text-slate-500 font-medium mt-0.5 inline-block">
                                Outcome: {comm.outcome}
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-right whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => {
                                if (isClient) {
                                  onSelectClient(entityId);
                                } else {
                                  onSelectLead(entityId);
                                }
                              }}
                              className="px-2.5 py-1 text-[11px] font-bold rounded-lg border border-slate-200 bg-white text-indigo-600 hover:bg-indigo-50/50 transition cursor-pointer"
                            >
                              {isClient ? 'View Client' : 'View Lead'}
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {filteredCommunications.length > 0 && (
              <div className="flex items-center justify-between px-4 py-3 bg-slate-50/50 border-t border-slate-200 text-xs text-slate-500">
                <div>
                  Showing {(commPage - 1) * PAGE_SIZE + 1} to{' '}
                  {Math.min(commPage * PAGE_SIZE, filteredCommunications.length)} of{' '}
                  {filteredCommunications.length} records
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={commPage === 1}
                    onClick={() => setCommPage((p) => Math.max(1, p - 1))}
                    className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 cursor-pointer"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </button>
                  <span className="font-semibold text-slate-700">
                    Page {commPage} of {totalCommPages}
                  </span>
                  <button
                    type="button"
                    disabled={commPage === totalCommPages}
                    onClick={() => setCommPage((p) => Math.min(totalCommPages, p + 1))}
                    className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 cursor-pointer"
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 2: LEAD TRANSFERS */}
      {/* ========================================================= */}
      {activeTab === 'lead-transfers' && (
        <div className="space-y-4 animate-in fade-in duration-150">
          {/* Controls Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3 flex-1">
              {/* Search */}
              <div className="relative min-w-[220px] flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  id="lead-tr-search-input"
                  placeholder="Search lead name, reason..."
                  value={leadTrSearch}
                  onChange={(e) => {
                    setLeadTrSearch(e.target.value);
                    setLeadTrPage(1);
                  }}
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
                />
              </div>

              {/* From Salesman */}
              <select
                id="lead-tr-from-select"
                value={leadTrFrom}
                onChange={(e) => {
                  setLeadTrFrom(e.target.value);
                  setLeadTrPage(1);
                }}
                className="px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition cursor-pointer"
              >
                <option value="all">From: All</option>
                {companySalesmen.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.full_name || s.email}
                  </option>
                ))}
              </select>

              {/* To Salesman */}
              <select
                id="lead-tr-to-select"
                value={leadTrTo}
                onChange={(e) => {
                  setLeadTrTo(e.target.value);
                  setLeadTrPage(1);
                }}
                className="px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition cursor-pointer"
              >
                <option value="all">To: All</option>
                {companySalesmen.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.full_name || s.email}
                  </option>
                ))}
              </select>

              {/* Transferred By */}
              <select
                id="lead-tr-by-select"
                value={leadTrBy}
                onChange={(e) => {
                  setLeadTrBy(e.target.value);
                  setLeadTrPage(1);
                }}
                className="px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition cursor-pointer"
              >
                <option value="all">By: All Users</option>
                {usersList.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.full_name || s.email} ({s.role})
                  </option>
                ))}
              </select>

              {/* Date Range */}
              <select
                id="lead-tr-date-select"
                value={leadTrDateRange}
                onChange={(e) => {
                  setLeadTrDateRange(e.target.value as DateFilter);
                  setLeadTrPage(1);
                }}
                className="px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition cursor-pointer"
              >
                <option value="all">All Time</option>
                <option value="today">Today</option>
                <option value="yesterday">Yesterday</option>
                <option value="last7">Last 7 Days</option>
                <option value="last30">Last 30 Days</option>
              </select>
            </div>

            {/* Export Action */}
            <button
              type="button"
              id="export-lead-tr-btn"
              onClick={exportLeadTransfersCSV}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 shadow-2xs transition cursor-pointer self-start md:self-auto"
            >
              <Download className="h-3.5 w-3.5 text-slate-500" />
              <span>Export CSV</span>
            </button>
          </div>

          {/* Lead Transfers Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs" id="lead-transfers-table">
                <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3.5 px-4">Date & Time</th>
                    <th className="py-3.5 px-4">Lead Name</th>
                    <th className="py-3.5 px-4">Handover (From &rarr; To)</th>
                    <th className="py-3.5 px-4">Transferred By</th>
                    <th className="py-3.5 px-4 min-w-[200px]">Reason</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {paginatedLeadTransfers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        <History className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                        <p className="font-semibold text-sm text-slate-600">No lead transfers recorded</p>
                        <p className="text-xs text-slate-400 mt-1">
                          No lead ownership transfers match your selected filters.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    paginatedLeadTransfers.map((tr) => {
                      const dt = new Date(tr.transferred_at || tr.timestamp || Date.now()).toLocaleString();
                      const leadName = tr.lead_name || leadsMap[tr.lead_id]?.name || 'Lead';
                      const fromName = tr.from_user_name || tr.previous_owner_name || 'Unassigned';
                      const toName = tr.to_user_name || tr.new_owner_name || 'Unassigned';

                      return (
                        <tr
                          key={tr.id}
                          className="hover:bg-slate-50/60 transition"
                          id={`lead-tr-row-${tr.id}`}
                        >
                          <td className="py-3.5 px-4 whitespace-nowrap text-slate-500 font-medium text-[11px]">
                            {dt}
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => onSelectLead(tr.lead_id)}
                              className="font-bold text-slate-900 hover:text-indigo-600 hover:underline flex items-center gap-1 cursor-pointer"
                            >
                              <span>{leadName}</span>
                              <ExternalLink className="h-3 w-3 inline text-slate-400" />
                            </button>
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <div className="flex items-center gap-1.5 text-xs font-semibold">
                              <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 text-[11px]">
                                {fromName}
                              </span>
                              <ArrowRight className="h-3 w-3 text-indigo-600" />
                              <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 text-[11px] border border-indigo-100">
                                {toName}
                              </span>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <span className="text-slate-800 font-medium">
                              {tr.transferred_by_name || 'Administrator'}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <p className="text-slate-700 italic text-xs">
                              &ldquo;{tr.reason || 'Lead reassignment'}&rdquo;
                            </p>
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="h-3 w-3" />
                              <span>Completed</span>
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => onSelectLead(tr.lead_id)}
                              className="px-2.5 py-1 text-[11px] font-bold rounded-lg border border-slate-200 bg-white text-indigo-600 hover:bg-indigo-50/50 transition cursor-pointer"
                            >
                              View Lead
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {filteredLeadTransfers.length > 0 && (
              <div className="flex items-center justify-between px-4 py-3 bg-slate-50/50 border-t border-slate-200 text-xs text-slate-500">
                <div>
                  Showing {(leadTrPage - 1) * PAGE_SIZE + 1} to{' '}
                  {Math.min(leadTrPage * PAGE_SIZE, filteredLeadTransfers.length)} of{' '}
                  {filteredLeadTransfers.length} records
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={leadTrPage === 1}
                    onClick={() => setLeadTrPage((p) => Math.max(1, p - 1))}
                    className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 cursor-pointer"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </button>
                  <span className="font-semibold text-slate-700">
                    Page {leadTrPage} of {totalLeadTrPages}
                  </span>
                  <button
                    type="button"
                    disabled={leadTrPage === totalLeadTrPages}
                    onClick={() => setLeadTrPage((p) => Math.min(totalLeadTrPages, p + 1))}
                    className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 cursor-pointer"
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 3: CLIENT TRANSFERS */}
      {/* ========================================================= */}
      {activeTab === 'client-transfers' && (
        <div className="space-y-4 animate-in fade-in duration-150">
          {/* Controls Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3 flex-1">
              {/* Search */}
              <div className="relative min-w-[220px] flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  id="client-tr-search-input"
                  placeholder="Search client name, reason..."
                  value={clientTrSearch}
                  onChange={(e) => {
                    setClientTrSearch(e.target.value);
                    setClientTrPage(1);
                  }}
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
                />
              </div>

              {/* From Salesman */}
              <select
                id="client-tr-from-select"
                value={clientTrFrom}
                onChange={(e) => {
                  setClientTrFrom(e.target.value);
                  setClientTrPage(1);
                }}
                className="px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition cursor-pointer"
              >
                <option value="all">From: All</option>
                {companySalesmen.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.full_name || s.email}
                  </option>
                ))}
              </select>

              {/* To Salesman */}
              <select
                id="client-tr-to-select"
                value={clientTrTo}
                onChange={(e) => {
                  setClientTrTo(e.target.value);
                  setClientTrPage(1);
                }}
                className="px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition cursor-pointer"
              >
                <option value="all">To: All</option>
                {companySalesmen.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.full_name || s.email}
                  </option>
                ))}
              </select>

              {/* Transferred By */}
              <select
                id="client-tr-by-select"
                value={clientTrBy}
                onChange={(e) => {
                  setClientTrBy(e.target.value);
                  setClientTrPage(1);
                }}
                className="px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition cursor-pointer"
              >
                <option value="all">By: All Users</option>
                {usersList.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.full_name || s.email} ({s.role})
                  </option>
                ))}
              </select>

              {/* Date Range */}
              <select
                id="client-tr-date-select"
                value={clientTrDateRange}
                onChange={(e) => {
                  setClientTrDateRange(e.target.value as DateFilter);
                  setClientTrPage(1);
                }}
                className="px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition cursor-pointer"
              >
                <option value="all">All Time</option>
                <option value="today">Today</option>
                <option value="yesterday">Yesterday</option>
                <option value="last7">Last 7 Days</option>
                <option value="last30">Last 30 Days</option>
              </select>
            </div>

            {/* Export Action */}
            <button
              type="button"
              id="export-client-tr-btn"
              onClick={exportClientTransfersCSV}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 shadow-2xs transition cursor-pointer self-start md:self-auto"
            >
              <Download className="h-3.5 w-3.5 text-slate-500" />
              <span>Export CSV</span>
            </button>
          </div>

          {/* Client Transfers Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs" id="client-transfers-table">
                <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3.5 px-4">Date & Time</th>
                    <th className="py-3.5 px-4">Client Name</th>
                    <th className="py-3.5 px-4">Handover (From &rarr; To)</th>
                    <th className="py-3.5 px-4">Transferred By</th>
                    <th className="py-3.5 px-4 min-w-[200px]">Reason</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {paginatedClientTransfers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        <Briefcase className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                        <p className="font-semibold text-sm text-slate-600">No client transfers recorded</p>
                        <p className="text-xs text-slate-400 mt-1">
                          No client account ownership transfers match your selected filters.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    paginatedClientTransfers.map((tr) => {
                      const dt = new Date(tr.transferred_at || tr.timestamp || Date.now()).toLocaleString();
                      const clientName = tr.client_name || clientsMap[tr.client_id]?.name || 'Client';
                      const fromName = tr.from_user_name || 'Unassigned';
                      const toName = tr.to_user_name || 'Unassigned';

                      return (
                        <tr
                          key={tr.id}
                          className="hover:bg-slate-50/60 transition"
                          id={`client-tr-row-${tr.id}`}
                        >
                          <td className="py-3.5 px-4 whitespace-nowrap text-slate-500 font-medium text-[11px]">
                            {dt}
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => onSelectClient(tr.client_id)}
                              className="font-bold text-slate-900 hover:text-indigo-600 hover:underline flex items-center gap-1 cursor-pointer"
                            >
                              <span>{clientName}</span>
                              <ExternalLink className="h-3 w-3 inline text-slate-400" />
                            </button>
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <div className="flex items-center gap-1.5 text-xs font-semibold">
                              <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 text-[11px]">
                                {fromName}
                              </span>
                              <ArrowRight className="h-3 w-3 text-indigo-600" />
                              <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 text-[11px] border border-indigo-100">
                                {toName}
                              </span>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <span className="text-slate-800 font-medium">
                              {tr.transferred_by_name || 'Administrator'}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <p className="text-slate-700 italic text-xs">
                              &ldquo;{tr.reason || 'Portfolio optimization'}&rdquo;
                            </p>
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="h-3 w-3" />
                              <span>Completed</span>
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => onSelectClient(tr.client_id)}
                              className="px-2.5 py-1 text-[11px] font-bold rounded-lg border border-slate-200 bg-white text-indigo-600 hover:bg-indigo-50/50 transition cursor-pointer"
                            >
                              View Client
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {filteredClientTransfers.length > 0 && (
              <div className="flex items-center justify-between px-4 py-3 bg-slate-50/50 border-t border-slate-200 text-xs text-slate-500">
                <div>
                  Showing {(clientTrPage - 1) * PAGE_SIZE + 1} to{' '}
                  {Math.min(clientTrPage * PAGE_SIZE, filteredClientTransfers.length)} of{' '}
                  {filteredClientTransfers.length} records
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={clientTrPage === 1}
                    onClick={() => setClientTrPage((p) => Math.max(1, p - 1))}
                    className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 cursor-pointer"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </button>
                  <span className="font-semibold text-slate-700">
                    Page {clientTrPage} of {totalClientTrPages}
                  </span>
                  <button
                    type="button"
                    disabled={clientTrPage === totalClientTrPages}
                    onClick={() => setClientTrPage((p) => Math.min(totalClientTrPages, p + 1))}
                    className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 cursor-pointer"
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
