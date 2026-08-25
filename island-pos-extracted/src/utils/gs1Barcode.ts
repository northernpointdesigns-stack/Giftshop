/**
 * GS1 Barcode Utility Helper
 * Provides GS1 GTIN-13 / GTIN-12 / GS1-128 generation,
 * Modulo 10 check digit calculation, and GS1 compliance validation.
 */

/**
 * Calculates the official GS1 Modulo-10 check digit for GTIN (8, 12, 13, or 14 digits).
 * Algorithm: Multiply digits from right to left alternating by 3 and 1, sum them up,
 * and calculate (10 - (sum % 10)) % 10.
 */
export function calculateGS1CheckDigit(digitsWithoutCheck: string): number {
  const digits = digitsWithoutCheck.replace(/\D/g, '');
  let sum = 0;
  let multiplier = 3;

  for (let i = digits.length - 1; i >= 0; i--) {
    sum += parseInt(digits[i], 10) * multiplier;
    multiplier = multiplier === 3 ? 1 : 3;
  }

  const remainder = sum % 10;
  return remainder === 0 ? 0 : 10 - remainder;
}

/**
 * Validates whether a barcode string is a valid GS1 GTIN-13, GTIN-12 (UPC-A), or GTIN-8.
 */
export function validateGS1GTIN(barcode: string): { isValid: boolean; reason?: string; format?: string } {
  const cleaned = barcode.replace(/\D/g, '');

  if (![8, 12, 13, 14].includes(cleaned.length)) {
    return { isValid: false, reason: 'Length must be 8, 12, 13, or 14 digits for GTIN compliance.' };
  }

  const payload = cleaned.slice(0, -1);
  const providedCheckDigit = parseInt(cleaned.slice(-1), 10);
  const expectedCheckDigit = calculateGS1CheckDigit(payload);

  if (providedCheckDigit !== expectedCheckDigit) {
    return {
      isValid: false,
      reason: `Invalid GS1 check digit. Expected ${expectedCheckDigit}, got ${providedCheckDigit}.`,
    };
  }

  const formatMap: Record<number, string> = {
    8: 'GTIN-8 (EAN-8)',
    12: 'GTIN-12 (UPC-A)',
    13: 'GTIN-13 (EAN-13)',
    14: 'GTIN-14 (ITF-14 / Shipping)',
  };

  return { isValid: true, format: formatMap[cleaned.length] };
}

/**
 * Generates a valid GS1 GTIN-13 compliant barcode string.
 * @param prefix 3-digit GS1 country / company prefix (e.g. "690", "893", "950" internal)
 * @param itemRef 9-digit item reference sequence or random digits
 */
export function generateGS1GTIN13(prefix: string = '950', itemRef?: string): string {
  const cleanPrefix = prefix.replace(/\D/g, '').padEnd(3, '0').slice(0, 3);
  
  let cleanItemRef = itemRef ? itemRef.replace(/\D/g, '') : '';
  if (cleanItemRef.length < 9) {
    const randomSeed = Math.floor(100000000 + Math.random() * 900000000).toString();
    cleanItemRef = (cleanItemRef + randomSeed).slice(0, 9);
  } else {
    cleanItemRef = cleanItemRef.slice(0, 9);
  }

  const payload12 = `${cleanPrefix}${cleanItemRef}`;
  const checkDigit = calculateGS1CheckDigit(payload12);

  return `${payload12}${checkDigit}`;
}

/**
 * Formats GTIN string into human readable GS1 spacing (e.g., 9 501234 567890).
 */
export function formatGS1Display(gtin: string): string {
  const cleaned = gtin.replace(/\D/g, '');
  if (cleaned.length === 13) {
    return `${cleaned.slice(0, 1)} ${cleaned.slice(1, 7)} ${cleaned.slice(7, 13)}`;
  }
  if (cleaned.length === 12) {
    return `${cleaned.slice(0, 1)} ${cleaned.slice(1, 6)} ${cleaned.slice(6, 11)} ${cleaned.slice(11)}`;
  }
  return gtin;
}
