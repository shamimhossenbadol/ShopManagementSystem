/**
 * Super Shop Variable-Weight & Price-Embedded Scale Barcode Parser
 * 
 * Standard EAN-13 Scale Barcode Format:
 * Prefix (2 digits, e.g. 20, 21, 28, 29) + PLU (5 digits) + Weight/Price (5 digits) + Checksum (1 digit)
 * Total: 13 digits
 * 
 * Example 1 (Weight-embedded, prefix 20):
 * "2001042014503" -> Prefix "20", PLU "01042" (or "1042"), Weight: 01450 grams = 1.450 kg
 * 
 * Example 2 (Price-embedded, prefix 21):
 * "2101042008505" -> Prefix "21", PLU "01042", Price: 00850 = 8.50 SAR
 */

export interface ParsedScaleBarcode {
  isScaleBarcode: boolean;
  prefix: string;
  pluCode: string;
  weightKg?: number;
  embeddedPrice?: number;
  rawBarcode: string;
}

export function parseScaleBarcode(
  barcode: string,
  allowedPrefixes: string[] = ['20', '21', '28', '29']
): ParsedScaleBarcode {
  const cleanBarcode = barcode.trim();
  
  if (cleanBarcode.length !== 13 || !/^\d{13}$/.test(cleanBarcode)) {
    return { isScaleBarcode: false, prefix: '', pluCode: '', rawBarcode: cleanBarcode };
  }

  const prefix = cleanBarcode.substring(0, 2);
  if (!allowedPrefixes.includes(prefix)) {
    return { isScaleBarcode: false, prefix, pluCode: '', rawBarcode: cleanBarcode };
  }

  const pluCodeRaw = cleanBarcode.substring(2, 7);
  // Normalize PLU (strip leading zeroes or preserve string representation)
  const pluCode = parseInt(pluCodeRaw, 10).toString();
  const valueField = parseInt(cleanBarcode.substring(7, 12), 10);

  if (prefix === '20' || prefix === '28') {
    // Weight in grams -> convert to kg (e.g. 1450g -> 1.450kg)
    const weightKg = Math.round((valueField / 1000) * 1000) / 1000;
    return {
      isScaleBarcode: true,
      prefix,
      pluCode,
      weightKg,
      rawBarcode: cleanBarcode,
    };
  } else {
    // Price embedded (e.g. 850 -> 8.50)
    const embeddedPrice = Math.round((valueField / 100) * 100) / 100;
    return {
      isScaleBarcode: true,
      prefix,
      pluCode,
      embeddedPrice,
      rawBarcode: cleanBarcode,
    };
  }
}
