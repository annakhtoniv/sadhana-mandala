import React, { useState } from 'react';
import { badgeLook } from '../lib/badges';

interface AvatarProps {
  name?: string | null;
  url?: string | null;
  size?: number;
  className?: string;
  /** Phase 21: an earned badge (week1, ..., complete) shown as a ring with an emblem */
  frame?: string | null;
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

/** A round profile picture, or the person's initials, with the badge frame they chose. */
export const Avatar: React.FC<AvatarProps> = ({ frame, size = 36, className = '', ...rest }) => {
  const look = frame ? badgeLook(frame) : null;
  if (!look) return <Picture {...rest} size={size} className={className} />;
  // The frame stays inside the same size, so layouts do not move
  const ring = Math.max(2, Math.round(size * 0.07));
  const emblem = Math.round(size * 0.36);
  return (
    <span
      className={`relative inline-flex shrink-0 rounded-full ${className}`}
      style={{ width: size, height: size, padding: ring, background: `conic-gradient(from 210deg, ${look.from}, ${look.to}, ${look.from})` }}
    >
      <span className="inline-flex rounded-full bg-white p-px">
        <Picture {...rest} size={size - 2 * ring - 2} />
      </span>
      {size >= 32 && (
        <span
          aria-hidden="true"
          className="absolute -bottom-0.5 -start-0.5 rounded-full text-white font-bold leading-none flex items-center justify-center ring-2 ring-white"
          style={{ width: emblem, height: emblem, fontSize: Math.max(9, Math.round(emblem * 0.55)), background: look.to }}
        >
          {look.emblem}
        </span>
      )}
    </span>
  );
};

const Picture: React.FC<Omit<AvatarProps, 'frame'> & { size: number }> = ({ name, url, size, className = '' }) => {
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
