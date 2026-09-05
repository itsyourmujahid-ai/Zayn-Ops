import React, { useState } from 'react';
import { KanbanCard } from './KanbanCard';
import { LeadRecord, LeadStatus, FollowUpRecord, UserProfile } from '../../types/database';
import { Badge } from '../common/Badge';

export interface StageDefinition {
  id: LeadStatus;
  label: string;
  description: string;
  colorClass: string;
  borderClass: string;
  headerBg: string;
}

interface KanbanColumnProps {
  stage: StageDefinition;
  leads: LeadRecord[];
  followupsMap: Map<string, FollowUpRecord>;
  users: UserProfile[];
  isAdmin: boolean;
  onSelectLead?: (leadId: string) => void;
  onStatusChange: (leadId: string, newStatus: LeadStatus) => Promise<void>;
}

export const KanbanColumn: React.FC<KanbanColumnProps> = ({
  stage,
  leads,
  followupsMap,
  users,
  isAdmin,
  onSelectLead,
  onStatusChange,
}) => {
  const [isDragOver, setIsDragOver] = useState<boolean>(false);

  const totalValue = leads.reduce((sum, lead) => sum + (lead.estimated_value || 0), 0);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (!isDragOver) setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    // Only toggle if leaving the column element itself
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    try {
      const leadId = e.dataTransfer.getData('text/plain');
      const rawJson = e.dataTransfer.getData('application/json');
      let currentStatus: string | undefined;

      if (rawJson) {
        try {
          const parsed = JSON.parse(rawJson);
          currentStatus = parsed.currentStatus;
        } catch {
          // ignore
        }
      }

      if (!leadId) return;

      // Check if dropped within the same status column
      if (currentStatus === stage.id) {
        return; // No-op, no unnecessary database updates or activities
      }

      await onStatusChange(leadId, stage.id);
    } catch (err) {
      console.error('Error handling drop in column:', err);
    }
  };

  return (
    <div
      id={`pipeline-column-${stage.id.toLowerCase()}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`flex w-76 shrink-0 flex-col rounded-2xl border transition-colors duration-150 ${
        isDragOver
          ? 'border-[var(--color-primary)] bg-[var(--bg-hover)] ring-2 ring-[var(--focus-ring)] ring-offset-1'
          : 'border-[var(--border-subtle)] bg-[var(--bg-elevated)]'
      }`}
    >
      {/* Stage Header */}
      <div className={`p-3.5 rounded-t-2xl border-b border-[var(--border-subtle)] bg-[var(--bg-card)]/70`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge stage={stage.id.toLowerCase() as any} size="sm">
              {stage.label}
            </Badge>
          </div>
          <span
            id={`count-stage-${stage.id.toLowerCase()}`}
            className="rounded-full bg-[var(--bg-elevated)] px-2.5 py-0.5 text-xs font-bold text-[var(--text-main)] shadow-xs border border-[var(--border-strong)]"
          >
            {leads.length}
          </span>
        </div>

        <div className="mt-1 flex items-center justify-between text-[11px] text-[var(--text-secondary)]">
          <span className="truncate font-medium">{stage.description}</span>
          {totalValue > 0 && (
            <span className="font-bold text-[var(--text-main)] shrink-0">
              SAR {(totalValue / 1000).toFixed(0)}k
            </span>
          )}
        </div>
      </div>

      {/* Cards Scrollable Body */}
      <div className="flex-1 p-3 space-y-3 min-h-[400px] overflow-y-auto max-h-[calc(100vh-290px)]">
        {leads.length === 0 ? (
          <div className="flex h-48 flex-col items-center justify-center rounded-xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-card)]/60 p-4 text-center">
            <div className="rounded-full bg-[var(--bg-hover)] p-2 text-[var(--text-secondary)] mb-1.5">
              <span className="text-xs">📂</span>
            </div>
            <p className="text-xs font-semibold text-[var(--text-main)]">No leads in this stage</p>
            <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">Drag leads here to progress them</p>
          </div>
        ) : (
          leads.map((lead) => (
            <KanbanCard
              key={lead.id}
              lead={lead}
              followUp={followupsMap.get(lead.id)}
              users={users}
              isAdmin={isAdmin}
              onSelectLead={onSelectLead}
              onStatusChange={onStatusChange}
            />
          ))
        )}
      </div>
    </div>
  );
};
