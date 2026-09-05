/**
 * Calculates suggested borrow amount in tUSDC for a given collateral amount and ETH price.
 * Targets Health Factor ~1.40:
 *   HF = (collateralWETH * ethPrice * 0.80) / targetDebt = 1.40
 *   targetDebt = (collateralWETH * ethPrice * 0.80) / 1.40
 * Capped by contract's MAX_BORROW_LTV = 75%:
 *   maxBorrow = collateralWETH * ethPrice * 0.75
 * Uses Math.floor for consistent integer rounding across preview and submit.
 */
export function suggestedBorrowUSDC(collateralWETH: number, ethPrice: number): number {
  if (collateralWETH <= 0 || ethPrice <= 0) return 0;
  const targetDebt = (collateralWETH * ethPrice * 0.80) / 1.40;
  const maxBorrow = collateralWETH * ethPrice * 0.75;
  return Math.floor(Math.min(targetDebt, maxBorrow));
}
