import React from 'react';
import { LeadPriority, PipelineStage } from '../../types/crm';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'outline' | 'priority' | 'stage' | 'status';
  priority?: LeadPriority;
  stage?: PipelineStage;
  className?: string;
  size?: 'sm' | 'md';
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'default',
  priority,
  stage,
  className = '',
  size = 'md',
}) => {
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-0.5 text-[11px] font-semibold';

  let colorClasses = 'bg-slate-100 text-slate-700 border border-slate-200';

  if (variant === 'priority' && priority) {
    switch (priority) {
      case 'hot':
        colorClasses = 'bg-[#FEF2F2] text-[#DC2626] border border-red-200/80';
        break;
      case 'warm':
        colorClasses = 'bg-[#FFFBEB] text-[#D97706] border border-amber-200/80';
        break;
      case 'cold':
        colorClasses = 'bg-[#F0F9FF] text-[#0284C7] border border-sky-200/80';
        break;
    }
  } else if (variant === 'stage' && stage) {
    switch (stage) {
      case 'new':
        colorClasses = 'bg-indigo-50 text-indigo-700 border border-indigo-200';
        break;
      case 'contacted':
        colorClasses = 'bg-blue-50 text-blue-700 border border-blue-200';
        break;
      case 'interested':
        colorClasses = 'bg-cyan-50 text-cyan-700 border border-cyan-200';
        break;
      case 'meeting':
        colorClasses = 'bg-purple-50 text-purple-700 border border-purple-200';
        break;
      case 'quotation':
        colorClasses = 'bg-amber-50 text-amber-700 border border-amber-200';
        break;
      case 'negotiation':
        colorClasses = 'bg-orange-50 text-orange-700 border border-orange-200';
        break;
      case 'won':
        colorClasses = 'bg-emerald-50 text-emerald-700 border border-emerald-200';
        break;
      case 'lost':
        colorClasses = 'bg-slate-100 text-slate-600 border border-slate-200';
        break;
    }
  }

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full uppercase tracking-wider whitespace-nowrap ${sizeClasses} ${colorClasses} ${className}`}
    >
      {children}
    </span>
  );
};
