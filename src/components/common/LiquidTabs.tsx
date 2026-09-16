import React from 'react';
import { motion } from 'motion/react';
import { liquidSpring } from '../../lib/motion';

export interface TabOption<T extends string = string> {
  id: T;
  label: string;
  badge?: number | string;
  icon?: React.ElementType;
}

interface LiquidTabsProps<T extends string = string> {
  tabs: TabOption<T>[];
  activeTab: T;
  onChange: (tabId: T) => void;
  layoutId?: string;
  size?: 'sm' | 'md';
  className?: string;
}

export function LiquidTabs<T extends string = string>({
  tabs,
  activeTab,
  onChange,
  layoutId = 'liquid-tab-indicator',
  size = 'md',
  className = '',
}: LiquidTabsProps<T>) {
  const isSm = size === 'sm';

  return (
    <div
      role="tablist"
      className={`relative inline-flex items-center rounded-xl bg-slate-100/80 p-1 border border-slate-200/60 select-none ${className}`}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        const Icon = tab.icon;

        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            id={`tab-${tab.id}`}
            type="button"
            onClick={() => onChange(tab.id)}
            className={`relative z-10 flex items-center gap-2 rounded-lg font-medium transition-colors duration-150 cursor-pointer whitespace-nowrap ${
              isSm ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-1.5 text-xs'
            } ${
              isActive
                ? 'font-semibold text-slate-900'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {/* Fluid / Liquid Moving Active Indicator */}
            {isActive && (
              <motion.div
                layoutId={layoutId}
                transition={liquidSpring}
                className="absolute inset-0 rounded-lg bg-white shadow-xs border border-slate-200/70"
                style={{ zIndex: -1 }}
              />
            )}

            {Icon && (
              <Icon
                className={`h-3.5 w-3.5 transition-colors ${
                  isActive ? 'text-emerald-600' : 'text-slate-400'
                }`}
                strokeWidth={1.75}
              />
            )}

            <span>{tab.label}</span>

            {tab.badge !== undefined && (
              <span
                className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                  isActive
                    ? 'bg-slate-100 text-slate-800'
                    : 'bg-slate-200/80 text-slate-600'
                }`}
              >
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
