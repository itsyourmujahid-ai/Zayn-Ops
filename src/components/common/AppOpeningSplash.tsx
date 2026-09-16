import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ZaynLogo } from './ZaynLogo';
import { isReducedMotion } from '../../lib/motion';

interface AppOpeningSplashProps {
  isReady: boolean;
  onFinish?: () => void;
  children: React.ReactNode;
}

export const AppOpeningSplash: React.FC<AppOpeningSplashProps> = ({
  isReady,
  onFinish,
  children,
}) => {
  const [showSplash, setShowSplash] = useState<boolean>(() => {
    // Only show opening splash once per session or on cold load
    if (typeof window !== 'undefined') {
      const alreadyShown = sessionStorage.getItem('zaynops_splash_shown');
      if (alreadyShown) return false;
    }
    return true;
  });

  useEffect(() => {
    if (!showSplash) return;

    // If reduced motion is requested, dismiss immediately
    if (isReducedMotion()) {
      setShowSplash(false);
      sessionStorage.setItem('zaynops_splash_shown', 'true');
      if (onFinish) onFinish();
      return;
    }

    // Minimum elegant dwell time: 750ms so user sees the fluid brand reveal
    const timer = setTimeout(() => {
      setShowSplash(false);
      sessionStorage.setItem('zaynops_splash_shown', 'true');
      if (onFinish) onFinish();
    }, 850);

    return () => clearTimeout(timer);
  }, [showSplash, isReady, onFinish]);

  return (
    <>
      <AnimatePresence mode="wait">
        {showSplash && (
          <motion.div
            key="zaynops-app-opening-splash"
            id="app-opening-splash"
            initial={{ opacity: 1 }}
            exit={{
              opacity: 0,
              scale: 1.02,
              transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] },
            }}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#F8FAFC] select-none"
          >
            <div className="flex flex-col items-center">
              {/* Fluid Logo Reveal */}
              <motion.div
                initial={{ opacity: 0, scale: 0.88, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{
                  duration: 0.5,
                  ease: [0.16, 1, 0.3, 1],
                }}
                className="relative flex items-center justify-center"
              >
                <div className="absolute inset-0 -m-3 rounded-full bg-emerald-500/10 blur-xl animate-pulse" />
                <ZaynLogo size={72} className="relative drop-shadow-xs" />
              </motion.div>

              {/* Brand Typography & Subtitle */}
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  delay: 0.2,
                  duration: 0.4,
                  ease: [0.16, 1, 0.3, 1],
                }}
                className="mt-4 flex flex-col items-center"
              >
                <div className="flex items-center gap-1.5">
                  <span className="text-xl font-bold tracking-tight text-slate-900">
                    ZaynOps
                  </span>
                  <span className="h-1.5 w-1.5 rounded-full bg-[#0CB675]" />
                </div>
                <span className="mt-1 text-xs font-medium text-slate-500 tracking-wide">
                  Enterprise Commercial Suite
                </span>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        initial={showSplash ? { opacity: 0 } : false}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.25, delay: 0.05 }}
        className="w-full h-full min-h-screen"
      >
        {children}
      </motion.div>
    </>
  );
};
