import React, { useState, useMemo } from 'react';
import {
  Users,
  Building2,
  Clock,
  CheckCircle2,
  AlertCircle,
  Flame,
  Trophy,
  XCircle,
  TrendingUp,
  Activity,
  Layers,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import {
  FollowUpRecord,
  LeadRecord,
  LeadActivityRecord,
  UserProfile,
  ClientRecord,
  TargetRecord,
  LeadTransferRecord,
  ClientTransferRecord,
} from '../../types/database';
import { NavigationView } from '../../types/crm';
import { DateRangePreset } from '../../types/reports';
import { getDateRangeBoundaries, isWithinDateRange } from '../../utils/reportUtils';
import { QuickActionsBar } from './QuickActionsBar';
import { UrgentAttentionSection } from './UrgentAttentionSection';
import { RecentActivityFeed } from './RecentActivityFeed';
import { DashboardCalendarWidget } from './DashboardCalendarWidget';
import { SalesPerformanceSection } from './SalesPerformanceSection';
import { SalesmanPerformanceTable } from './SalesmanPerformanceTable';
import { TargetPerformanceWidget } from './TargetPerformanceWidget';
import { SalesFunnelWidget } from './SalesFunnelWidget';
import { LeadSourcePerformanceWidget } from './LeadSourcePerformanceWidget';
import { SalesmanComparisonWidget } from './SalesmanComparisonWidget';
import { FollowupActivityPerformanceWidget } from './FollowupActivityPerformanceWidget';
import { ClientGrowthWidget } from './ClientGrowthWidget';
import { TransferIntelligenceWidget } from './TransferIntelligenceWidget';

export interface AdminDashboardProps {
  leads: LeadRecord[];
  clients?: ClientRecord[];
  followups: FollowUpRecord[];
  activities: LeadActivityRecord[];
  targets?: TargetRecord[];
  leadTransfers?: LeadTransferRecord[];
  clientTransfers?: ClientTransferRecord[];
  salesmen: UserProfile[];
  allUsers: UserProfile[];
  onOpenAddLead: () => void;
  onOpenScheduleFollowUp: () => void;
  onSelectLead: (leadId: string) => void;
  onOpenCompleteFollowUp: (followup: FollowUpRecord) => void;
  onOpenRescheduleFollowUp: (followup: FollowUpRecord) => void;
  onSelectView: (view: NavigationView, options?: any) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  leads,
  clients = [],
  followups,
  activities,
  targets = [],
  leadTransfers = [],
  clientTransfers = [],
  salesmen,
  allUsers,
  onOpenAddLead,
  onOpenScheduleFollowUp,
  onSelectLead,
  onOpenCompleteFollowUp,
  onOpenRescheduleFollowUp,
  onSelectView,
}) => {
  // Global Dashboard Date Filter State
  const [datePreset, setDatePreset] = useState<DateRangePreset>('this_month');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');

  // Compute Active Date Range Boundaries
  const dateRange = useMemo(() => {
    return getDateRangeBoundaries(datePreset, customStartDate, customEndDate);
  }, [datePreset, customStartDate, customEndDate]);

  const dateRangeDisplay = useMemo(() => {
    const s = dateRange.startDate.toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
    const e = dateRange.endDate.toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
    return `${s} – ${e}`;
  }, [dateRange]);

  // Clearly Distinguish:
  // 1. Current Ownership Metrics: Active pipeline, current assignments, current pending tasks
  // 2. Historical Activity Metrics: Events occurring within the selected date boundary
  const filteredLeads = useMemo(() => {
    return leads.filter((l) => {
      // If lead was created or closed or updated within range
      const createdTime = l.created_at || (l as any).createdAt;
      const closingTime = l.closing_date;
      const updatedTime = l.updated_at;

      const inCreated = isWithinDateRange(createdTime, dateRange);
      const inClosing = closingTime ? isWithinDateRange(closingTime, dateRange) : false;
      const inUpdated = updatedTime ? isWithinDateRange(updatedTime, dateRange) : false;

      return inCreated || inClosing || inUpdated;
    });
  }, [leads, dateRange]);

  const filteredClients = useMemo(() => {
    return clients.filter((c) => {
      return isWithinDateRange(c.created_at, dateRange);
    });
  }, [clients, dateRange]);

  const filteredFollowups = useMemo(() => {
    return followups.filter((f) => {
      const scheduledTime = `${f.scheduled_date}T${f.scheduled_time || '12:00:00'}`;
      const completedTime = f.completed_at;
      return (
        isWithinDateRange(scheduledTime, dateRange) ||
        (completedTime ? isWithinDateRange(completedTime, dateRange) : false)
      );
    });
  }, [followups, dateRange]);

  const filteredActivities = useMemo(() => {
    return activities.filter((a) => {
      return isWithinDateRange(a.created_at || (a as any).timestamp, dateRange);
    });
  }, [activities, dateRange]);

  return (
    <div className="space-y-6 pb-12">
      {/* 1. TOP BANNER & QUICK ACTIONS BAR */}
      <QuickActionsBar
        role="ADMIN"
        onOpenAddLead={onOpenAddLead}
        onOpenScheduleFollowUp={onOpenScheduleFollowUp}
        onSelectView={onSelectView}
      />

      {/* 2. SALES PERFORMANCE & MANAGEMENT SECTION (PRIMARY UPGRADE) */}
      <SalesPerformanceSection
        leads={leads}
        filteredLeads={filteredLeads.length > 0 ? filteredLeads : leads}
        clients={clients}
        filteredClients={filteredClients}
        followups={followups}
        filteredFollowups={filteredFollowups}
        activities={activities}
        filteredActivities={filteredActivities}
        targets={targets}
        activeSalesmen={salesmen}
        datePreset={datePreset}
        onSelectDatePreset={setDatePreset}
        customStartDate={customStartDate}
        customEndDate={customEndDate}
        onChangeCustomDates={(s, e) => {
          setCustomStartDate(s);
          setCustomEndDate(e);
        }}
        dateRangeDisplay={dateRangeDisplay}
        onOpenAddLead={onOpenAddLead}
        onSelectView={onSelectView}
      />

      {/* 3. SALESMAN PERFORMANCE TABLE */}
      <SalesmanPerformanceTable
        salesmen={salesmen}
        leads={leads}
        clients={clients}
        followups={followups}
        activities={activities}
        targets={targets}
        onSelectView={onSelectView}
      />

      {/* 4. VISUAL SALES FUNNEL & TARGET QUOTA WIDGETS */}
      <div className="space-y-6">
        <SalesFunnelWidget
          leads={leads}
          salesmen={salesmen}
          onSelectView={onSelectView}
        />

        <TargetPerformanceWidget
          targets={targets}
          salesmen={salesmen}
          leads={leads}
          clients={clients}
          followups={followups}
          activities={activities}
          onSelectView={onSelectView}
        />
      </div>

      {/* 5. LEAD SOURCE PERFORMANCE & SALESMAN COMPARISON BENCHMARK */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <LeadSourcePerformanceWidget
          leads={leads}
          onSelectView={onSelectView}
        />

        <SalesmanComparisonWidget
          salesmen={salesmen}
          leads={leads}
          clients={clients}
          followups={followups}
          activities={activities}
          targets={targets}
          onSelectView={onSelectView}
        />
      </div>

      {/* 6. OPERATIONAL VELOCITY: FOLLOW-UP & ACTIVITY PERFORMANCE */}
      <FollowupActivityPerformanceWidget
        followups={followups}
        activities={activities}
        salesmen={salesmen}
        onSelectView={onSelectView}
      />

      {/* 7. CLIENT PORTFOLIO GROWTH & TRANSFER INTELLIGENCE */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ClientGrowthWidget
          clients={clients}
          onSelectView={onSelectView}
        />

        <TransferIntelligenceWidget
          leadTransfers={leadTransfers}
          clientTransfers={clientTransfers}
          activities={activities}
          salesmen={salesmen}
          onSelectView={onSelectView}
        />
      </div>

      {/* 8. SALES CALENDAR & APPOINTMENTS */}
      <DashboardCalendarWidget
        followups={followups}
        allUsers={allUsers}
        onSelectView={onSelectView}
        onSelectLead={onSelectLead}
        onOpenComplete={onOpenCompleteFollowUp}
        onOpenReschedule={onOpenRescheduleFollowUp}
        onOpenSchedule={onOpenScheduleFollowUp}
        isAdmin={true}
      />

      {/* 9. URGENT ATTENTION SECTION & RECENT ACTIVITY FEED */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7">
          <UrgentAttentionSection
            followups={followups}
            leads={leads}
            users={allUsers}
            onSelectLead={onSelectLead}
            onOpenComplete={onOpenCompleteFollowUp}
            onOpenReschedule={onOpenRescheduleFollowUp}
            onViewAllOverdue={() => onSelectView('followups', { followupTab: 'overdue' })}
          />
        </div>

        <div className="lg:col-span-5">
          <RecentActivityFeed
            activities={activities}
            leads={leads}
            users={allUsers}
            onSelectLead={onSelectLead}
            title="CRM Activity Feed"
            maxItems={8}
          />
        </div>
      </div>
    </div>
  );
};
