import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Check } from 'lucide-react';

export interface LiquidSuccessFeedbackProps {
  show: boolean;
  title: string;
  subtitle?: string;
  onClose?: () => void;
  autoCloseMs?: number;
}

export const LiquidSuccessFeedback: React.FC<LiquidSuccessFeedbackProps> = ({
  show,
  title,
  subtitle,
  onClose,
  autoCloseMs = 1800,
}) => {
  useEffect(() => {
    if (show && onClose && autoCloseMs > 0) {
      const timer = setTimeout(onClose, autoCloseMs);
      return () => clearTimeout(timer);
    }
  }, [show, onClose, autoCloseMs]);

  return (
    <AnimatePresence>
      {show && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none p-4 select-none"
          role="status"
          aria-live="polite"
        >
          {/* Subtle liquid backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-slate-900/10 backdrop-blur-[2px]"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 4 }}
            transition={{ type: 'spring', stiffness: 420, damping: 28, mass: 0.8 }}
            className="relative flex flex-col items-center justify-center rounded-2xl border border-emerald-500/25 bg-white/95 px-7 py-6 text-center shadow-[0_16px_40px_rgba(15,23,42,0.12)] backdrop-blur-md min-w-[240px] max-w-sm pointer-events-auto"
          >
            {/* Animated Liquid Halo */}
            <motion.div
              initial={{ scale: 0, opacity: 0.8 }}
              animate={{ scale: 1.8, opacity: 0 }}
              transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
              className="absolute h-14 w-14 rounded-full bg-[#0CB675]/30 -z-10"
            />

            {/* Icon Container with Drawn Checkmark */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{
                type: 'spring',
                stiffness: 500,
                damping: 24,
                delay: 0.05,
              }}
              className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#0CB675] text-white shadow-[0_4px_12px_rgba(12,182,117,0.35)]"
            >
              <motion.svg
                className="h-6 w-6"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <motion.path
                  d="M 4 12 L 9 17 L 20 6"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.35, delay: 0.15, ease: 'easeOut' }}
                />
              </motion.svg>
            </motion.div>

            <motion.h4
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12, duration: 0.2 }}
              className="text-sm font-bold text-slate-900"
            >
              {title}
            </motion.h4>

            {subtitle && (
              <motion.p
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.18, duration: 0.2 }}
                className="mt-1 text-xs text-slate-600 max-w-[220px]"
              >
                {subtitle}
              </motion.p>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
