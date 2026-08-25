import { InventoryItem, Vendor } from '../types/pos';

export interface ParsedCsvRow {
  name: string;
  brand: string;
  category: string;
  productLine: string;
  size: string;
  variant: string;
  sku: string;
  retailPrice: number; // Net retail price saved to DB
  costBasis: number;
  stockLevel: number;
  minStockThreshold: number;
  vatRate: number;
  vendorName: string;
  // Extra calculation metadata for preview UI & tax audits
  netPrice?: number;
  vatAmount?: number;
  grossPrice?: number;
  categorySource?: 'mapped' | 'auto_rule' | 'fallback';
}

export interface FieldMapping {
  name: number;
  brand: number;
  category: number;
  productLine: number;
  size: number;
  variant: number;
  sku: number;
  retailPrice: number;
  costBasis: number;
  stockLevel: number;
  minStockThreshold: number;
  vatRate: number;
  vendorName: number;
}

export interface CategoryConfig {
  enableAutoAssign: boolean;
  defaultCategory: string;
  rules: { keyword: string; category: string }[];
}

export interface VatConfig {
  calculationMode: 'exclusive' | 'inclusive'; // 'exclusive' = CSV has Net Price (add VAT), 'inclusive' = CSV has Gross Price (extract VAT)
  defaultVatRate: number; // e.g. 0.15 for 15% Seychelles VAT
  applyGlobalOverride: boolean;
}

export const DEFAULT_CATEGORY_RULES = [
  { keyword: 't-shirt', category: 'T-Shirts' },
  { keyword: 'tee', category: 'T-Shirts' },
  { keyword: 'shirt', category: 'T-Shirts' },
  { keyword: 'mug', category: 'Mugs' },
  { keyword: 'cup', category: 'Mugs' },
  { keyword: 'ceramic', category: 'Mugs' },
  { keyword: 'bag', category: 'Bags' },
  { keyword: 'tote', category: 'Bags' },
  { keyword: 'purse', category: 'Bags' },
  { keyword: 'pareo', category: 'Pareos' },
  { keyword: 'sarong', category: 'Pareos' },
  { keyword: 'wrap', category: 'Pareos' },
  { keyword: 'soap', category: 'Soaps & Cosmetics' },
  { keyword: 'lotion', category: 'Soaps & Cosmetics' },
  { keyword: 'cream', category: 'Soaps & Cosmetics' },
  { keyword: 'craft', category: 'Souvenirs & Crafts' },
  { keyword: 'shell', category: 'Souvenirs & Crafts' },
  { keyword: 'keychain', category: 'Souvenirs & Crafts' },
];

/**
 * Robust CSV parser handling quotes, commas, and line endings.
 */
export function parseRawCsv(text: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentVal = '';
  let insideQuote = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (insideQuote && nextChar === '"') {
        currentVal += '"';
        i++; // skip escaped quote
      } else {
        insideQuote = !insideQuote;
      }
    } else if (char === ',' && !insideQuote) {
      currentRow.push(currentVal.trim());
      currentVal = '';
    } else if ((char === '\r' || char === '\n') && !insideQuote) {
      if (char === '\r' && nextChar === '\n') i++; // CRLF
      currentRow.push(currentVal.trim());
      if (currentRow.some((field) => field.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentVal = '';
    } else {
      currentVal += char;
    }
  }

  if (currentVal.length > 0 || currentRow.length > 0) {
    currentRow.push(currentVal.trim());
    if (currentRow.some((field) => field.length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

/**
 * Smart header matcher for auto-detecting CSV column mappings.
 */
export function getDefaultFieldMapping(rawHeaders: string[]): FieldMapping {
  const normalized = rawHeaders.map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ''));

  const findIndex = (...aliases: string[]): number => {
    for (const alias of aliases) {
      const idx = normalized.findIndex((h) => h.includes(alias));
      if (idx !== -1) return idx;
    }
    return -1;
  };

  return {
    name: findIndex('itemname', 'name', 'productname', 'title', 'description', 'item'),
    brand: findIndex('brand', 'vendor', 'supplier', 'collection', 'make'),
    category: findIndex('category', 'group', 'department', 'type', 'section'),
    productLine: findIndex('productline', 'line', 'quality', 'style', 'tier'),
    size: findIndex('size', 'target', 'demographic', 'fit'),
    variant: findIndex('variant', 'design', 'color', 'pattern'),
    sku: findIndex('sku', 'barcode', 'code', 'upc', 'ean', 'id'),
    retailPrice: findIndex('retailprice', 'price', 'retail', 'sellingprice', 'msrp'),
    costBasis: findIndex('costbasis', 'cost', 'unitcost', 'wholesale', 'buyprice'),
    stockLevel: findIndex('stocklevel', 'stock', 'quantity', 'qty', 'units', 'count'),
    minStockThreshold: findIndex('minstock', 'minthreshold', 'threshold', 'alertat', 'min'),
    vatRate: findIndex('vatrate', 'vat', 'tax', 'taxrate', 'vatpercent'),
    vendorName: findIndex('vendor', 'supplier', 'brand'),
  };
}

/**
 * Advanced CSV Parser handling explicit field mappings, category auto-assignment, and bulk VAT calculations.
 */
export function parseCsvWithAdvancedMapping(
  csvText: string,
  mapping: FieldMapping,
  categoryConfig: CategoryConfig,
  vatConfig: VatConfig
): { rows: ParsedCsvRow[]; rawHeaders: string[]; totalGridRows: number } {
  const grid = parseRawCsv(csvText);
  if (grid.length < 2) {
    return { rows: [], rawHeaders: grid[0] || [], totalGridRows: grid.length };
  }

  const rawHeaders = grid[0];
  const parsedRows: ParsedCsvRow[] = [];

  for (let r = 1; r < grid.length; r++) {
    const row = grid[r];
    if (!row || row.length === 0) continue;

    const rawName = mapping.name !== -1 ? row[mapping.name] || '' : row[0] || '';
    if (!rawName.trim()) continue;

    let brand = mapping.brand !== -1 ? row[mapping.brand] || '' : '';
    let category = mapping.category !== -1 ? row[mapping.category] || '' : '';
    let productLine = mapping.productLine !== -1 ? row[mapping.productLine] || '' : '';
    let size = mapping.size !== -1 ? row[mapping.size] || '' : '';
    let variant = mapping.variant !== -1 ? row[mapping.variant] || '' : '';
    let vendorName = mapping.vendorName !== -1 ? row[mapping.vendorName] || '' : '';

    const lowerName = rawName.toLowerCase();

    // Auto-detect Brand if missing
    if (!brand) {
      if (lowerName.includes('ocean') || lowerName.includes('seychelles')) {
        brand = 'Ocean Seychelles';
      } else if (lowerName.includes('souvenir') || lowerName.includes('boutique')) {
        brand = 'Souvenir Boutique';
      } else {
        brand = 'Ocean Seychelles';
      }
    }
    if (!vendorName) vendorName = brand;

    // Category Auto Assignment Logic
    let categorySource: 'mapped' | 'auto_rule' | 'fallback' = 'mapped';

    if (!category.trim()) {
      if (categoryConfig.enableAutoAssign) {
        let matched = false;

        // Try custom/default rules
        for (const rule of categoryConfig.rules) {
          if (lowerName.includes(rule.keyword.toLowerCase())) {
            category = rule.category;
            categorySource = 'auto_rule';
            matched = true;
            break;
          }
        }

        if (!matched) {
          category = categoryConfig.defaultCategory || 'Souvenirs & Crafts';
          categorySource = 'fallback';
        }
      } else {
        category = categoryConfig.defaultCategory || 'Souvenirs & Crafts';
        categorySource = 'fallback';
      }
    }

    // Auto-detect Line if missing
    if (!productLine) {
      if (lowerName.includes('luxury') || lowerName.includes('gold') || lowerName.includes('premium')) {
        productLine = 'Luxury Line';
      } else if (lowerName.includes('normal') || lowerName.includes('standard')) {
        productLine = 'Normal Line';
      } else {
        productLine = 'Standard Line';
      }
    }

    // Auto-detect Size / Demographic if missing
    if (!size) {
      if (lowerName.includes('kid') || lowerName.includes('child')) {
        size = 'Kids';
      } else if (lowerName.includes('women') || lowerName.includes('lady') || lowerName.includes('ladies')) {
        size = 'Women';
      } else if (lowerName.includes('adult') || lowerName.includes('men')) {
        size = 'Adults';
      } else {
        size = 'One Size';
      }
    }

    // SKU Auto-generation if missing
    let sku = mapping.sku !== -1 ? row[mapping.sku] || '' : '';
    if (!sku.trim()) {
      sku = `893${Math.floor(100000 + Math.random() * 900000)}`;
    }

    // Numerical values
    const rawPriceInput = mapping.retailPrice !== -1 ? parseFloat(row[mapping.retailPrice]?.replace(/[^0-9.]/g, '')) : 0;
    const parsedRetailInput = isNaN(rawPriceInput) || rawPriceInput <= 0 ? 15.0 : rawPriceInput;

    const rawCost = mapping.costBasis !== -1 ? parseFloat(row[mapping.costBasis]?.replace(/[^0-9.]/g, '')) : 0;
    const costBasis = isNaN(rawCost) ? Number((parsedRetailInput * 0.5).toFixed(2)) : rawCost;

    const rawStock = mapping.stockLevel !== -1 ? parseInt(row[mapping.stockLevel]?.replace(/[^0-9]/g, '')) : 0;
    const stockLevel = isNaN(rawStock) ? 20 : rawStock;

    const rawMin = mapping.minStockThreshold !== -1 ? parseInt(row[mapping.minStockThreshold]?.replace(/[^0-9]/g, '')) : 0;
    const minStockThreshold = isNaN(rawMin) || rawMin <= 0 ? 5 : rawMin;

    // VAT Rate Calculation Logic
    let vatRate = vatConfig.defaultVatRate; // default fallback (e.g. 0.15)

    if (!vatConfig.applyGlobalOverride && mapping.vatRate !== -1 && row[mapping.vatRate]) {
      const parsedVat = parseFloat(row[mapping.vatRate].replace(/[^0-9.]/g, ''));
      if (!isNaN(parsedVat) && parsedVat >= 0) {
        vatRate = parsedVat > 1 ? parsedVat / 100 : parsedVat;
      }
    }

    // Bulk VAT Math Calculations
    let netPrice: number;
    let vatAmount: number;
    let grossPrice: number;

    if (vatConfig.calculationMode === 'inclusive') {
      // Prices in CSV are Tax Inclusive (Gross Price)
      grossPrice = parsedRetailInput;
      netPrice = Number((grossPrice / (1 + vatRate)).toFixed(2));
      vatAmount = Number((grossPrice - netPrice).toFixed(2));
    } else {
      // Prices in CSV are Tax Exclusive (Net Price)
      netPrice = parsedRetailInput;
      vatAmount = Number((netPrice * vatRate).toFixed(2));
      grossPrice = Number((netPrice + vatAmount).toFixed(2));
    }

    parsedRows.push({
      name: rawName.trim(),
      brand,
      category,
      productLine,
      size,
      variant: variant || rawName.trim(),
      sku,
      retailPrice: netPrice, // Net price stored in database
      costBasis,
      stockLevel,
      minStockThreshold,
      vatRate,
      vendorName,
      netPrice,
      vatAmount,
      grossPrice,
      categorySource,
    });
  }

  return { rows: parsedRows, rawHeaders, totalGridRows: grid.length };
}

/**
 * Legacy compatibility wrapper.
 */
export function processCsvToInventoryRows(csvText: string): ParsedCsvRow[] {
  const grid = parseRawCsv(csvText);
  if (grid.length < 2) return [];

  const defaultMapping = getDefaultFieldMapping(grid[0]);
  const result = parseCsvWithAdvancedMapping(
    csvText,
    defaultMapping,
    { enableAutoAssign: true, defaultCategory: 'Souvenirs & Crafts', rules: DEFAULT_CATEGORY_RULES },
    { calculationMode: 'exclusive', defaultVatRate: 0.15, applyGlobalOverride: false }
  );

  return result.rows;
}

/**
 * Sample CSV for Ocean Seychelles Products
 */
export const SAMPLE_OCEAN_SEYCHELLES_CSV = `Brand,Item Name,Group Category,Product Line,Size Target,Barcode SKU,Retail Price,Cost Basis,Stock Qty,VAT Rate %
Ocean Seychelles,Ocean Seychelles T-Shirt - Turtle Cove,T-Shirts,Beach Heritage,Adults - Medium,893100101,25.00,12.50,30,15%
Ocean Seychelles,Ocean Seychelles T-Shirt - Turtle Cove,T-Shirts,Beach Heritage,Women - Small,893100102,25.00,12.50,22,15%
Ocean Seychelles,Ocean Seychelles T-Shirt - Turtle Cove,T-Shirts,Beach Heritage,Kids - Large,893100103,18.00,9.00,15,15%
Ocean Seychelles,Ocean Seychelles T-Shirt - Anse Source d'Argent,T-Shirts,Island Paradise,Adults - Large,893100104,28.00,14.00,25,15%
Ocean Seychelles,Ocean Seychelles T-Shirt - Anse Source d'Argent,T-Shirts,Island Paradise,Women - Medium,893100105,28.00,14.00,18,15%
Ocean Seychelles,Ocean Seychelles T-Shirt - Coco de Mer Heritage,T-Shirts,Botanical Line,Adults - XL,893100106,30.00,15.00,12,15%
Ocean Seychelles,Ocean Seychelles T-Shirt - Coco de Mer Heritage,T-Shirts,Botanical Line,Women - Small,893100107,30.00,15.00,10,15%
Ocean Seychelles,Ocean Seychelles T-Shirt - Praslin Sunset,T-Shirts,Sunset Collection,Kids - Medium,893100108,18.00,9.00,14,15%
Ocean Seychelles,Ocean Seychelles T-Shirt - Mahé Coral Reef,T-Shirts,Marine Life,Adults - Medium,893100109,26.00,13.00,20,15%
Ocean Seychelles,Ocean Seychelles Ceramic Mug - Luxury Gold Rim Line,Mugs,Luxury Line,12oz Gold,893100201,18.00,8.00,24,15%
Ocean Seychelles,Ocean Seychelles Ceramic Mug - Normal Standard Line,Mugs,Normal Line,11oz Ceramic,893100202,12.00,5.00,40,15%
`;

/**
 * Sample CSV for Souvenir Boutique Direct Items
 */
export const SAMPLE_SOUVENIR_BOUTIQUE_CSV = `Brand,Item Name,Group Category,Product Line,Size Target,Barcode SKU,Retail Price,Cost Basis,Stock Qty,VAT Rate %
Souvenir Boutique,Souvenir Boutique Canvas Tote Bag,Bags,Boutique Accessories,One Size,893200101,22.00,10.00,18,15%
Souvenir Boutique,Souvenir Boutique Woven Straw Beach Bag,Bags,Luxury Beachwear,One Size,893200102,34.00,16.00,12,15%
Souvenir Boutique,Souvenir Boutique Unisex Cotton T-Shirt - Tropical Palm,T-Shirts,Boutique Classics,Adults - Large,893200103,20.00,10.00,28,15%
Souvenir Boutique,Souvenir Boutique Handcrafted Shell Keychain,Accessories,Local Souvenirs,One Size,893200104,8.50,3.50,50,15%
`;
