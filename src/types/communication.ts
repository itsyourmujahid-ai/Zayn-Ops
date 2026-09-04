import { ActivityType } from './database';

export type CommunicationType = 'Call' | 'WhatsApp' | 'Email' | 'Meeting' | 'Site Visit' | 'Note';

export type CallOutcome =
  | 'Connected'
  | 'No Answer'
  | 'Busy'
  | 'Call Back Later'
  | 'Wrong Number'
  | 'Other';

export type WhatsAppOutcome =
  | 'Sent'
  | 'Replied'
  | 'Interested'
  | 'No Reply'
  | 'Not Interested'
  | 'Other';

export type EmailOutcome =
  | 'Sent'
  | 'Replied'
  | 'No Reply'
  | 'Interested'
  | 'Not Interested'
  | 'Other';

export type MeetingOutcome =
  | 'Successful'
  | 'Interested'
  | 'Follow-up Required'
  | 'No Show'
  | 'Not Interested'
  | 'Other';

export type SiteVisitOutcome =
  | 'Successful'
  | 'Requirement Confirmed'
  | 'Follow-up Required'
  | 'No Contact'
  | 'Not Interested'
  | 'Other';

export const COMMUNICATION_OUTCOMES: Record<CommunicationType, string[]> = {
  Call: ['Connected', 'No Answer', 'Busy', 'Call Back Later', 'Wrong Number', 'Other'],
  WhatsApp: ['Sent', 'Replied', 'Interested', 'No Reply', 'Not Interested', 'Other'],
  Email: ['Sent', 'Replied', 'No Reply', 'Interested', 'Not Interested', 'Other'],
  Meeting: ['Successful', 'Interested', 'Follow-up Required', 'No Show', 'Not Interested', 'Other'],
  'Site Visit': ['Successful', 'Requirement Confirmed', 'Follow-up Required', 'No Contact', 'Not Interested', 'Other'],
  Note: ['General Note', 'Internal Remark', 'Project Update', 'Requirement Note'],
};

export type CommunicationFilter =
  | 'all'
  | 'Call'
  | 'WhatsApp'
  | 'Email'
  | 'Meeting'
  | 'Site Visit'
  | 'Note';

export interface CommunicationSummaryData {
  callsCount: number;
  whatsappCount: number;
  emailsCount: number;
  meetingsCount: number;
  siteVisitsCount: number;
  notesCount: number;
  totalCommunications: number;
}

export interface LastContactInfo {
  date: string;
  type: CommunicationType;
  performedBy: string;
  outcome?: string;
  notes?: string;
}

export interface NextActionInfo {
  scheduledAt?: string;
  action?: string;
  assignedToName?: string;
  isPending: boolean;
}
