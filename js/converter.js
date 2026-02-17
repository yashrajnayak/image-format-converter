import { getFileExtension, stripFileExtension } from './utils.js';

const POPULAR_INPUT_EXTENSIONS = new Set([
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
]);

const HEIC_EXTENSIONS = new Set(['heic', 'heif', 'hiec', 'hic', 'hif']);
const AVIF_EXTENSIONS = new Set(['avif', 'avifs']);
const HEIC2ANY_CDN_URL = 'https://cdn.jsdelivr.net/npm/heic2any@0.0.4/dist/heic2any.min.js';

const OUTPUT_FORMAT_CATALOG = [
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

export const INPUT_ACCEPT = [
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

let supportedOutputFormatsPromise = null;
let heic2anyPromise = null;

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

async function loadHeic2any() {
  const existing = getHeic2anyGlobal();
  if (existing) {
    return existing;
  }

  if (!heic2anyPromise) {
    heic2anyPromise = new Promise((resolve, reject) => {
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
      const existingScript = document.querySelector(scriptSelector);
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
      script.src = HEIC2ANY_CDN_URL;
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
  }

  return heic2anyPromise;
}

async function transcodeHeicToPngBlob(file) {
  const heic2any = await loadHeic2any();

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

async function decodeBitmap(file) {
  if (!file) {
    throw new Error('No file provided.');
  }

  const sourceBlob = isHeicLikeFile(file) ? await transcodeHeicToPngBlob(file) : file;

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
      const formatHint = isHeicLikeFile(file)
        ? 'HEIC/HEIF'
        : isAvifLikeFile(file)
          ? 'AVIF'
          : 'image';
      throw new Error(`Could not decode ${file.name}. ${formatHint} may not be supported in this browser.`);
    }
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
  if (mimeType.includes('png')) {
    return 'png';
  }
  if (mimeType.includes('jpeg') || mimeType.includes('jpg')) {
    return 'jpeg';
  }
  if (mimeType.includes('webp')) {
    return 'webp';
  }
  if (mimeType.includes('avif')) {
    return 'avif';
  }

  const extension = getFileExtension(file.name);
  if (extension === 'png') {
    return 'png';
  }
  if (extension === 'jpg' || extension === 'jpeg' || extension === 'jfif') {
    return 'jpeg';
  }
  if (extension === 'webp') {
    return 'webp';
  }
  if (AVIF_EXTENSIONS.has(extension)) {
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
    const blob = await canvasToBlob(canvas, mimeType, 0.92);
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

  return POPULAR_INPUT_EXTENSIONS.has(getFileExtension(file.name));
}

export async function getSupportedOutputFormats() {
  if (!supportedOutputFormatsPromise) {
    supportedOutputFormatsPromise = (async () => {
      const checks = await Promise.all(
        OUTPUT_FORMAT_CATALOG.map(async (format) => {
          const supported = format.id === 'png' ? true : await canEncodeMimeType(format.mimeType);
          return {
            ...format,
            supported,
          };
        })
      );

      const supported = checks.filter((format) => format.supported);
      if (!supported.length) {
        return [OUTPUT_FORMAT_CATALOG[0]];
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

export async function createPreviewBlob(file, maxEdge = 420) {
  const decoded = await decodeBitmap(file);

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

export async function convertImageFile(file, { format }) {
  if (!format) {
    throw new Error('No output format selected.');
  }

  const decoded = await decodeBitmap(file);

  try {
    const canvas = drawBitmapToCanvas(decoded.source, decoded.width, decoded.height);
    const normalizedQuality = format.lossy ? DEFAULT_LOSSY_QUALITY : undefined;
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
