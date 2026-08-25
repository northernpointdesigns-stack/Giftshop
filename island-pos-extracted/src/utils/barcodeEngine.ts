import { BarcodeMappingRule, InventoryItem, BarcodeAction } from '../types/pos';

export interface BarcodeScanResult {
  rawBarcode: string;
  matchedRule: BarcodeMappingRule | null;
  parsedSku: string;
  matchedItem: InventoryItem | null;
  action: BarcodeAction;
  quantity?: number;
  overridePrice?: number;
  message: string;
}

export const DEFAULT_BARCODE_RULES: BarcodeMappingRule[] = [
  {
    id: 'rule_plu_qty',
    name: 'PLU Scale Quantity Embedded (28xxxxx)',
    matchType: 'plu_prefix',
    pattern: '28',
    action: 'set_quantity',
    enabled: true,
    skuStartIndex: 2,
    skuLength: 5,
    valueStartIndex: 7,
    valueLength: 5,
    valueDivisor: 1,
    description: 'Matches 28 + 5-digit SKU + 5-digit Qty (e.g. 280000100005 -> SKU 00001, Qty 5)',
  },
  {
    id: 'rule_plu_price',
    name: 'PLU Embedded Price Override (21xxxxx)',
    matchType: 'plu_prefix',
    pattern: '21',
    action: 'price_embedded',
    enabled: true,
    skuStartIndex: 2,
    skuLength: 5,
    valueStartIndex: 7,
    valueLength: 5,
    valueDivisor: 100,
    description: 'Matches 21 + 5-digit SKU + 5-digit Price in cents (e.g. 210000101550 -> SKU 00001, Price 15.50)',
  },
  {
    id: 'rule_quick_add',
    name: 'Quick Add Cart Prefix (+)',
    matchType: 'prefix',
    pattern: '+',
    action: 'add_to_cart',
    enabled: true,
    description: 'Matches barcodes starting with "+" (e.g. +SKU-1001 -> adds item directly to cart)',
  },
  {
    id: 'rule_find_only',
    name: 'Find / Search Item Suffix (-FIND)',
    matchType: 'suffix',
    pattern: '-FIND',
    action: 'find_item',
    enabled: true,
    description: 'Matches barcodes ending with "-FIND" (e.g. SKU-1001-FIND -> searches without adding to cart)',
  },
  {
    id: 'rule_increment_qty',
    name: 'Increment Cart Quantity Suffix (++)',
    matchType: 'suffix',
    pattern: '++',
    action: 'increment_quantity',
    enabled: true,
    description: 'Matches barcodes ending with "++" (e.g. SKU-1001++ -> increments quantity in cart)',
  },
];

export function parseAndExecuteBarcode(
  rawBarcode: string,
  rules: BarcodeMappingRule[],
  inventory: InventoryItem[],
  enableEngine: boolean = true
): BarcodeScanResult {
  const trimmed = rawBarcode.trim();
  if (!trimmed) {
    return {
      rawBarcode,
      matchedRule: null,
      parsedSku: '',
      matchedItem: null,
      action: 'add_to_cart',
      message: 'Empty barcode scanned.',
    };
  }

  const activeRules = enableEngine ? (rules || []).filter((r) => r.enabled) : [];

  for (const rule of activeRules) {
    let matches = false;
    let targetSku = trimmed;
    let extractedQty: number | undefined = undefined;
    let extractedPrice: number | undefined = undefined;

    switch (rule.matchType) {
      case 'prefix':
        if (trimmed.startsWith(rule.pattern)) {
          matches = true;
          targetSku = trimmed.slice(rule.pattern.length);
        }
        break;

      case 'suffix':
        if (trimmed.endsWith(rule.pattern)) {
          matches = true;
          targetSku = trimmed.slice(0, trimmed.length - rule.pattern.length);
        }
        break;

      case 'exact':
        if (trimmed === rule.pattern) {
          matches = true;
          targetSku = trimmed;
        }
        break;

      case 'plu_prefix':
        if (trimmed.startsWith(rule.pattern)) {
          matches = true;
          const skuStart = rule.skuStartIndex ?? 2;
          const skuLen = rule.skuLength ?? 5;
          const valStart = rule.valueStartIndex ?? 7;
          const valLen = rule.valueLength ?? 5;
          const divisor = rule.valueDivisor || 1;

          if (trimmed.length >= skuStart + skuLen) {
            targetSku = trimmed.substring(skuStart, skuStart + skuLen);
          }

          if (trimmed.length >= valStart + valLen) {
            const rawValStr = trimmed.substring(valStart, valStart + valLen);
            const numVal = parseFloat(rawValStr);
            if (!isNaN(numVal)) {
              const val = numVal / divisor;
              if (rule.action === 'price_embedded') {
                extractedPrice = val;
              } else {
                extractedQty = val;
              }
            }
          }
        }
        break;

      case 'regex':
        try {
          const reg = new RegExp(rule.pattern);
          const match = trimmed.match(reg);
          if (match) {
            matches = true;
            targetSku = match[1] ? match[1] : trimmed;
          }
        } catch (e) {
          console.error('Invalid barcode regex pattern:', rule.pattern);
        }
        break;
    }

    if (matches) {
      // Look up inventory product by exact or unpadded SKU/ID
      let item = inventory.find(
        (i) => i.sku.toLowerCase() === targetSku.toLowerCase() || i.id.toLowerCase() === targetSku.toLowerCase()
      );

      if (!item) {
        // Strip leading zeroes for loose matching (e.g., PLU "00001" -> "1" or "SKU-1")
        const unpadded = targetSku.replace(/^0+/, '');
        item = inventory.find(
          (i) =>
            i.sku.toLowerCase() === unpadded.toLowerCase() ||
            i.sku.toLowerCase().endsWith(targetSku.toLowerCase()) ||
            i.sku.toLowerCase().endsWith(unpadded.toLowerCase())
        );
      }

      return {
        rawBarcode,
        matchedRule: rule,
        parsedSku: targetSku,
        matchedItem: item || null,
        action: rule.action,
        quantity: extractedQty,
        overridePrice: extractedPrice,
        message: item
          ? `Rule "${rule.name}" matched → ${rule.action.toUpperCase()} for "${item.name}"`
          : `Rule "${rule.name}" matched, but SKU "${targetSku}" was not found in catalog.`,
      };
    }
  }

  // Standard Fallback Scanning
  const fallbackItem = inventory.find(
    (i) => i.sku.toLowerCase() === trimmed.toLowerCase() || i.id.toLowerCase() === trimmed.toLowerCase()
  );

  return {
    rawBarcode,
    matchedRule: null,
    parsedSku: trimmed,
    matchedItem: fallbackItem || null,
    action: 'add_to_cart',
    message: fallbackItem
      ? `Standard Barcode scan → ADD TO CART`
      : `SKU / Barcode "${trimmed}" not found in catalog.`,
  };
}
