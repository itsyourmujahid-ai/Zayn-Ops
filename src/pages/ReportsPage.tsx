import React, { useState, useEffect, useMemo } from 'react';
import {
  BarChart3,
  Loader2,
  Calendar,
  Layers,
  Users,
  Compass,
  Award,
  AlertTriangle,
  RefreshCw,
  Clock,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  LeadRecord,
  FollowUpRecord,
  LeadActivityRecord,
  UserProfile,
} from '../types/database';
import {
  subscribeToLeads,
  subscribeToFollowUps,
  subscribeToAllActivities,
  subscribeToUsers,
} from '../lib/dal';
import {
  ReportsFilterState,
  DateRangePreset,
} from '../types/reports';
import {
  getDateRangeBoundaries,
  isWithinDateRange,
  calculateMetricSummary,
  aggregatePipelineDistribution,
  aggregateSalesTeamPerformance,
  aggregateDimensionBreakdown,
  aggregateActivityBreakdown,
  aggregateTimeSeriesTrends,
  findRecentWins,
  calculateAttentionRisks,
} from '../utils/reportUtils';
import { ReportsHeader } from '../components/reports/ReportsHeader';
import { ReportsKPICards } from '../components/reports/ReportsKPICards';
import { LeadPerformanceCard } from '../components/reports/LeadPerformanceCard';
import { PipelineAnalyticsSection } from '../components/reports/PipelineAnalyticsSection';
import { SalesTeamPerformanceTable } from '../components/reports/SalesTeamPerformanceTable';
import { SalesmanPersonalSummary } from '../components/reports/SalesmanPersonalSummary';
import { LeadSourceAndTypeCharts } from '../components/reports/LeadSourceAndTypeCharts';
import { ActivityAndFollowupAnalytics } from '../components/reports/ActivityAndFollowupAnalytics';
import { TimeTrendCharts } from '../components/reports/TimeTrendCharts';
import { RecentWinsTable } from '../components/reports/RecentWinsTable';
import { AttentionRiskAnalysis } from '../components/reports/AttentionRiskAnalysis';
import { NavigationView } from '../types/crm';

interface ReportsPageProps {
  onSelectLead?: (leadId: string) => void;
  onSelectView?: (view: NavigationView, options?: any) => void;
}

export const ReportsPage: React.FC<ReportsPageProps> = ({ onSelectLead, onSelectView }) => {
  const { userProfile, currentUser, isAdmin } = useAuth();

  // Raw Database Subscriptions
  const [leads, setLeads] = useState<LeadRecord[]>([]);
  const [followups, setFollowups] = useState<FollowUpRecord[]>([]);
  const [activities, setActivities] = useState<LeadActivityRecord[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filter State
  const [filterState, setFilterState] = useState<ReportsFilterState>({
    dateRangePreset: 'this_month',
    selectedSalesman: 'all',
    selectedLeadType: 'all',
    selectedSource: 'all',
    selectedPriority: 'all',
    selectedLocation: 'all',
  });

  // 1. Establish Real-time Firestore Subscriptions with strict role scoping
  useEffect(() => {
    setLoading(true);
    setError(null);

    const userRole = userProfile?.role || 'SALESMAN';
    const targetUserId = currentUser?.uid;

    let leadsLoaded = false;
    let followupsLoaded = false;
    let activitiesLoaded = false;
    let usersLoaded = false;

    const checkComplete = () => {
      if (leadsLoaded && followupsLoaded && activitiesLoaded) {
        setLoading(false);
      }
    };

    // 1. Leads
    const unsubLeads = subscribeToLeads(
      (data) => {
        setLeads(data);
        leadsLoaded = true;
        checkComplete();
      },
      userRole,
      (err) => {
        console.warn('Reports leads subscription fallback:', err);
        leadsLoaded = true;
        checkComplete();
      },
      targetUserId
    );

    // 2. Follow-ups
    const unsubFollowups = subscribeToFollowUps(
      (data) => {
        setFollowups(data);
        followupsLoaded = true;
        checkComplete();
      },
      userRole,
      (err) => {
        console.warn('Reports followups subscription fallback:', err);
        followupsLoaded = true;
        checkComplete();
      },
      targetUserId
    );

    // 3. Activities
    const unsubActivities = subscribeToAllActivities(
      (data) => {
        setActivities(data);
        activitiesLoaded = true;
        checkComplete();
      },
      userRole,
      (err) => {
        console.warn('Reports activities subscription fallback:', err);
        activitiesLoaded = true;
        checkComplete();
      },
      targetUserId,
      300
    );

    // 4. Users (for Admin views & display names)
    const unsubUsers = subscribeToUsers(
      (data) => {
        setUsers(data);
        usersLoaded = true;
      },
      (err) => {
        console.warn('Reports users subscription fallback:', err);
      }
    );

    return () => {
      unsubLeads();
      unsubFollowups();
      unsubActivities();
      unsubUsers();
    };
  }, [userProfile?.role, currentUser?.uid]);

  // Active Salesmen list (for Admin filter dropdown & team matrix)
  const activeSalesmen = useMemo(() => {
    return users.filter(
      (u) => u.is_active !== false && u.role?.toUpperCase() !== 'ADMIN'
    );
  }, [users]);

  // Compute Active Date Range Boundaries
  const dateRange = useMemo(() => {
    return getDateRangeBoundaries(
      filterState.dateRangePreset,
      filterState.customStartDate,
      filterState.customEndDate
    );
  }, [
    filterState.dateRangePreset,
    filterState.customStartDate,
    filterState.customEndDate,
  ]);

  // Date Range Display String
  const dateRangeDisplay = useMemo(() => {
    const sStr = dateRange.startDate.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    const eStr = dateRange.endDate.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    return `${sStr} – ${eStr}`;
  }, [dateRange]);

  // Filter leads based on selected Salesman (Admin only) and optional dimensions
  const filteredLeads = useMemo(() => {
    return leads.filter((l) => {
      // Salesman filter (Admin only)
      if (isAdmin && filterState.selectedSalesman !== 'all') {
        if (l.assigned_to !== filterState.selectedSalesman) return false;
      }
      return true;
    });
  }, [leads, isAdmin, filterState.selectedSalesman]);

  // Filter activities based on date range and selected Salesman
  const filteredActivities = useMemo(() => {
    return activities.filter((act) => {
      // Salesman filter (Admin only)
      if (isAdmin && filterState.selectedSalesman !== 'all') {
        if (
          act.performed_by !== filterState.selectedSalesman &&
          act.created_by !== filterState.selectedSalesman
        ) {
          return false;
        }
      }
      // Date range filter
      const actDate = act.activity_at || act.activity_date || act.created_at;
      return isWithinDateRange(actDate, dateRange);
    });
  }, [activities, isAdmin, filterState.selectedSalesman, dateRange]);

  // Filter follow-ups based on selected Salesman
  const filteredFollowups = useMemo(() => {
    return followups.filter((f) => {
      // Salesman filter (Admin only)
      if (isAdmin && filterState.selectedSalesman !== 'all') {
        if (f.assigned_to !== filterState.selectedSalesman) return false;
      }
      return true;
    });
  }, [followups, isAdmin, filterState.selectedSalesman]);

  // Follow-ups falling within the active period
  const followupsInPeriod = useMemo(() => {
    return filteredFollowups.filter((f) => {
      const targetDate = f.completed_at || f.updated_at || f.scheduled_at;
      return isWithinDateRange(targetDate, dateRange);
    });
  }, [filteredFollowups, dateRange]);

  // Leads created in active period
  const leadsCreatedInPeriod = useMemo(() => {
    return filteredLeads.filter((l) => isWithinDateRange(l.created_at, dateRange));
  }, [filteredLeads, dateRange]);

  // 1. High-level KPI Summary
  const metrics = useMemo(() => {
    return calculateMetricSummary(
      filteredLeads,
      leadsCreatedInPeriod,
      filteredActivities,
      filteredFollowups,
      followupsInPeriod
    );
  }, [
    filteredLeads,
    leadsCreatedInPeriod,
    filteredActivities,
    filteredFollowups,
    followupsInPeriod,
  ]);

  // 2. Stage Breakdown
  const stageMetrics = useMemo(() => {
    return aggregatePipelineDistribution(filteredLeads);
  }, [filteredLeads]);

  // 3. Sales Team Matrix (Admin Only)
  const teamMetrics = useMemo(() => {
    if (!isAdmin) return [];
    return aggregateSalesTeamPerformance(
      activeSalesmen,
      leads,
      activities,
      followups
    );
  }, [isAdmin, activeSalesmen, leads, activities, followups]);

  // 4. Source & Type Breakdowns
  const sourceBreakdown = useMemo(() => {
    return aggregateDimensionBreakdown(filteredLeads, 'source');
  }, [filteredLeads]);

  const typeBreakdown = useMemo(() => {
    return aggregateDimensionBreakdown(filteredLeads, 'lead_type');
  }, [filteredLeads]);

  // 5. Activity Breakdown
  const activityBreakdown = useMemo(() => {
    return aggregateActivityBreakdown(filteredActivities);
  }, [filteredActivities]);

  // 6. Time-Series Trends
  const trendPoints = useMemo(() => {
    return aggregateTimeSeriesTrends(
      filteredLeads,
      filteredActivities,
      filteredFollowups,
      dateRange
    );
  }, [filteredLeads, filteredActivities, filteredFollowups, dateRange]);

  // 7. Recent Wins
  const recentWins = useMemo(() => {
    return findRecentWins(filteredLeads, users, 8);
  }, [filteredLeads, users]);

  // 8. Attention & Risk Items
  const risks = useMemo(() => {
    return calculateAttentionRisks(filteredLeads, filteredFollowups, users, isAdmin);
  }, [filteredLeads, filteredFollowups, users, isAdmin]);

  const handleFilterChange = (updates: Partial<ReportsFilterState>) => {
    setFilterState((prev) => ({ ...prev, ...updates }));
  };

  const handleResetFilters = () => {
    setFilterState({
      dateRangePreset: 'this_month',
      selectedSalesman: 'all',
      selectedLeadType: 'all',
      selectedSource: 'all',
      selectedPriority: 'all',
      selectedLocation: 'all',
    });
  };

  const handleSelectStageDrilldown = (stage: string) => {
    if (onSelectView) {
      onSelectView('leads', { leadFilter: { stage: stage.toLowerCase() } });
    }
  };

  if (loading && leads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-3">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
        <div className="text-sm font-semibold text-slate-800">
          Aggregating Sales &amp; Performance Intelligence...
        </div>
        <div className="text-xs text-slate-400">
          Computing real-time pipeline KPIs, conversion velocity, and activity metrics
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Page Header & Filter Controls */}
      <ReportsHeader
        isAdmin={isAdmin}
        filterState={filterState}
        onFilterChange={handleFilterChange}
        onResetFilters={handleResetFilters}
        activeSalesmen={activeSalesmen}
        dateRangeDisplay={dateRangeDisplay}
      />

      {/* 2. Top Summary KPI Cards */}
      <ReportsKPICards metrics={metrics} isAdmin={isAdmin} />

      {/* 3. Salesman Personal Scorecard (Salesman View Only) */}
      {!isAdmin && (
        <SalesmanPersonalSummary
          metrics={metrics}
          userName={userProfile?.full_name || currentUser?.email || 'Representative'}
        />
      )}

      {/* 4. Lead Performance & Conversion Card */}
      <LeadPerformanceCard
        metrics={metrics}
        leadsCreatedInPeriodCount={leadsCreatedInPeriod.length}
        periodLabel={dateRangeDisplay}
      />

      {/* 5. Pipeline Stage Analytics & Financial Breakdown */}
      <PipelineAnalyticsSection
        stages={stageMetrics}
        totalLeads={metrics.totalLeads}
        totalPipelineValue={metrics.totalPipelineValue}
        onSelectStage={handleSelectStageDrilldown}
      />

      {/* 6. Historical Time Trends (Recharts Area / Bar) */}
      <TimeTrendCharts
        trendPoints={trendPoints}
        dateRangeDisplay={dateRangeDisplay}
      />

      {/* 7. Sales Team Performance Matrix (Admin Only) */}
      {isAdmin && (
        <SalesTeamPerformanceTable
          teamMetrics={teamMetrics}
          onSelectSalesman={(id) => handleFilterChange({ selectedSalesman: id })}
        />
      )}

      {/* 8. Activity Mix & Follow-up Discipline */}
      <ActivityAndFollowupAnalytics
        activityBreakdown={activityBreakdown}
        totalActivities={metrics.totalActivities}
        followupsInPeriod={followupsInPeriod}
        allFollowups={filteredFollowups}
        metrics={metrics}
      />

      {/* 9. Lead Sources & Customer Types */}
      <LeadSourceAndTypeCharts
        sourceBreakdown={sourceBreakdown}
        typeBreakdown={typeBreakdown}
      />

      {/* 10. Operational Risk Radar & Attention Alerts */}
      <AttentionRiskAnalysis
        risks={risks}
        onSelectLead={onSelectLead}
        onOpenLeadsView={() => onSelectView && onSelectView('leads')}
      />

      {/* 11. Recent Closed Wins & Trophies */}
      <RecentWinsTable
        recentWins={recentWins}
        isAdmin={isAdmin}
        onSelectLead={onSelectLead}
      />
    </div>
  );
};
