'use client';

import React, { useState } from 'react';
import { ProtocolEvent } from '@/types';
import { Activity, ExternalLink } from 'lucide-react';
import { formatDistanceToNow } from '@/lib/utils';
import { DataSourceBadge, CardChipRow } from '@/lib/dataSource';

interface ActivityLogProps {
  events: ProtocolEvent[];
  isConnected: boolean;
  isLoading?: boolean;
}

function SourceTag({ source }: { source?: 'ON-CHAIN' | 'DAEMON' | 'LOCAL' }) {
  if (!source) return null;
  const cfg = {
    'ON-CHAIN': 'bg-emerald-950/60 text-emerald-400 border-emerald-500/30',
    'DAEMON':   'bg-cyan-950/60 text-cyan-400 border-cyan-500/30',
    'LOCAL':    'bg-purple-950/60 text-purple-400 border-purple-500/20',
  }[source];
  return (
    <span className={`text-[8px] font-bold font-mono px-1 py-0.5 rounded border uppercase ${cfg}`}>
      {source}
    </span>
  );
}

export function ActivityLog({ events, isConnected, isLoading = false }: ActivityLogProps) {
  const [filter, setFilter] = useState<'ALL' | 'HEDGE' | 'VAULT'>('ALL');

  const filteredEvents = events.filter((e) => {
    if (filter === 'ALL') return true;
    if (filter === 'HEDGE') return e.type === 'HEDGE_TRIGGERED' || e.type === 'HEDGE_SETTLED';
    if (filter === 'VAULT') return e.type === 'DEPOSIT' || e.type === 'BORROW' || e.type === 'WITHDRAW' || e.type === 'FAUCET' || e.type === 'DEBT_REPAID';
    return true;
  });

  return (
    <div className="rounded-2xl glass-panel p-5 flex flex-col justify-between h-full border border-purple-500/25">
      {/* Header */}
      <div>
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-start gap-2 min-w-0">
            <div className="p-1.5 rounded-lg bg-purple-950/80 border border-purple-500/30 shrink-0 mt-0.5">
              <Activity className="w-4 h-4 text-purple-400" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white tracking-tight leading-snug">Vault &amp; Sentinel Events</h4>
              <p className="text-[10px] text-purple-300/70">Event feed</p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <CardChipRow>
              <DataSourceBadge source="LIVE_DAEMON" />
            </CardChipRow>
            <div className="flex items-center gap-1 bg-purple-950/60 p-0.5 rounded-md border border-purple-500/20 text-[9px] h-5">
              <button
                onClick={() => setFilter('ALL')}
                className={`h-full px-2 rounded ${
                  filter === 'ALL' ? 'bg-purple-600 text-white font-bold' : 'text-purple-300 hover:text-white'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilter('HEDGE')}
                className={`h-full px-2 rounded ${
                  filter === 'HEDGE' ? 'bg-purple-600 text-white font-bold' : 'text-purple-300 hover:text-white'
                }`}
              >
                Hedges
              </button>
              <button
                onClick={() => setFilter('VAULT')}
                className={`h-full px-2 rounded ${
                  filter === 'VAULT' ? 'bg-purple-600 text-white font-bold' : 'text-purple-300 hover:text-white'
                }`}
              >
                Vault
              </button>
            </div>
          </div>
        </div>

        {/* Scrollable Event Feed */}
        <div className="space-y-2 max-h-[175px] overflow-y-auto pr-1 my-2 text-xs">
          {filteredEvents.length === 0 ? (
            <div className="py-6 text-center text-purple-300/50 text-[11px]">
              {!isConnected
                ? 'Connect your wallet to view your vault activity.'
                : isLoading
                  ? 'Loading on-chain vault activity…'
                  : 'No vault activity yet. Deposit collateral to get started.'}
            </div>
          ) : (
            filteredEvents.map((evt) => (
              <div
                key={evt.id}
                className="p-2.5 rounded-xl bg-purple-950/40 border border-purple-500/20 hover:border-purple-500/40 transition-colors space-y-0.5"
              >
                <div className="flex items-center justify-between text-[11px] font-semibold text-white">
                  <div className="flex items-center gap-1.5 truncate max-w-[200px]">
                    <SourceTag source={evt.source} />
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
          <span>Channel: HTTP 3s</span>
          <span className="text-purple-500">•</span>
          <span className="text-cyan-300/90 font-medium">
            {isConnected ? 'Wallet-linked' : 'Wallet required'}
          </span>
        </span>
        <span className="text-purple-400/70 flex items-center gap-1">
          On-chain + Sentinel
        </span>
      </div>
    </div>
  );
}
