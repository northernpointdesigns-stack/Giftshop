const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/components/pos/ReceiptModal.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Add import
if (!content.includes('printThermalReceipt')) {
  content = content.replace(
    "import { posDb } from '../../services/db';",
    "import { posDb } from '../../services/db';\nimport { printThermalReceipt } from '../../utils/printThermalReceipt';"
  );
}

// Replace window.print() inside handlePrint
content = content.replace(
  "  const handlePrint = () => {\n    window.print();\n  };",
  "  const handlePrint = () => {\n    printThermalReceipt(transaction, settings);\n  };"
);

// Replace auto-print
content = content.replace(
  "const t = setTimeout(() => window.print(), 500);",
  "const t = setTimeout(() => printThermalReceipt(transaction, settings), 500);"
);

// Remove the `thermal-receipt` class that we added to the div, as it's no longer needed in index.css
// Actually, let's just leave it, it's harmless or maybe we should remove it so we don't accidentally hide the app.
content = content.replace(
  'className="thermal-receipt bg-[#161B22]',
  'className="bg-[#161B22]'
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Updated ReceiptModal.tsx');
