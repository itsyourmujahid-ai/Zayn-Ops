import React from 'react';
import { motion, LayoutGroup } from 'motion/react';
import { liquidSpring } from '../../lib/motion';

export interface TabItem<T extends string = string> {
  id: T;
  label: React.ReactNode;
  icon?: React.ElementType;
  count?: number | string;
  badgeClass?: string;
}

export interface LiquidTabsProps<T extends string = string> {
  tabs: TabItem<T>[];
  activeTab: T;
  onChange: (id: T) => void;
  layoutGroupId?: string;
  className?: string;
  size?: 'sm' | 'md';
}

export function LiquidTabs<T extends string = string>({
  tabs,
  activeTab,
  onChange,
  layoutGroupId = 'liquid-tabs-group',
  className = '',
  size = 'md',
}: LiquidTabsProps<T>) {
  const isSm = size === 'sm';

  return (
    <LayoutGroup id={layoutGroupId}>
      <div
        className={`inline-flex items-center rounded-xl border border-slate-200/90 bg-slate-100/75 p-1 select-none shadow-2xs backdrop-blur-xs ${className}`}
        role="tablist"
      >
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab;
          const Icon = tab.icon;

          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              type="button"
              onClick={() => onChange(tab.id)}
              className={`relative inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors duration-200 cursor-pointer whitespace-nowrap z-10 ${
                isSm ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-xs font-semibold'
              } ${
                isActive
                  ? 'text-slate-950 font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/40'
              }`}
            >
              {/* Shared Liquid Active Slider Pill */}
              {isActive && (
                <motion.div
                  layoutId={`${layoutGroupId}-pill`}
                  transition={liquidSpring}
                  className="absolute inset-0 rounded-lg bg-white shadow-[0_1px_3px_rgba(0,0,0,0.08),0_1px_1px_rgba(0,0,0,0.04)] border border-slate-200/80 -z-10"
                />
              )}

              {Icon && (
                <Icon
                  className={`h-3.5 w-3.5 transition-transform duration-200 ${
                    isActive ? 'text-[#0CB675] scale-105' : 'text-slate-500'
                  }`}
                  strokeWidth={isActive ? 2 : 1.75}
                />
              )}

              <span>{tab.label}</span>

              {tab.count !== undefined && (
                <span
                  className={`ml-1 rounded-full px-1.5 py-0.2 text-[10px] font-bold transition-colors ${
                    tab.badgeClass
                      ? tab.badgeClass
                      : isActive
                      ? 'bg-emerald-100/80 text-emerald-800'
                      : 'bg-slate-200/80 text-slate-600'
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </LayoutGroup>
  );
}
