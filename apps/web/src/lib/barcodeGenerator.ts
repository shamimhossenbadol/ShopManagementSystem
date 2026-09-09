/**
 * High-Precision Vector Barcode Generator
 * 
 * Supports:
 * - Code 128 (Universal alphanumeric, Auto B/C mode switching, modulo 103 checksum)
 * - EAN-13 / UPC-A (Standard retail GTIN with automatic parity calculation and guard bars)
 * - QR Code (2D matrix symbology using the qrcode engine)
 * 
 * Outputs crisp, pixel-perfect SVGs with zero anti-aliasing blur for thermal and laser printers.
 */

import QRCode from 'qrcode';

// ==========================================
// CODE 128 SYMBOLOGY PATTERNS & ENGINE
// ==========================================

// Standard 107 Code 128 symbol patterns (each number is the width of consecutive 1s and 0s, 6 elements totaling 11 modules, plus stop character with 13 modules)
const CODE128_PATTERNS: string[] = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213', // 0-9
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132', // 10-19
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211', // 20-29
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313', // 30-39
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331', // 40-49
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111', // 50-59
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214', // 60-69
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111', // 70-79
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141', // 80-89
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141', // 90-99
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112' // 100-106 (106 is STOP pattern: 7 elements totaling 13 modules)
];

const CODE128_START_B = 104;
const CODE128_START_C = 105;
const CODE128_CODE_B = 100;
const CODE128_CODE_C = 99;
const CODE128_STOP = 106;

/**
 * Converts a pattern of alternating bar/space widths (e.g. '212222') into binary string of 1s and 0s
 */
function patternToModules(pattern: string): string {
  let result = '';
  let isBar = true;
  for (let i = 0; i < pattern.length; i++) {
    const width = parseInt(pattern[i], 10);
    result += (isBar ? '1' : '0').repeat(width);
    isBar = !isBar;
  }
  return result;
}

/**
 * Encodes arbitrary string into Code 128 binary modules (1=bar, 0=space)
 * Uses automatic B/C switching for maximum compaction of digit sequences
 */
export function encodeCode128(text: string): { modules: string; encodedText: string } {
  const clean = (text || '').trim() || '0000';
  const symbols: number[] = [];

  // Determine starting mode
  let isDigitsStart = clean.length >= 4 && /^\d{4}/.test(clean);
  let currentMode: 'B' | 'C' = isDigitsStart ? 'C' : 'B';
  symbols.push(currentMode === 'C' ? CODE128_START_C : CODE128_START_B);

  let i = 0;
  while (i < clean.length) {
    if (currentMode === 'C') {
      // Check if next 2 characters are digits
      if (i + 1 < clean.length && /^\d{2}$/.test(clean.substring(i, i + 2))) {
        symbols.push(parseInt(clean.substring(i, i + 2), 10));
        i += 2;
      } else {
        // Switch to B
        symbols.push(CODE128_CODE_B);
        currentMode = 'B';
      }
    } else {
      // Current mode is B
      // Lookahead: if 4 or more digits follow, switch to C
      if (clean.length - i >= 4 && /^\d{4}/.test(clean.substring(i, i + 4))) {
        symbols.push(CODE128_CODE_C);
        currentMode = 'C';
      } else {
        const charCode = clean.charCodeAt(i);
        if (charCode >= 32 && charCode <= 126) {
          symbols.push(charCode - 32);
        } else {
          // Fallback for non-ASCII
          symbols.push(0); // Space
        }
        i += 1;
      }
    }
  }

  // Calculate modulo 103 checksum
  let checksum = symbols[0];
  for (let pos = 1; pos < symbols.length; pos++) {
    checksum += symbols[pos] * pos;
  }
  symbols.push(checksum % 103);
  symbols.push(CODE128_STOP);

  // Convert symbols to full binary module string
  let modules = '';
  // Quiet zone: 10 modules
  modules += '0000000000';
  for (const sym of symbols) {
    modules += patternToModules(CODE128_PATTERNS[sym]);
  }
  // Quiet zone: 10 modules
  modules += '0000000000';

  return { modules, encodedText: clean };
}

// ==========================================
// EAN-13 / UPC SYMBOLOGY PATTERNS & ENGINE
// ==========================================

const EAN_L_CODES = [
  '0001101', '0011001', '0010011', '0111101', '0100011',
  '0110001', '0101111', '0111011', '0110111', '0001011'
];
const EAN_G_CODES = [
  '0100111', '0110011', '0011011', '0100001', '0011101',
  '0111001', '0000101', '0010001', '0001001', '0010111'
];
const EAN_R_CODES = [
  '1110010', '1100110', '1101100', '1000010', '1011100',
  '1001110', '1010000', '1000100', '1001000', '1110100'
];
const EAN_PARITY_PATTERNS = [
  'LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG',
  'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL'
];

/**
 * Calculates official EAN-13 check digit (Modulo 10 with weights 1 and 3)
 */
export function calculateEan13Checksum(digits12: string): number {
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = parseInt(digits12[i], 10) || 0;
    sum += i % 2 === 0 ? digit : digit * 3;
  }
  const mod = sum % 10;
  return mod === 0 ? 0 : 10 - mod;
}

/**
 * Encodes numeric string into standard EAN-13 barcode modules
 */
export function encodeEan13(rawDigits: string): { modules: string; fullEan: string } | null {
  const digits = (rawDigits || '').replace(/\D/g, '');
  if (!digits) return null;
  let fullEan = '';

  if (digits.length === 12) {
    const check = calculateEan13Checksum(digits);
    fullEan = digits + check;
  } else if (digits.length === 13) {
    fullEan = digits;
  } else if (digits.length < 12) {
    // Pad with leading zeros up to 12 digits then calculate checksum
    const padded = digits.padStart(12, '0');
    const check = calculateEan13Checksum(padded);
    fullEan = padded + check;
  } else {
    // Truncate to 12 digits + calculate check
    const truncated = digits.substring(0, 12);
    fullEan = truncated + calculateEan13Checksum(truncated);
  }

  const firstDigit = parseInt(fullEan[0], 10);
  const parity = EAN_PARITY_PATTERNS[firstDigit];
  if (!parity) return null;

  let modules = '';
  // Left quiet zone (7 modules)
  modules += '0000000';
  // Normal Guard bar: 101
  modules += '101';

  // Left 6 digits (using L or G patterns based on first digit parity)
  for (let i = 1; i <= 6; i++) {
    const digit = parseInt(fullEan[i], 10);
    const patternType = parity[i - 1];
    modules += patternType === 'L' ? EAN_L_CODES[digit] : EAN_G_CODES[digit];
  }

  // Center Guard bar: 01010
  modules += '01010';

  // Right 6 digits (using R patterns)
  for (let i = 7; i <= 12; i++) {
    const digit = parseInt(fullEan[i], 10);
    modules += EAN_R_CODES[digit];
  }

  // Right Guard bar: 101
  modules += '101';
  // Right quiet zone (7 modules)
  modules += '0000000';

  return { modules, fullEan };
}

// ==========================================
// VECTOR SVG RENDERING ENGINE
// ==========================================

export interface BarcodeRenderOptions {
  height?: number;           // Bar height in pixels (default: 36)
  barWidth?: number;         // Width per module in px (default: 1.5)
  showText?: boolean;        // Include human-readable text below barcode (default: true)
  fontSize?: number;         // Text font size (default: 10)
  textColor?: string;        // Text color (default: #000000)
  barColor?: string;         // Bar color (default: #000000)
  bgColor?: string;          // Background color (default: transparent)
  format?: 'CODE128' | 'EAN13' | 'QR';
}

/**
 * Converts a binary module string ('1101001...') into an optimized SVG string
 */
function modulesToSvg(
  modules: string,
  displayText: string,
  options: BarcodeRenderOptions
): string {
  const height = options.height || 36;
  const barWidth = options.barWidth || 1.5;
  const showText = options.showText !== false;
  const fontSize = options.fontSize || 10;
  const barColor = options.barColor || '#000000';
  const textColor = options.textColor || '#000000';
  const totalWidth = modules.length * barWidth;
  const textSpace = showText ? fontSize + 4 : 0;
  const totalHeight = height + textSpace;

  // Build SVG path rects by grouping contiguous 1s for minimal DOM overhead and zero sub-pixel rendering gaps
  let pathData = '';
  let inBar = false;
  let startX = 0;

  for (let i = 0; i < modules.length; i++) {
    if (modules[i] === '1') {
      if (!inBar) {
        startX = i * barWidth;
        inBar = true;
      }
    } else {
      if (inBar) {
        const width = i * barWidth - startX;
        pathData += `M${startX.toFixed(2)},0 h${width.toFixed(2)} v${height} h-${width.toFixed(2)} Z `;
        inBar = false;
      }
    }
  }
  if (inBar) {
    const width = modules.length * barWidth - startX;
    pathData += `M${startX.toFixed(2)},0 h${width.toFixed(2)} v${height} h-${width.toFixed(2)} Z `;
  }

  const textSvg = showText
    ? `<text x="${(totalWidth / 2).toFixed(1)}" y="${(height + fontSize + 1).toFixed(1)}" text-anchor="middle" font-family="'JetBrains Mono', monospace, sans-serif" font-size="${fontSize}px" font-weight="700" fill="${textColor}" letter-spacing="1px">${displayText}</text>`
    : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalWidth.toFixed(1)} ${totalHeight.toFixed(1)}" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" style="display:block; overflow:visible;">
    <path d="${pathData}" fill="${barColor}" />
    ${textSvg}
  </svg>`;
}

/**
 * Generates an SVG string for Code 128 barcode
 */
export function generateCode128Svg(value: string, options: BarcodeRenderOptions = {}): string {
  const { modules, encodedText } = encodeCode128(value);
  return modulesToSvg(modules, encodedText, options);
}

/**
 * Generates an SVG string for EAN-13 barcode with automatic fallback to Code-128 if not purely numeric
 */
export function generateEan13Svg(value: string, options: BarcodeRenderOptions = {}): string {
  const eanResult = encodeEan13(value);
  if (eanResult) {
    return modulesToSvg(eanResult.modules, eanResult.fullEan, options);
  }
  return generateCode128Svg(value, options);
}

/**
 * Generates a QR Code as pure vector SVG string
 */
export async function generateQrCodeSvg(value: string, size: number = 80): Promise<string> {
  try {
    const svg = await QRCode.toString(value || '0', {
      type: 'svg',
      margin: 1,
      width: size,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    });
    return svg;
  } catch (err) {
    console.error('QR code generation error:', err);
    return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><rect width="${size}" height="${size}" fill="#eee"/></svg>`;
  }
}

/**
 * Master Barcode Vector Generator
 * Automatically picks best format (EAN13 if 12-13 digits, Code-128 for alphanumeric, QR code if selected)
 */
export async function generateBarcodeVector(
  value: string,
  format: 'AUTO' | 'CODE128' | 'EAN13' | 'QR' = 'AUTO',
  options: BarcodeRenderOptions = {}
): Promise<{ svg: string; symbology: string; cleanValue: string }> {
  const cleanVal = (value || '').trim() || '0000';

  if (format === 'QR') {
    const svg = await generateQrCodeSvg(cleanVal, options.height ? options.height * 1.5 : 80);
    return { svg, symbology: 'QR Code', cleanValue: cleanVal };
  }

  const isEanEligible = /^\d{12,13}$/.test(cleanVal);
  if (format === 'EAN13' || (format === 'AUTO' && isEanEligible)) {
    const ean = encodeEan13(cleanVal);
    if (ean) {
      const svg = modulesToSvg(ean.modules, ean.fullEan, options);
      return { svg, symbology: 'EAN-13', cleanValue: ean.fullEan };
    }
  }

  // Universal Code 128
  const { modules, encodedText } = encodeCode128(cleanVal);
  const svg = modulesToSvg(modules, encodedText, options);
  return { svg, symbology: 'Code 128', cleanValue: encodedText };
}
