const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/components/pos/RefundModal.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Add import if missing
if (!content.includes("import { soundService } from '../../services/audio';")) {
  content = content.replace(
    "import { posDb } from '../../services/db';",
    "import { posDb } from '../../services/db';\nimport { soundService } from '../../services/audio';"
  );
}

// Add playChaChing before onCompleteRefund
const target = 'onCompleteRefund(refundTx);';
const replacement = 'soundService.playChaChing();\n      onCompleteRefund(refundTx);';

if (content.includes(target) && !content.includes(replacement)) {
  content = content.replace(target, replacement);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Successfully added cha-ching to refund');
} else {
  console.log('Target not found or already added in RefundModal');
}
