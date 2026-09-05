'use client';

import React, { ReactNode } from 'react';

export type DataSource =
  | 'LIVE_ONCHAIN'
  | 'LIVE_DAEMON'
  | 'LIVE_RPC'
  | 'SIMULATED'
  | 'MARKETING';

interface DataSourceBadgeProps {
  source: DataSource;
  className?: string;
}

const CHIP =
  'h-5 shrink-0 inline-flex items-center gap-1 px-1.5 rounded-md text-[9px] font-bold font-mono uppercase tracking-wide leading-none border whitespace-nowrap';

const SOURCE_CONFIG: Record<DataSource, { label: string; dot: string; text: string; border: string; bg: string }> = {
  LIVE_ONCHAIN: {
    label: 'LIVE ON-CHAIN',
    dot: 'bg-emerald-400',
    text: 'text-emerald-300',
    border: 'border-emerald-500/40',
    bg: 'bg-emerald-950/50',
  },
  LIVE_DAEMON: {
    label: 'LIVE DAEMON',
    dot: 'bg-cyan-400',
    text: 'text-cyan-300',
    border: 'border-cyan-500/40',
    bg: 'bg-cyan-950/50',
  },
  LIVE_RPC: {
    label: 'LIVE RPC',
    dot: 'bg-blue-400',
    text: 'text-blue-300',
    border: 'border-blue-500/40',
    bg: 'bg-blue-950/50',
  },
  SIMULATED: {
    label: 'SIMULATED',
    dot: 'bg-amber-400',
    text: 'text-amber-300',
    border: 'border-amber-500/40',
    bg: 'bg-amber-950/50',
  },
  MARKETING: {
    label: 'SPEC',
    dot: 'bg-purple-400',
    text: 'text-purple-300',
    border: 'border-purple-500/30',
    bg: 'bg-purple-950/40',
  },
};

export function DataSourceBadge({ source, className = '' }: DataSourceBadgeProps) {
  const cfg = SOURCE_CONFIG[source];
  return (
    <span className={`${CHIP} ${cfg.bg} ${cfg.text} ${cfg.border} ${className}`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

interface StatusChipProps {
  children: ReactNode;
  tone?: 'emerald' | 'amber' | 'rose' | 'cyan' | 'pink' | 'yellow';
  pulse?: boolean;
  className?: string;
}

const TONE: Record<NonNullable<StatusChipProps['tone']>, string> = {
  emerald: 'bg-emerald-950/60 text-emerald-300 border-emerald-500/40',
  amber: 'bg-amber-950/60 text-amber-300 border-amber-500/40',
  rose: 'bg-rose-950/70 text-rose-300 border-rose-500/50',
  cyan: 'bg-cyan-950/60 text-cyan-300 border-cyan-500/40',
  pink: 'bg-pink-950/50 text-pink-300 border-pink-500/40',
  yellow: 'bg-yellow-950/60 text-yellow-300 border-yellow-500/40',
};

export function StatusChip({ children, tone = 'emerald', pulse = false, className = '' }: StatusChipProps) {
  return (
    <span className={`${CHIP} ${TONE[tone]} ${pulse ? 'animate-pulse' : ''} ${className}`}>
      {children}
    </span>
  );
}

/** Right-side card header row: all chips same height, vertically centered, wraps cleanly on laptop widths. */
export function CardChipRow({ children }: { children: ReactNode }) {
  return <div className="flex items-center justify-end flex-wrap gap-1.5 shrink-0 self-start max-w-full">{children}</div>;
}
