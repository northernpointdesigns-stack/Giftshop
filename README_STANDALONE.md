# Seychelles Ocean Retail POS • Standalone Software & Native Builds

This repository is pre-configured to build fully standalone, professional desktop applications for **macOS (M1 onwards & Intel)**, **Windows**, and **Android** using **Electron** and **Capacitor**.

To make deployment seamless, we have also configured a **GitHub Actions Automation Pipeline** so that you can compile your installers automatically by pushing your code to GitHub!

---

## 🚀 The Easiest Way: GitHub Actions (No local setup required)

We have created an automated building system in `.github/workflows/build-standalone.yml`. When you push this code to your own GitHub repository, GitHub's secure cloud servers will build everything for you:

1. **Push your code** to GitHub (`main` or `master` branch).
2. Go to your repository on **GitHub.com**.
3. Click the **Actions** tab at the top.
4. Select the **Build Standalone Desktop & Mobile Apps** workflow.
5. Once complete (takes ~4-5 mins), scroll to the bottom of the successful run page to find the **Artifacts** section.
6. **Download your compiled apps** directly:
   - 🍏 **macOS:** `.dmg` installer & `.zip` bundle (universal - works on Apple Silicon M1/M2/M3 & Intel Macs).
   - 🪟 **Windows:** `.exe` setup wizard (NSIS) and portable `.exe`.
   - 🤖 **Android:** `.apk` package ready to sideload on tablets or POS terminals.

---

## 🍏 Building Locally on macOS (M1/M2/M3 or Intel)

To build a native macOS app bundle (`.app`) or disk image (`.dmg`) directly on your Mac:

### 1. Prerequisites
Ensure you have **Node.js 18+** installed on your Mac.

### 2. Install Dependencies
Open your Mac Terminal in the project root folder and run:
```bash
npm install
```

### 3. Build & Package
Run the dedicated Apple Silicon & Intel Universal builder command:
```bash
npm run electron:build:mac
```
*If you want to compile strictly for Apple Silicon M1 onwards to save space:*
```bash
npm run electron:build:mac:m1
```

The compiled native Mac installer will be generated in:
📁 `/dist-desktop/Seychelles Ocean Retail POS-1.4.0-arm64.dmg` (for M1 onwards)

---

## 🪟 Building Locally on Windows

To build a native Windows `.exe` executable installer on your Windows computer:

### 1. Prerequisites
Ensure you have **Node.js 18+** installed on your PC.

### 2. Install Dependencies
Open Command Prompt, PowerShell, or Git Bash in the project root folder and run:
```bash
npm install
```

### 3. Build & Package
Run the Windows executable compiler:
```bash
npm run electron:build:win
```

The compiled Windows installer will be generated in:
📁 `\dist-desktop\Ocean Retail POS Setup 1.4.0.exe`

---

## 🤖 Building Locally for Android

To run and compile the Android app locally on your computer:

### 1. Prerequisites
- Install [Android Studio](https://developer.android.com/studio).
- Install the Android SDK and Command Line Tools.

### 2. Initialize Capacitor & Create Android App Wrapper
Run the following scripts in your terminal:
```bash
# Compile the web application
npm run build

# Add the Android platform
npx cap add android

# Sync your web code to the Android shell
npx cap sync android
```

### 3. Build APK
- To build the APK directly from your command line:
  ```bash
  cd android && ./gradlew assembleDebug
  ```
  The ready-to-test APK will be located in `/android/app/build/outputs/apk/debug/app-debug.apk`.
- Alternatively, open the `/android` folder in **Android Studio** and click **Build > Build Bundle(s) / APK(s) > Build APK(s)** to export your application safely.

---

## 🛠️ Advanced Offline Hardware Capabilities Pre-Configured
Our native desktop code (`/electron/main.cjs` and `/src/services/installService.ts`) has native modules initialized to enable high-performance cashier features when running as a standalone app:
- **RJ11 Cash Drawer Solenoid Pulse:** Electron listens to drawer trigger events and executes a high-speed pinout kick to cash drawers.
- **ESC/POS Thermal Printing:** Allows raw USB thermal receipt layout printing bypassing standard web print menus.
- **Secondary Customer Display Window:** Multi-screen projection allows the app to find and launch a separate checkout cart on the 2nd monitor facing the customer.
- **Persistent Local Database:** All register data is backed up automatically to IndexedDB/SQLite on the local hardware so you can run transactions offline without internet access.
