import React from 'react';
import { Phone, MessageSquare, Mail, X, CheckCircle2, ArrowRight } from 'lucide-react';
import { ActivityType } from '../../types/database';

interface QuickContactPromptProps {
  isOpen: boolean;
  onClose: () => void;
  contactType: ActivityType; // 'Call' | 'WhatsApp' | 'Email'
  companyName: string;
  contactPerson: string;
  onConfirmLog: (type: ActivityType) => void;
}

export const QuickContactPrompt: React.FC<QuickContactPromptProps> = ({
  isOpen,
  onClose,
  contactType,
  companyName,
  contactPerson,
  onConfirmLog,
}) => {
  if (!isOpen) return null;

  const getIcon = () => {
    switch (contactType) {
      case 'Call':
        return <Phone className="h-6 w-6 text-indigo-600" />;
      case 'WhatsApp':
        return <MessageSquare className="h-6 w-6 text-emerald-600" />;
      case 'Email':
        return <Mail className="h-6 w-6 text-blue-600" />;
      default:
        return <CheckCircle2 className="h-6 w-6 text-indigo-600" />;
    }
  };

  const getBgColor = () => {
    switch (contactType) {
      case 'Call':
        return 'bg-indigo-50 border-indigo-100';
      case 'WhatsApp':
        return 'bg-emerald-50 border-emerald-100';
      case 'Email':
        return 'bg-blue-50 border-blue-100';
      default:
        return 'bg-slate-50 border-slate-100';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 p-3 sm:p-4 backdrop-blur-xs">
      <div className="relative w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl border border-slate-200 animate-in fade-in slide-in-from-bottom-6 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-start gap-3.5">
          <div className={`rounded-xl p-3 border ${getBgColor()} shrink-0`}>
            {getIcon()}
          </div>
          <div className="pr-6">
            <h4 className="text-sm font-bold text-slate-900">
              Log this {contactType}?
            </h4>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              Would you like to record notes and outcomes from your {contactType.toLowerCase()} with{' '}
              <strong className="text-slate-800">{contactPerson || companyName}</strong>?
            </p>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
          >
            Not Now
          </button>
          <button
            type="button"
            onClick={() => {
              onClose();
              onConfirmLog(contactType);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 transition cursor-pointer"
          >
            <span>Yes, Log Activity</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
