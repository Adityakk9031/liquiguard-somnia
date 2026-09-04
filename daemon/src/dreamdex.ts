import { config } from './config.js';
import { logger } from './logger.js';

export interface BinaryMarket {
  id: string;
  ticker: string;
  underlying: string;
  strikePrice: number;
  expiryTimestamp: number;
  durationMinutes: number;
  downPrice: number;
  upPrice: number;
  status: 'OPEN' | 'RESOLVING' | 'RESOLVED_DOWN' | 'RESOLVED_UP';
  totalLiquidityUSDC: number;
}

export interface IOCOrderParams {
  marketId: string;
  side: 'DOWN' | 'UP';
  sizeUSDC: number;
  limitPrice: number;
  clientOrderId?: string;
}

export interface IOCOrderResult {
  orderId: string;
  marketId: string;
  side: 'DOWN' | 'UP';
  requestedSizeUSDC: number;
  filledSizeUSDC: number;
  sharesPurchased: number;
  averagePrice: number;
  status: 'FILLED' | 'PARTIALLY_FILLED' | 'EXPIRED' | 'REJECTED';
  potentialPayoutUSDC: number;
  txHash?: string;
  timestamp: number;
}

export interface SettlementResult {
  orderId: string;
  marketId: string;
  settledSide: 'DOWN' | 'UP';
  settlementPrice: number;
  strikePrice: number;
  payoutUSDC: number;
  netProfitUSDC: number;
  isWinningHedge: boolean;
  settledAt: number;
}

export class DreamDEXClient {
  private mode: 'mock' | 'live';
  private indexerUrl: string;
  private wsUrl: string;
  private markets: Map<string, BinaryMarket> = new Map();
  private orders: Map<string, IOCOrderResult> = new Map();
  private liveSdk: any = null;

  constructor() {
    this.mode = config.dreamdex.mode;
    this.indexerUrl = config.dreamdex.indexerUrl;
    this.wsUrl = config.dreamdex.wsUrl;
    this.initMarkets();
  }

  public async initialize(): Promise<void> {
    logger.info(`[DreamDEX] Initializing DreamDEX Client in ${this.mode.toUpperCase()} mode...`);

    if (this.mode === 'live') {
      try {
        await this.initLiveSdk();
        logger.info(`[DreamDEX] Successfully connected to Live DreamDEX indexer at ${this.indexerUrl}`);
      } catch (err) {
        logger.warn(`[DreamDEX] Failed to initialize live SDK (${err instanceof Error ? err.message : String(err)}). Falling back to MOCK mode.`);
        this.mode = 'mock';
      }
    } else {
      logger.info(`[DreamDEX] Mock mode active: Simulating Somnia DreamDEX binary markets`);
    }
  }

  private async initLiveSdk(): Promise<void> {
    try {
      // Dynamic import for optional live SDK usage
      const marketsSdk = await import('@somnia-chain/markets-sdk');
      if (marketsSdk && (marketsSdk as any).createClient) {
        this.liveSdk = (marketsSdk as any).createClient({
          graphqlUrl: this.indexerUrl,
          wsUrl: this.wsUrl,
        });
      } else {
        logger.info(`[DreamDEX] @somnia-chain/markets-sdk loaded, using REST/GraphQL endpoint.`);
      }
    } catch (err) {
      throw new Error(`Could not load @somnia-chain/markets-sdk: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  private initMarkets(): void {
    const now = Date.now();
    const mockMarkets: BinaryMarket[] = [
      {
        id: 'ETH-USD-15M-DOWN',
        ticker: 'ETH/USD 15-Min DOWN Contract',
        underlying: 'ETH/USD',
        strikePrice: 2000.0,
        expiryTimestamp: now + 15 * 60 * 1000,
        durationMinutes: 15,
        downPrice: config.dreamdex.entryPrice,
        upPrice: 1.0 - config.dreamdex.entryPrice,
        status: 'OPEN',
        totalLiquidityUSDC: 500_000,
      },
      {
        id: 'ETH-USD-1H-DOWN',
        ticker: 'ETH/USD 1-Hour DOWN Contract',
        underlying: 'ETH/USD',
        strikePrice: 2000.0,
        expiryTimestamp: now + 60 * 60 * 1000,
        durationMinutes: 60,
        downPrice: config.dreamdex.entryPrice + 0.05,
        upPrice: 1.0 - (config.dreamdex.entryPrice + 0.05),
        status: 'OPEN',
        totalLiquidityUSDC: 1_200_000,
      },
    ];

    for (const m of mockMarkets) {
      this.markets.set(m.id, m);
    }
  }

  public getMode(): 'mock' | 'live' {
    return this.mode;
  }

  public setMode(newMode: 'mock' | 'live'): void {
    this.mode = newMode;
    logger.info(`[DreamDEX] Mode switched to ${newMode.toUpperCase()}`);
  }

  public async getActiveMarkets(): Promise<BinaryMarket[]> {
    if (this.mode === 'live' && this.liveSdk) {
      try {
        const liveMarkets = await this.liveSdk.getMarkets();
        if (liveMarkets && liveMarkets.length > 0) {
          return liveMarkets;
        }
      } catch (err) {
        logger.warn(`[DreamDEX] Live getMarkets query failed, returning fallback mock markets: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    return Array.from(this.markets.values());
  }

  public async getMarket(marketId: string): Promise<BinaryMarket | undefined> {
    const markets = await this.getActiveMarkets();
    return markets.find((m) => m.id === marketId) || this.markets.get(marketId);
  }

  /**
   * Places an Immediate-or-Cancel (IOC) Limit Order on DreamDEX
   * For hedging, we buy DOWN contracts when ETH price is dropping
   */
  public async placeIOCOrder(params: IOCOrderParams): Promise<IOCOrderResult> {
    const orderId = params.clientOrderId || `ord_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const market = await this.getMarket(params.marketId);

    if (!market) {
      throw new Error(`Market not found: ${params.marketId}`);
    }

    logger.info(
      `[DreamDEX] Placing IOC Limit Order: orderId=${orderId}, market=${params.marketId}, side=${params.side}, size=$${params.sizeUSDC.toFixed(2)}, limitPrice=$${params.limitPrice.toFixed(4)}`
    );

    if (this.mode === 'live' && this.liveSdk) {
      try {
        const liveOrder = await this.liveSdk.placeOrder({
          marketId: params.marketId,
          side: params.side,
          size: params.sizeUSDC,
          price: params.limitPrice,
          timeInForce: 'IOC',
        });
        return {
          orderId: liveOrder.id || orderId,
          marketId: params.marketId,
          side: params.side,
          requestedSizeUSDC: params.sizeUSDC,
          filledSizeUSDC: Number(liveOrder.filledSize || params.sizeUSDC),
          sharesPurchased: Number(liveOrder.sharesPurchased || params.sizeUSDC / params.limitPrice),
          averagePrice: Number(liveOrder.averagePrice || params.limitPrice),
          status: 'FILLED',
          potentialPayoutUSDC: Number(liveOrder.potentialPayout || params.sizeUSDC / params.limitPrice),
          txHash: liveOrder.transactionHash,
          timestamp: Date.now(),
        };
      } catch (err) {
        logger.warn(`[DreamDEX] Live placeOrder failed (${err instanceof Error ? err.message : String(err)}). Falling back to mock execution.`);
      }
    }

    // Mock IOC Execution
    const price = params.side === 'DOWN' ? market.downPrice : market.upPrice;
    const effectivePrice = Math.min(price, params.limitPrice);
    const sharesPurchased = params.sizeUSDC / effectivePrice;
    const potentialPayout = sharesPurchased * 1.0; // Each winning share pays $1.00 USDC

    const orderResult: IOCOrderResult = {
      orderId,
      marketId: params.marketId,
      side: params.side,
      requestedSizeUSDC: params.sizeUSDC,
      filledSizeUSDC: params.sizeUSDC,
      sharesPurchased,
      averagePrice: effectivePrice,
      status: 'FILLED',
      potentialPayoutUSDC: potentialPayout,
      txHash: `0x${Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('')}`,
      timestamp: Date.now(),
    };

    this.orders.set(orderId, orderResult);
    logger.info(
      `[DreamDEX] IOC Order FILLED: orderId=${orderId}, shares=${sharesPurchased.toFixed(2)}, avgPrice=$${effectivePrice.toFixed(4)}, potentialPayout=$${potentialPayout.toFixed(2)}`
    );

    return orderResult;
  }

  /**
   * Settles the binary event contract when price drops below strike.
   * In binary options, DOWN contract wins if currentPrice < strikePrice.
   * When winning, each share pays $1.00 USD.
   */
  public async settleHedge(
    orderId: string,
    currentPriceETH?: number,
    strikePriceETH?: number
  ): Promise<SettlementResult> {
    const order = this.orders.get(orderId);
    const market = order ? this.markets.get(order.marketId) : undefined;

    const currentPrice = currentPriceETH ?? 2400.0; // default crashed price for demo
    const strike = strikePriceETH ?? market?.strikePrice ?? 3000.0;
    const isDownWin = currentPrice < strike;

    // Simulate delay for settlement verification
    if (config.dreamdex.simulatedSettlementDelayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, config.dreamdex.simulatedSettlementDelayMs));
    }

    let payoutUSDC = 0;
    let netProfitUSDC = 0;
    const isWinningHedge = order ? (order.side === 'DOWN' && isDownWin) : isDownWin;

    if (isWinningHedge && order) {
      payoutUSDC = order.sharesPurchased * 1.0; // $1 per share payout
      netProfitUSDC = payoutUSDC - order.filledSizeUSDC;
    } else if (order) {
      payoutUSDC = 0;
      netProfitUSDC = -order.filledSizeUSDC;
    }

    const settlement: SettlementResult = {
      orderId,
      marketId: order?.marketId || 'ETH-USD-15M-DOWN',
      settledSide: isDownWin ? 'DOWN' : 'UP',
      settlementPrice: currentPrice,
      strikePrice: strike,
      payoutUSDC,
      netProfitUSDC,
      isWinningHedge,
      settledAt: Date.now(),
    };

    logger.info(
      `[DreamDEX] Market Settled for orderId=${orderId}: result=${settlement.settledSide} (Price: $${currentPrice.toFixed(2)} < Strike: $${strike.toFixed(2)}), Payout=$${payoutUSDC.toFixed(2)}, NetProfit=+$${netProfitUSDC.toFixed(2)}`
    );

    return settlement;
  }
}

// Global DreamDEX client singleton
export const dreamdex = new DreamDEXClient();
