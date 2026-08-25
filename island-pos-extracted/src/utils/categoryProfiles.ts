// Category profiling and customizable smart attribute assistance for retail and consignment inventory

export type CategoryProfileType =
  | 'apparel'
  | 'footwear'
  | 'cosmetics'
  | 'drinkware'
  | 'bags'
  | 'souvenirs'
  | 'general';

export interface DemographicOption {
  id: string;
  label: string;
  shortLabel: string;
  icon: string;
  defaultSizes: string[];
}

export const DEFAULT_DEMOGRAPHIC_OPTIONS: DemographicOption[] = [
  {
    id: 'Adult Male',
    label: 'Adult Male',
    shortLabel: 'Men',
    icon: '👨',
    defaultSizes: ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL'],
  },
  {
    id: 'Adult Female',
    label: 'Adult Female',
    shortLabel: 'Women',
    icon: '👩',
    defaultSizes: ['XS', 'S', 'M', 'L', 'XL', '2XL', 'Free Size'],
  },
  {
    id: 'Unisex Adult',
    label: 'Unisex Adult',
    shortLabel: 'Unisex',
    icon: '🧑',
    defaultSizes: ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', 'One Size'],
  },
  {
    id: 'Child / Kids',
    label: 'Child / Kids',
    shortLabel: 'Kids',
    icon: '👦',
    defaultSizes: ['2-3Y', '4-5Y', '6-7Y', '8-9Y', '10-11Y', '12-14Y', 'Kids S', 'Kids M', 'Kids L'],
  },
  {
    id: 'Baby / Infant',
    label: 'Baby / Infant',
    shortLabel: 'Baby',
    icon: '👶',
    defaultSizes: ['0-3M', '3-6M', '6-12M', '12-18M', '18-24M'],
  },
];

export interface CategoryPreset {
  id?: string;
  name: string;
  icon: string;
  profileType: CategoryProfileType;
  defaultBrand?: string;
  defaultProductLine?: string;
  variantLabel: string;
  variantPlaceholder: string;
  commonVariants: string[];
  commonMaterials?: string[];
  commonVolumes?: string[];
}

export const DEFAULT_CATEGORY_PRESETS: CategoryPreset[] = [
  {
    id: 'preset_tshirts',
    name: 'T-Shirts',
    icon: '👕',
    profileType: 'apparel',
    defaultProductLine: 'Beach Heritage',
    variantLabel: 'Design / Artwork / Color',
    variantPlaceholder: 'e.g. Turtle Cove, Coco de Mer, Sunset Palm',
    commonVariants: ['Turtle Cove', 'Coco de Mer Silhouette', 'Aldabra Giant', 'Sunset Beach', 'Vintage Seychelles', 'Ocean Palm', 'Classic Logo Navy'],
  },
  {
    id: 'preset_pareos',
    name: 'Pareos',
    icon: '🧣',
    profileType: 'apparel',
    defaultProductLine: 'Island Silk & Cotton',
    variantLabel: 'Pattern / Silk Print',
    variantPlaceholder: 'e.g. Tropical Flora, Turquoise Wave, Hibiscus Red',
    commonVariants: ['Tropical Flora', 'Turquoise Wave', 'Hibiscus Red', 'Sunset Coral', 'Sea Turtle Floral', 'Bora Palm'],
  },
  {
    id: 'preset_keyrings',
    name: 'Keyrings',
    icon: '🔑',
    profileType: 'souvenirs',
    defaultProductLine: 'Artisan Souvenirs',
    variantLabel: 'Motif / Shape',
    variantPlaceholder: 'e.g. Coco de Mer, Giant Tortoise, Island Map',
    commonVariants: ['Coco de Mer', 'Giant Tortoise', 'Seychelles Map', 'Dolphin', 'Granite Rock', 'Seychelles Flag'],
    commonMaterials: ['Carved Hardwood', 'Polished Coconut Shell', 'Pewter Metal', 'Resin & Sand', 'Acrylic'],
  },
  {
    id: 'preset_mugs',
    name: 'Mugs',
    icon: '☕',
    profileType: 'drinkware',
    defaultProductLine: 'Boutique Drinkware',
    variantLabel: 'Artwork / Graphic Theme',
    variantPlaceholder: 'e.g. Granite Boulders, Giant Tortoise, Sunset Cove',
    commonVariants: ['Granite Boulders', 'Giant Tortoise', 'Sunset Cove', 'Seychelles Flag Crest', 'Coco de Mer Art', 'Island Latitude'],
    commonMaterials: ['Gloss Ceramic', 'Matte Stoneware', 'Enamel Campfire', 'Stainless Steel', 'Glass'],
    commonVolumes: ['330ml (11oz)', '450ml (15oz)', '500ml', '750ml'],
  },
  {
    id: 'preset_bags',
    name: 'Bags',
    icon: '👜',
    profileType: 'bags',
    defaultProductLine: 'Eco Beach Bags',
    variantLabel: 'Print / Style Theme',
    variantPlaceholder: 'e.g. Beach Tote, Zipper Pouch, Palm Canvas',
    commonVariants: ['Beach Tote (Large)', 'Shoulder Canvas', 'Zipper Pouch', 'Drawstring Bag', 'Crossbody Mini'],
    commonMaterials: ['Heavy Canvas', 'Jute / Burlap', 'Organic Cotton', 'Recycled Ocean Plastic', 'Waterproof Ripstop'],
  },
  {
    id: 'preset_soaps',
    name: 'Soaps & Cosmetics',
    icon: '🧼',
    profileType: 'cosmetics',
    defaultProductLine: 'Island Botanicals Organic',
    variantLabel: 'Scent / Fragrance / Formula',
    variantPlaceholder: 'e.g. Vanilla & Coconut, Lemongrass, Ylang Ylang',
    commonVariants: ['Vanilla & Coconut', 'Lemongrass & Ginger', 'Ylang Ylang & Jasmine', 'Frangipani Island', 'Cinnamon & Clove', 'Pure Monoi Oil', 'Eucalyptus Mint'],
    commonVolumes: ['50g', '100g', '150g', '200g', '50ml', '100ml', '200ml', '250ml', '500ml'],
  },
  {
    id: 'preset_souvenirs',
    name: 'Souvenirs & Crafts',
    icon: '🐚',
    profileType: 'souvenirs',
    defaultProductLine: 'Handcrafted Island Art',
    variantLabel: 'Motif / Sculpture Subject',
    variantPlaceholder: 'e.g. Aldabra Tortoise, Coco de Mer Carving, Shell Trio',
    commonVariants: ['Aldabra Tortoise Carving', 'Coco de Mer Replica', 'Shell Windchime', 'Granite Boulder Figurine', 'Island Magnet Set'],
    commonMaterials: ['Local Wood (Calice du Pape)', 'Coconut Shell', 'Sea Glass & Shell', 'Resin & Granite Sand', 'Bronze'],
  },
];

const PRESETS_STORAGE_KEY = 'island_pos_custom_category_presets_v1';
const DEMO_STORAGE_KEY = 'island_pos_custom_demographic_options_v1';

/**
 * Load user configured category presets from local storage or defaults
 */
export function getStoredCategoryPresets(): CategoryPreset[] {
  try {
    const raw = localStorage.getItem(PRESETS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Error loading category presets:', e);
  }
  return DEFAULT_CATEGORY_PRESETS;
}

/**
 * Save user modified category presets
 */
export function saveStoredCategoryPresets(presets: CategoryPreset[]): void {
  try {
    localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(presets));
  } catch (e) {
    console.error('Error saving category presets:', e);
  }
}

/**
 * Load demographic & sizing options
 */
export function getStoredDemographicOptions(): DemographicOption[] {
  try {
    const raw = localStorage.getItem(DEMO_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Error loading demographics:', e);
  }
  return DEFAULT_DEMOGRAPHIC_OPTIONS;
}

/**
 * Save demographic & sizing options
 */
export function saveStoredDemographicOptions(options: DemographicOption[]): void {
  try {
    localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(options));
  } catch (e) {
    console.error('Error saving demographics:', e);
  }
}

/**
 * Reset all presets back to system defaults
 */
export function resetCategoryPresetsToDefault(): { presets: CategoryPreset[]; demographics: DemographicOption[] } {
  try {
    localStorage.removeItem(PRESETS_STORAGE_KEY);
    localStorage.removeItem(DEMO_STORAGE_KEY);
  } catch (e) {
    console.error('Error resetting category presets:', e);
  }
  return {
    presets: DEFAULT_CATEGORY_PRESETS,
    demographics: DEFAULT_DEMOGRAPHIC_OPTIONS,
  };
}

export const CATEGORY_PRESETS = DEFAULT_CATEGORY_PRESETS;
export const DEMOGRAPHIC_OPTIONS = DEFAULT_DEMOGRAPHIC_OPTIONS;

/**
 * Classifies any category string into an inventory profile
 */
export function getCategoryProfile(
  categoryName: string,
  customPresets?: CategoryPreset[]
): {
  profileType: CategoryProfileType;
  preset?: CategoryPreset;
  isApparel: boolean;
  isCosmetics: boolean;
  isDrinkware: boolean;
  isBags: boolean;
  isSouvenirs: boolean;
  isFootwear: boolean;
} {
  const norm = (categoryName || '').trim().toLowerCase();
  const presetsList = customPresets || getStoredCategoryPresets();

  // Look for direct preset match
  const exactPreset = presetsList.find(
    (p) => p.name.toLowerCase() === norm || norm.includes(p.name.toLowerCase())
  );

  // Apparel / Clothing keywords
  const isApparel =
    exactPreset?.profileType === 'apparel' ||
    /(t-?shirt|shirt|polo|top|hoodie|dress|pareo|sarong|short|pant|swim|towel|apparel|cloth|jacket|hat|cap|vest|tank)/i.test(
      norm
    );

  // Footwear
  const isFootwear = exactPreset?.profileType === 'footwear' || /(flip\s?flop|sandal|shoe|slipper|footwear|boot)/i.test(norm);

  // Cosmetics / Liquid / Soaps
  const isCosmetics =
    exactPreset?.profileType === 'cosmetics' ||
    /(soap|cosmetic|cream|lotion|oil|fragrance|perfume|shampoo|balm|body|scrub|butter|serum|candle)/i.test(
      norm
    );

  // Drinkware
  const isDrinkware =
    exactPreset?.profileType === 'drinkware' ||
    /(mug|cup|bottle|flask|tumbler|glass|coaster|pitcher)/i.test(norm);

  // Bags
  const isBags =
    exactPreset?.profileType === 'bags' ||
    /(bag|tote|backpack|pouch|clutch|duffel|wallet|purse)/i.test(norm);

  // Souvenirs, Keyrings, Trinkets, Crafts
  const isSouvenirs =
    exactPreset?.profileType === 'souvenirs' ||
    /(keyring|key\s?chain|keychain|magnet|souvenir|craft|postcard|sticker|statue|figurine|shell|trinket|ornament|wood|carving|jewel|bracelet|necklace|pendant|pin|badge)/i.test(
      norm
    );

  let profileType: CategoryProfileType = exactPreset?.profileType || 'general';
  if (!exactPreset) {
    if (isApparel) profileType = 'apparel';
    else if (isFootwear) profileType = 'footwear';
    else if (isCosmetics) profileType = 'cosmetics';
    else if (isDrinkware) profileType = 'drinkware';
    else if (isBags) profileType = 'bags';
    else if (isSouvenirs) profileType = 'souvenirs';
  }

  return {
    profileType,
    preset: exactPreset,
    isApparel: profileType === 'apparel',
    isCosmetics: profileType === 'cosmetics',
    isDrinkware: profileType === 'drinkware',
    isBags: profileType === 'bags',
    isSouvenirs: profileType === 'souvenirs',
    isFootwear: profileType === 'footwear',
  };
}

/**
 * Builds a standardized, clean inventory product name based on its attributes
 */
export function formatStandardItemName(params: {
  brand: string;
  category: string;
  variant?: string;
  demographic?: string;
  size?: string;
  material?: string;
  volumeOrWeight?: string;
}): string {
  const brand = (params.brand || '').trim();
  const category = (params.category || '').trim();
  const variant = (params.variant || '').trim();
  const demographic = (params.demographic || '').trim();
  const size = (params.size || '').trim();
  const material = (params.material || '').trim();
  const vol = (params.volumeOrWeight || '').trim();

  const profile = getCategoryProfile(category);

  if (profile.isApparel) {
    let fitTag = '';
    if (demographic && size) fitTag = ` (${demographic} - ${size})`;
    else if (size) fitTag = ` (${size})`;
    else if (demographic) fitTag = ` (${demographic})`;

    if (variant) {
      return `${brand ? brand + ' ' : ''}${category} - ${variant}${fitTag}`.trim();
    }
    return `${brand ? brand + ' ' : ''}${category}${fitTag}`.trim();
  }

  if (profile.isCosmetics) {
    const scent = variant ? ` - ${variant}` : '';
    const volTag = vol ? ` (${vol})` : size ? ` (${size})` : '';
    return `${brand ? brand + ' ' : ''}${category}${scent}${volTag}`.trim();
  }

  if (profile.isDrinkware) {
    const matTag = material ? ` ${material}` : '';
    const varTag = variant ? ` - ${variant}` : '';
    const volTag = vol ? ` (${vol})` : size ? ` (${size})` : '';
    return `${brand ? brand + ' ' : ''}${category}${matTag}${varTag}${volTag}`.trim();
  }

  if (profile.isSouvenirs || profile.isBags) {
    const matTag = material ? ` ${material}` : '';
    const varTag = variant ? ` - ${variant}` : '';
    return `${brand ? brand + ' ' : ''}${category}${matTag}${varTag}`.trim();
  }

  // General fallback
  const varTag = variant ? ` - ${variant}` : '';
  const sizeTag = size && size !== 'One Size' ? ` (${size})` : '';
  return `${brand ? brand + ' ' : ''}${category}${varTag}${sizeTag}`.trim();
}
