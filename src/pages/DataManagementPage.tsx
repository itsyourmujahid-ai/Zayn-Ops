import React, { useState, useEffect } from 'react';
import {
  UploadCloud,
  Download,
  History,
  ShieldCheck,
  AlertTriangle,
  Database,
  ArrowDownUp,
  FileSpreadsheet,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  subscribeToLeads,
  subscribeToClients,
  subscribeToAllActivities,
  subscribeToFollowUps,
  getAllUsers,
  recordSecurityAuditLog,
} from '../lib/dal';
import {
  LeadRecord,
  ClientRecord,
  LeadActivityRecord,
  FollowUpRecord,
  UserProfile,
} from '../types/database';
import { ImportWizard } from '../components/dataManagement/ImportWizard';
import { ExportCenter } from '../components/dataManagement/ExportCenter';
import { ImportHistory } from '../components/dataManagement/ImportHistory';

interface DataManagementPageProps {
  onNavigateToLead?: (leadId: string) => void;
  onNavigateToClient?: (clientId: string) => void;
  onNavigateToLeads?: () => void;
  onNavigateToClients?: () => void;
}

type ActiveTab = 'import' | 'export' | 'history';

export const DataManagementPage: React.FC<DataManagementPageProps> = ({
  onNavigateToLead,
  onNavigateToClient,
  onNavigateToLeads,
  onNavigateToClients,
}) => {
  const { currentUser, userProfile } = useAuth();
  const { addToast } = useToast();

  const [activeTab, setActiveTab] = useState<ActiveTab>('import');

  // Real-time data streams
  const [leads, setLeads] = useState<LeadRecord[]>([]);
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [activities, setActivities] = useState<LeadActivityRecord[]>([]);
  const [followups, setFollowups] = useState<FollowUpRecord[]>([]);
  const [teamUsers, setTeamUsers] = useState<UserProfile[]>([]);

  const isSuperAdmin = userProfile?.role === 'SUPER_ADMIN';
  const isCompanyAdmin = userProfile?.role === 'ADMIN' || userProfile?.role === 'admin';
  const isAuthorizedSalesman = userProfile?.role === 'SALESMAN' && userProfile?.permissions?.includes('IMPORT_CREATE' as any);
  const canAccessImport = isCompanyAdmin || isAuthorizedSalesman;

  const effectiveCompanyId = userProfile?.company_id || 'company-bahwan-mge';

  // 1. RBAC Guard: If not admin, block and log
  useEffect(() => {
    if (userProfile && !canAccessImport && !isSuperAdmin) {
      addToast(
        'error',
        'Access Denied',
        'Company Administrator privileges are required to access Data Import tools.'
      );
      recordSecurityAuditLog({
        action: 'security_unauthorized_action',
        description: `Security Notice: Unauthorized user ${userProfile.full_name} (${currentUser?.email}) attempted to access /data-management.`,
        metadata: { attempted_url: '/data-management', user_role: userProfile.role, status: 'BLOCKED' },
      });
    }
  }, [userProfile, canAccessImport, isSuperAdmin, currentUser?.email, addToast]);

  // Subscribe to CRM data for validation and export
  useEffect(() => {
    if (!canAccessImport) return;

    getAllUsers()
      .then((users) => setTeamUsers(users))
      .catch((err) => console.warn('Failed to load users for data management:', err));

    const unsubLeads = subscribeToLeads((list) => setLeads(list), 'ADMIN');
    const unsubClients = subscribeToClients((list) => setClients(list), 'ADMIN');
    const unsubActs = subscribeToAllActivities((list) => setActivities(list));
    const unsubFu = subscribeToFollowUps((list) => setFollowups(list), 'ADMIN');

    return () => {
      unsubLeads();
      unsubClients();
      unsubActs();
      unsubFu();
    };
  }, [canAccessImport]);

  if (isSuperAdmin) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-4">
        <div className="max-w-lg text-center rounded-2xl border border-amber-200 bg-white p-8 shadow-xs space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
            <ShieldCheck className="h-7 w-7" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">Tenant Data Isolation Policy</h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            Super Administrators oversee platform infrastructure and company provisioning. To strictly maintain tenant segregation and client confidentiality, proprietary business data imports and CRM customer migrations must be executed directly by an authorized <strong>Company Administrator</strong> within that company's workspace.
          </p>
          <div className="pt-2 text-[11px] text-slate-400 font-mono">
            Security Policy: Multi-Tenant Compliance v2.4
          </div>
        </div>
      </div>
    );
  }

  if (!canAccessImport) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-4">
        <div className="max-w-md text-center rounded-2xl border border-rose-200 bg-white p-8 shadow-xs space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
            <ShieldCheck className="h-7 w-7" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">Administrator Access Required</h2>
          <p className="text-xs text-slate-500 leading-relaxed">
            Data Management and customer migrations are restricted to authorized Company Administrators. Sales representatives cannot perform bulk imports without explicit administrative permissions.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-[11px] font-bold text-indigo-700 uppercase tracking-wider">
              Admin Console
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-xs text-slate-500 font-medium">Phase V Module</span>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">Data Management</h1>
          <p className="mt-0.5 text-xs text-slate-500">
            CSV &amp; Excel import, structured CRM export, duplicate protection, and batch validation.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-2xs">
          <button
            type="button"
            onClick={() => setActiveTab('import')}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition cursor-pointer ${
              activeTab === 'import'
                ? 'bg-indigo-600 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <UploadCloud className="h-4 w-4" />
            <span>Import Data</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('export')}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition cursor-pointer ${
              activeTab === 'export'
                ? 'bg-indigo-600 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Download className="h-4 w-4" />
            <span>Export Data</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition cursor-pointer ${
              activeTab === 'history'
                ? 'bg-indigo-600 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <History className="h-4 w-4" />
            <span>Import History</span>
          </button>
        </div>
      </div>

      {/* Active Tab View */}
      {activeTab === 'import' && (
        <ImportWizard
          existingLeads={leads}
          existingClients={clients}
          teamUsers={teamUsers}
          effectiveCompanyId={effectiveCompanyId}
          onImportComplete={() => {
            // Refresh counts or trigger notifications
          }}
          onNavigateToLeads={onNavigateToLeads}
          onNavigateToClients={onNavigateToClients}
          onNavigateToHistory={() => setActiveTab('history')}
        />
      )}

      {activeTab === 'export' && (
        <ExportCenter
          leads={leads}
          clients={clients}
          activities={activities}
          followups={followups}
          teamUsers={teamUsers}
        />
      )}

      {activeTab === 'history' && <ImportHistory />}
    </div>
  );
};
