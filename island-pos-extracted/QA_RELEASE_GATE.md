# POS Release Gate — Master Test Plan & Results

**Build under test:** `The Gift Shop POS-1.0.0-arm64.dmg` (26 Aug 2026)  
**Release status:** **IN TESTING — not yet approved for release**  
**Rule:** A scenario is only marked Pass after evidence is recorded. `Not supported` is never treated as a pass.

## 1. Evidence collected

| Check | Result | Evidence |
|---|---|---|
| TypeScript validation | Pass | `npm run lint` |
| Production web bundle | Pass | `npm run build` |
| Apple Silicon DMG package | Pass | `npm run build-desktop`; 149 MB DMG |
| Basket discount VAT reconciliation | Pass after fix | A 100.00 item at 15% VAT with a 20.00 basket discount now saves 80.00 subtotal, 12.00 VAT, and 92.00 total. |
| 5,000-SKU import and search | Pass after fix | 5,000 rows imported in 462 ms with two storage writes; exact and partial lookup under 1 ms in the test environment. |
| Consignment sale, advance, return, EOD variance | Pass after fix | 5 sold/1 returned restores stock to 46; a 20.00 advance reduces the vendor balance; expected cash 176.00 and a 10.00 shortage closes at -10.00. |
| Physical peripherals | Not run | Requires the target scanner/printer/drawer/display/scale. |
| Live payment terminal | Not supported/testable | No integrated acquirer/terminal SDK is configured. |

## 2. Release-blocking financial scenarios

| ID | Scenario | Expected result | Status |
|---|---|---|---|
| FIN-001 | Item VAT, no discount | Saved transaction, receipt, report, and EOD agree | Pending |
| FIN-002 | Fixed basket discount with VAT | VAT is calculated on the reduced taxable amount | Pass after fix |
| FIN-003 | Percentage basket discount with VAT | VAT is calculated on the reduced taxable amount | Pending |
| FIN-004 | Damage/line markdown with VAT | Receipt, transaction, and reports agree | Pending |
| FIN-005 | Mixed VAT-rate basket | Each item uses its own configured VAT rate | Pending |
| FIN-006 | Tax-exempt item | No VAT is charged on the exempt line | Pending |
| FIN-007 | Rounding edge cases | Totals reconcile to two decimals, without lost/gained cents | Pending |
| FIN-008 | Primary/secondary currency | POS, checkout, receipt, and customer display agree | Pending |
| FIN-009 | Cash tender and change | Change is exact and receipt records tender/change | Pending |
| FIN-010 | Split tender | Tender lines sum to the exact transaction total | Pending |
| FIN-011 | Refund | Refund reverses correct stock/cash/report amounts | Pass — consignment cash-return scenario |
| FIN-012 | EOD close | Starting float + cash sales + adjustments - drops = expected cash | Pass — deliberate 10.00 shortage recorded as -10.00 variance |

## 3. Functional POS test matrix

| ID | Area | Scenario | Status |
|---|---|---|---|
| POS-001 | Scan | Standard barcode adds the exact catalog item | Pending |
| POS-002 | Scan | Unknown barcode shows an error and does not change cart | Pending |
| POS-003 | Scan | PLU quantity barcode parses item and quantity correctly | Pending |
| POS-004 | Scan | PLU embedded-price barcode is authorized and recorded correctly | Pending |
| POS-005 | Search | Name, SKU, and partial search return correct results | Pending |
| POS-006 | Cart | Increment/decrement/remove lines recalculate correctly | Pending |
| POS-007 | Cart | Void cart leaves no sale/stock mutation | Pending |
| POS-008 | Pricing | Retail, wholesale, and VIP price lists resolve correctly | Pending |
| POS-009 | Discount | Line markdown and basket discounts persist on receipt/history | Pending |
| POS-010 | Inventory | Sale reduces stock; refund restores stock exactly once | Pass — 50 → 45 sale → 46 return |
| POS-011 | Customer | Lookup, loyalty, and tier changes persist correctly | Pending |
| POS-012 | Receipt | Thermal/normal print layouts show correct tax, tender, and refund data | Pending |
| POS-013 | Customer display | Cart and completion state mirror the cashier screen | Pending |
| POS-014 | Backup | Backup export/import restores catalog, staff, settings, and transactions | Pending |
| POS-015 | Recovery | Corrupt/invalid backup is rejected without changing existing data | Pending |

## 4. Permissions, security, and reliability

| ID | Scenario | Status |
|---|---|---|
| SEC-001 | Cashier cannot reach admin configuration/cost-margin functions | Pending |
| SEC-002 | Refund, drawer open, and overrides require the configured authority | Pending |
| SEC-003 | Idle timeout returns to the login/lock screen | Pending |
| SEC-004 | Audit records include user, timestamp, action, and reason | Pending |
| SEC-005 | No PAN, CVV, or PIN is stored in app data/logs | Pending; no card-terminal integration is present |
| RES-001 | Offline cash sale is retained across restart | Pending |
| RES-002 | Offline queue state/total are accurate and reconnect does not duplicate records | Pending |
| RES-003 | Unexpected quit during cart/transaction does not corrupt persisted data | Pending |
| RES-004 | 100-item basket remains responsive and calculates correctly | Pending |
| RES-005 | Repeated open/close shift and backup operations remain stable | Pending |

## 5. Hardware and integration acceptance

| ID | Device/integration | Acceptance criterion | Status |
|---|---|---|---|
| HW-001 | USB/Bluetooth barcode scanner | Keyboard-wedge scans complete reliably; invalid scans beep/error | Pending on target hardware |
| HW-002 | Receipt printer | Correct paper output and recovery from paper-out/offline | Pending on target hardware |
| HW-003 | Cash drawer | Opens only for permitted cash/no-sale actions and logs events | Pending on target hardware |
| HW-004 | Customer display | Correct real-time cart/total mirroring on target display | Pending on target hardware |
| HW-005 | Scale | **Not supported unless a compatible scale integration is added** | Not supported |
| PAY-001 | Card/NFC/EMV terminal | **Not supported until an acquirer/terminal integration is added** | Not supported |

## 6. Required release path

1. Correct FIN-002 and add automated regression tests for all `FIN-*` calculations.
2. Rebuild the DMG and rerun type/build/package validation.
3. Run every `Pending` workflow manually in the packaged Mac app with test data; attach screenshots/receipts to this file.
4. Run `HW-*` with the exact hardware sold/supported and document models/drivers.
5. Keep release status **BLOCKED** until there are no failed financial/security tests and all supported scenarios are passed.
