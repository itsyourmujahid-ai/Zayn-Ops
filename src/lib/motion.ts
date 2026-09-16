/**
 * ZaynOps Premium Motion System
 * Centralized motion tokens, spring physics, and transition curves.
 * Respects user's prefers-reduced-motion accessibility preference.
 */

export const isReducedMotion = (): boolean => {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};

// Standardized Spring Easing Curves for Physical/Liquid UI
export const liquidSpring = {
  type: 'spring' as const,
  stiffness: 420,
  damping: 32,
  mass: 0.8,
};

export const gentleSpring = {
  type: 'spring' as const,
  stiffness: 300,
  damping: 28,
  mass: 0.9,
};

export const snappySpring = {
  type: 'spring' as const,
  stiffness: 500,
  damping: 35,
};

// Timing curves
export const easeOutQuad = [0.25, 1, 0.5, 1] as const;
export const easeInOutCubic = [0.65, 0, 0.35, 1] as const;

// Page Transitions
export const pageMotionVariants = {
  initial: {
    opacity: 0,
    y: 6,
  },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.22,
      ease: [0.16, 1, 0.3, 1],
    },
  },
  exit: {
    opacity: 0,
    y: -4,
    transition: {
      duration: 0.15,
      ease: [0.4, 0, 1, 1],
    },
  },
};

// Dialog & Modal Transitions
export const modalBackdropVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.18 } },
  exit: { opacity: 0, transition: { duration: 0.14 } },
};

export const modalContentVariants = {
  initial: { opacity: 0, scale: 0.97, y: 8 },
  animate: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      type: 'spring' as const,
      stiffness: 380,
      damping: 28,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.97,
    y: 6,
    transition: { duration: 0.14 },
  },
};

// Dropdown & Popover Transitions
export const dropdownVariants = {
  initial: { opacity: 0, y: -4, scale: 0.98 },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.15,
      ease: [0.16, 1, 0.3, 1],
    },
  },
  exit: {
    opacity: 0,
    y: -4,
    scale: 0.98,
    transition: { duration: 0.1 },
  },
};

// Stagger list container
export const staggerContainerVariants = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.04,
      delayChildren: 0.02,
    },
  },
};

export const staggerItemVariants = {
  initial: { opacity: 0, y: 8 },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.2,
      ease: [0.16, 1, 0.3, 1],
    },
  },
};
