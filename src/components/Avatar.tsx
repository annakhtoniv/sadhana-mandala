import React, { useState } from 'react';

interface AvatarProps {
  name?: string | null;
  url?: string | null;
  size?: number;
  className?: string;
}

function initials(name: string): string {
  return (
    name
      .split(/[\s@.]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase() || '?'
  );
}

/** A round profile picture, or the person's initials when there is none. */
export const Avatar: React.FC<AvatarProps> = ({ name, url, size = 36, className = '' }) => {
  const [broken, setBroken] = useState(false);
  const style = { width: size, height: size, fontSize: Math.max(10, Math.round(size * 0.36)) };
  if (url && !broken) {
    return (
      <img
        src={url}
        alt=""
        referrerPolicy="no-referrer"
        onError={() => setBroken(true)}
        style={style}
        className={`rounded-full object-cover bg-stone-100 shrink-0 ring-1 ring-stone-900/5 ${className}`}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      style={style}
      className={`rounded-full shrink-0 inline-flex items-center justify-center font-semibold text-stone-600 bg-gradient-to-br from-stone-100 to-stone-200 ring-1 ring-stone-900/5 ${className}`}
    >
      {initials(name || '')}
    </span>
  );
};
