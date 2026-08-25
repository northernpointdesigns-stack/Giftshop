const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/utils/printThermalReceipt.ts');
let content = fs.readFileSync(filePath, 'utf8');

content = content.replace(
  '<span>${primarySymbol}${item.totalPrice.toFixed(2)}</span>\n      </div>\n    </div>',
  '<span>${primarySymbol}${item.totalPrice.toFixed(2)}</span>\n      </div>\n      ${item.discountAmount && item.discountAmount > 0 ? `<div class="item-discount" style="text-align: right; font-style: italic; font-size: 10px;">- Damaged Markdown: ${primarySymbol}${item.discountAmount.toFixed(2)}</div>` : \'\'}\n    </div>'
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Fixed item discountAmount');
