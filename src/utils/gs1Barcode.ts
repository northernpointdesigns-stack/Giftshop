// GS1 Barcode Generator & Parser utilities

/**
 * Calculates standard EAN-13 check digit
 */
export function calculateEAN13CheckDigit(digits12: string): number {
  if (digits12.length !== 12) return 0;
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const num = parseInt(digits12[i], 10);
    sum += i % 2 === 0 ? num : num * 3;
  }
  const remainder = sum % 10;
  return remainder === 0 ? 0 : 10 - remainder;
}

/**
 * Generates a valid 13-digit EAN barcode with Seychelles prefix (690-699/600 or custom 200 internal range)
 */
export function generateValidEAN13(customPrefix: string = '200'): string {
  const random8 = Math.floor(10000000 + Math.random() * 90000000).toString().substring(0, 9 - customPrefix.length);
  const first12 = (customPrefix + random8).padEnd(12, '0');
  const checkDigit = calculateEAN13CheckDigit(first12);
  return first12 + checkDigit.toString();
}

/**
 * Validates whether a barcode string is a valid EAN-13
 */
export function isValidEAN13(barcode: string): boolean {
  if (!/^\d{13}$/.test(barcode)) return false;
  const first12 = barcode.slice(0, 12);
  const checkDigit = parseInt(barcode[12], 10);
  return calculateEAN13CheckDigit(first12) === checkDigit;
}

/**
 * Parses GS1 Application Identifiers (AI) from a scanned raw 2D/GS1 string (e.g. (01)06901234567890(10)LOT123)
 */
export function parseGS1Data(rawScan: string): {
  gtin?: string;
  lot?: string;
  expiry?: string;
  serial?: string;
  cleanCode: string;
} {
  const clean = rawScan.replace(/[\r\n\t]/g, '').trim();
  const result: any = { cleanCode: clean };

  // Common GS1 pattern: (01)GTIN(17)EXPIRY(10)LOT
  const gtinMatch = clean.match(/\(01\)(\d{14})|\b01(\d{14})/);
  if (gtinMatch) {
    result.gtin = gtinMatch[1] || gtinMatch[2];
  }

  const lotMatch = clean.match(/\(10\)([a-zA-Z0-9]+)/);
  if (lotMatch) {
    result.lot = lotMatch[1];
  }

  const expMatch = clean.match(/\(17\)(\d{6})/);
  if (expMatch) {
    result.expiry = expMatch[1];
  }

  return result;
}
