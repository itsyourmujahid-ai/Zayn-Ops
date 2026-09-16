import React, { useState } from 'react';
import {
  Calendar,
  Filter,
  User,
  RotateCcw,
  Sparkles,
  ShieldCheck,
  UserCheck,
  ChevronDown,
  Check,
} from 'lucide-react';
import { DateRangePreset, ReportsFilterState } from '../../types/reports';
import { UserProfile } from '../../types/database';

interface ReportsHeaderProps {
  isAdmin: boolean;
  filterState: ReportsFilterState;
  onFilterChange: (updates: Partial<ReportsFilterState>) => void;
  onResetFilters: () => void;
  activeSalesmen: UserProfile[];
  dateRangeDisplay: string;
}

const PRESET_LABELS: { preset: DateRangePreset; label: string }[] = [
  { preset: 'today', label: 'Today' },
  { preset: 'this_week', label: 'This Week' },
  { preset: 'this_month', label: 'This Month' },
  { preset: 'last_month', label: 'Last Month' },
  { preset: 'this_quarter', label: 'This Quarter' },
  { preset: 'this_year', label: 'This Year' },
  { preset: 'custom', label: 'Custom Range' },
];

export const ReportsHeader: React.FC<ReportsHeaderProps> = ({
  isAdmin,
  filterState,
  onFilterChange,
  onResetFilters,
  activeSalesmen,
  dateRangeDisplay,
}) => {
  const [showCustomModal, setShowCustomModal] = useState<boolean>(false);
  const [tempStart, setTempStart] = useState<string>(filterState.customStartDate || '');
  const [tempEnd, setTempEnd] = useState<string>(filterState.customEndDate || '');

  const handlePresetClick = (preset: DateRangePreset) => {
    if (preset === 'custom') {
      setShowCustomModal(true);
    } else {
      onFilterChange({ dateRangePreset: preset });
    }
  };

  const handleApplyCustomDate = (e: React.FormEvent) => {
    e.preventDefault();
    if (tempStart && tempEnd) {
      onFilterChange({
        dateRangePreset: 'custom',
        customStartDate: tempStart,
        customEndDate: tempEnd,
      });
      setShowCustomModal(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Header Row */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              {isAdmin ? 'Performance Reports' : 'My Performance Report'}
            </h1>
            <span
              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200/80"
            >
              {isAdmin ? (
                <>
                  <ShieldCheck className="h-3 w-3 text-[#0CB675]" />
                  Admin Executive View
                </>
              ) : (
                <>
                  <UserCheck className="h-3 w-3 text-[#0CB675]" />
                  Personal Metrics
                </>
              )}
            </span>
          </div>
          <p className="text-xs text-slate-500">
            {isAdmin
              ? 'Real-time sales pipeline KPIs, representative metrics, and conversion intelligence.'
              : 'Real-time personal lead progress, activity tracking, and follow-up discipline analytics.'}
          </p>
          <div className="flex items-center gap-1.5 pt-0.5 text-xs text-slate-500 font-medium">
            <Calendar className="h-3.5 w-3.5 text-slate-400" strokeWidth={1.75} />
            <span>Active Range: <strong className="text-slate-800">{dateRangeDisplay}</strong></span>
          </div>
        </div>

        {/* Right Action & Salesman Filter (Admin Only) */}
        <div className="flex flex-wrap items-center gap-2">
          {isAdmin && (
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200/80 rounded-lg p-1">
              <span className="text-[11px] font-semibold text-slate-500 pl-1.5">Salesman:</span>
              <select
                id="report-salesman-select"
                value={filterState.selectedSalesman}
                onChange={(e) => onFilterChange({ selectedSalesman: e.target.value })}
                className="bg-white border border-slate-200 rounded-md px-2 py-1 text-xs font-medium text-slate-800 focus:outline-none cursor-pointer"
              >
                <option value="all">All Sales Representatives</option>
                {activeSalesmen.map((salesman) => (
                  <option key={salesman.id} value={salesman.id}>
                    {salesman.full_name || salesman.email}
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            type="button"
            onClick={onResetFilters}
            className="zaynops-btn-secondary py-1.5 px-3 text-xs font-medium flex items-center gap-1.5 cursor-pointer"
            title="Reset active date and dimension filters"
          >
            <RotateCcw className="h-3.5 w-3.5 text-slate-400" strokeWidth={1.75} />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* Date Preset Filter Bar */}
      <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1">
        <div className="flex items-center gap-1.5">
          {PRESET_LABELS.map((item) => {
            const isActive = filterState.dateRangePreset === item.preset;
            return (
              <button
                key={item.preset}
                type="button"
                onClick={() => handlePresetClick(item.preset)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-2xs font-semibold'
                    : 'bg-white border border-slate-200/80 text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                {item.label}
                {item.preset === 'custom' && filterState.dateRangePreset === 'custom' && (
                  <span className="ml-1 text-[10px] bg-slate-800 px-1.5 py-0.5 rounded text-white">
                    {filterState.customStartDate} ~ {filterState.customEndDate}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Custom Date Range Picker Modal */}
      {showCustomModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl w-full max-w-md p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-900">Select Custom Date Interval</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCustomModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleApplyCustomDate} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    required
                    value={tempStart}
                    onChange={(e) => setTempStart(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    required
                    value={tempEnd}
                    onChange={(e) => setTempEnd(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCustomModal(false)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-indigo-600 text-xs font-semibold text-white hover:bg-indigo-700 transition cursor-pointer"
                >
                  Apply Date Range
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
