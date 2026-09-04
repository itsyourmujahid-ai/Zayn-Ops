import React from 'react';
import { X } from 'lucide-react';
import { TagRecord } from '../types/database';

export interface TagBadgeProps {
  name: string;
  color?: string;
  type?: 'Lead' | 'Client' | 'Both';
  isActive?: boolean;
  onRemove?: () => void;
  onClick?: () => void;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const COLOR_STYLES: Record<string, { bg: string; text: string; border: string; hover: string }> = {
  rose: {
    bg: 'bg-rose-50 text-rose-700',
    text: 'text-rose-700',
    border: 'border-rose-200',
    hover: 'hover:bg-rose-100',
  },
  emerald: {
    bg: 'bg-emerald-50 text-emerald-700',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
    hover: 'hover:bg-emerald-100',
  },
  purple: {
    bg: 'bg-purple-50 text-purple-700',
    text: 'text-purple-700',
    border: 'border-purple-200',
    hover: 'hover:bg-purple-100',
  },
  indigo: {
    bg: 'bg-indigo-50 text-indigo-700',
    text: 'text-indigo-700',
    border: 'border-indigo-200',
    hover: 'hover:bg-indigo-100',
  },
  cyan: {
    bg: 'bg-cyan-50 text-cyan-700',
    text: 'text-cyan-700',
    border: 'border-cyan-200',
    hover: 'hover:bg-cyan-100',
  },
  amber: {
    bg: 'bg-amber-50 text-amber-700',
    text: 'text-amber-700',
    border: 'border-amber-200',
    hover: 'hover:bg-amber-100',
  },
  slate: {
    bg: 'bg-slate-100 text-slate-700',
    text: 'text-slate-700',
    border: 'border-slate-200',
    hover: 'hover:bg-slate-200',
  },
};

// Fallback color mapping based on tag name hash for consistent display
function getColorForName(name: string): string {
  const colors = ['indigo', 'emerald', 'purple', 'rose', 'cyan', 'amber', 'slate'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % colors.length;
  return colors[index];
}

export const TagBadge: React.FC<TagBadgeProps> = ({
  name,
  color,
  type,
  isActive = true,
  onRemove,
  onClick,
  size = 'md',
  className = '',
}) => {
  const chosenColor = color || getColorForName(name);
  const style = COLOR_STYLES[chosenColor] || COLOR_STYLES.indigo;

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5 gap-1',
    md: 'text-xs px-2.5 py-1 gap-1.5',
    lg: 'text-sm px-3 py-1.5 gap-2',
  }[size];

  return (
    <span
      id={`tag-badge-${name.toLowerCase().replace(/\s+/g, '-')}`}
      onClick={onClick}
      className={`inline-flex items-center font-medium rounded-md border transition-colors ${style.bg} ${style.border} ${sizeClasses} ${
        onClick ? 'cursor-pointer hover:opacity-90' : ''
      } ${!isActive ? 'opacity-60 line-through' : ''} ${className}`}
    >
      <span className="truncate max-w-[150px]">{name}</span>
      {type && type !== 'Both' && (
        <span className="text-[10px] font-semibold uppercase tracking-wider px-1 rounded bg-black/5">
          {type}
        </span>
      )}
      {onRemove && (
        <button
          type="button"
          id={`btn-remove-tag-${name.toLowerCase().replace(/\s+/g, '-')}`}
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="ml-0.5 p-0.5 rounded-full hover:bg-black/10 focus:outline-none focus:ring-1 focus:ring-offset-1 focus:ring-black/20"
          aria-label={`Remove tag ${name}`}
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </span>
  );
};
