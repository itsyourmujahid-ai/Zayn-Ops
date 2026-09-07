import React from 'react';

interface ZaynLogoProps {
  size?: number | string;
  className?: string;
  rounded?: string;
  showWhiteBorder?: boolean;
}

export const ZaynLogo: React.FC<ZaynLogoProps> = ({
  size = 36,
  className = '',
}) => {
  const dimension = typeof size === 'number' ? `${size}px` : size;

  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 select-none bg-transparent ${className}`}
      style={{
        width: dimension,
        height: dimension,
      }}
      title="ZaynOps Logo"
      aria-label="ZaynOps Logo"
    >
      <img
        src="/zaynops.svg"
        alt="ZaynOps Logo"
        className="h-full w-full object-contain pointer-events-none drop-shadow-xs"
        loading="eager"
      />
    </div>
  );
};
