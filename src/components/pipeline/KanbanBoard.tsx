import React, { useState } from 'react';
import { KanbanColumn, StageDefinition } from './KanbanColumn';
import { MobileStageSelector } from './MobileStageSelector';
import { LeadRecord, LeadStatus, FollowUpRecord, UserProfile } from '../../types/database';

export const PIPELINE_STAGE_DEFINITIONS: StageDefinition[] = [
  {
    id: 'New',
    label: 'New Lead',
    description: 'Freshly registered accounts',
    colorClass: 'text-indigo-700 bg-indigo-50 border-indigo-200',
    borderClass: 'border-indigo-300',
    headerBg: 'bg-indigo-50/50',
  },
  {
    id: 'Contacted',
    label: 'Contacted',
    description: 'Initial phone / email outreach',
    colorClass: 'text-blue-700 bg-blue-50 border-blue-200',
    borderClass: 'border-blue-300',
    headerBg: 'bg-blue-50/50',
  },
  {
    id: 'Interested',
    label: 'Interested',
    description: 'Confirmed project requirements',
    colorClass: 'text-cyan-700 bg-cyan-50 border-cyan-200',
    borderClass: 'border-cyan-300',
    headerBg: 'bg-cyan-50/50',
  },
  {
    id: 'Meeting',
    label: 'Meeting',
    description: 'Consultation or site visit',
    colorClass: 'text-purple-700 bg-purple-50 border-purple-200',
    borderClass: 'border-purple-300',
    headerBg: 'bg-purple-50/50',
  },
  {
    id: 'Quotation',
    label: 'Quotation',
    description: 'Price proposal submitted',
    colorClass: 'text-amber-700 bg-amber-50 border-amber-200',
    borderClass: 'border-amber-300',
    headerBg: 'bg-amber-50/50',
  },
  {
    id: 'Negotiation',
    label: 'Negotiation',
    description: 'Terms and discount review',
    colorClass: 'text-orange-700 bg-orange-50 border-orange-200',
    borderClass: 'border-orange-300',
    headerBg: 'bg-orange-50/50',
  },
  {
    id: 'Won',
    label: 'Won Deal',
    description: 'Order confirmed & closed',
    colorClass: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    borderClass: 'border-emerald-300',
    headerBg: 'bg-emerald-50/50',
  },
  {
    id: 'Lost',
    label: 'Lost Lead',
    description: 'Closed without conversion',
    colorClass: 'text-slate-700 bg-slate-100 border-slate-200',
    borderClass: 'border-slate-300',
    headerBg: 'bg-slate-100/60',
  },
];

interface KanbanBoardProps {
  leads: LeadRecord[];
  followups: FollowUpRecord[];
  users: UserProfile[];
  isAdmin: boolean;
  onSelectLead?: (leadId: string) => void;
  onStatusChange: (leadId: string, newStatus: LeadStatus) => Promise<void>;
}

export const KanbanBoard: React.FC<KanbanBoardProps> = ({
  leads,
  followups,
  users,
  isAdmin,
  onSelectLead,
  onStatusChange,
}) => {
  const [mobileSelectedStage, setMobileSelectedStage] = useState<LeadStatus | 'all'>('all');

  // Build Map of nearest pending follow-ups keyed by lead_id
  const pendingFollowups = followups.filter((f) => f.status === 'pending');
  const followupsMap = new Map<string, FollowUpRecord>();

  // Sort by scheduled_at asc so earliest pending follow-up is mapped
  const sortedPending = [...pendingFollowups].sort(
    (a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()
  );

  sortedPending.forEach((f) => {
    if (!followupsMap.has(f.lead_id)) {
      followupsMap.set(f.lead_id, f);
    }
  });

  // Calculate counts by stage
  const countsByStage: Record<LeadStatus, number> = {
    New: 0,
    Contacted: 0,
    Interested: 0,
    Meeting: 0,
    Quotation: 0,
    Negotiation: 0,
    Won: 0,
    Lost: 0,
  };

  leads.forEach((l) => {
    if (countsByStage[l.status] !== undefined) {
      countsByStage[l.status] += 1;
    }
  });

  const visibleStages =
    mobileSelectedStage === 'all'
      ? PIPELINE_STAGE_DEFINITIONS
      : PIPELINE_STAGE_DEFINITIONS.filter((s) => s.id === mobileSelectedStage);

  return (
    <div className="space-y-3">
      {/* Mobile Stage Selector */}
      <MobileStageSelector
        stages={PIPELINE_STAGE_DEFINITIONS}
        countsByStage={countsByStage}
        selectedStage={mobileSelectedStage}
        onSelectStage={setMobileSelectedStage}
      />

      {/* Horizontal Scrollable Kanban Columns */}
      <div
        id="kanban-columns-container"
        className="flex gap-4 overflow-x-auto pb-6 pt-1 items-start no-scrollbar scroll-smooth"
      >
        {visibleStages.map((stage) => {
          const stageLeads = leads.filter(
            (l) => l.status.toLowerCase() === stage.id.toLowerCase()
          );

          return (
            <KanbanColumn
              key={stage.id}
              stage={stage}
              leads={stageLeads}
              followupsMap={followupsMap}
              users={users}
              isAdmin={isAdmin}
              onSelectLead={onSelectLead}
              onStatusChange={onStatusChange}
            />
          );
        })}
      </div>
    </div>
  );
};
