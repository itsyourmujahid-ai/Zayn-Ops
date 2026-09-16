import React, { useRef, useState, useCallback } from 'react';
import { motion, HTMLMotionProps } from 'motion/react';

export type LiquidButtonVariant = 'primary' | 'dark' | 'secondary' | 'ghost' | 'danger' | 'icon';
export type LiquidButtonSize = 'sm' | 'md' | 'lg' | 'icon';

export interface LiquidButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: LiquidButtonVariant;
  size?: LiquidButtonSize;
  isLoading?: boolean;
  children?: React.ReactNode;
  activeScale?: number;
}

interface RippleState {
  id: number;
  x: number;
  y: number;
  size: number;
}

export const LiquidButton = React.forwardRef<HTMLButtonElement, LiquidButtonProps>(
  (
    {
      variant = 'secondary',
      size = 'md',
      isLoading = false,
      disabled = false,
      className = '',
      children,
      onClick,
      onMouseMove,
      onMouseEnter,
      onMouseLeave,
      activeScale = 0.97,
      type = 'button',
      ...props
    },
    forwardedRef
  ) => {
    const internalRef = useRef<HTMLButtonElement>(null);
    const buttonRef = (forwardedRef as React.RefObject<HTMLButtonElement>) || internalRef;
    const [ripples, setRipples] = useState<RippleState[]>([]);
    const nextRippleId = useRef(0);

    // Mouse tracking for fluid highlight
    const handleMouseMove = useCallback(
      (e: React.MouseEvent<HTMLButtonElement>) => {
        if (disabled || isLoading) return;
        const btn = buttonRef.current;
        if (btn) {
          const rect = btn.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const y = e.clientY - rect.top;
          btn.style.setProperty('--liquid-x', `${x}px`);
          btn.style.setProperty('--liquid-y', `${y}px`);
          btn.style.setProperty('--liquid-opacity', '1');
        }
        onMouseMove?.(e);
      },
      [buttonRef, disabled, isLoading, onMouseMove]
    );

    const handleMouseEnter = useCallback(
      (e: React.MouseEvent<HTMLButtonElement>) => {
        if (disabled || isLoading) return;
        const btn = buttonRef.current;
        if (btn) {
          btn.style.setProperty('--liquid-opacity', '1');
        }
        onMouseEnter?.(e);
      },
      [buttonRef, disabled, isLoading, onMouseEnter]
    );

    const handleMouseLeave = useCallback(
      (e: React.MouseEvent<HTMLButtonElement>) => {
        const btn = buttonRef.current;
        if (btn) {
          btn.style.setProperty('--liquid-opacity', '0');
        }
        onMouseLeave?.(e);
      },
      [buttonRef, onMouseLeave]
    );

    // Click physical ripple trigger
    const handleClick = useCallback(
      (e: React.MouseEvent<HTMLButtonElement>) => {
        if (disabled || isLoading) return;
        const btn = buttonRef.current;
        if (btn) {
          const rect = btn.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const y = e.clientY - rect.top;
          const rippleSize = Math.max(rect.width, rect.height) * 2;

          const newRipple: RippleState = {
            id: nextRippleId.current++,
            x,
            y,
            size: rippleSize,
          };

          setRipples((prev) => [...prev.slice(-3), newRipple]);

          // Auto-clean ripple after animation ends
          setTimeout(() => {
            setRipples((prev) => prev.filter((r) => r.id !== newRipple.id));
          }, 450);
        }
        onClick?.(e);
      },
      [buttonRef, disabled, isLoading, onClick]
    );

    // Variant style definitions
    const getVariantClasses = () => {
      switch (variant) {
        case 'primary':
          return 'bg-[#0CB675] hover:bg-[#0aa368] text-white font-semibold border border-emerald-600/30 shadow-[0_1px_3px_rgba(12,182,117,0.25)] hover:shadow-[0_4px_12px_rgba(12,182,117,0.3)] text-white';
        case 'dark':
          return 'bg-[#0F172A] hover:bg-[#1E293B] text-white font-semibold border border-[#1E293B] shadow-[0_1px_3px_rgba(15,23,42,0.15)] hover:shadow-[0_4px_12px_rgba(15,23,42,0.25)] text-white';
        case 'secondary':
          return 'bg-white hover:bg-slate-50 text-slate-900 font-medium border border-slate-200/90 shadow-2xs hover:border-slate-300 hover:shadow-xs';
        case 'ghost':
          return 'bg-transparent hover:bg-slate-100/70 text-slate-700 hover:text-slate-900 border border-transparent';
        case 'danger':
          return 'bg-rose-600 hover:bg-rose-700 text-white font-semibold border border-rose-700/30 shadow-xs hover:shadow-sm';
        case 'icon':
          return 'bg-transparent hover:bg-slate-100/80 text-slate-600 hover:text-slate-900 border border-transparent rounded-lg';
        default:
          return 'bg-white text-slate-800 border border-slate-200';
      }
    };

    const getSizeClasses = () => {
      switch (size) {
        case 'sm':
          return 'px-2.5 py-1 text-xs rounded-lg gap-1.5 min-h-[28px]';
        case 'md':
          return 'px-3.5 py-2 text-xs font-semibold rounded-lg gap-2 min-h-[36px]';
        case 'lg':
          return 'px-4 py-2.5 text-sm font-semibold rounded-xl gap-2.5 min-h-[42px]';
        case 'icon':
          return 'p-1.5 rounded-lg flex items-center justify-center min-w-[32px] min-h-[32px]';
        default:
          return 'px-3 py-1.5 text-xs rounded-lg';
      }
    };

    const getRippleColor = () => {
      switch (variant) {
        case 'primary':
          return 'bg-white/35';
        case 'dark':
          return 'bg-white/25';
        case 'danger':
          return 'bg-white/30';
        case 'secondary':
          return 'bg-[#0CB675]/20';
        default:
          return 'bg-slate-400/20';
      }
    };

    const getLiquidHighlightGradient = () => {
      switch (variant) {
        case 'primary':
          return 'radial-gradient(circle, rgba(255, 255, 255, 0.35) 0%, rgba(255, 255, 255, 0.08) 50%, transparent 75%)';
        case 'dark':
          return 'radial-gradient(circle, rgba(255, 255, 255, 0.22) 0%, rgba(255, 255, 255, 0.04) 50%, transparent 75%)';
        case 'secondary':
          return 'radial-gradient(circle, rgba(12, 182, 117, 0.16) 0%, rgba(12, 182, 117, 0.02) 50%, transparent 75%)';
        case 'danger':
          return 'radial-gradient(circle, rgba(255, 255, 255, 0.3) 0%, rgba(255, 255, 255, 0.05) 50%, transparent 75%)';
        default:
          return 'radial-gradient(circle, rgba(12, 182, 117, 0.12) 0%, transparent 70%)';
      }
    };

    return (
      <button
        ref={buttonRef}
        type={type}
        disabled={disabled || isLoading}
        onClick={handleClick}
        onMouseMove={handleMouseMove}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={`liquid-button relative inline-flex items-center justify-center select-none overflow-hidden transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.975] will-change-transform ${getVariantClasses()} ${getSizeClasses()} ${className}`}
        style={{
          contain: 'paint',
          ...props.style,
        }}
        {...props}
      >
        {/* Layer 1: Cursor-Following Fluid Sheen / Highlight */}
        <span
          className="liquid-highlight pointer-events-none absolute -top-[60px] -left-[60px] w-[120px] h-[120px] rounded-full will-change-transform transition-opacity duration-300"
          style={{
            transform: 'translate3d(var(--liquid-x, -100px), var(--liquid-y, -100px), 0) translate(-50%, -50%)',
            background: getLiquidHighlightGradient(),
            opacity: 'var(--liquid-opacity, 0)',
            zIndex: 1,
          }}
          aria-hidden="true"
        />

        {/* Layer 2: Click Liquid Expanding Ripples */}
        {ripples.map((ripple) => (
          <span
            key={ripple.id}
            className={`pointer-events-none absolute rounded-full ${getRippleColor()}`}
            style={{
              left: `${ripple.x}px`,
              top: `${ripple.y}px`,
              width: `${ripple.size}px`,
              height: `${ripple.size}px`,
              transform: 'translate(-50%, -50%) scale(0)',
              animation: 'liquid-ripple-expand 400ms cubic-bezier(0.16, 1, 0.3, 1) forwards',
              zIndex: 2,
            }}
            aria-hidden="true"
          />
        ))}

        {/* Layer 3: Button Content with Micro-Scale Icon Interaction */}
        <span className="relative z-10 inline-flex items-center justify-center gap-2 pointer-events-none">
          {isLoading ? (
            <span className="inline-block h-3.5 w-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
          ) : null}
          {children}
        </span>
      </button>
    );
  }
);

LiquidButton.displayName = 'LiquidButton';
