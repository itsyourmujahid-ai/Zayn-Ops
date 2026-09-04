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
          ? 'border-indigo-400 bg-indigo-50/50 ring-2 ring-indigo-300 ring-offset-1'
          : 'border-slate-200/90 bg-slate-100/70'
      }`}
    >
      {/* Stage Header */}
      <div className={`p-3.5 rounded-t-2xl border-b border-slate-200/80 ${stage.headerBg}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge stage={stage.id.toLowerCase() as any} size="sm">
              {stage.label}
            </Badge>
          </div>
          <span
            id={`count-stage-${stage.id.toLowerCase()}`}
            className="rounded-full bg-white px-2 py-0.5 text-xs font-bold text-slate-700 shadow-xs border border-slate-200"
          >
            {leads.length}
          </span>
        </div>

        <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
          <span className="truncate">{stage.description}</span>
          {totalValue > 0 && (
            <span className="font-semibold text-slate-700 shrink-0">
              SAR {(totalValue / 1000).toFixed(0)}k
            </span>
          )}
        </div>
      </div>

      {/* Cards Scrollable Body */}
      <div className="flex-1 p-3 space-y-3 min-h-[400px] overflow-y-auto max-h-[calc(100vh-290px)]">
        {leads.length === 0 ? (
          <div className="flex h-48 flex-col items-center justify-center rounded-xl border border-dashed border-slate-300/80 bg-white/50 p-4 text-center">
            <div className="rounded-full bg-slate-100 p-2 text-slate-400 mb-1.5">
              <span className="text-xs">📂</span>
            </div>
            <p className="text-xs font-medium text-slate-500">No leads in this stage</p>
            <p className="text-[10px] text-slate-400 mt-0.5">Drag leads here to progress them</p>
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
