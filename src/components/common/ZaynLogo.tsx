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
  rounded = 'rounded-lg',
  showWhiteBorder = true,
}) => {
  const dimension = typeof size === 'number' ? `${size}px` : size;

  return (
    <div
      className={`relative inline-flex items-center justify-center overflow-hidden shrink-0 select-none ${rounded} ${className}`}
      style={{
        width: dimension,
        height: dimension,
        backgroundColor: '#FFFFFF',
      }}
      title="ZaynOs Logo"
      aria-label="ZaynOs Logo"
    >
      <svg
        viewBox="0 0 500 500"
        className="h-full w-full"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
      >
        {/* White Base Canvas */}
        <rect width="500" height="500" fill="#FFFFFF" />

        {/* Top-Left Deep Forest Green Triangle */}
        <polygon points="45,46 232,46 45,455" fill="#18582B" />

        {/* Bottom-Right Deep Forest Green Triangle */}
        <polygon points="455,46 455,455 268,455" fill="#18582B" />

        {/* Center Black Circle Badge */}
        <circle cx="250" cy="250" r="80" fill="#111111" />

        {/* Center Stylized White Emblem */}
        <path
          d="M 264 192
             C 230 192 196 216 196 250
             C 196 284 224 308 260 308
             C 278 308 290 298 296 288
             L 309 285
             L 282 230
             L 264 230
             C 268 248 264 270 252 276
             C 238 282 225 272 225 250
             C 225 228 238 218 252 218
             C 262 218 268 226 270 216
             C 272 204 268 195 264 192 Z"
          fill="#FFFFFF"
        />
      </svg>
    </div>
  );
};
