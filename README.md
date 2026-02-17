# Image Format Converter

Browser-only image converter for single or batch image conversion across popular formats, built with plain HTML, CSS, and JavaScript.

<img width="1389" height="940" alt="image" src="https://github.com/user-attachments/assets/b054dd1b-79ff-4f42-ba9b-120b34a9acb0" />

## Features

- Drag/drop or click-to-upload for multiple files
- Preview-first flow in a fixed-size drop zone
- Convert between popular formats in-browser
- Dynamic output format support (based on browser encoding capability)
- UI footer lists supported input and output formats
- For a single uploaded image, its current format is automatically removed from **Convert To**
- `Convert To`, `Convert`, and `Clear` controls appear only after files are uploaded
- Tile-based preview with inline download actions for multi-file conversions
- Bottom action button switches from **Convert** to **Download** / **Download All**
- Light/Dark theme toggle with `data-theme` on `<html>`
- Runtime feature flags + guardrail limits via JSON config
- Local-only processing (no server upload)

## Supported formats

Input formats (selection filter + best-effort decode): `PNG`, `JPG/JPEG/JFIF`, `WebP`, `APNG`, `GIF`, `BMP`, `ICO`, `AVIF/AVIFS`, `HEIC/HEIF/HIEC/HIC/HIF`, `TIFF`, `SVG`, plus `image/*`.

Output formats (browser-dependent): `PNG`, `JPEG`, `WebP`.

UI footer format summary:
- Input: `PNG`, `JPG/JPEG/JFIF`, `WebP`, `APNG`, `GIF`, `BMP`, `ICO`, `AVIF/AVIFS`, `HEIC/HEIF/HIEC/HIC/HIF`, `TIFF`, `SVG`
- Output: `PNG`, `JPEG`, `WebP` (browser-dependent)

## Project structure

- `index.html` — app layout and controls
- `favicon.svg` — app favicon
- `styles.css` — app-specific styling using design-system tokens
- `vendor/yashrajnayak-design-system.css` — bundled design system
- `config/app-config.json` — runtime feature flags and selection limits
- `js/app-config.js` — config loader + normalization
- `js/main.js` — app state, events, conversion flow
- `js/converter.js` — format detection and image conversion pipeline
- `js/ui.js` — drop-zone and preview tile UI helpers
- `js/utils.js` — shared utility helpers

## How to use

1. Drop image files into the upload area, or click it to select files.
2. Choose the target format from **Convert To**.
3. Click **Convert**.
4. Click **Download** (single) or **Download All** (multiple), or use per-tile download actions for multi-file output.

## Run locally

Use a local static server (recommended for ES modules):

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

## Runtime configuration

Update `config/app-config.json` to change behavior without touching app logic:

- `features.themeToggle` — show/hide theme toggle
- `features.singleFileFormatFiltering` — remove same source format from **Convert To** for single-file mode
- `features.selectionLimits` — enable/disable selection guardrail checks
- `features.lockInputDuringConversion` — prevent new uploads while conversion is in progress
- `features.tileDownloads` — show inline tile download buttons after conversion
- `features.bulkDownload` — enable **Download/Download All** action mode
- `features.heicDecoder` — enable runtime HEIC decoder usage
- `limits.maxFiles`, `limits.maxTotalBytes`, `limits.maxTotalMegapixels` — batch guardrails

## Design system usage

This app follows the vendor design system through:

- `ys-` utility/component classes
- `--ys-*` tokens for colors, spacing, radius, shadow, and typography
- `vendor/yashrajnayak-design-system.css` as the source of shared visual primitives

## Browser support

- Requires modern browser APIs: `createImageBitmap`, canvas, File APIs.
- Output format availability is detected at runtime and shown in the format selector.
- AVIF decode falls back to `<img>` decode path when needed.
- HEIC/HEIF/HIEC decode uses a runtime-loaded `heic2any` decoder script for broader browser support.
