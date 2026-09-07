import React from 'react';
import {
  Shield,
  CheckSquare,
  Square,
  RotateCcw,
  Sparkles,
  Award,
  Layers,
  Lock,
} from 'lucide-react';
import {
  SalesmanPermission,
  PERMISSION_GROUPS,
  DEFAULT_SALESMAN_PERMISSIONS,
  SENIOR_SALESMAN_PERMISSIONS,
} from '../../types/database';

interface SalesmanPermissionsEditorProps {
  permissions: SalesmanPermission[];
  onChange: (permissions: SalesmanPermission[]) => void;
  disabled?: boolean;
}

export const SalesmanPermissionsEditor: React.FC<SalesmanPermissionsEditorProps> = ({
  permissions,
  onChange,
  disabled = false,
}) => {
  const currentSet = new Set(permissions);
  const totalAvailable = PERMISSION_GROUPS.reduce((acc, g) => acc + g.permissions.length, 0);

  const togglePermission = (key: SalesmanPermission) => {
    if (disabled) return;
    const next = new Set(currentSet);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    onChange(Array.from(next));
  };

  const toggleGroup = (groupPermissions: SalesmanPermission[]) => {
    if (disabled) return;
    const allSelected = groupPermissions.every((p) => currentSet.has(p));
    const next = new Set(currentSet);
    if (allSelected) {
      groupPermissions.forEach((p) => next.delete(p));
    } else {
      groupPermissions.forEach((p) => next.add(p));
    }
    onChange(Array.from(next));
  };

  const applyPreset = (preset: SalesmanPermission[]) => {
    if (disabled) return;
    onChange([...preset]);
  };

  const selectAll = () => {
    if (disabled) return;
    const all = PERMISSION_GROUPS.flatMap((g) => g.permissions.map((p) => p.key));
    onChange(all);
  };

  const clearAll = () => {
    if (disabled) return;
    onChange([]);
  };

  // Determine preset match
  const isStandardPreset =
    permissions.length === DEFAULT_SALESMAN_PERMISSIONS.length &&
    DEFAULT_SALESMAN_PERMISSIONS.every((p) => currentSet.has(p));

  const isSeniorPreset =
    permissions.length === SENIOR_SALESMAN_PERMISSIONS.length &&
    SENIOR_SALESMAN_PERMISSIONS.every((p) => currentSet.has(p));

  return (
    <div className="space-y-4">
      {/* Role & Boundary Guard Banner */}
      <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-primary)]/10 text-[var(--color-primary)] shrink-0">
            <Lock className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-[var(--text-primary)]">
                Salesman Access Matrix
              </span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                Role: SALESMAN
              </span>
            </div>
            <p className="text-[11px] text-[var(--text-secondary)]">
              Configure permitted CRM operations. The user cannot access features or data outside these rules.
            </p>
          </div>
        </div>

        {/* Counter Badge */}
        <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-main)] px-3 py-1 text-center shrink-0">
          <span className="text-xs font-bold text-[var(--color-primary)]">
            {permissions.length}
          </span>
          <span className="text-[10px] font-medium text-[var(--text-secondary)]">
            {' '}/ {totalAvailable} permissions granted
          </span>
        </div>
      </div>

      {/* Preset Action Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-color)] pb-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)] mr-1">
            Presets:
          </span>

          <button
            type="button"
            id="preset-standard-salesman-btn"
            onClick={() => applyPreset(DEFAULT_SALESMAN_PERMISSIONS)}
            disabled={disabled}
            className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition cursor-pointer border ${
              isStandardPreset
                ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-[var(--color-primary)] shadow-2xs'
                : 'border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Sparkles className="h-3 w-3" />
            <span>Standard Salesman</span>
          </button>

          <button
            type="button"
            id="preset-senior-salesman-btn"
            onClick={() => applyPreset(SENIOR_SALESMAN_PERMISSIONS)}
            disabled={disabled}
            className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition cursor-pointer border ${
              isSeniorPreset
                ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-[var(--color-primary)] shadow-2xs'
                : 'border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Award className="h-3 w-3" />
            <span>Senior Salesman</span>
          </button>

          <button
            type="button"
            id="preset-reset-defaults-btn"
            onClick={() => applyPreset(DEFAULT_SALESMAN_PERMISSIONS)}
            disabled={disabled}
            className="inline-flex items-center gap-1 rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] px-2.5 py-1 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition cursor-pointer"
            title="Reset to default Salesman permissions"
          >
            <RotateCcw className="h-3 w-3" />
            <span>Reset Defaults</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={selectAll}
            disabled={disabled}
            className="text-[11px] font-semibold text-[var(--color-primary)] hover:underline cursor-pointer"
          >
            Select All
          </button>
          <span className="text-[var(--border-color)]">|</span>
          <button
            type="button"
            onClick={clearAll}
            disabled={disabled}
            className="text-[11px] font-semibold text-rose-600 hover:underline cursor-pointer"
          >
            Clear All
          </button>
        </div>
      </div>

      {/* Permission Groups Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 max-h-[440px] overflow-y-auto pr-1">
        {PERMISSION_GROUPS.map((group) => {
          const groupKeys = group.permissions.map((p) => p.key);
          const activeInGroup = groupKeys.filter((k) => currentSet.has(k)).length;
          const isAllGroupSelected = activeInGroup === groupKeys.length;

          return (
            <div
              key={group.id}
              className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] p-3.5 transition hover:border-[var(--color-primary)]/40 shadow-2xs"
            >
              {/* Group Header */}
              <div className="flex items-center justify-between border-b border-[var(--border-color)]/60 pb-2 mb-2.5">
                <div className="flex items-center gap-2">
                  <div className="flex h-5 w-5 items-center justify-center rounded-md bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
                    <Shield className="h-3 w-3" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-[var(--text-primary)]">
                      {group.title}
                    </h4>
                    {group.description && (
                      <p className="text-[10px] text-[var(--text-secondary)] line-clamp-1">
                        {group.description}
                      </p>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => toggleGroup(groupKeys)}
                  disabled={disabled}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--text-secondary)] hover:text-[var(--color-primary)] cursor-pointer"
                  title="Toggle all permissions in this category"
                >
                  <span className="text-[10px]">
                    {activeInGroup}/{groupKeys.length}
                  </span>
                  {isAllGroupSelected ? (
                    <CheckSquare className="h-3.5 w-3.5 text-[var(--color-primary)]" />
                  ) : (
                    <Square className="h-3.5 w-3.5 text-slate-400" />
                  )}
                </button>
              </div>

              {/* Permission Items */}
              <div className="space-y-1.5">
                {group.permissions.map((perm) => {
                  const isChecked = currentSet.has(perm.key);
                  return (
                    <label
                      key={perm.key}
                      htmlFor={`perm-checkbox-${perm.key}`}
                      className={`flex items-start gap-2.5 rounded-lg p-2 transition cursor-pointer select-none border ${
                        isChecked
                          ? 'border-[var(--color-primary)]/30 bg-[var(--color-primary)]/5'
                          : 'border-transparent hover:bg-[var(--bg-main)]'
                      } ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
                    >
                      <input
                        id={`perm-checkbox-${perm.key}`}
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => togglePermission(perm.key)}
                        disabled={disabled}
                        className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[var(--color-primary)] focus:ring-[var(--color-primary)] cursor-pointer"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`text-xs font-bold ${
                              isChecked
                                ? 'text-[var(--text-primary)]'
                                : 'text-[var(--text-secondary)]'
                            }`}
                          >
                            {perm.label}
                          </span>
                          <span className="text-[9px] font-mono text-slate-400">
                            {perm.key}
                          </span>
                        </div>
                        <p className="text-[11px] text-[var(--text-secondary)]">
                          {perm.description}
                        </p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
