import React from 'react';

// Deterministic color palette based on seed hash
const AVATAR_PALETTES = [
  { bg: '#0F6E56', fg: '#E8F5F1' },
  { bg: '#E24B4A', fg: '#FFF0F0' },
  { bg: '#7C3AED', fg: '#F5F0FF' },
  { bg: '#0EA5E9', fg: '#F0F9FF' },
  { bg: '#BA7517', fg: '#FFFBEB' },
  { bg: '#1D9E75', fg: '#E8F5F1' },
  { bg: '#DC2626', fg: '#FFF0F0' },
  { bg: '#2563EB', fg: '#EFF6FF' },
  { bg: '#7C3AED', fg: '#F5F0FF' },
  { bg: '#059669', fg: '#ECFDF5' },
];

function hashSeed(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

interface AvatarProps {
  name: string;
  seed?: string | null;
  size?: number;
  className?: string;
  isDoctor?: boolean;
}

export function Avatar({ name, seed, size = 48, className = '', isDoctor = false }: AvatarProps) {
  const key = seed || name;
  const hash = hashSeed(key);
  const palette = AVATAR_PALETTES[hash % AVATAR_PALETTES.length];
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');

  // Generate a simple deterministic abstract face pattern
  const patternSeed = hash % 8;

  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: `linear-gradient(135deg, ${palette.bg}, ${palette.bg}cc)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        position: 'relative',
        overflow: 'hidden',
        boxShadow: `0 0 0 3px ${palette.bg}30`,
      }}
    >
      {/* Background pattern */}
      <svg
        style={{ position: 'absolute', inset: 0, opacity: 0.15 }}
        viewBox="0 0 48 48"
        width={size}
        height={size}
      >
        {patternSeed % 3 === 0 && (
          <>
            <circle cx="40" cy="8" r="14" fill={palette.fg} />
            <circle cx="8" cy="40" r="10" fill={palette.fg} />
          </>
        )}
        {patternSeed % 3 === 1 && (
          <>
            <rect x="28" y="-4" width="28" height="28" rx="6" fill={palette.fg} transform="rotate(15 28 -4)" />
          </>
        )}
        {patternSeed % 3 === 2 && (
          <>
            <polygon points="48,0 48,24 24,0" fill={palette.fg} />
            <polygon points="0,48 24,48 0,24" fill={palette.fg} />
          </>
        )}
      </svg>

      {/* Doctor badge */}
      {isDoctor && (
        <div style={{
          position: 'absolute', bottom: size * 0.04, right: size * 0.04,
          width: size * 0.28, height: size * 0.28,
          background: '#fff', borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg viewBox="0 0 12 12" width={size * 0.18} height={size * 0.18} fill="none">
            <path d="M6 1v10M1 6h10" stroke={palette.bg} strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>
      )}

      {/* Initials */}
      <span style={{
        color: palette.fg,
        fontSize: size * 0.33,
        fontWeight: 700,
        letterSpacing: '-0.5px',
        lineHeight: 1,
        zIndex: 1,
        fontFamily: 'Plus Jakarta Sans, system-ui, sans-serif',
      }}>
        {initials}
      </span>
    </div>
  );
}

// Large profile avatar with decorative ring
export function ProfileAvatar({ name, seed, size = 96, isDoctor = false }: AvatarProps) {
  const key = seed || name;
  const hash = hashSeed(key);
  const palette = AVATAR_PALETTES[hash % AVATAR_PALETTES.length];

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <div style={{
        width: size + 8,
        height: size + 8,
        borderRadius: '50%',
        padding: 4,
        background: `conic-gradient(from 0deg, ${palette.bg}, ${palette.bg}88, ${palette.bg})`,
      }}>
        <Avatar name={name} seed={seed} size={size} isDoctor={isDoctor} />
      </div>
      {isDoctor && (
        <div style={{
          position: 'absolute', bottom: 4, right: 4,
          background: '#0F6E56', borderRadius: '50%',
          width: 24, height: 24,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: '2px solid var(--color-surface)',
        }}>
          <svg viewBox="0 0 12 12" width="11" height="11" fill="none">
            <path d="M6 1v10M1 6h10" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        </div>
      )}
    </div>
  );
}

// Star rating display
export function StarRating({ rating }: { rating: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
      {[1, 2, 3, 4, 5].map((star) => (
        <svg key={star} width="14" height="14" viewBox="0 0 24 24" fill={star <= Math.round(rating) ? '#F59E0B' : 'none'} stroke="#F59E0B" strokeWidth="1.5">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      ))}
      <span style={{ fontSize: 12, color: 'var(--color-text-muted)', marginLeft: 3 }}>{rating.toFixed(1)}</span>
    </div>
  );
}
