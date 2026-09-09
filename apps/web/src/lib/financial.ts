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
 * Matches backend calculateLineVat exactly.
 */
export function calculateLineVat(
  unitPrice: number,
  quantity: number,
  vatRatePercent: number = 15.00,
  isTaxInclusive: boolean = false,
  lineDiscount: number = 0
): VatCalculationResult {
  const rateFactor = (vatRatePercent ?? 15.00) / 100;

  if (isTaxInclusive) {
    // VAT is extracted from the unitPrice
    // Base = Price / (1 + Rate)
    const baseUnitPrice = rateFactor > 0 ? unitPrice / (1 + rateFactor) : unitPrice;
    const grossTotal = unitPrice * quantity;
    const discountedGross = Math.max(0, grossTotal - lineDiscount);

    const taxableAmount = rateFactor > 0 ? discountedGross / (1 + rateFactor) : discountedGross;
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
