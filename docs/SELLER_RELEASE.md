# Seller release checklist (Giftshop POS)

## Two GitHub repos

| Repo | Purpose | Actions variable |
|------|---------|------------------|
| [Giftshop](https://github.com/northernpointdesigns-stack/Giftshop) | **Customer / business** builds (14-day trial + license) | Do **not** set `VITE_DISABLE_LICENSE` (or set `0`) |
| [Giftshopownervs](https://github.com/northernpointdesigns-stack/Giftshopownervs) | **Your** unlocked test builds | Set `VITE_DISABLE_LICENSE=1` |

Same source code. Difference is build-time env only.

## One-time Giftshop secrets/variables

**Settings → Secrets and variables → Actions**

- **Variable** `VITE_PURCHASE_URL` = your Payhip product/checkout URL
- **Secret** `VITE_PAYHIP_PRODUCT_SECRET` = Payhip product secret (license keys enabled)
- Optional signing secrets: see `RELEASE_SIGNING.md`

## Build customer files (no Mac required)

1. Push `main` to Giftshop (done when you push both remotes).
2. **Actions → Build Gift Shop POS Releases → Run workflow** (branch `main`).
3. Download artifacts:
   - `gift-shop-pos-win` (.exe)
   - `gift-shop-pos-mac` (.dmg / .zip)
   - `gift-shop-pos-setup-guide` (PDF)
4. Optional: **Build Gift Shop POS Android APK → Run workflow** → `.apk` + PDF.
5. Upload those files to your **Payhip** product (same product that issues license keys).

## Payhip product layout

- Enable **Software license keys** on the product.
- Attach: Windows installer, Mac DMG, optional APK, customer PDF.
- Buyers get the key by email / library — they enter it in the app.
- **No separate “paid unlocked binary”** is required; the key unlocks the trial build.

### Variations (vs LemonSqueezy)

Payhip is simpler. Recommended:

- **One product + license keys** (lifetime unlock, multi-file download).
- Or **separate products** for add-ons (training, extra site).
- Free listing can share the same installers; paid listing delivers the key.

You do **not** need LemonSqueezy-style multi-variant license APIs for a single lifetime POS unlock.

## Your unlocked builds only

1. Confirm ownervs variable `VITE_DISABLE_LICENSE=1`.
2. Run the same Actions on **Giftshopownervs**.
3. Keep those artifacts private — never upload to Payhip.

## Customer install (unsigned)

Covered in the PDF:

- **Windows:** SmartScreen → More info → Run anyway
- **Mac:** `xattr -cr "/Applications/The Gift Shop POS.app"` if “damaged”
- **Android:** allow unknown apps for APK install

## Re-download after purchase?

Not required to unlock. The license key unlocks the installed trial app.
Re-download from Payhip if they lost the installer or want a newer package.
