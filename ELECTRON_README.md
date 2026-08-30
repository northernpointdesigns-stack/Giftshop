# Boutique POS Desktop Compilation Guide (.exe)

This application is equipped with direct, out-of-the-box support for compiling into a native offline **Windows Desktop Application (.exe installer)** using Electron and `electron-builder`.

---

## 🛠️ Section 1: How to Build the `.exe` Installer

Follow these quick steps on your local PC or laptop to package this POS into a single executable installer:

### Step 1: Install Local Node.js
If you haven't already, download and install **Node.js** (LTS recommended) on your machine:
🔗 [https://nodejs.org/](https://nodejs.org/)

### Step 2: Install Desktop Packaging Dependencies
Open your command prompt or terminal in this project folder and run:
```bash
npm install --save-dev electron electron-builder
```

### Step 3: Package the POS App into Windows `.exe`
Run the compilation script:
```bash
# 1. Compile the production optimized web assets
npm run build

# 2. Package the build output into an offline Windows Installer
npx electron-builder --win
```

### Step 4: Locate your Installer
Once complete, you will find your self-contained installer (`BoutiquePOS Setup.exe`) inside the newly created directory:
📂 `dist-desktop/`

---

## 🎨 Section 2: Personalizing Corporate Branding

The POS terminal is built with **100% white-labeling capability**! The owner can remove any reference to "Island POS" and configure custom branding, menus, and theme styles directly in the app.

### How to configure brand parameters:
1. Log into the **Admin Backend** (PIN: `admin123` or your customized admin PIN).
2. Navigate to the **Store Settings** tab.
3. Locate the **"Whitelabeling, Theme Colors & Navigation Labels"** panel.
4. **Customizing Options:**
   * **Remove "Island POS" References**: Check this checkbox to immediately strip the header and portal from default placeholder branding.
   * **POS Brand/App Title**: Enter your custom brand name (e.g. *Elite Fashion POS*).
   * **Short Badge Initials**: Enter initials for the top-left logo (e.g. *EFP*).
   * **Theme Accent Color**: Choose your corporate palette (Emerald, Royal Blue, Indigo, Violet, Warm Amber, Rose, or Cool Slate).
   * **Custom Navigation Tab Labels**: Change menu text (e.g. rename "Register" to "Sales counter", "Inventory" to "Warehouse").
   * **Custom Logo URL**: Input your web hosted transparent PNG or SVG logo to render directly in the terminal navbar!
5. Click **"Save All Store Settings"** to update the system in real time.

---

## ⚡ Section 3: Dual Display Support
* When compiling into a desktop `.exe`, you can click **Dual Display** in the header to spin up a secondary window, drag it onto an external pole display or customer-facing monitor, and let customers follow the real-time cart, price scans, and loyalty rewards!
