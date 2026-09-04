'use client';

import React, { useState } from 'react';
import { ProtocolEvent } from '@/types';
import { Activity, ArrowDownRight, ExternalLink, ShieldCheck, Zap, Flame, RefreshCw } from 'lucide-react';
import { formatDistanceToNow } from '@/lib/utils';

interface ActivityLogProps {
  events: ProtocolEvent[];
}

export function ActivityLog({ events }: ActivityLogProps) {
  const [filter, setFilter] = useState<'ALL' | 'HEDGE' | 'VAULT'>('ALL');

  const filteredEvents = events.filter((e) => {
    if (filter === 'ALL') return true;
    if (filter === 'HEDGE') return e.type === 'HEDGE_TRIGGERED' || e.type === 'HEDGE_SETTLED';
    if (filter === 'VAULT') return e.type === 'DEPOSIT' || e.type === 'WITHDRAW';
    return true;
  });

  return (
    <div className="rounded-2xl glass-panel p-5 flex flex-col justify-between h-full border border-purple-500/25">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-purple-950/80 border border-purple-500/30">
              <Activity className="w-4 h-4 text-purple-400" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white tracking-tight">On-Chain Activity</h4>
              <p className="text-[10px] text-purple-300/70">Somnia Block Event Stream</p>
            </div>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1 bg-purple-950/60 p-0.5 rounded-lg border border-purple-500/20 text-[10px]">
            <button
              onClick={() => setFilter('ALL')}
              className={`px-2 py-0.5 rounded ${
                filter === 'ALL' ? 'bg-purple-600 text-white font-bold' : 'text-purple-300 hover:text-white'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilter('HEDGE')}
              className={`px-2 py-0.5 rounded ${
                filter === 'HEDGE' ? 'bg-purple-600 text-white font-bold' : 'text-purple-300 hover:text-white'
              }`}
            >
              Hedges
            </button>
            <button
              onClick={() => setFilter('VAULT')}
              className={`px-2 py-0.5 rounded ${
                filter === 'VAULT' ? 'bg-purple-600 text-white font-bold' : 'text-purple-300 hover:text-white'
              }`}
            >
              Vault
            </button>
          </div>
        </div>

        {/* Scrollable Event Feed */}
        <div className="space-y-2 max-h-[175px] overflow-y-auto pr-1 my-2 text-xs">
          {filteredEvents.length === 0 ? (
            <div className="py-6 text-center text-purple-300/50 text-[11px]">
              No events recorded yet.
            </div>
          ) : (
            filteredEvents.map((evt) => (
              <div
                key={evt.id}
                className="p-2.5 rounded-xl bg-purple-950/40 border border-purple-500/20 hover:border-purple-500/40 transition-colors space-y-0.5"
              >
                <div className="flex items-center justify-between text-[11px] font-semibold text-white">
                  <div className="flex items-center gap-1.5 truncate max-w-[210px]">
                    <span className="truncate">{evt.title}</span>
                    {evt.txHash && (
                      <a
                        href={`https://shannon-explorer.somnia.network/tx/${evt.txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-cyan-400 hover:text-cyan-200 inline-flex items-center transition-colors flex-shrink-0"
                        title="View on Somnia Explorer"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    )}
                  </div>
                  <span className="text-[9px] text-purple-400/60 font-mono flex-shrink-0">
                    {formatDistanceToNow(evt.timestamp)}
                  </span>
                </div>
                <p className="text-[10px] text-purple-300/70 line-clamp-1">{evt.description}</p>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between text-[10px] text-purple-300/70 font-mono">
        <span className="flex items-center gap-1">
          <span>Channel: HTTP 1.2s</span>
          <span className="text-purple-500">•</span>
          <span className="text-cyan-300/90 font-medium">Session Persisted</span>
        </span>
        <span className="text-emerald-300 flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Live
        </span>
      </div>
    </div>
  );
}
