import React from 'react';
import { LeadStatus } from '../../types/database';
import { StageDefinition } from './KanbanColumn';

interface MobileStageSelectorProps {
  stages: StageDefinition[];
  countsByStage: Record<LeadStatus, number>;
  selectedStage: LeadStatus | 'all';
  onSelectStage: (stage: LeadStatus | 'all') => void;
}

export const MobileStageSelector: React.FC<MobileStageSelectorProps> = ({
  stages,
  countsByStage,
  selectedStage,
  onSelectStage,
}) => {
  return (
    <div className="flex md:hidden items-center gap-1.5 overflow-x-auto pb-2 pt-1 no-scrollbar">
      <button
        type="button"
        onClick={() => onSelectStage('all')}
        className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition cursor-pointer ${
          selectedStage === 'all'
            ? 'bg-slate-900 text-white shadow-xs'
            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
        }`}
      >
        All Stages
      </button>

      {stages.map((stage) => {
        const isSelected = selectedStage === stage.id;
        const count = countsByStage[stage.id] || 0;

        return (
          <button
            key={stage.id}
            type="button"
            onClick={() => onSelectStage(stage.id)}
            className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition cursor-pointer ${
              isSelected
                ? 'bg-indigo-600 text-white shadow-xs font-semibold'
                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <span>{stage.label}</span>
            <span
              className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                isSelected ? 'bg-indigo-700 text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
};
