import crypto from 'crypto';

/**
 * ZATCA (Saudi Tax Authority) Phase 1 & 2 TLV (Tag-Length-Value) Base64 Encoder
 * Tag 1: Seller's Name
 * Tag 2: VAT Registration Number (15 digits)
 * Tag 3: Timestamp (ISO 8601 UTC)
 * Tag 4: Invoice Total (with VAT)
 * Tag 5: Total VAT Amount
 */
export function generateZatcaTLVQR(
  sellerName: string,
  vatNumber: string,
  timestampIso: string,
  invoiceTotal: string,
  vatTotal: string
): string {
  const getTLVBuffer = (tag: number, value: string): Buffer => {
    const valueBuffer = Buffer.from(value, 'utf8');
    const tagBuffer = Buffer.from([tag]);
    const lengthBuffer = Buffer.from([valueBuffer.length]);
    return Buffer.concat([tagBuffer, lengthBuffer, valueBuffer]);
  };

  const tlvBuffers = [
    getTLVBuffer(1, sellerName),
    getTLVBuffer(2, vatNumber),
    getTLVBuffer(3, timestampIso),
    getTLVBuffer(4, invoiceTotal),
    getTLVBuffer(5, vatTotal),
  ];

  return Buffer.concat(tlvBuffers).toString('base64');
}

/**
 * Generates cryptographic SHA-256 hash for invoice chaining
 */
export function generateInvoiceHash(
  invoiceNo: string,
  previousHash: string,
  grandTotal: number,
  timestamp: string
): string {
  const payload = `${invoiceNo}|${previousHash}|${grandTotal.toFixed(2)}|${timestamp}`;
  return crypto.createHash('sha256').update(payload).digest('hex');
}
