import React from 'react';

/** The app mark: an eight-petal mandala, matching the home-screen icon. */
export const BrandMark: React.FC<{ className?: string }> = ({ className = 'w-9 h-9' }) => (
  <svg viewBox="0 0 512 512" className={className} aria-hidden="true">
    <rect width="512" height="512" rx="256" fill="#18181b" />
    <g transform="translate(256 256)" fill="none" stroke="#34d399" strokeWidth="18" strokeLinecap="round">
      {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
        <path key={deg} transform={`rotate(${deg})`} d="M0 -150 C 46 -104 46 -46 0 0 C -46 -46 -46 -104 0 -150 Z" />
      ))}
    </g>
    <circle cx="256" cy="256" r="28" fill="#fbbf24" />
  </svg>
);
