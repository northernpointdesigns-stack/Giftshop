# BoutiquePOS — recovered project

This directory was reconstructed from the supplied Linux AppImage. It is a
working reference build, not the original source repository.

## What was recovered

- The compiled React/Vite browser bundle
- Its compiled CSS and static HTML entry point
- The Electron desktop window launcher
- The dependency list found in the packaged application

The browser bundle contains readable application strings and embedded source
file paths, but the AppImage does not include the original TypeScript/JSX
source files or source maps. The bundled JavaScript is therefore preserved
under `public/assets/` as a reference while new editable features should be
added in a separate `src/` structure.

## Run the recovered browser build

```bash
pnpm install
pnpm run dev
```

Then open the Vite URL shown in the terminal.

## Build a static distribution

```bash
pnpm run build
```

The resulting `dist/` directory contains the recovered application bundle.

## Important limitation

The original AppImage is a compiled artifact. Recovering the exact original
component files, build configuration, backend, and data model requires the
source project that produced it. This project is a starting point for
continuing development, not a lossless source conversion.