import React, { useEffect, useRef } from 'react';

export interface AmbientBackgroundProps {
  /**
   * Visual intensity level of the ambient texture and cursor response:
   * - 'minimal': subtle dot field with gentle displacement (detail views, dense tables)
   * - 'subtle': default for CRM dashboard, pipeline, and list pages
   * - 'medium': distinct fluid wake & displacement for auth/login
   */
  intensity?: 'minimal' | 'subtle' | 'medium';
  /** Whether to incorporate the signature ZaynOps emerald accent tint in the cursor wake */
  showAccent?: boolean;
  className?: string;
}

interface GridPoint {
  ox: number; // Original origin X
  oy: number; // Original origin Y
  x: number;  // Current X
  y: number;  // Current Y
  vx: number; // Velocity X
  vy: number; // Velocity Y
  isCross: boolean; // Every 4th point has a precision crosshair
}

export const AmbientBackground: React.FC<AmbientBackgroundProps> = ({
  intensity = 'subtle',
  showAccent = true,
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 1. Accessibility: Check for reduced motion preference
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // 2. Mobile/Touch Detection: Disable continuous cursor-following on touch screens
    const isTouchDevice =
      window.matchMedia('(hover: none), (pointer: coarse)').matches ||
      'ontouchstart' in window;

    // Grid configuration parameters based on intensity
    const CELL_SIZE = 34; // 34px technical grid spacing
    const INTERACTION_RADIUS =
      intensity === 'minimal' ? 140 : intensity === 'medium' ? 220 : 180;
    const MAX_DISPLACEMENT =
      intensity === 'minimal' ? 5 : intensity === 'medium' ? 10 : 7.5;
    const BASE_OPACITY =
      intensity === 'minimal' ? 0.045 : intensity === 'medium' ? 0.085 : 0.065;
    const ACTIVE_OPACITY =
      intensity === 'minimal' ? 0.25 : intensity === 'medium' ? 0.45 : 0.35;
    const GLOW_RADIUS =
      intensity === 'minimal' ? 180 : intensity === 'medium' ? 280 : 230;

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);
    let dpr = window.devicePixelRatio || 1;

    let points: GridPoint[] = [];

    const initPoints = () => {
      points = [];
      const cols = Math.ceil(width / CELL_SIZE) + 2;
      const rows = Math.ceil(height / CELL_SIZE) + 2;

      for (let r = -1; r < rows; r++) {
        for (let c = -1; c < cols; c++) {
          const ox = c * CELL_SIZE;
          const oy = r * CELL_SIZE;
          const isCross = (c % 4 === 0) && (r % 4 === 0);
          points.push({
            ox,
            oy,
            x: ox,
            y: oy,
            vx: 0,
            vy: 0,
            isCross,
          });
        }
      }
    };

    const resize = () => {
      dpr = window.devicePixelRatio || 1;
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      initPoints();
    };

    resize();
    window.addEventListener('resize', resize);

    // If reduced motion or touch device: draw static technical grid once and exit loop
    if (prefersReducedMotion || isTouchDevice) {
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = `rgba(15, 23, 42, ${BASE_OPACITY})`;
      ctx.strokeStyle = `rgba(15, 23, 42, ${BASE_OPACITY * 1.2})`;
      ctx.lineWidth = 0.75;

      for (let i = 0; i < points.length; i++) {
        const pt = points[i];
        ctx.beginPath();
        ctx.arc(pt.ox, pt.oy, 0.85, 0, Math.PI * 2);
        ctx.fill();

        if (pt.isCross) {
          ctx.beginPath();
          ctx.moveTo(pt.ox - 3, pt.oy);
          ctx.lineTo(pt.ox + 3, pt.oy);
          ctx.moveTo(pt.ox, pt.oy - 3);
          ctx.lineTo(pt.ox, pt.oy + 3);
          ctx.stroke();
        }
      }
      return () => {
        window.removeEventListener('resize', resize);
      };
    }

    // Dynamic Physics & Cursor Wake State
    let mouseX = -1000;
    let mouseY = -1000;
    let lerpMouseX = -1000;
    let lerpMouseY = -1000;
    let isMouseOver = false;
    let animId: number;

    const onPointerMove = (e: PointerEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      if (!isMouseOver) {
        isMouseOver = true;
        lerpMouseX = mouseX;
        lerpMouseY = mouseY;
      }
    };

    const onPointerLeave = () => {
      isMouseOver = false;
      mouseX = -1000;
      mouseY = -1000;
    };

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    document.documentElement.addEventListener('pointerleave', onPointerLeave);

    // Render loop with spring dynamics & liquid wake
    const render = () => {
      // Smooth cursor inertia
      if (isMouseOver) {
        lerpMouseX += (mouseX - lerpMouseX) * 0.14;
        lerpMouseY += (mouseY - lerpMouseY) * 0.14;
      } else {
        lerpMouseX += (-1000 - lerpMouseX) * 0.08;
        lerpMouseY += (-1000 - lerpMouseY) * 0.08;
      }

      ctx.clearRect(0, 0, width, height);

      // Layer 1: Soft Ambient Liquid Wake (Radial Illumination)
      if (isMouseOver && lerpMouseX > -500) {
        const grad = ctx.createRadialGradient(
          lerpMouseX,
          lerpMouseY,
          0,
          lerpMouseX,
          lerpMouseY,
          GLOW_RADIUS
        );

        if (showAccent) {
          grad.addColorStop(0, 'rgba(255, 255, 255, 0.7)');
          grad.addColorStop(0.2, 'rgba(248, 250, 252, 0.5)');
          grad.addColorStop(0.5, 'rgba(12, 182, 117, 0.055)');
          grad.addColorStop(0.8, 'rgba(12, 182, 117, 0.015)');
          grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
        } else {
          grad.addColorStop(0, 'rgba(255, 255, 255, 0.6)');
          grad.addColorStop(0.4, 'rgba(241, 245, 249, 0.4)');
          grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
        }

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(lerpMouseX, lerpMouseY, GLOW_RADIUS, 0, Math.PI * 2);
        ctx.fill();
      }

      // Layer 2: Physics-based Particle Grid Displacement
      for (let i = 0; i < points.length; i++) {
        const pt = points[i];

        // Calculate distance to inertial cursor
        const dx = lerpMouseX - pt.ox;
        const dy = lerpMouseY - pt.oy;
        const dist = Math.sqrt(dx * dx + dy * dy);

        let targetX = pt.ox;
        let targetY = pt.oy;
        let proximity = 0;

        if (dist < INTERACTION_RADIUS && dist > 0) {
          proximity = 1 - dist / INTERACTION_RADIUS;
          // Smooth sinusoidal force curve
          const force = Math.sin((proximity * Math.PI) / 2) * MAX_DISPLACEMENT;
          // Repulsion direction (push away like liquid wake)
          const angle = Math.atan2(dy, dx);
          targetX = pt.ox - Math.cos(angle) * force;
          targetY = pt.oy - Math.sin(angle) * force;
        }

        // Spring acceleration & velocity damping
        const ax = (targetX - pt.x) * 0.22;
        const ay = (targetY - pt.y) * 0.22;
        pt.vx = (pt.vx + ax) * 0.74;
        pt.vy = (pt.vy + ay) * 0.74;
        pt.x += pt.vx;
        pt.y += pt.vy;

        // Visual rendering based on displacement & proximity
        const currentOpacity = BASE_OPACITY + proximity * (ACTIVE_OPACITY - BASE_OPACITY);
        const radius = 0.85 + proximity * 0.85;

        // Dot rendering
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, radius, 0, Math.PI * 2);

        if (proximity > 0.05 && showAccent) {
          ctx.fillStyle = `rgba(12, 182, 117, ${currentOpacity * 1.2})`;
        } else {
          ctx.fillStyle = `rgba(15, 23, 42, ${currentOpacity})`;
        }
        ctx.fill();

        // Technical crosshair rendering for key intersections
        if (pt.isCross) {
          const crossArm = 3 + proximity * 1.5;
          ctx.beginPath();
          ctx.moveTo(pt.x - crossArm, pt.y);
          ctx.lineTo(pt.x + crossArm, pt.y);
          ctx.moveTo(pt.x, pt.y - crossArm);
          ctx.lineTo(pt.x, pt.y + crossArm);
          ctx.strokeStyle =
            proximity > 0.05 && showAccent
              ? `rgba(12, 182, 117, ${currentOpacity * 1.4})`
              : `rgba(15, 23, 42, ${currentOpacity * 1.1})`;
          ctx.lineWidth = 0.75 + proximity * 0.25;
          ctx.stroke();
        }
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', onPointerMove);
      document.documentElement.removeEventListener('pointerleave', onPointerLeave);
    };
  }, [intensity, showAccent]);

  return (
    <div
      className={`fixed inset-0 pointer-events-none overflow-hidden select-none -z-10 ${className}`}
      aria-hidden="true"
      style={{ contain: 'strict' }}
    >
      {/* Base Canvas Layer */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none will-change-transform"
      />
    </div>
  );
};
