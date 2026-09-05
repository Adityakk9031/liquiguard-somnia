import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatAddress(address?: string): string {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function formatUSD(value: number): string {
  if (isNaN(value) || !isFinite(value)) return '$0.00';
  // If whole number >= $1,000, don't show trailing .00
  const isWhole = value % 1 === 0;
  const digits = Math.abs(value) >= 1000 && isWhole ? 0 : 2;

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

/**
 * Formats USD for narrow metric cards (prevents text overflow).
 * Values >= $1,000 drop cents ($43,000 instead of $43,000.00).
 * Values >= $100k use 'k' notation ($120k).
 * Values >= $1M use 'M' notation ($1.5M).
 */
export function formatMetricUSD(value: number): string {
  if (isNaN(value) || !isFinite(value) || value <= 0) return '$0.00';
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(2)}M`;
  }
  if (value >= 100_000) {
    return `$${(value / 1_000).toFixed(1)}k`;
  }
  if (value >= 1_000) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(value);
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}


export function formatCrypto(value: number, decimals: number = 4): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: decimals,
  }).format(value);
}

export type HealthFactorStatus = 'SAFE' | 'WARNING' | 'CRITICAL';

export function getHealthFactorStatus(hf: number): HealthFactorStatus {
  if (hf >= 1.50) return 'SAFE';
  if (hf >= 1.30) return 'WARNING';
  return 'CRITICAL';
}

export function getHealthFactorColor(hf: number): {
  text: string;
  bg: string;
  border: string;
  hex: string;
} {
  if (hf >= 1.50) {
    return {
      text: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/30',
      hex: '#10b981',
    };
  }
  if (hf >= 1.30) {
    return {
      text: 'text-amber-400',
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/30',
      hex: '#f59e0b',
    };
  }
  return {
    text: 'text-rose-400',
    bg: 'bg-rose-500/10',
    border: 'border-rose-500/30',
    hex: '#f43f5e',
  };
}

export function formatDistanceToNow(timestamp: number): string {
  if (!timestamp || !Number.isFinite(timestamp)) return '';
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 0) return 'just now';
  if (seconds < 10) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
