import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  Plus,
  Clock,
  MapPin,
  Building2,
  Users,
  AlertCircle,
  CheckCircle2,
  Filter,
  Sparkles,
  Layers,
} from 'lucide-react';
import {
  FollowUpRecord,
  LeadRecord,
  ClientRecord,
  UserProfile,
  CalendarViewMode,
  CalendarFilterState,
  CompleteFollowUpInput,
  RescheduleFollowUpInput,
  CancelFollowUpInput,
} from '../types/database';
import { useAuth } from '../context/AuthContext';
import {
  subscribeToFollowUps,
  subscribeToLeads,
  subscribeToClients,
  subscribeToUsers,
  completeFollowUp,
  rescheduleFollowUp,
  cancelFollowUp,
} from '../lib/dal';
import {
  filterCalendarEvents,
  toDateInputValue,
  toTimeInputValue,
  isSameDay,
} from '../lib/calendarUtils';
import { CalendarHeader } from '../components/calendar/CalendarHeader';
import { MonthView } from '../components/calendar/views/MonthView';
import { WeekView } from '../components/calendar/views/WeekView';
import { DayView } from '../components/calendar/views/DayView';
import { AgendaView } from '../components/calendar/views/AgendaView';
import { TeamCalendarGrid } from '../components/calendar/views/TeamCalendarGrid';
import { ScheduleAppointmentModal } from '../components/calendar/ScheduleAppointmentModal';
import { EventDetailModal } from '../components/calendar/EventDetailModal';
import { CompleteFollowUpModal } from '../components/followups/CompleteFollowUpModal';
import { RescheduleFollowUpModal } from '../components/followups/RescheduleFollowUpModal';
import { CancelFollowUpModal } from '../components/followups/CancelFollowUpModal';

interface CalendarPageProps {
  onSelectLead?: (leadId: string) => void;
  onSelectClient?: (clientId: string) => void;
}

export const CalendarPage: React.FC<CalendarPageProps> = ({
  onSelectLead,
  onSelectClient,
}) => {
  const { userProfile, isAdmin } = useAuth();

  // Determine initial view mode based on viewport width: Week on desktop, Day/Agenda on mobile
  const [viewMode, setViewMode] = useState<CalendarViewMode>(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      return 'agenda';
    }
    return 'week';
  });

  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [isTeamMode, setIsTeamMode] = useState<boolean>(false);

  // Raw Database Data
  const [allEvents, setAllEvents] = useState<FollowUpRecord[]>([]);
  const [leads, setLeads] = useState<LeadRecord[]>([]);
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Filters State
  const [filters, setFilters] = useState<CalendarFilterState>({
    eventType: 'all',
    status: 'all',
    recordType: 'all',
    salesmanId: 'all',
    searchQuery: '',
  });

  // Modals State
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState<boolean>(false);
  const [scheduleModalInitial, setScheduleModalInitial] = useState<{
    date?: string;
    time?: string;
    salesmanId?: string;
  }>({});

  const [selectedEventForDetail, setSelectedEventForDetail] = useState<FollowUpRecord | null>(null);
  const [selectedForComplete, setSelectedForComplete] = useState<FollowUpRecord | null>(null);
  const [selectedForReschedule, setSelectedForReschedule] = useState<FollowUpRecord | null>(null);
  const [selectedForCancel, setSelectedForCancel] = useState<FollowUpRecord | null>(null);

  // Toast / Notification Banner
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Subscriptions
  useEffect(() => {
    const unsubFollowUps = subscribeToFollowUps(
      (list) => {
        setAllEvents(list);
        setLoading(false);
      },
      userProfile?.role,
      (err) => {
        console.warn('Calendar FollowUps subscription error:', err);
        setLoading(false);
      }
    );

    const unsubLeads = subscribeToLeads((leadList) => {
      setLeads(leadList);
    }, userProfile?.role);

    const unsubClients = subscribeToClients((clientList) => {
      setClients(clientList);
    }, userProfile?.role);

    const unsubUsers = subscribeToUsers((userList) => {
      setUsers(userList);
    });

    return () => {
      unsubFollowUps();
      unsubLeads();
      unsubClients();
      unsubUsers();
    };
  }, [userProfile?.role]);

  // Keep detail modal synced with updated event record if modified
  useEffect(() => {
    if (selectedEventForDetail) {
      const fresh = allEvents.find((e) => e.id === selectedEventForDetail.id);
      if (fresh) {
        setSelectedEventForDetail(fresh);
      }
    }
  }, [allEvents]);

  // Filtered Events
  const filteredEvents = useMemo(() => {
    return filterCalendarEvents(allEvents, filters);
  }, [allEvents, filters]);

  // Navigation handlers
  const handleNavigatePrev = () => {
    const d = new Date(currentDate);
    if (viewMode === 'month') {
      d.setMonth(d.getMonth() - 1);
    } else if (viewMode === 'week') {
      d.setDate(d.getDate() - 7);
    } else if (viewMode === 'day') {
      d.setDate(d.getDate() - 1);
    } else {
      d.setMonth(d.getMonth() - 1);
    }
    setCurrentDate(d);
  };

  const handleNavigateNext = () => {
    const d = new Date(currentDate);
    if (viewMode === 'month') {
      d.setMonth(d.getMonth() + 1);
    } else if (viewMode === 'week') {
      d.setDate(d.getDate() + 7);
    } else if (viewMode === 'day') {
      d.setDate(d.getDate() + 1);
    } else {
      d.setMonth(d.getMonth() + 1);
    }
    setCurrentDate(d);
  };

  const handleNavigateToday = () => {
    setCurrentDate(new Date());
  };

  const handleFilterChange = (key: keyof CalendarFilterState, value: any) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  // Quick Slot click to Schedule
  const handleSelectSlot = (date: Date, timeStr: string, salesmanId?: string) => {
    setScheduleModalInitial({
      date: toDateInputValue(date),
      time: timeStr,
      salesmanId,
    });
    setIsScheduleModalOpen(true);
  };

  const handleSelectDateFromMonth = (date: Date) => {
    setCurrentDate(date);
    setViewMode('day');
  };

  // Workflow Handlers
  const handleCompleteSuccess = async (input: CompleteFollowUpInput) => {
    try {
      await completeFollowUp(input);
      setSelectedForComplete(null);
      showToast('Appointment completed successfully.');
    } catch (e: any) {
      console.error('Failed to complete follow up:', e);
      showToast('Error completing appointment: ' + (e.message || 'Unknown error'));
    }
  };

  const handleRescheduleSuccess = async (input: RescheduleFollowUpInput) => {
    try {
      await rescheduleFollowUp(input);
      setSelectedForReschedule(null);
      showToast('Appointment rescheduled to new time slot.');
    } catch (e: any) {
      console.error('Failed to reschedule follow up:', e);
      showToast('Error rescheduling appointment: ' + (e.message || 'Unknown error'));
    }
  };

  const handleCancelSuccess = async (input: CancelFollowUpInput) => {
    try {
      await cancelFollowUp(input);
      setSelectedForCancel(null);
      showToast('Appointment cancelled.');
    } catch (e: any) {
      console.error('Failed to cancel follow up:', e);
      showToast('Error cancelling appointment: ' + (e.message || 'Unknown error'));
    }
  };

  return (
    <div id="sales-calendar-page" className="space-y-4 pb-12">
      {/* Toast Banner */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-2xl bg-slate-900 text-white px-4 py-3 shadow-xl text-xs font-semibold animate-in fade-in slide-in-from-bottom-3 duration-200">
          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Page Title & Subtitle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-xs">
              <CalendarIcon className="h-5 w-5" />
            </div>
            <span>Sales Calendar</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Real-time appointment schedule, customer meetings, site visits, and conflict management
          </p>
        </div>
      </div>

      {/* Calendar Navigation & Filters Header */}
      <CalendarHeader
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        currentDate={currentDate}
        onNavigatePrev={handleNavigatePrev}
        onNavigateToday={handleNavigateToday}
        onNavigateNext={handleNavigateNext}
        filters={filters}
        onFilterChange={handleFilterChange}
        salesmen={users}
        onOpenSchedule={() => {
          setScheduleModalInitial({});
          setIsScheduleModalOpen(true);
        }}
        isTeamMode={isTeamMode}
        onToggleTeamMode={setIsTeamMode}
        totalEventsCount={filteredEvents.length}
      />

      {/* Calendar View Body */}
      {loading ? (
        <div className="flex items-center justify-center rounded-2xl border border-slate-200 bg-white p-16 shadow-2xs">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-3 border-indigo-600 border-t-transparent" />
            <span className="text-xs font-semibold text-slate-500">
              Loading calendar bookings...
            </span>
          </div>
        </div>
      ) : isTeamMode && isAdmin ? (
        <TeamCalendarGrid
          currentDate={currentDate}
          events={filteredEvents}
          salesmen={users}
          onSelectEvent={setSelectedEventForDetail}
          onSelectSlot={handleSelectSlot}
        />
      ) : viewMode === 'month' ? (
        <MonthView
          currentDate={currentDate}
          events={filteredEvents}
          onSelectEvent={setSelectedEventForDetail}
          onSelectDate={handleSelectDateFromMonth}
        />
      ) : viewMode === 'week' ? (
        <WeekView
          currentDate={currentDate}
          events={filteredEvents}
          onSelectEvent={setSelectedEventForDetail}
          onSelectSlot={handleSelectSlot}
        />
      ) : viewMode === 'day' ? (
        <DayView
          currentDate={currentDate}
          events={filteredEvents}
          onSelectEvent={setSelectedEventForDetail}
          onSelectSlot={handleSelectSlot}
          onOpenComplete={(e) => setSelectedForComplete(e)}
          onOpenReschedule={(e) => setSelectedForReschedule(e)}
        />
      ) : (
        <AgendaView
          events={filteredEvents}
          onSelectEvent={setSelectedEventForDetail}
          onOpenComplete={(e) => setSelectedForComplete(e)}
          onOpenReschedule={(e) => setSelectedForReschedule(e)}
          onOpenCancel={(e) => setSelectedForCancel(e)}
          onNavigateToLead={onSelectLead}
          onNavigateToClient={onSelectClient}
        />
      )}

      {/* Schedule Appointment Modal */}
      <ScheduleAppointmentModal
        isOpen={isScheduleModalOpen}
        onClose={() => setIsScheduleModalOpen(false)}
        onSuccess={(newRecord) => {
          showToast(`Scheduled "${newRecord.title || newRecord.action}" successfully.`);
        }}
        allLeads={leads}
        allClients={clients}
        allUsers={users}
        allEvents={allEvents}
        initialDate={scheduleModalInitial.date}
        initialTime={scheduleModalInitial.time}
      />

      {/* Event Detail Modal */}
      <EventDetailModal
        isOpen={!!selectedEventForDetail}
        event={selectedEventForDetail}
        onClose={() => setSelectedEventForDetail(null)}
        onOpenComplete={(e) => setSelectedForComplete(e)}
        onOpenReschedule={(e) => setSelectedForReschedule(e)}
        onOpenCancel={(e) => setSelectedForCancel(e)}
        onNavigateToLead={onSelectLead}
        onNavigateToClient={onSelectClient}
      />

      {/* Complete Modal */}
      <CompleteFollowUpModal
        isOpen={!!selectedForComplete}
        followUp={selectedForComplete}
        onClose={() => setSelectedForComplete(null)}
        onComplete={handleCompleteSuccess}
      />

      {/* Reschedule Modal */}
      <RescheduleFollowUpModal
        isOpen={!!selectedForReschedule}
        followUp={selectedForReschedule}
        onClose={() => setSelectedForReschedule(null)}
        onReschedule={handleRescheduleSuccess}
      />

      {/* Cancel Modal */}
      <CancelFollowUpModal
        isOpen={!!selectedForCancel}
        followUp={selectedForCancel}
        onClose={() => setSelectedForCancel(null)}
        onCancelFollowUp={handleCancelSuccess}
      />
    </div>
  );
};
