import { LeadRecord, ClientRecord, FollowUpRecord, LeadActivityRecord, UserRole } from './database';

export type SearchResultType = 'lead' | 'client' | 'followup' | 'activity';

export interface UnifiedSearchResult {
  id: string;
  type: SearchResultType;
  title: string;
  subtitle?: string;
  description?: string;
  badgeText?: string;
  badgeVariant?: 'blue' | 'green' | 'amber' | 'purple' | 'red' | 'gray';
  leadId?: string;
  clientId?: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
  timestamp?: string;
  score: number;
  matchedFields: string[];
  rawRecord: LeadRecord | ClientRecord | FollowUpRecord | LeadActivityRecord;
}

export interface SearchGroupedResults {
  leads: UnifiedSearchResult[];
  clients: UnifiedSearchResult[];
  followups: UnifiedSearchResult[];
  activities: UnifiedSearchResult[];
  totalCount: number;
}

export interface SearchFilterOptions {
  type?: 'all' | SearchResultType;
  leadStage?: string;
  leadPriority?: string;
  clientStatus?: string;
  followupStatus?: string;
  sortBy?: 'relevance' | 'date_desc' | 'date_asc' | 'title_asc';
}

export interface RecentSearchItem {
  id: string;
  query: string;
  timestamp: string;
}
