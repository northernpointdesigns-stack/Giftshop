const fs = require('fs');

const path = 'src/components/admin/BarcodePrinterModal.tsx';
let code = fs.readFileSync(path, 'utf8');

// 1. Update export type LabelPreset
code = code.replace(
  "export type LabelPreset = 'shelf_tag' | 'product_sticker' | 'jewelry' | 'avery_30up';",
  "export type LabelPreset = 'shelf_tag' | 'product_sticker' | 'jewelry' | 'avery_30up' | 'thermal_roll';"
);

// 2. Add import for printThermalLabels
if (!code.includes("import { printThermalLabels }")) {
  code = code.replace(
    "import JsBarcode from 'jsbarcode';",
    "import JsBarcode from 'jsbarcode';\nimport { printThermalLabels } from '../../utils/printThermalLabels';"
  );
}

// 3. Add thermal_roll to the <select> element
if (!code.includes('value="thermal_roll"')) {
  code = code.replace(
    '<option value="avery_30up">Avery 30-up Sheet (1.0" x 2.625")</option>',
    '<option value="avery_30up">Avery 30-up Sheet (1.0" x 2.625")</option>\n                    <option value="thermal_roll">Dymo / Brother Thermal Roll (2.25" x 1.25")</option>'
  );
}

// 4. Update the handlePrint function
const printTarget = `  const handlePrint = () => {
    window.print();
  };`;
const printReplacement = `  const handlePrint = () => {
    if (labelPreset === 'thermal_roll') {
      const selectedItems = inventory.filter(item => selectedItemIds.includes(item.id));
      printThermalLabels(
        selectedItems,
        quantities,
        symbology,
        showPrice,
        showBrand,
        showCategory,
        showSizeVariant,
        showVatBadge
      );
    } else {
      window.print();
    }
  };`;
if (code.includes(printTarget)) {
  code = code.replace(printTarget, printReplacement);
}

// 5. Update the text snippet in the preview
const textTarget = `{labelPreset === 'avery_30up' && 'Avery 30-up Sheet'}`;
const textReplacement = `{labelPreset === 'avery_30up' && 'Avery 30-up Sheet'}
                {labelPreset === 'thermal_roll' && 'Dymo/Brother Thermal Roll (2.25" x 1.25")'}`;
if (code.includes(textTarget)) {
  code = code.replace(textTarget, textReplacement);
}

// 6. Update the grid cols conditionally
const gridTarget = `labelPreset === 'avery_30up'
                  ? 'grid-cols-3 print:grid-cols-3'
                  : 'grid-cols-2 sm:grid-cols-3 print:grid-cols-3'`;
const gridReplacement = `labelPreset === 'avery_30up'
                  ? 'grid-cols-3 print:grid-cols-3'
                  : labelPreset === 'thermal_roll'
                  ? 'grid-cols-1 print:hidden'
                  : 'grid-cols-2 sm:grid-cols-3 print:grid-cols-3'`;
if (code.includes(gridTarget)) {
  code = code.replace(gridTarget, gridReplacement);
}

// Write the changes back to file
fs.writeFileSync(path, code);
console.log('BarcodePrinterModal.tsx updated successfully');
