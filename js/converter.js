import { getFileExtension, stripFileExtension } from './utils.js';

const DEFAULT_POPULAR_INPUT_EXTENSIONS = [
  'png',
  'jpg',
  'jpeg',
  'jfif',
  'webp',
  'apng',
  'gif',
  'bmp',
  'ico',
  'avif',
  'avifs',
  'heic',
  'heif',
  'hiec',
  'hic',
  'hif',
  'tif',
  'tiff',
  'svg',
];

const HEIC_EXTENSIONS = new Set(['heic', 'heif', 'hiec', 'hic', 'hif']);
const AVIF_EXTENSIONS = new Set(['avif', 'avifs']);
const DEFAULT_HEIC2ANY_CDN_URL = 'https://cdn.jsdelivr.net/npm/heic2any@0.0.4/dist/heic2any.min.js';

const DEFAULT_OUTPUT_FORMAT_CATALOG = [
  {
    id: 'png',
    label: 'PNG',
    extension: 'png',
    mimeType: 'image/png',
    lossy: false,
  },
  {
    id: 'jpeg',
    label: 'JPEG',
    extension: 'jpg',
    mimeType: 'image/jpeg',
    lossy: true,
  },
  {
    id: 'webp',
    label: 'WebP',
    extension: 'webp',
    mimeType: 'image/webp',
    lossy: true,
  },
];

const DEFAULT_LOSSY_QUALITY = 0.92;
const DEFAULT_INPUT_ACCEPT = [
  '.png',
  '.jpg',
  '.jpeg',
  '.jfif',
  '.webp',
  '.apng',
  '.gif',
  '.bmp',
  '.ico',
  '.avif',
  '.avifs',
  '.heic',
  '.heif',
  '.hiec',
  '.hic',
  '.hif',
  '.tif',
  '.tiff',
  '.svg',
  'image/*',
].join(',');

export const INPUT_ACCEPT = DEFAULT_INPUT_ACCEPT;

const converterSettings = {
  inputAccept: DEFAULT_INPUT_ACCEPT,
  supportedInputExtensions: [...DEFAULT_POPULAR_INPUT_EXTENSIONS],
  outputFormatCatalog: DEFAULT_OUTPUT_FORMAT_CATALOG.map((format) => ({ ...format })),
  defaultLossyQuality: DEFAULT_LOSSY_QUALITY,
  heicDecoderUrl: DEFAULT_HEIC2ANY_CDN_URL,
};

let supportedOutputFormatsPromise = null;
const heic2anyPromiseByUrl = new Map();

function normalizeExtension(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) {
    return '';
  }
  return normalized.startsWith('.') ? normalized.slice(1) : normalized;
}

function normalizeOutputFormat(format, fallback) {
  if (!format || typeof format !== 'object') {
    return { ...fallback };
  }

  const id = String(format.id || fallback.id || '').trim().toLowerCase();
  const label = String(format.label || fallback.label || '').trim() || fallback.label;
  const extension = normalizeExtension(format.extension || fallback.extension);
  const mimeType = String(format.mimeType || fallback.mimeType || '').trim().toLowerCase();
  const lossy = typeof format.lossy === 'boolean' ? format.lossy : Boolean(fallback.lossy);

  if (!id || !extension || !mimeType) {
    return { ...fallback };
  }

  return {
    id,
    label,
    extension,
    mimeType,
    lossy,
  };
}

export function configureConverter(config = {}) {
  if (!config || typeof config !== 'object') {
    return;
  }

  if (typeof config.inputAccept === 'string' && config.inputAccept.trim()) {
    converterSettings.inputAccept = config.inputAccept.trim();
  }

  if (Array.isArray(config.supportedInputExtensions)) {
    const unique = new Set();
    config.supportedInputExtensions.forEach((extension) => {
      const normalized = normalizeExtension(extension);
      if (normalized) {
        unique.add(normalized);
      }
    });
    if (unique.size) {
      converterSettings.supportedInputExtensions = [...unique];
    }
  }

  if (Array.isArray(config.outputFormats)) {
    const normalized = [];
    config.outputFormats.forEach((format, index) => {
      const fallback = DEFAULT_OUTPUT_FORMAT_CATALOG[index % DEFAULT_OUTPUT_FORMAT_CATALOG.length];
      normalized.push(normalizeOutputFormat(format, fallback));
    });
    if (normalized.length) {
      const seenIds = new Set();
      converterSettings.outputFormatCatalog = normalized.filter((format) => {
        if (seenIds.has(format.id)) {
          return false;
        }
        seenIds.add(format.id);
        return true;
      });
    }
  }

  if (Number.isFinite(config.defaultLossyQuality)) {
    const normalizedQuality = Math.min(1, Math.max(0, config.defaultLossyQuality));
    converterSettings.defaultLossyQuality = normalizedQuality;
  }

  if (typeof config.heicDecoderUrl === 'string' && config.heicDecoderUrl.trim()) {
    converterSettings.heicDecoderUrl = config.heicDecoderUrl.trim();
  }

  supportedOutputFormatsPromise = null;
}

export function getInputAccept() {
  return converterSettings.inputAccept;
}

function drawBitmapToCanvas(source, width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Could not create canvas context.');
  }

  ctx.drawImage(source, 0, 0, width, height);
  return canvas;
}

function canvasToBlob(canvas, mimeType, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
          return;
        }

        reject(new Error(`Could not encode ${mimeType} output.`));
      },
      mimeType,
      quality
    );
  });
}

function getMimeType(file) {
  return String(file?.type || '').toLowerCase();
}

function isHeicLikeFile(file) {
  const extension = getFileExtension(file?.name || '');
  const mimeType = getMimeType(file);
  return (
    HEIC_EXTENSIONS.has(extension) ||
    mimeType.includes('heic') ||
    mimeType.includes('heif') ||
    mimeType.includes('heic-sequence') ||
    mimeType.includes('heif-sequence')
  );
}

function isAvifLikeFile(file) {
  const extension = getFileExtension(file?.name || '');
  const mimeType = getMimeType(file);
  return AVIF_EXTENSIONS.has(extension) || mimeType.includes('avif');
}

function getHeic2anyGlobal() {
  const candidate = globalThis.heic2any || globalThis.window?.heic2any;
  return typeof candidate === 'function' ? candidate : null;
}

async function loadHeic2any(decoderUrl = converterSettings.heicDecoderUrl) {
  const resolvedDecoderUrl = String(decoderUrl || '').trim() || DEFAULT_HEIC2ANY_CDN_URL;
  const existing = getHeic2anyGlobal();
  if (existing) {
    return existing;
  }

  if (!heic2anyPromiseByUrl.has(resolvedDecoderUrl)) {
    const promise = new Promise((resolve, reject) => {
      if (typeof document === 'undefined') {
        reject(new Error('HEIC decoding is not available in this environment.'));
        return;
      }

      const handleReady = () => {
        const loaded = getHeic2anyGlobal();
        if (loaded) {
          resolve(loaded);
          return;
        }
        reject(new Error('HEIC decoder failed to initialize.'));
      };

      const scriptSelector = 'script[data-heic2any-loader="true"]';
      const existingScript = [...document.querySelectorAll(scriptSelector)]
        .find((script) => script.src === resolvedDecoderUrl);
      if (existingScript) {
        existingScript.addEventListener('load', handleReady, { once: true });
        existingScript.addEventListener(
          'error',
          () => reject(new Error('Could not load HEIC decoder script.')),
          { once: true }
        );
        return;
      }

      const script = document.createElement('script');
      script.src = resolvedDecoderUrl;
      script.async = true;
      script.defer = true;
      script.crossOrigin = 'anonymous';
      script.dataset.heic2anyLoader = 'true';
      script.addEventListener('load', handleReady, { once: true });
      script.addEventListener(
        'error',
        () => reject(new Error('Could not load HEIC decoder script.')),
        { once: true }
      );
      document.head.append(script);
    });
    heic2anyPromiseByUrl.set(resolvedDecoderUrl, promise);
  }

  return heic2anyPromiseByUrl.get(resolvedDecoderUrl);
}

async function transcodeHeicToPngBlob(file, options = {}) {
  const heic2any = await loadHeic2any(options.heicDecoderUrl);

  let result;
  try {
    result = await heic2any({
      blob: file,
      toType: 'image/png',
    });
  } catch {
    throw new Error(`Could not decode ${file.name}.`);
  }

  const blob = Array.isArray(result) ? result[0] : result;
  if (!(blob instanceof Blob)) {
    throw new Error(`Could not decode ${file.name}.`);
  }

  return blob;
}

function createDecodedBitmap(bitmap) {
  return {
    source: bitmap,
    width: bitmap.width,
    height: bitmap.height,
    close() {
      if (bitmap && typeof bitmap.close === 'function') {
        bitmap.close();
      }
    },
  };
}

function createDecodedImageElement(image) {
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  return {
    source: image,
    width,
    height,
    close() {},
  };
}

function decodeViaImageElement(blob) {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(blob);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(createDecodedImageElement(image));
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Image element decode failed.'));
    };

    image.src = objectUrl;
  });
}

async function decodeBitmap(file, options = {}) {
  if (!file) {
    throw new Error('No file provided.');
  }

  const isHeicFile = isHeicLikeFile(file);
  const shouldUseHeicDecoder = options.enableHeicDecoder !== false;
  const sourceBlob = isHeicFile && shouldUseHeicDecoder
    ? await transcodeHeicToPngBlob(file, {
      heicDecoderUrl: options.heicDecoderUrl || converterSettings.heicDecoderUrl,
    })
    : file;

  try {
    if (typeof createImageBitmap === 'function') {
      const bitmap = await createImageBitmap(sourceBlob);
      return createDecodedBitmap(bitmap);
    }
    return await decodeViaImageElement(sourceBlob);
  } catch {
    try {
      return await decodeViaImageElement(sourceBlob);
    } catch {
      const formatHint = isHeicFile
        ? shouldUseHeicDecoder
          ? 'HEIC/HEIF'
          : 'HEIC/HEIF (decoder disabled by configuration)'
        : isAvifLikeFile(file)
          ? 'AVIF'
          : 'image';
      throw new Error(`Could not decode ${file.name}. ${formatHint} may not be supported in this browser.`);
    }
  }
}

export async function measureImageFile(file, options = {}) {
  const decoded = await decodeBitmap(file, options);

  try {
    return {
      width: decoded.width,
      height: decoded.height,
      pixelCount: decoded.width * decoded.height,
    };
  } finally {
    decoded.close();
  }
}

function buildOutputName(sourceName, extension) {
  return `${stripFileExtension(sourceName)}.${extension}`;
}

export function inferConvertibleInputFormatId(file) {
  if (!file) {
    return null;
  }

  const mimeType = getMimeType(file);
  const extension = getFileExtension(file.name);

  for (const format of converterSettings.outputFormatCatalog) {
    const formatMimeType = String(format.mimeType || '').toLowerCase();
    const mimeToken = formatMimeType.startsWith('image/') ? formatMimeType.slice(6) : formatMimeType;
    const formatExtension = normalizeExtension(format.extension);

    if (mimeToken && mimeType.includes(mimeToken)) {
      return format.id;
    }

    if (extension && extension === formatExtension) {
      return format.id;
    }

    // Preserve common JPEG aliases even when extension is configured as "jpg".
    if (format.id === 'jpeg' && (extension === 'jpg' || extension === 'jpeg' || extension === 'jfif')) {
      return format.id;
    }
  }

  if (AVIF_EXTENSIONS.has(extension) || mimeType.includes('avif')) {
    return 'avif';
  }

  return null;
}

async function canEncodeMimeType(mimeType) {
  const canvas = document.createElement('canvas');
  canvas.width = 2;
  canvas.height = 2;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return false;
  }

  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  try {
    const blob = await canvasToBlob(canvas, mimeType, converterSettings.defaultLossyQuality);
    return Boolean(blob) && blob.type === mimeType;
  } catch {
    return false;
  }
}

export function isSupportedInputFile(file) {
  if (!file || !file.name) {
    return false;
  }

  const type = getMimeType(file);
  if (type.startsWith('image/')) {
    return true;
  }

  const extension = getFileExtension(file.name);
  return converterSettings.supportedInputExtensions.includes(extension);
}

export async function getSupportedOutputFormats() {
  if (!supportedOutputFormatsPromise) {
    supportedOutputFormatsPromise = (async () => {
      const catalog = converterSettings.outputFormatCatalog.length
        ? converterSettings.outputFormatCatalog
        : DEFAULT_OUTPUT_FORMAT_CATALOG;
      const checks = await Promise.all(
        catalog.map(async (format) => {
          const supported = format.id === 'png' ? true : await canEncodeMimeType(format.mimeType);
          return {
            ...format,
            supported,
          };
        })
      );

      const supported = checks.filter((format) => format.supported);
      if (!supported.length) {
        return [catalog[0]];
      }

      return supported;
    })();
  }

  return supportedOutputFormatsPromise;
}

export function getOutputFormatById(formatId, formats) {
  if (!Array.isArray(formats) || !formats.length) {
    return null;
  }

  const direct = formats.find((format) => format.id === formatId);
  return direct || formats[0];
}

export async function createPreviewBlob(file, maxEdge = 420, options = {}) {
  const decoded = await decodeBitmap(file, options);

  try {
    const maxDimension = Math.max(decoded.width, decoded.height);
    const scale = maxDimension > maxEdge ? maxEdge / maxDimension : 1;

    const width = Math.max(1, Math.round(decoded.width * scale));
    const height = Math.max(1, Math.round(decoded.height * scale));

    const canvas = drawBitmapToCanvas(decoded.source, width, height);
    return await canvasToBlob(canvas, 'image/png');
  } finally {
    decoded.close();
  }
}

export async function convertImageFile(file, { format, decodeOptions, quality } = {}) {
  if (!format) {
    throw new Error('No output format selected.');
  }

  const decoded = await decodeBitmap(file, decodeOptions);

  try {
    const canvas = drawBitmapToCanvas(decoded.source, decoded.width, decoded.height);
    const fallbackQuality = converterSettings.defaultLossyQuality;
    const normalizedQuality = format.lossy
      ? Number.isFinite(quality)
        ? Math.min(1, Math.max(0, quality))
        : fallbackQuality
      : undefined;
    const blob = await canvasToBlob(canvas, format.mimeType, normalizedQuality);

    return {
      sourceName: file.name,
      outputName: buildOutputName(file.name, format.extension),
      width: decoded.width,
      height: decoded.height,
      sourceSize: file.size,
      outputSize: blob.size,
      blob,
    };
  } finally {
    decoded.close();
  }
}
