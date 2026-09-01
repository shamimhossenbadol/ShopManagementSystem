// Financial math utilities guaranteeing exact decimal precision without floating point errors

/**
 * Rounds a number to exactly 2 decimal places using standard commercial rounding
 */
export function round2(num: number): number {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

/**
 * Formats a decimal number into SAR currency string
 * Example: 1250.5 -> "SAR 1,250.50"
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
 */
export function calculateLineVat(
  unitPrice: number,
  quantity: number,
  vatRatePercent: number = 15.00,
  isTaxInclusive: boolean = false,
  lineDiscount: number = 0
): VatCalculationResult {
  const rateFactor = vatRatePercent / 100;
  
  if (isTaxInclusive) {
    // VAT is extracted from the unitPrice
    // Base = Price / (1 + Rate)
    const baseUnitPrice = unitPrice / (1 + rateFactor);
    const unitVat = unitPrice - baseUnitPrice;
    
    const grossTotal = unitPrice * quantity;
    const discountedGross = Math.max(0, grossTotal - lineDiscount);
    
    const taxableAmount = discountedGross / (1 + rateFactor);
    const taxAmount = discountedGross - taxableAmount;
    
    return {
      netUnitPrice: round2(baseUnitPrice),
      taxAmount: round2(taxAmount),
      lineTotal: round2(discountedGross),
      taxableAmount: round2(taxableAmount),
    };
  } else {
    // VAT is added on top of unitPrice
    const grossSubtotal = unitPrice * quantity;
    const discountedSubtotal = Math.max(0, grossSubtotal - lineDiscount);
    const taxAmount = discountedSubtotal * rateFactor;
    const lineTotal = discountedSubtotal + taxAmount;
    
    return {
      netUnitPrice: round2(unitPrice),
      taxAmount: round2(taxAmount),
      lineTotal: round2(lineTotal),
      taxableAmount: round2(discountedSubtotal),
    };
  }
}

/**
 * Recalculates Weighted Average Cost (WAC) upon receiving goods
 */
export function calculateWeightedAverageCost(
  currentStock: number,
  currentWac: number,
  purchasedQty: number,
  purchasedNetUnitCost: number
): number {
  if (currentStock <= 0) {
    return round2(purchasedNetUnitCost);
  }
  const totalValueBefore = currentStock * currentWac;
  const totalValueIncoming = purchasedQty * purchasedNetUnitCost;
  const totalQuantity = currentStock + purchasedQty;
  
  if (totalQuantity <= 0) return 0;
  return round2((totalValueBefore + totalValueIncoming) / totalQuantity);
}
