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

export interface ProtocolEvent {
  id: string;
  type: 'DEPOSIT' | 'WITHDRAW' | 'PRICE_DROP' | 'PRICE_RESET' | 'HEDGE_TRIGGERED' | 'HEDGE_SETTLED' | 'DEBT_REPAID';
  title: string;
  description: string;
  timestamp: number;
  txHash?: string;
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
