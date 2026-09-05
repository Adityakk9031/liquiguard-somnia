export enum HedgeStatus {
  IDLE = 0,
  HEDGING = 1,
  PROTECTED = 2,
}

export interface UserPosition {
  collateralWETH: number;
  debtUSDC: number;
  healthFactor: number;
  status: HedgeStatus;
  collateralUSD: number;
  ltv: number;
}

export type ProtocolEventType =
  | 'DEPOSIT'
  | 'BORROW'
  | 'WITHDRAW'
  | 'FAUCET'
  | 'PRICE_DROP'
  | 'PRICE_RESET'
  | 'HEDGE_TRIGGERED'
  | 'HEDGE_SETTLED'
  | 'DEBT_REPAID';

export interface ProtocolEvent {
  id: string;
  type: ProtocolEventType;
  title: string;
  description: string;
  timestamp: number;
  txHash?: string;
  /** Data source for this event — shown as a tag in the activity log */
  source?: 'ON-CHAIN' | 'DAEMON' | 'LOCAL';

  data?: {
    amount?: string;
    hf?: number;
    price?: number;
    payout?: string;
    executionTimeMs?: number;
  };
}

export interface OraclePrice {
  price: number;
  basePrice: number;
  changePercent: number;
  lastUpdated: number;
}
