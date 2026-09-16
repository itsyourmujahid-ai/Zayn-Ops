import React, { useRef, useCallback } from 'react';

export interface LiquidCardProps extends React.HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
  glowColor?: string;
  children: React.ReactNode;
  elevateOnHover?: boolean;
}

export const LiquidCard: React.FC<LiquidCardProps> = ({
  interactive = true,
  glowColor = 'rgba(12, 182, 117, 0.08)',
  children,
  className = '',
  elevateOnHover = true,
  onMouseMove,
  onMouseEnter,
  onMouseLeave,
  ...props
}) => {
  const cardRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!interactive) return;
      const card = cardRef.current;
      if (card) {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        card.style.setProperty('--card-mouse-x', `${x}px`);
        card.style.setProperty('--card-mouse-y', `${y}px`);
        card.style.setProperty('--card-glow-opacity', '1');
      }
      onMouseMove?.(e);
    },
    [interactive, onMouseMove]
  );

  const handleMouseEnter = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!interactive) return;
      const card = cardRef.current;
      if (card) {
        card.style.setProperty('--card-glow-opacity', '1');
      }
      onMouseEnter?.(e);
    },
    [interactive, onMouseEnter]
  );

  const handleMouseLeave = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!interactive) return;
      const card = cardRef.current;
      if (card) {
        card.style.setProperty('--card-glow-opacity', '0');
      }
      onMouseLeave?.(e);
    },
    [interactive, onMouseLeave]
  );

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`liquid-card relative rounded-xl border border-slate-200/90 bg-white p-4 transition-all duration-200 ${
        interactive
          ? `cursor-pointer ${
              elevateOnHover
                ? 'hover:border-slate-300 hover:shadow-[0_4px_16px_rgba(0,0,0,0.05)] hover:-translate-y-0.5'
                : 'hover:border-slate-300'
            }`
          : 'shadow-2xs'
      } ${className}`}
      style={{
        contain: 'paint',
        ...props.style,
      }}
      {...props}
    >
      {/* Liquid cursor-following sheen */}
      {interactive && (
        <span
          className="pointer-events-none absolute -top-[100px] -left-[100px] w-[200px] h-[200px] rounded-full will-change-transform transition-opacity duration-300"
          style={{
            transform:
              'translate3d(var(--card-mouse-x, -200px), var(--card-mouse-y, -200px), 0) translate(-50%, -50%)',
            background: `radial-gradient(circle, ${glowColor} 0%, rgba(255, 255, 255, 0) 70%)`,
            opacity: 'var(--card-glow-opacity, 0)',
            zIndex: 1,
          }}
          aria-hidden="true"
        />
      )}

      <div className="relative z-10">{children}</div>
    </div>
  );
};
