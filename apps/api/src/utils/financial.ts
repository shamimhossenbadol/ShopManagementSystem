import Decimal from 'decimal.js';

// Configure Decimal.js for financial precision
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

/**
 * Rounds a number to exactly 2 decimal places using Round Half-Up
 */
export function round2(num: number): number {
  return new Decimal(num).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
}

/**
 * Rounds a number to exactly 4 decimal places using Round Half-Up
 */
export function round4(num: number): number {
  return new Decimal(num).toDecimalPlaces(4, Decimal.ROUND_HALF_UP).toNumber();
}

/**
 * Formats a decimal number into SAR currency string
 */
export function formatSAR(num: number): string {
  return `SAR ${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export interface VatCalculationResult {
  netUnitPrice: number;
  taxAmount: number;
  lineTotal: number;
  taxableAmount: number;
}

/**
 * Calculates VAT based on product pricing type (inclusive or exclusive)
 * Uses Decimal.js for exact arithmetic - no floating point errors
 */
export function calculateLineVat(
  unitPrice: number,
  quantity: number,
  vatRatePercent: number = 15.00,
  isTaxInclusive: boolean = false,
  lineDiscount: number = 0
): VatCalculationResult {
  const price = new Decimal(unitPrice);
  const qty = new Decimal(quantity);
  const rate = new Decimal(vatRatePercent).div(100);
  const discount = new Decimal(lineDiscount);

  if (isTaxInclusive) {
    const divisor = new Decimal(1).plus(rate);
    const baseUnitPrice = price.div(divisor);
    const grossTotal = price.times(qty);
    const discountedGross = Decimal.max(0, grossTotal.minus(discount));
    const taxableAmount = discountedGross.div(divisor);
    const taxAmount = discountedGross.minus(taxableAmount);

    return {
      netUnitPrice: baseUnitPrice.toDecimalPlaces(4, Decimal.ROUND_HALF_UP).toNumber(),
      taxAmount: taxAmount.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber(),
      lineTotal: discountedGross.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber(),
      taxableAmount: taxableAmount.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber(),
    };
  } else {
    const grossSubtotal = price.times(qty);
    const discountedSubtotal = Decimal.max(0, grossSubtotal.minus(discount));
    const taxAmount = discountedSubtotal.times(rate);
    const lineTotal = discountedSubtotal.plus(taxAmount);

    return {
      netUnitPrice: price.toDecimalPlaces(4, Decimal.ROUND_HALF_UP).toNumber(),
      taxAmount: taxAmount.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber(),
      lineTotal: lineTotal.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber(),
      taxableAmount: discountedSubtotal.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber(),
    };
  }
}

/**
 * Recalculates Weighted Average Cost (WAC) upon receiving goods
 * Uses Decimal.js for exact arithmetic
 */
export function calculateWeightedAverageCost(
  currentStock: number,
  currentWac: number,
  purchasedQty: number,
  purchasedNetUnitCost: number
): number {
  const stock = new Decimal(currentStock);
  const wac = new Decimal(currentWac);
  const qty = new Decimal(purchasedQty);
  const cost = new Decimal(purchasedNetUnitCost);

  if (stock.lte(0)) {
    return cost.toDecimalPlaces(4, Decimal.ROUND_HALF_UP).toNumber();
  }

  const totalValueBefore = stock.times(wac);
  const totalValueIncoming = qty.times(cost);
  const totalQuantity = stock.plus(qty);

  if (totalQuantity.lte(0)) return 0;
  return totalValueBefore.plus(totalValueIncoming).div(totalQuantity)
    .toDecimalPlaces(4, Decimal.ROUND_HALF_UP).toNumber();
}

/**
 * Distributes a total discount amount proportionally across line items
 * using the largest-remainder method to ensure the sum exactly equals the total.
 * Each line gets: share = totalDiscount * (lineAmount / sumOfAllLines)
 * Rounding residual is assigned to the line with the largest fractional remainder.
 */
export function allocateInvoiceDiscount(
  lineAmounts: { lineId: number; amount: number }[],
  totalDiscount: number
): Map<number, number> {
  const result = new Map<number, number>();
  if (totalDiscount <= 0 || lineAmounts.length === 0) return result;

  const total = new Decimal(totalDiscount);
  const sumAll = lineAmounts.reduce((s, l) => s.plus(new Decimal(l.amount)), new Decimal(0));
  if (sumAll.lte(0)) return result;

  // Calculate raw (unrounded) shares and their floor values
  const shares: { lineId: number; raw: Decimal; floored: number; remainder: number }[] = [];
  let flooredSum = new Decimal(0);

  for (const line of lineAmounts) {
    const raw = total.times(new Decimal(line.amount)).div(sumAll);
    const floored = raw.toDecimalPlaces(2, Decimal.ROUND_DOWN).toNumber();
    const remainder = raw.minus(new Decimal(floored)).toNumber();
    shares.push({ lineId: line.lineId, raw, floored, remainder });
    flooredSum = flooredSum.plus(new Decimal(floored));
  }

  // Distribute residual cents to lines with the largest remainders
  let residualCents = total.minus(flooredSum).times(100).round().toNumber();
  const sorted = [...shares].sort((a, b) => b.remainder - a.remainder);

  for (const share of sorted) {
    if (residualCents <= 0) break;
    share.floored = new Decimal(share.floored).plus(new Decimal('0.01')).toNumber();
    residualCents--;
  }

  for (const share of shares) {
    result.set(share.lineId, share.floored);
  }

  return result;
}
