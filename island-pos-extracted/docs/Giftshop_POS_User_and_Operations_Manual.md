# The Gift Shop POS — User & Operations Manual
**Version 1.0.0-customer** · 14-day trial / Payhip license activated

## Table of Contents
1. Introduction
2. Getting Started
3. Main Dashboard
4. Sales & Checkout
5. Products & Inventory
6. Customers
7. Staff Management
8. Settings
9. Reports
10. License Activation
11. Troubleshooting
1. Introduction
2. Getting Started
3. Main Dashboard
4. Sales & Checkout
5. Products & Inventory
6. Customers
7. Staff Management
8. Settings
9. Reports
10. License Activation
11. Troubleshooting
12. Frequently Asked Questions
13. Support

---

## 1. Introduction

The Gift Shop POS is a lightweight, cross-platform point-of-sale system built for retail shops, gift stores, and small hospitality counters.

### License Model

| | Trial Mode | Paid License |
|---|---|---|
| **Cost** | Free | One-time payment |
| **Duration** | 14 days | Permanent |
| **Activation needed?** | No | Yes — enter your Payhip key |

The trial and paid versions use the **same installer** — only the license key differs.

---

## 2. Getting Started

### Download
- [Mac (.dmg)](https://github.com/northernpointdesigns-stack/Giftshop/releases/download/v1.0.0-customer/The.Gift.Shop.POS-1.0.0-arm64.dmg) — Apple Silicon
- [Windows (.exe)](https://github.com/northernpointdesigns-stack/Giftshop/releases/download/v1.0.0-customer/The.Gift.Shop.POS.Setup.1.0.0.exe) — 64-bit

### Install on macOS
1. Double-click the `.dmg` → drag "The Gift Shop POS" to Applications.
2. If macOS says "unidentified developer": System Settings → Privacy & Security → Open Anyway.
3. Or run: `xattr -cr "/Applications/The Gift Shop POS.app"`
4. Launch from Applications.

### Install on Windows
1. Double-click the `.exe`.
2. If SmartScreen appears: click **More info → Run anyway**.
3. Follow the installer prompts.

### First Launch
The app starts a **14-day free trial** automatically. All features are available.

Data is stored locally:
- **macOS:** `~/Library/Application Support/The Gift Shop POS/`
- **Windows:** `%APPDATA%/The Gift Shop POS/`

---

## 3. Main Dashboard

The dashboard shows today's summary, recent transactions, and quick-action buttons.

**Sidebar navigation:**
- Dashboard — overview
- Sales — transactions list
- Products — item catalog
- Customers — customer directory
- Staff — employee accounts
- Reports — analytics
- Settings — store configuration
- Account/License — license status and activation

Click any sidebar item to navigate.

---

## 4. Sales & Checkout

### Creating a New Sale
1. Click **New Sale** on the Dashboard or sidebar.
2. Add items by scanning a barcode or selecting from the product list.
3. Adjust quantities or remove items.
4. Apply discounts or taxes (configured in Settings).
5. Click **Complete Sale** — choose payment method:
   - Cash
   - Card (if terminal configured)
   - Other

### Applying a Discount
- Click **Discount** on the checkout screen.
- Enter a percentage or fixed amount.
- Apply to the entire order or individual items.

### Processing a Return / Refund
1. Go to **Sales → All Transactions**.
2. Search by receipt number or date.
3. Click **Refund** to open transaction details.
4. Select items to return — refund amount auto-calculated.
5. Click **Process Refund** — manager PIN may be required.

### Printing / Emailing Receipts
- **Print:** requires a receipt printer (see Settings → Hardware).
- **Email:** enter customer email → receipt sent automatically.

### Offline Sales
Card terminal issues? Process as **Cash** — stored locally, works with zero internet.

---

## 5. Products & Inventory

### Adding a New Product
1. Go to **Products → Add Product**.
2. Fill in:
   - **Name** — shown on receipts and sales screen
   - **SKU** — unique identifier
   - **Price** — base price
   - **Category** — grouping (e.g., "Gifts", "Coffee")
3. Optional:
   - **Modifier groups** — selectable options (e.g., size)
   - **Barcode** — for scanning
   - **Cost** — for profit reports
   - **Tax category** — which tax rate applies
4. Click **Save**.

### Using Barcodes
- Print labels and attach to products.
- Scan at the **New Sale** screen to add items instantly.
- Supported: UPC-A, UPC-E, EAN-13, EAN-8, Code 128, Code 39.

### Categories
1. **Products → Categories → Add Category** → name + color.
2. Drag to reorder on the sales screen.

### Modifier Groups
1. **Products → Modifier Groups → Create**.
2. Add options (e.g., Small, Medium, Large), each with optional price override.
3. Assign the group to products. At sale time, the cashier selects modifiers.

### Inventory Tracking
- Enable per product in the product editor.
- Sales decrement count; returns increment it.
- Low-stock alerts appear on the Dashboard and **Reports → Inventory**.
- Settings → Inventory → **Block zero stock sales**.

---

## 6. Customers

### Adding a Customer
1. **Customers → Add Customer**.
2. Enter Name, Email, Phone (all optional except Name).
3. Click **Save**.

### Customer History
Click any customer to view past transactions (receipt number + date). Search by name, email, or phone.

### Loyalty Points (if enabled)
- Each $1 spent = 1 point (configurable in Settings).
- Points redeemable for discounts — set rate in Settings.
- View balance on customer profile.

---

## 7. Staff Management

### Adding a Staff Member
1. **Staff → Add Staff Member**.
2. Enter Name, Email, Password.
3. Assign a **Role**:
   - Admin — full access
   - Manager — sales/refunds/customers only
   - Cashier — sales only
4. Click **Save**.

### Roles & Permissions

| Role | Permissions |
|---|---|
| **Admin** | Full access — Settings, Staff, Returns, Reports |
| **Manager** | Sales, Returns, Customers — no Settings or Staff edits |
| **Cashier** | Sales only — restricted from Returns, Settings, Reports |

### Manager PIN
Assign a 4-digit PIN in the staff profile. Required for returns, discounts, voiding.

---

## 8. Settings

### Store Information
- Store name (on receipts)
- Receipt footer text
- Logo (optional)

### Taxes
1. **Settings → Taxes → Add Tax Rate**.
2. Enter Name and Rate (e.g., `8.25`).
3. Assign to products via the product editor.

### Payment Methods
- Defaults: Cash, Card, Other.
- For Card, select your terminal provider (Square, SumUp, etc.).

### Hardware
- **Receipt printer** — select model, set paper size (2" or 3").
- **Barcode scanner** — usually plug-and-play (USB/HID).
- **Cash drawer** — USB or printer-triggered.
- **Card reader** — USB or Bluetooth per provider.
- Run **Test Print** to verify.

### Currency & Language
- Currency symbol (USD, EUR, GBP)
- Date/time format

### Data Backup & Sync
- Local data in Application Support directory.
- Optional cloud sync (separate monthly fee).
- **Manual export:** Settings → Data → Export.

---

## 9. Reports

All reports filterable by date range.

### Sales Summary
Total sales, refunds, net revenue.

### Transaction List
Receipt number, date/time, cashier, items, total, payment method.

### Product Performance
Units sold and revenue per product.

### Inventory Report
All tracked products + current stock. Low stock highlighted.

### Staff Performance
Per-staff sales totals and transaction counts.

### Exporting
CSV or PDF via the **Export** button on each report.

---

## 10. License Activation

### Checking Status
Go to **Account / License** (or click your store name in top-right).
Shows: Status, Days remaining (if trial), and the registered email.

### Activating a New License
1. Click **Activate License** (or **Upgrade from Trial**).
2. Enter the **email** from your Payhip receipt.
3. Enter the **license key** exactly (copy-paste to avoid typos).
4. Click **Verify**.
Requires internet — verifies against Payhip. After success, works offline permanently.

### During Trial
- Starts a 14-day free trial on first launch.
- To unlock: purchase at [payhip.com/b/PHMGz](https://payhip.com/b/PHMGz), then enter the emailed key.

### After Activation
- Restart the app to complete activation.
- Status panel shows **Active** with your email.

### Reactivating on a New Machine
1. Reinstall the app from [GitHub releases](https://github.com/northernpointdesigns-stack/Giftshop/releases).
2. Launch → app detects new machine.
3. Click **Activate License** → enter email + key.
Up to 2 machines per key. Contact support to reset.

### Deactivating a License
**Account / License → Deactivate This Machine**. Frees up a slot for reuse.

### Recovering a Lost Key
Visit [payhip.com/orders](https://payhip.com/orders), enter your purchase email, view order history + key.

---

## 11. Troubleshooting

### App Won't Start
1. Confirm macOS 11+ / Windows 10 64-bit+.
2. Reinstall from [latest release](https://github.com/northernpointdesigns-stack/Giftshop/releases).
3. macOS: approve via System Settings → Privacy & Security.

### License Activation Fails ("Invalid Key")
1. Double-check email + key (copy-paste).
2. Confirm the key is for *The Gift Shop POS — Full License*.
3. Test at [payhip.com/orders](https://payhip.com/orders).
4. Contact support if still blocked.

### Trial Won't Advance / Expired Early
1. Verify device clock.
2. Reactivate your license (if paid) or restart trial with a fresh install.

### Receipt Printer Not Responding
1. Check cable/power.
2. Settings → Hardware → reselect printer + **Test Print**.

### Barcode Scanner Inputs Wrong Characters
1. Scanner must be in **HID/Keyboard Wedge** mode.
2. Reconfigure prefixes/suffixes per scanner manual.
3. Test by scanning into Notes.

---

## 12. Frequently Asked Questions

### Is my data private?
All sales/products/customer data live locally. Nothing is uploaded unless you enable cloud sync or export.

### What if my computer dies?
Reinstall + activate your existing key on the new machine. Contact support to reset activations if needed.

### Does it need internet?
No. Trial + daily use work offline. Internet is only needed for initial key activation, optional sync, and email receipts.

### Is there a subscription?
No. One-time purchase — use the app forever with no recurring fees.

### I paid but didn't get a key email.
Check spam/junk. Also find it anytime at [payhip.com/orders](https://payhip.com/orders).

---

## 13. Support

**Email:** support@your-store.example.com

Mention your order number or license key (not full card number) and describe your OS/version.

**Payhip:** [payhip.com/orders](https://payhip.com/orders) — view/re-download keys.

**GitHub:** [Report bugs](https://github.com/northernpointdesigns-stack/Giftshop/issues)

---
*© 2026 The Gift Shop POS — Version 1.0.0-customer*