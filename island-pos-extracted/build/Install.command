#!/bin/bash
# =====================================================================
#  The Gift Shop POS — one-time install helper (unsigned macOS build)
#
#  Double-click this file to open Terminal automatically. It clears the
#  macOS Gatekeeper quarantine flag from the app and launches it, so you
#  never need to type the xattr command by hand.
# =====================================================================

APP="/Applications/The Gift Shop POS.app"
THIS_DIR="$(cd "$(dirname "$0")" && pwd)"

# Clear quarantine from the DMG's own contents too (harmless if absent).
xattr -dr com.apple.quarantine "$THIS_DIR" 2>/dev/null

if [ ! -d "$APP" ]; then
  echo ""
  echo "  The Gift Shop POS.app is not in /Applications yet."
  echo "  First drag the app icon onto the Applications shortcut in this"
  echo "  DMG window (or into the Applications folder), then double-click"
  echo "  Install.command again."
  echo ""
  read -r -p "  Press Enter to close…"
  exit 1
fi

echo ""
echo "  Clearing macOS quarantine flag from The Gift Shop POS …"
xattr -cr "$APP"
echo "  Launching The Gift Shop POS …"
open "$APP"
echo ""
echo "  Done. On future launches you can just double-click the app."
echo "  This window will close automatically…"
sleep 2
exit 0