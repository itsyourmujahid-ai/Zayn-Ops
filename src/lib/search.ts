import {
  getLocalLeads,
  getLocalClients,
  getLocalFollowUps,
  getLocalActivities,
  getEffectiveUserId,
  getEffectiveUserRole,
} from './dal';
import {
  UnifiedSearchResult,
  SearchGroupedResults,
  SearchFilterOptions,
  RecentSearchItem,
} from '../types/search';
import { UserRole } from '../types/database';

const LOCAL_STORAGE_RECENT_SEARCHES_KEY = 'leadflow_recent_searches';

// ----------------------------------------------------------------------
// 1. Recent Searches Management
// ----------------------------------------------------------------------

export function getRecentSearches(): RecentSearchItem[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_RECENT_SEARCHES_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

export function saveRecentSearch(queryStr: string): RecentSearchItem[] {
  const trimmed = queryStr.trim();
  if (!trimmed || trimmed.length < 2 || typeof localStorage === 'undefined') {
    return getRecentSearches();
  }

  try {
    const current = getRecentSearches();
    // Remove if already exists to bump to top
    const filtered = current.filter(
      (item) => item.query.toLowerCase() !== trimmed.toLowerCase()
    );
    const newItem: RecentSearchItem = {
      id: 'rs_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      query: trimmed,
      timestamp: new Date().toISOString(),
    };
    const updated = [newItem, ...filtered].slice(0, 8);
    localStorage.setItem(LOCAL_STORAGE_RECENT_SEARCHES_KEY, JSON.stringify(updated));

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('crm_recent_searches_changed'));
    }
    return updated;
  } catch (e) {
    return getRecentSearches();
  }
}

export function removeRecentSearch(id: string): RecentSearchItem[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const current = getRecentSearches();
    const updated = current.filter((item) => item.id !== id);
    localStorage.setItem(LOCAL_STORAGE_RECENT_SEARCHES_KEY, JSON.stringify(updated));

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('crm_recent_searches_changed'));
    }
    return updated;
  } catch (e) {
    return [];
  }
}

export function clearRecentSearches(): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(LOCAL_STORAGE_RECENT_SEARCHES_KEY);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('crm_recent_searches_changed'));
    }
  } catch (e) {
    // ignore
  }
}

// ----------------------------------------------------------------------
// 2. Query Normalization & Matching Algorithms
// ----------------------------------------------------------------------

function cleanDigits(val?: string): string {
  if (!val) return '';
  return val.replace(/\D/g, '');
}

function matchesTokens(text: string, tokens: string[]): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();
  return tokens.every((token) => lower.includes(token));
}

// ----------------------------------------------------------------------
// 3. Unified Search Execution
// ----------------------------------------------------------------------

export function searchUnifiedCRM(
  rawQuery: string,
  options?: SearchFilterOptions,
  providedRole?: UserRole,
  providedUserId?: string
): SearchGroupedResults {
  const queryStr = rawQuery.trim().toLowerCase();
  const userId = providedUserId || getEffectiveUserId();
  const role = providedRole || getEffectiveUserRole();
  const isAdmin = role.toUpperCase() === 'ADMIN';

  // If query is blank and no specific filters, return empty set
  if (!queryStr && (!options || options.type === 'all')) {
    return {
      leads: [],
      clients: [],
      followups: [],
      activities: [],
      totalCount: 0,
    };
  }

  const tokens = queryStr ? queryStr.split(/\s+/).filter(Boolean) : [];
  const queryDigits = cleanDigits(queryStr);

  const leadsResults: UnifiedSearchResult[] = [];
  const clientsResults: UnifiedSearchResult[] = [];
  const followupsResults: UnifiedSearchResult[] = [];
  const activitiesResults: UnifiedSearchResult[] = [];

  // ==========================================
  // Search Leads
  // ==========================================
  if (!options?.type || options.type === 'all' || options.type === 'lead') {
    const allLeads = getLocalLeads();

    allLeads.forEach((lead) => {
      // 1. Strict Role Security: Salesman can only search assigned or created leads
      if (!isAdmin && lead.assigned_to !== userId && lead.created_by !== userId) {
        return;
      }

      // 2. Filter checks
      if (options?.leadStage && options.leadStage !== 'all') {
        if (lead.status?.toLowerCase() !== options.leadStage.toLowerCase()) return;
      }
      if (options?.leadPriority && options.leadPriority !== 'all') {
        if (lead.priority?.toLowerCase() !== options.leadPriority.toLowerCase()) return;
      }

      // 3. Match calculation
      let score = 0;
      const matchedFields: string[] = [];

      if (!queryStr) {
        score = 10; // For filter-only searches
      } else {
        const company = (lead.company_name || '').toLowerCase();
        const contact = (lead.contact_person || '').toLowerCase();
        const phone = lead.phone || '';
        const whatsapp = lead.whatsapp || '';
        const email = (lead.email || '').toLowerCase();
        const projectName = (lead.project_name || '').toLowerCase();
        const projectLoc = (lead.project_location || '').toLowerCase();
        const leadId = (lead.id || '').toLowerCase();
        const source = (lead.source || '').toLowerCase();
        const notes = (lead.notes || '').toLowerCase();

        // Company matching
        if (company === queryStr) {
          score += 100;
          matchedFields.push('Company (Exact)');
        } else if (company.startsWith(queryStr)) {
          score += 60;
          matchedFields.push('Company');
        } else if (matchesTokens(company, tokens)) {
          score += 40;
          matchedFields.push('Company');
        }

        // Contact person matching
        if (contact && matchesTokens(contact, tokens)) {
          score += 35;
          matchedFields.push('Contact Person');
        }

        // Phone / WhatsApp matching (digits comparison)
        const phoneDigits = cleanDigits(phone);
        const waDigits = cleanDigits(whatsapp);
        if (queryDigits.length >= 3) {
          if (phoneDigits.includes(queryDigits)) {
            score += 30;
            matchedFields.push('Phone');
          }
          if (waDigits.includes(queryDigits)) {
            score += 25;
            matchedFields.push('WhatsApp');
          }
        }

        // Email matching
        if (email && email.includes(queryStr)) {
          score += 25;
          matchedFields.push('Email');
        }

        // Project info
        if (projectName && matchesTokens(projectName, tokens)) {
          score += 20;
          matchedFields.push('Project Name');
        }
        if (projectLoc && matchesTokens(projectLoc, tokens)) {
          score += 15;
          matchedFields.push('Location');
        }

        // ID & Source
        if (leadId && leadId.includes(queryStr)) {
          score += 20;
          matchedFields.push('Lead ID');
        }
        if (source && source.includes(queryStr)) {
          score += 10;
          matchedFields.push('Source');
        }

        // Tags matching (#tag or keyword)
        const cleanTagQuery = queryStr.startsWith('#') ? queryStr.slice(1).trim() : queryStr;
        if (Array.isArray(lead.tags) && cleanTagQuery) {
          const matchedTag = lead.tags.find(
            (t) => t.toLowerCase() === cleanTagQuery || t.toLowerCase().includes(cleanTagQuery)
          );
          if (matchedTag) {
            score += queryStr.startsWith('#') ? 95 : 45;
            matchedFields.push(`Tag: ${matchedTag}`);
          }
        }

        // Notes
        if (notes && matchesTokens(notes, tokens)) {
          score += 8;
          matchedFields.push('Notes');
        }
      }

      if (score > 0) {
        let badgeVariant: 'blue' | 'green' | 'amber' | 'purple' | 'red' | 'gray' = 'blue';
        if (lead.status === 'Won') badgeVariant = 'green';
        else if (lead.status === 'Lost') badgeVariant = 'red';
        else if (lead.status === 'Meeting' || lead.status === 'Quotation') badgeVariant = 'amber';
        else if (lead.status === 'Negotiation') badgeVariant = 'purple';

        leadsResults.push({
          id: lead.id,
          type: 'lead',
          title: lead.company_name,
          subtitle: lead.contact_person
            ? `${lead.contact_person}${lead.location ? ` • ${lead.location}` : ''}`
            : lead.location || 'Lead Prospect',
          description: lead.project_name
            ? `Project: ${lead.project_name}${lead.next_action ? ` | Next: ${lead.next_action}` : ''}`
            : lead.next_action || lead.notes || undefined,
          badgeText: lead.status || 'New',
          badgeVariant,
          leadId: lead.id,
          phone: lead.phone,
          whatsapp: lead.whatsapp,
          email: lead.email,
          timestamp: lead.updated_at || lead.created_at,
          score,
          matchedFields,
          rawRecord: lead,
        });
      }
    });
  }

  // ==========================================
  // Search Clients
  // ==========================================
  if (!options?.type || options.type === 'all' || options.type === 'client') {
    const allClients = getLocalClients();

    allClients.forEach((client) => {
      // 1. Strict Role Security: Salesman can only search owned clients
      if (!isAdmin && client.owner_id !== userId) {
        return;
      }

      // 2. Filter checks
      if (options?.clientStatus && options.clientStatus !== 'all') {
        if (client.status?.toLowerCase() !== options.clientStatus.toLowerCase()) return;
      }

      // 3. Match calculation
      let score = 0;
      const matchedFields: string[] = [];

      if (!queryStr) {
        score = 10;
      } else {
        const company = (client.company_name || '').toLowerCase();
        const contact = (client.contact_person || '').toLowerCase();
        const phone = client.phone || '';
        const whatsapp = client.whatsapp || '';
        const email = (client.email || '').toLowerCase();
        const location = (client.location || '').toLowerCase();
        const clientId = (client.id || '').toLowerCase();
        const clientType = (client.client_type || '').toLowerCase();
        const notes = (client.notes || '').toLowerCase();

        if (company === queryStr) {
          score += 100;
          matchedFields.push('Company (Exact)');
        } else if (company.startsWith(queryStr)) {
          score += 65;
          matchedFields.push('Company');
        } else if (matchesTokens(company, tokens)) {
          score += 45;
          matchedFields.push('Company');
        }

        if (contact && matchesTokens(contact, tokens)) {
          score += 35;
          matchedFields.push('Primary Contact');
        }

        const phoneDigits = cleanDigits(phone);
        const waDigits = cleanDigits(whatsapp);
        if (queryDigits.length >= 3) {
          if (phoneDigits.includes(queryDigits)) {
            score += 30;
            matchedFields.push('Phone');
          }
          if (waDigits.includes(queryDigits)) {
            score += 25;
            matchedFields.push('WhatsApp');
          }
        }

        if (email && email.includes(queryStr)) {
          score += 25;
          matchedFields.push('Email');
        }

        if (location && matchesTokens(location, tokens)) {
          score += 15;
          matchedFields.push('Location');
        }

        if (clientId && clientId.includes(queryStr)) {
          score += 20;
          matchedFields.push('Client ID');
        }

        if (clientType && clientType.includes(queryStr)) {
          score += 10;
          matchedFields.push('Type');
        }

        // Tags matching (#tag or keyword)
        const cleanTagQuery = queryStr.startsWith('#') ? queryStr.slice(1).trim() : queryStr;
        if (Array.isArray(client.tags) && cleanTagQuery) {
          const matchedTag = client.tags.find(
            (t) => t.toLowerCase() === cleanTagQuery || t.toLowerCase().includes(cleanTagQuery)
          );
          if (matchedTag) {
            score += queryStr.startsWith('#') ? 95 : 45;
            matchedFields.push(`Tag: ${matchedTag}`);
          }
        }

        if (notes && matchesTokens(notes, tokens)) {
          score += 8;
          matchedFields.push('Notes');
        }
      }

      if (score > 0) {
        clientsResults.push({
          id: client.id,
          type: 'client',
          title: client.company_name,
          subtitle: client.contact_person
            ? `${client.contact_person}${client.location ? ` • ${client.location}` : ''}`
            : client.location || 'Customer Account',
          description: client.client_type
            ? `Type: ${client.client_type.toUpperCase()} • Owner: ${client.owner_name || 'Assigned Salesman'}`
            : client.notes || undefined,
          badgeText: client.status || 'Active',
          badgeVariant: client.status === 'Active' ? 'green' : 'gray',
          clientId: client.id,
          leadId: client.source_lead_id,
          phone: client.phone,
          whatsapp: client.whatsapp,
          email: client.email,
          timestamp: client.updated_at || client.created_at,
          score,
          matchedFields,
          rawRecord: client,
        });
      }
    });
  }

  // ==========================================
  // Search Follow-ups
  // ==========================================
  if (!options?.type || options.type === 'all' || options.type === 'followup') {
    const allFollowups = getLocalFollowUps();
    const leadsMap = new Map<string, string>();
    getLocalLeads().forEach((l) => leadsMap.set(l.id, l.company_name));
    getLocalClients().forEach((c) => leadsMap.set(c.id, c.company_name));

    allFollowups.forEach((fu) => {
      // 1. Strict Role Security: Salesman can only search assigned or created followups
      if (!isAdmin && fu.assigned_to !== userId && fu.created_by !== userId) {
        return;
      }

      // 2. Filter checks
      if (options?.followupStatus && options.followupStatus !== 'all') {
        const isOverdue =
          fu.status === 'pending' &&
          new Date(fu.scheduled_at).getTime() < Date.now();
        if (options.followupStatus.toLowerCase() === 'overdue') {
          if (!isOverdue) return;
        } else if (fu.status?.toLowerCase() !== options.followupStatus.toLowerCase()) {
          return;
        }
      }

      // 3. Match calculation
      let score = 0;
      const matchedFields: string[] = [];
      const companyResolved = leadsMap.get(fu.client_id || '') || leadsMap.get(fu.lead_id || '') || fu.company_name || '';
      const relatedCompany = companyResolved.toLowerCase();
      const action = (fu.action || '').toLowerCase();
      const notes = (fu.notes || '').toLowerCase();
      const apptTitle = (fu.title || '').toLowerCase();
      const location = (fu.location || '').toLowerCase();
      const salesman = (fu.assigned_to_name || '').toLowerCase();

      if (!queryStr) {
        score = 10;
      } else {
        if (apptTitle && matchesTokens(apptTitle, tokens)) {
          score += 60;
          matchedFields.push('Appointment Title');
        }

        if (relatedCompany && matchesTokens(relatedCompany, tokens)) {
          score += 50;
          matchedFields.push('Lead/Client');
        }

        if (action && matchesTokens(action, tokens)) {
          score += 35;
          matchedFields.push('Action Type');
        }

        if (location && matchesTokens(location, tokens)) {
          score += 30;
          matchedFields.push('Location');
        }

        if (salesman && matchesTokens(salesman, tokens)) {
          score += 30;
          matchedFields.push('Salesman');
        }

        if (notes && matchesTokens(notes, tokens)) {
          score += 25;
          matchedFields.push('Notes');
        }
      }

      if (score > 0) {
        const companyName = companyResolved || (fu.lead_id ? 'Lead #' + fu.lead_id : 'Client Appointment');
        let badgeVariant: 'blue' | 'green' | 'amber' | 'purple' | 'red' | 'gray' = 'amber';
        const isOverdue =
          fu.status === 'pending' &&
          new Date(fu.scheduled_at).getTime() < Date.now();

        let badgeText: string = fu.status;
        if (isOverdue) {
          badgeText = 'Overdue';
          badgeVariant = 'red';
        } else if (fu.status === 'completed') {
          badgeVariant = 'green';
        } else if (fu.status === 'cancelled') {
          badgeVariant = 'gray';
        } else if (fu.status === 'rescheduled') {
          badgeVariant = 'purple';
        }

        const formattedDate = fu.scheduled_at
          ? new Date(fu.scheduled_at).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })
          : '';

        const eventHeading = fu.title
          ? `${fu.action}: ${fu.title} • ${companyName}`
          : `${fu.action} with ${companyName}`;

        const salesmanStr = fu.assigned_to_name ? ` • Rep: ${fu.assigned_to_name}` : '';
        const locationStr = fu.location ? ` • 📍 ${fu.location}` : '';

        followupsResults.push({
          id: fu.id,
          type: 'followup',
          title: eventHeading,
          subtitle: `Scheduled: ${formattedDate}${salesmanStr}${locationStr}`,
          description: fu.notes || undefined,
          badgeText: badgeText.charAt(0).toUpperCase() + badgeText.slice(1),
          badgeVariant,
          leadId: fu.lead_id,
          clientId: fu.client_id,
          timestamp: fu.scheduled_at || fu.created_at,
          score,
          matchedFields,
          rawRecord: fu,
        });
      }
    });
  }

  // ==========================================
  // Search Activities
  // ==========================================
  if (!options?.type || options.type === 'all' || options.type === 'activity') {
    const allActivities = getLocalActivities();
    const leadsMap = new Map<string, string>();
    getLocalLeads().forEach((l) => leadsMap.set(l.id, l.company_name));
    getLocalClients().forEach((c) => leadsMap.set(c.id, c.company_name));

    allActivities.forEach((act) => {
      // 1. Strict Role Security: Salesman can only search activities performed or created by them
      if (!isAdmin && act.performed_by !== userId && act.created_by !== userId) {
        return;
      }

      // 2. Match calculation
      let score = 0;
      const matchedFields: string[] = [];
      const relatedCompany = (
        act.metadata?.company_name ||
        leadsMap.get(act.lead_id) ||
        ''
      ).toLowerCase();
      const desc = (act.description || '').toLowerCase();
      const notes = (act.notes || '').toLowerCase();
      const type = (act.activity_type || '').toLowerCase();
      const performer = (act.performed_by_name || '').toLowerCase();

      if (!queryStr) {
        score = 10;
      } else {
        if (relatedCompany && matchesTokens(relatedCompany, tokens)) {
          score += 45;
          matchedFields.push('Related Lead');
        }

        if (desc && matchesTokens(desc, tokens)) {
          score += 40;
          matchedFields.push('Activity Description');
        }

        if (notes && matchesTokens(notes, tokens)) {
          score += 25;
          matchedFields.push('Notes');
        }

        if (type && matchesTokens(type, tokens)) {
          score += 20;
          matchedFields.push('Activity Type');
        }

        if (performer && matchesTokens(performer, tokens)) {
          score += 15;
          matchedFields.push('Logged By');
        }
      }

      if (score > 0) {
        const companyName =
          act.metadata?.company_name || leadsMap.get(act.lead_id) || 'Lead #' + act.lead_id;

        const formattedDate = act.activity_at || act.activity_date || act.created_at
          ? new Date(
              act.activity_at || act.activity_date || act.created_at
            ).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })
          : '';

        activitiesResults.push({
          id: act.id,
          type: 'activity',
          title: `${act.activity_type} • ${companyName}`,
          subtitle: `By ${act.performed_by_name || 'Team member'} on ${formattedDate}`,
          description: act.description || act.notes || undefined,
          badgeText: act.activity_type || 'Activity',
          badgeVariant: 'blue',
          leadId: act.lead_id,
          timestamp: act.activity_at || act.activity_date || act.created_at,
          score,
          matchedFields,
          rawRecord: act,
        });
      }
    });
  }

  // ==========================================
  // Sort Results
  // ==========================================
  const sortComparator = (a: UnifiedSearchResult, b: UnifiedSearchResult) => {
    if (options?.sortBy === 'date_desc') {
      const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return timeB - timeA;
    }
    if (options?.sortBy === 'date_asc') {
      const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return timeA - timeB;
    }
    if (options?.sortBy === 'title_asc') {
      return a.title.localeCompare(b.title);
    }
    // Default: relevance score descending, then date
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
    const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
    return timeB - timeA;
  };

  leadsResults.sort(sortComparator);
  clientsResults.sort(sortComparator);
  followupsResults.sort(sortComparator);
  activitiesResults.sort(sortComparator);

  const totalCount =
    leadsResults.length +
    clientsResults.length +
    followupsResults.length +
    activitiesResults.length;

  return {
    leads: leadsResults,
    clients: clientsResults,
    followups: followupsResults,
    activities: activitiesResults,
    totalCount,
  };
}
