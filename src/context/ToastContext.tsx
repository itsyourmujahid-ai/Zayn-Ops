import React, { createContext, useContext, useState, useCallback } from 'react';
import { ToastContainer, ToastMessage } from '../components/common/Toast';

export interface ToastContextType {
  toasts: ToastMessage[];
  addToast: (
    type: 'success' | 'error' | 'info',
    title: string,
    message?: string,
    duration?: number
  ) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    (
      type: 'success' | 'error' | 'info',
      title: string,
      message?: string,
      duration?: number
    ) => {
      const id = 'toast_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
      setToasts((prev) => [...prev, { id, type, title, message, duration }]);
    },
    []
  );

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextType => {
  const context = useContext(ToastContext);
  if (!context) {
    // Return graceful fallback if used outside provider
    return {
      toasts: [],
      addToast: (type, title, message) => {
        console.log(`[Toast ${type}] ${title}: ${message || ''}`);
      },
      removeToast: () => {},
    };
  }
  return context;
};
