# AVIF to PNG Converter

Minimal browser-only AVIF to PNG converter built with plain HTML, CSS, and JavaScript.

## Features

- Full-page drop/upload area
- Preview-first flow (shows selected files before conversion)
- Manual **Convert** button (no auto-convert on upload)
- Light/Dark theme toggle using `data-theme` on `<html>`
- Batch conversion
- Local-only processing (no server upload)

## Project structure

- `index.html` — app markup and controls
- `styles.css` — full-screen layout and UI styling
- `vendor/yashrajnayak-design-system.css` — copied design-system bundle for static hosting
- `js/main.js` — app workflow and event orchestration
- `js/converter.js` — AVIF decode + PNG conversion + preview generation
- `js/ui.js` — drop-zone handlers, row rendering, status updates
- `js/utils.js` — utility helpers

## How to use

1. Drop `.avif` files anywhere in the browser area, or click to select files.
2. Wait for previews to appear so you can confirm selected files.
3. Click **Convert** to start conversion.
4. Download each converted PNG from its result row.
5. Click **Clear** to reset the queue and results.

## Run locally

Use a local static server (recommended for ES modules), for example:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

## Design system usage

This app uses `ys-` classes and `--ys-*` tokens from a local design stylesheet that is bundled in this repo.

Required fonts are loaded in `index.html`, and the design stylesheet is loaded from:

- `vendor/yashrajnayak-design-system.css`

Theme switching is handled by setting:

- `document.documentElement.setAttribute('data-theme', 'dark')`

## GitHub Pages deployment

1. Keep all files at repository root.
2. Commit and push.
3. Open repository settings -> **Pages**.
4. Set source to your default branch and root (`/`) folder.
5. Open the published Pages URL.

## Browser support

- Requires a modern browser with `createImageBitmap`, canvas, and File APIs.
- If previews or conversion fail, update to latest Chrome, Firefox, or Safari.

## Notes

- Files are processed entirely in the browser.
- Large images/batches may use significant memory.
- No npm modules or build step are required to run the app.
