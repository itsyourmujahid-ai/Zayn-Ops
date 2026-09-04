import React, { useEffect } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  title: string;
  message?: string;
  duration?: number;
}

interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div
      id="toast-notifications-container"
      className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
};

const ToastItem: React.FC<{ toast: ToastMessage; onDismiss: (id: string) => void }> = ({
  toast,
  onDismiss,
}) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss(toast.id);
    }, toast.duration || 4000);

    return () => clearTimeout(timer);
  }, [toast, onDismiss]);

  const bgStyles = {
    success: 'bg-emerald-900/95 text-white border-emerald-700',
    error: 'bg-rose-900/95 text-white border-rose-700',
    info: 'bg-slate-900/95 text-white border-slate-700',
  }[toast.type];

  const Icon = {
    success: CheckCircle2,
    error: AlertCircle,
    info: Info,
  }[toast.type];

  const iconColors = {
    success: 'text-emerald-400',
    error: 'text-rose-400',
    info: 'text-indigo-400',
  }[toast.type];

  return (
    <div
      className={`pointer-events-auto flex items-start gap-3 rounded-xl border p-4 shadow-xl backdrop-blur-md transition-all duration-300 transform translate-y-0 ${bgStyles}`}
      role="alert"
    >
      <Icon className={`h-5 w-5 shrink-0 mt-0.5 ${iconColors}`} />
      <div className="flex-1 min-w-0">
        <h4 className="text-xs font-semibold leading-tight">{toast.title}</h4>
        {toast.message && (
          <p className="mt-1 text-[11px] text-slate-300 leading-snug">{toast.message}</p>
        )}
      </div>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        className="shrink-0 text-slate-400 hover:text-white transition p-1 cursor-pointer"
        aria-label="Close notification"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};
