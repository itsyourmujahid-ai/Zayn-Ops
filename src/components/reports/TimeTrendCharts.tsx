import React, { useState } from 'react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { TrendingUp, Activity, CheckCircle2, Calendar } from 'lucide-react';
import { TimeSeriesPoint } from '../../types/reports';

interface TimeTrendChartsProps {
  trendPoints: TimeSeriesPoint[];
  dateRangeDisplay: string;
}

export const TimeTrendCharts: React.FC<TimeTrendChartsProps> = ({
  trendPoints,
  dateRangeDisplay,
}) => {
  const [activeTab, setActiveTab] = useState<'leads' | 'activities' | 'followups'>('leads');

  const hasData = trendPoints.some(
    (p) =>
      p.leadsCreated > 0 ||
      p.leadsWon > 0 ||
      p.leadsLost > 0 ||
      p.activities > 0 ||
      p.followupsCompleted > 0
  );

  return (
    <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] shadow-xs p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[var(--border-subtle)] pb-3">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4.5 w-4.5 text-[var(--color-primary)]" />
            <h3 className="text-sm font-bold text-[var(--text-main)]">Historical Trends &amp; Velocity Over Time</h3>
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            Temporal distribution of new leads, win events, customer interactions, and task completions
          </p>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center gap-1 bg-[var(--bg-elevated)] p-1 rounded-lg border border-[var(--border-color)]">
          <button
            type="button"
            onClick={() => setActiveTab('leads')}
            className={`px-3 py-1 rounded-md text-xs font-semibold transition cursor-pointer ${
              activeTab === 'leads'
                ? 'bg-[var(--bg-card)] text-[var(--color-primary)] shadow-xs border border-[var(--color-primary-border)]'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-main)]'
            }`}
          >
            Leads &amp; Wins
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('activities')}
            className={`px-3 py-1 rounded-md text-xs font-semibold transition cursor-pointer ${
              activeTab === 'activities'
                ? 'bg-[var(--bg-card)] text-[#C084FC] shadow-xs border border-[rgba(168,85,247,0.4)]'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-main)]'
            }`}
          >
            Activity Volume
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('followups')}
            className={`px-3 py-1 rounded-md text-xs font-semibold transition cursor-pointer ${
              activeTab === 'followups'
                ? 'bg-[var(--bg-card)] text-[#34D399] shadow-xs border border-[rgba(16,185,129,0.4)]'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-main)]'
            }`}
          >
            Follow-up Resolutions
          </button>
        </div>
      </div>

      {!hasData ? (
        <div className="h-64 flex flex-col items-center justify-center text-[var(--text-muted)] text-xs">
          <Calendar className="h-8 w-8 text-[var(--text-disabled)] mb-2" />
          No historical activity recorded in this date range.
        </div>
      ) : (
        <div className="h-72 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            {activeTab === 'leads' ? (
              <AreaChart
                data={trendPoints}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="colorCreated" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="colorWon" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.5} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                <XAxis
                  dataKey="displayDate"
                  tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                  tickLine={false}
                  axisLine={{ stroke: 'var(--border-color)' }}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                  tickLine={false}
                  axisLine={{ stroke: 'var(--border-color)' }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--bg-card)',
                    borderColor: 'var(--border-color)',
                    borderRadius: '8px',
                    fontSize: '12px',
                    color: 'var(--text-main)',
                    boxShadow: '0 8px 16px var(--shadow-color)',
                  }}
                  itemStyle={{ color: 'var(--text-main)' }}
                  labelStyle={{ color: 'var(--text-secondary)', fontWeight: 'bold' }}
                />
                <Legend
                  wrapperStyle={{ fontSize: '12px', paddingTop: '8px', color: 'var(--text-secondary)' }}
                />
                <Area
                  type="monotone"
                  dataKey="leadsCreated"
                  name="Leads Created"
                  stroke="var(--color-primary)"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorCreated)"
                />
                <Area
                  type="monotone"
                  dataKey="leadsWon"
                  name="Deals Won"
                  stroke="#10b981"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorWon)"
                />
              </AreaChart>
            ) : activeTab === 'activities' ? (
              <BarChart
                data={trendPoints}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                <XAxis
                  dataKey="displayDate"
                  tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                  tickLine={false}
                  axisLine={{ stroke: 'var(--border-color)' }}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                  tickLine={false}
                  axisLine={{ stroke: 'var(--border-color)' }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--bg-card)',
                    borderColor: 'var(--border-color)',
                    borderRadius: '8px',
                    fontSize: '12px',
                    color: 'var(--text-main)',
                    boxShadow: '0 8px 16px var(--shadow-color)',
                  }}
                  itemStyle={{ color: 'var(--text-main)' }}
                  labelStyle={{ color: 'var(--text-secondary)', fontWeight: 'bold' }}
                />
                <Legend
                  wrapperStyle={{ fontSize: '12px', paddingTop: '8px', color: 'var(--text-secondary)' }}
                />
                <Bar
                  dataKey="activities"
                  name="Activities Logged"
                  fill="#8b5cf6"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            ) : (
              <BarChart
                data={trendPoints}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                <XAxis
                  dataKey="displayDate"
                  tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                  tickLine={false}
                  axisLine={{ stroke: 'var(--border-color)' }}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                  tickLine={false}
                  axisLine={{ stroke: 'var(--border-color)' }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--bg-card)',
                    borderColor: 'var(--border-color)',
                    borderRadius: '8px',
                    fontSize: '12px',
                    color: 'var(--text-main)',
                    boxShadow: '0 8px 16px var(--shadow-color)',
                  }}
                  itemStyle={{ color: 'var(--text-main)' }}
                  labelStyle={{ color: 'var(--text-secondary)', fontWeight: 'bold' }}
                />
                <Legend
                  wrapperStyle={{ fontSize: '12px', paddingTop: '8px', color: 'var(--text-secondary)' }}
                />
                <Bar
                  dataKey="followupsCompleted"
                  name="Follow-ups Completed"
                  fill="#10b981"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};
