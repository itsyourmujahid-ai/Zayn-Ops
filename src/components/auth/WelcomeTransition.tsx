import React, { useEffect } from 'react';
import { motion } from 'motion/react';
import { ZaynLogo } from '../common/ZaynLogo';
import { isReducedMotion } from '../../lib/motion';

interface WelcomeTransitionProps {
  fullName: string;
  onComplete: () => void;
  durationMs?: number;
}

export const WelcomeTransition: React.FC<WelcomeTransitionProps> = ({
  fullName,
  onComplete,
  durationMs = 750,
}) => {
  const firstName = fullName ? fullName.split(' ')[0] : 'there';

  useEffect(() => {
    if (isReducedMotion()) {
      onComplete();
      return;
    }

    const timer = setTimeout(() => {
      onComplete();
    }, durationMs);

    return () => clearTimeout(timer);
  }, [durationMs, onComplete]);

  return (
    <motion.div
      key="welcome-transition"
      id="welcome-transition-modal"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{
        opacity: 0,
        y: -6,
        transition: { duration: 0.25, ease: [0.16, 1, 0.3, 1] },
      }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white/95 backdrop-blur-xs select-none"
    >
      <div className="flex flex-col items-center text-center px-4 max-w-sm">
        {/* Subtle Logo Reveal */}
        <motion.div
          initial={{ scale: 0.88, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{
            type: 'spring',
            stiffness: 400,
            damping: 30,
          }}
          className="relative flex items-center justify-center mb-5"
        >
          <div className="absolute inset-0 -m-2 rounded-full bg-emerald-500/10 blur-lg" />
          <ZaynLogo size={60} className="relative drop-shadow-xs" />
        </motion.div>

        {/* Welcome Typography */}
        <motion.h2
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.3 }}
          className="text-xl font-bold tracking-tight text-slate-900"
        >
          Welcome back, {firstName}
        </motion.h2>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25, duration: 0.3 }}
          className="mt-1.5 text-xs text-slate-500"
        >
          Preparing your executive CRM workspace...
        </motion.p>
      </div>
    </motion.div>
  );
};
