The Gift Shop POS — bundled support files
=========================================

Any files placed in this folder are packaged inside the .app bundle
(Contents/Resources/support/) and automatically copied to:

    ~/Library/Application Support/The Gift Shop POS/support/

on first launch (and whenever the app version changes). This lets clients
install companion files (price lists, config templates, etc.) without ever
opening a Terminal window / running commands by hand.

Place companion files here before running electron-builder.