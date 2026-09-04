export type LeadPriority = 'hot' | 'warm' | 'cold';

export type PipelineStage =
  | 'new'
  | 'contacted'
  | 'interested'
  | 'meeting'
  | 'quotation'
  | 'negotiation'
  | 'won'
  | 'lost';

export type LeadType = 'b2b' | 'b2c' | 'channel_partner' | 'vendor' | 'enterprise' | 'individual' | 'other';

export type LeadSource =
  | 'referral'
  | 'whatsapp'
  | 'phone_inquiry'
  | 'website'
  | 'walk_in'
  | 'exhibition'
  | 'google'
  | 'social_media'
  | 'cold_outreach'
  | 'other';

export type ActivityType =
  | 'call'
  | 'whatsapp'
  | 'meeting'
  | 'email'
  | 'quotation'
  | 'note'
  | 'followup'
  | 'status_change'
  | 'other';

export interface ProjectInfo {
  projectName?: string;
  projectType?: string;
  projectLocation?: string;
  requirement?: string;
  estimatedValue?: number;
  expectedClosingDate?: string;
}

export interface Attachment {
  id: string;
  leadId: string;
  fileName: string;
  fileType: 'visiting_card' | 'drawing' | 'boq' | 'quotation' | 'photo' | 'pdf' | 'other';
  fileUrl: string;
  fileSize?: number;
  uploadedAt: string;
}

export interface Activity {
  id: string;
  leadId: string;
  companyName: string;
  type: ActivityType;
  description: string;
  timestamp: string;
  createdByName?: string;
  metadata?: {
    previousStatus?: PipelineStage;
    newStatus?: PipelineStage;
    durationMinutes?: number;
    quotationAmount?: number;
    outcome?: string;
  };
}

export interface FollowUp {
  id: string;
  leadId: string;
  companyName: string;
  contactPerson?: string;
  phone?: string;
  whatsapp?: string;
  action: string;
  dueDate: string; // YYYY-MM-DD
  dueTime?: string; // HH:mm
  status: 'pending' | 'completed' | 'rescheduled' | 'cancelled';
  priority: LeadPriority;
  notes?: string;
  completedAt?: string;
  completedActivityId?: string;
  createdAt: string;
}

export interface Lead {
  id: string;
  companyName: string; // Required
  contactPerson?: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
  leadType?: LeadType | string;
  location?: string;
  leadSource?: LeadSource | string;
  priority: LeadPriority;
  status: PipelineStage;
  notes?: string;
  
  // Next action & follow-up
  nextAction?: string;
  nextFollowUpDate?: string; // YYYY-MM-DD
  nextFollowUpTime?: string; // HH:mm
  
  // Extended details
  projectInfo?: ProjectInfo;
  attachments?: Attachment[];
  
  // Timestamps & ownership
  createdAt: string;
  updatedAt: string;
  lastContactedAt?: string;
  createdBy?: string;
}

export type NavigationView =
  | 'dashboard'
  | 'leads'
  | 'clients'
  | 'calendar'
  | 'segments'
  | 'pipeline'
  | 'followups'
  | 'reports'
  | 'notifications'
  | 'audit'
  | 'data-quality'
  | 'data-management'
  | 'settings'
  | 'search';

export interface LeadFilterState {
  searchQuery: string;
  stage: PipelineStage | 'all';
  priority: LeadPriority | 'all';
  source: string | 'all';
  leadType: string | 'all';
  sortBy: 'updatedAt' | 'createdAt' | 'companyName' | 'nextFollowUpDate';
  sortOrder: 'asc' | 'desc';
}
