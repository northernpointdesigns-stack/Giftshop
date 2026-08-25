const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/components/pos/CashierPOS.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Replace handleSearchKeyDown to add error beep
const target = `      if (filteredInventory.length === 1 && filteredInventory[0].stockLevel > 0) {
        soundService.playBeep();
        handleAddToCart(filteredInventory[0]);
        setSearchQuery('');
      }
    }
  };`;

const replacement = `      if (filteredInventory.length === 1 && filteredInventory[0].stockLevel > 0) {
        soundService.playBeep();
        handleAddToCart(filteredInventory[0]);
        setSearchQuery('');
        return;
      }
      soundService.playErrorBeep();
    }
  };`;

if (content.includes(target)) {
  content = content.replace(target, replacement);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Successfully added error beep to search');
} else {
  console.log('Target not found in CashierPOS');
}
