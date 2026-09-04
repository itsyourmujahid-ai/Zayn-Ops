import React, { useState, useEffect } from 'react';
import {
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  FileSpreadsheet,
  Download,
  Eye,
  RefreshCw,
} from 'lucide-react';
import { ImportJobRecord } from '../../types/dataManagement';
import { subscribeToImportJobs } from '../../lib/dal';
import { downloadErrorReport } from '../../lib/importTemplates';

export const ImportHistory: React.FC = () => {
  const [jobs, setJobs] = useState<ImportJobRecord[]>([]);
  const [selectedJob, setSelectedJob] = useState<ImportJobRecord | null>(null);

  useEffect(() => {
    const unsub = subscribeToImportJobs((list) => {
      setJobs(list);
    });
    return () => unsub();
  }, []);

  const getStatusBadge = (status: ImportJobRecord['status']) => {
    switch (status) {
      case 'Completed':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
            <CheckCircle2 className="h-3 w-3" />
            Completed
          </span>
        );
      case 'Completed With Errors':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">
            <AlertTriangle className="h-3 w-3" />
            With Errors
          </span>
        );
      case 'Failed':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700">
            <XCircle className="h-3 w-3" />
            Failed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700 animate-pulse">
            <RefreshCw className="h-3 w-3 animate-spin" />
            Processing
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
        <div className="border-b border-slate-100 p-4 bg-slate-50/50 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Historical Import Logs</h3>
            <p className="text-xs text-slate-500">
              Audit records of all CSV and Excel import operations processed in the CRM.
            </p>
          </div>
          <span className="text-xs font-semibold text-slate-400">
            {jobs.length} total jobs logged
          </span>
        </div>

        {jobs.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <FileSpreadsheet className="mx-auto h-10 w-10 text-slate-300 mb-2" />
            <p className="text-xs font-medium">No previous import jobs recorded yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Job ID / File</th>
                  <th className="py-3 px-4">Entity Type</th>
                  <th className="py-3 px-4">Initiated By</th>
                  <th className="py-3 px-4">Date &amp; Time</th>
                  <th className="py-3 px-4 text-center">Total</th>
                  <th className="py-3 px-4 text-center">Created</th>
                  <th className="py-3 px-4 text-center">Updated</th>
                  <th className="py-3 px-4 text-center">Skipped</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {jobs.map((job) => (
                  <tr key={job.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900 truncate max-w-xs">{job.file_name}</div>
                      <div className="font-mono text-[10px] text-slate-400">{job.id}</div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="capitalize font-semibold text-slate-700">{job.import_type}</span>
                    </td>
                    <td className="py-3 px-4 text-slate-600">{job.initiated_by_name || 'Administrator'}</td>
                    <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                      {job.started_at ? new Date(job.started_at).toLocaleString() : '—'}
                    </td>
                    <td className="py-3 px-4 text-center font-bold text-slate-800">{job.total_rows}</td>
                    <td className="py-3 px-4 text-center font-bold text-emerald-600">{job.created_count}</td>
                    <td className="py-3 px-4 text-center font-bold text-indigo-600">{job.updated_count}</td>
                    <td className="py-3 px-4 text-center font-bold text-slate-400">{job.skipped_count}</td>
                    <td className="py-3 px-4 whitespace-nowrap">{getStatusBadge(job.status)}</td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        {job.error_details && job.error_details.length > 0 && (
                          <button
                            type="button"
                            onClick={() => downloadErrorReport(job.error_details || [], job.import_type)}
                            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 transition"
                            title="Download Error Log"
                          >
                            <Download className="h-3 w-3 text-slate-500" />
                            Log
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setSelectedJob(job)}
                          className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 transition"
                        >
                          <Eye className="h-3 w-3 text-slate-500" />
                          Details
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* JOB DETAILS MODAL */}
      {selectedJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Import Job Overview</h3>
                <p className="text-xs text-slate-500">{selectedJob.file_name} • {selectedJob.id}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedJob(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 transition"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                <div className="text-[10px] text-slate-400 uppercase font-bold">Total</div>
                <div className="text-lg font-bold text-slate-800">{selectedJob.total_rows}</div>
              </div>
              <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-3">
                <div className="text-[10px] text-emerald-600 uppercase font-bold">Created</div>
                <div className="text-lg font-bold text-emerald-700">{selectedJob.created_count}</div>
              </div>
              <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-3">
                <div className="text-[10px] text-indigo-600 uppercase font-bold">Updated</div>
                <div className="text-lg font-bold text-indigo-700">{selectedJob.updated_count}</div>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                <div className="text-[10px] text-slate-400 uppercase font-bold">Skipped</div>
                <div className="text-lg font-bold text-slate-600">{selectedJob.skipped_count}</div>
              </div>
            </div>

            {selectedJob.error_details && selectedJob.error_details.length > 0 ? (
              <div className="flex-1 overflow-auto border border-slate-200 rounded-lg p-3 space-y-2">
                <h4 className="text-xs font-bold text-rose-700">
                  Recorded Row Errors &amp; Suggestions ({selectedJob.error_details.length})
                </h4>
                <div className="space-y-1.5 text-xs text-slate-600">
                  {selectedJob.error_details.map((err, i) => (
                    <div key={i} className="rounded-md border border-rose-100 bg-rose-50/30 p-2">
                      <div className="font-semibold text-rose-800">
                        Row {err.rowNumber}: {err.problem}
                      </div>
                      {err.suggestedCorrection && (
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          Correction: {err.suggestedCorrection}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-6 text-center text-xs text-slate-500">
                No row-level errors were encountered during this import job.
              </div>
            )}

            <div className="flex items-center justify-between border-t border-slate-100 pt-3">
              <span className="text-xs text-slate-400">
                Processed with safe Firestore write batches
              </span>
              <button
                type="button"
                onClick={() => setSelectedJob(null)}
                className="rounded-lg bg-slate-900 px-4 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
