const DEFAULT_FEATURE_FLAGS = Object.freeze({
  themeToggle: true,
  singleFileFormatFiltering: true,
  selectionLimits: true,
  lockInputDuringConversion: true,
  tileDownloads: true,
  bulkDownload: true,
  heicDecoder: true,
});

const DEFAULT_LIMITS = Object.freeze({
  maxFiles: 30,
  maxTotalBytes: 100 * 1024 * 1024,
  maxTotalMegapixels: 120,
});

const DEFAULT_CONVERSION = Object.freeze({
  inputAccept: [
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
  ].join(','),
  supportedInputExtensions: [
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
  ],
  outputFormats: [
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
  ],
  previewMaxEdge: 420,
  defaultLossyQuality: 0.92,
  heicDecoderUrl: 'https://cdn.jsdelivr.net/npm/heic2any@0.0.4/dist/heic2any.min.js',
});

const DEFAULT_UI = Object.freeze({
  heroTitle: 'Image Format Converter',
  heroSubtitle: 'Convert one or many images between popular formats in your browser.',
  labels: Object.freeze({
    formatControl: 'Convert To',
    convert: 'Convert',
    clear: 'Clear',
    download: 'Download',
    downloadAll: 'Download All',
  }),
  footer: Object.freeze({
    inputFormats: 'PNG, JPG/JPEG/JFIF, WebP, APNG, GIF, BMP, ICO, AVIF/AVIFS, HEIC/HEIF/HIEC/HIC/HIF, TIFF, SVG.',
    outputFormats: 'PNG, JPEG, WebP (browser-dependent).',
  }),
  messages: Object.freeze({
    multiDownloadHint: 'If your browser blocks some files, allow multiple downloads for this site.',
  }),
  github: Object.freeze({
    repoUrl: 'https://github.com/yashrajnayak/image-format-converter',
    repoApiUrl: 'https://api.github.com/repos/yashrajnayak/image-format-converter',
    starCtaText: 'Star this repo on GitHub',
    starsLoadingText: 'Loading stars...',
    starsUnavailableText: 'Stars unavailable',
    starsSuffixText: 'stars',
    creditsPrefix: 'Created by',
    profileUrl: 'https://github.com/yashrajnayak',
    profileName: 'Yashraj Nayak',
  }),
});

export const DEFAULT_APP_CONFIG = Object.freeze({
  features: DEFAULT_FEATURE_FLAGS,
  limits: DEFAULT_LIMITS,
  conversion: DEFAULT_CONVERSION,
  ui: DEFAULT_UI,
});

const CONFIG_URL = new URL('../config/app-config.json', import.meta.url);

function asNonEmptyString(value, fallback) {
  if (typeof value !== 'string') {
    return fallback;
  }

  const normalized = value.trim();
  return normalized || fallback;
}

function toBoolean(value, fallback) {
  return typeof value === 'boolean' ? value : fallback;
}

function toPositiveInteger(value, fallback) {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  const normalized = Math.floor(value);
  return normalized > 0 ? normalized : fallback;
}

function toPositiveNumber(value, fallback) {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return value > 0 ? value : fallback;
}

function toUnitInterval(value, fallback) {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  if (value < 0 || value > 1) {
    return fallback;
  }

  return value;
}

function normalizeExtension(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) {
    return null;
  }
  return normalized.startsWith('.') ? normalized.slice(1) : normalized;
}

function normalizeExtensionList(values, fallback) {
  if (!Array.isArray(values)) {
    return [...fallback];
  }

  const unique = new Set();
  values.forEach((value) => {
    const normalized = normalizeExtension(value);
    if (normalized) {
      unique.add(normalized);
    }
  });

  return unique.size ? [...unique] : [...fallback];
}

function normalizeOutputFormat(format, fallback) {
  if (!format || typeof format !== 'object') {
    return { ...fallback };
  }

  const id = asNonEmptyString(format.id, fallback.id).toLowerCase();
  const label = asNonEmptyString(format.label, fallback.label);
  const extension = normalizeExtension(format.extension) || fallback.extension;
  const mimeType = asNonEmptyString(format.mimeType, fallback.mimeType).toLowerCase();
  const lossy = toBoolean(format.lossy, fallback.lossy);

  return {
    id,
    label,
    extension,
    mimeType,
    lossy,
  };
}

function normalizeOutputFormats(values) {
  if (!Array.isArray(values)) {
    return DEFAULT_CONVERSION.outputFormats.map((format) => ({ ...format }));
  }

  const normalized = [];
  for (let index = 0; index < values.length; index += 1) {
    const fallback = DEFAULT_CONVERSION.outputFormats[index % DEFAULT_CONVERSION.outputFormats.length];
    const format = normalizeOutputFormat(values[index], fallback);
    if (!format.id || !format.extension || !format.mimeType) {
      continue;
    }
    normalized.push(format);
  }

  if (!normalized.length) {
    return DEFAULT_CONVERSION.outputFormats.map((format) => ({ ...format }));
  }

  const seen = new Set();
  return normalized.filter((format) => {
    if (seen.has(format.id)) {
      return false;
    }
    seen.add(format.id);
    return true;
  });
}

function normalizeConfig(payload) {
  const input = payload && typeof payload === 'object' ? payload : {};
  const rawFeatures = input.features && typeof input.features === 'object' ? input.features : {};
  const rawLimits = input.limits && typeof input.limits === 'object' ? input.limits : {};
  const rawConversion = input.conversion && typeof input.conversion === 'object' ? input.conversion : {};
  const rawUi = input.ui && typeof input.ui === 'object' ? input.ui : {};
  const rawLabels = rawUi.labels && typeof rawUi.labels === 'object' ? rawUi.labels : {};
  const rawFooter = rawUi.footer && typeof rawUi.footer === 'object' ? rawUi.footer : {};
  const rawMessages = rawUi.messages && typeof rawUi.messages === 'object' ? rawUi.messages : {};
  const rawGithub = rawUi.github && typeof rawUi.github === 'object' ? rawUi.github : {};

  const features = {
    themeToggle: toBoolean(rawFeatures.themeToggle, DEFAULT_FEATURE_FLAGS.themeToggle),
    singleFileFormatFiltering: toBoolean(
      rawFeatures.singleFileFormatFiltering,
      DEFAULT_FEATURE_FLAGS.singleFileFormatFiltering
    ),
    selectionLimits: toBoolean(rawFeatures.selectionLimits, DEFAULT_FEATURE_FLAGS.selectionLimits),
    lockInputDuringConversion: toBoolean(
      rawFeatures.lockInputDuringConversion,
      DEFAULT_FEATURE_FLAGS.lockInputDuringConversion
    ),
    tileDownloads: toBoolean(rawFeatures.tileDownloads, DEFAULT_FEATURE_FLAGS.tileDownloads),
    bulkDownload: toBoolean(rawFeatures.bulkDownload, DEFAULT_FEATURE_FLAGS.bulkDownload),
    heicDecoder: toBoolean(rawFeatures.heicDecoder, DEFAULT_FEATURE_FLAGS.heicDecoder),
  };

  if (!features.bulkDownload && !features.tileDownloads) {
    features.bulkDownload = true;
  }

  const limits = {
    maxFiles: toPositiveInteger(rawLimits.maxFiles, DEFAULT_LIMITS.maxFiles),
    maxTotalBytes: toPositiveInteger(rawLimits.maxTotalBytes, DEFAULT_LIMITS.maxTotalBytes),
    maxTotalMegapixels: toPositiveNumber(rawLimits.maxTotalMegapixels, DEFAULT_LIMITS.maxTotalMegapixels),
  };

  const conversion = {
    inputAccept: asNonEmptyString(rawConversion.inputAccept, DEFAULT_CONVERSION.inputAccept),
    supportedInputExtensions: normalizeExtensionList(
      rawConversion.supportedInputExtensions,
      DEFAULT_CONVERSION.supportedInputExtensions
    ),
    outputFormats: normalizeOutputFormats(rawConversion.outputFormats),
    previewMaxEdge: toPositiveInteger(rawConversion.previewMaxEdge, DEFAULT_CONVERSION.previewMaxEdge),
    defaultLossyQuality: toUnitInterval(
      rawConversion.defaultLossyQuality,
      DEFAULT_CONVERSION.defaultLossyQuality
    ),
    heicDecoderUrl: asNonEmptyString(rawConversion.heicDecoderUrl, DEFAULT_CONVERSION.heicDecoderUrl),
  };

  const ui = {
    heroTitle: asNonEmptyString(rawUi.heroTitle, DEFAULT_UI.heroTitle),
    heroSubtitle: asNonEmptyString(rawUi.heroSubtitle, DEFAULT_UI.heroSubtitle),
    labels: {
      formatControl: asNonEmptyString(rawLabels.formatControl, DEFAULT_UI.labels.formatControl),
      convert: asNonEmptyString(rawLabels.convert, DEFAULT_UI.labels.convert),
      clear: asNonEmptyString(rawLabels.clear, DEFAULT_UI.labels.clear),
      download: asNonEmptyString(rawLabels.download, DEFAULT_UI.labels.download),
      downloadAll: asNonEmptyString(rawLabels.downloadAll, DEFAULT_UI.labels.downloadAll),
    },
    footer: {
      inputFormats: asNonEmptyString(rawFooter.inputFormats, DEFAULT_UI.footer.inputFormats),
      outputFormats: asNonEmptyString(rawFooter.outputFormats, DEFAULT_UI.footer.outputFormats),
    },
    messages: {
      multiDownloadHint: asNonEmptyString(rawMessages.multiDownloadHint, DEFAULT_UI.messages.multiDownloadHint),
    },
    github: {
      repoUrl: asNonEmptyString(rawGithub.repoUrl, DEFAULT_UI.github.repoUrl),
      repoApiUrl: asNonEmptyString(rawGithub.repoApiUrl, DEFAULT_UI.github.repoApiUrl),
      starCtaText: asNonEmptyString(rawGithub.starCtaText, DEFAULT_UI.github.starCtaText),
      starsLoadingText: asNonEmptyString(rawGithub.starsLoadingText, DEFAULT_UI.github.starsLoadingText),
      starsUnavailableText: asNonEmptyString(rawGithub.starsUnavailableText, DEFAULT_UI.github.starsUnavailableText),
      starsSuffixText: asNonEmptyString(rawGithub.starsSuffixText, DEFAULT_UI.github.starsSuffixText),
      creditsPrefix: asNonEmptyString(rawGithub.creditsPrefix, DEFAULT_UI.github.creditsPrefix),
      profileUrl: asNonEmptyString(rawGithub.profileUrl, DEFAULT_UI.github.profileUrl),
      profileName: asNonEmptyString(rawGithub.profileName, DEFAULT_UI.github.profileName),
    },
  };

  return { features, limits, conversion, ui };
}

export async function loadAppConfig() {
  try {
    const response = await fetch(CONFIG_URL, {
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`Config request failed: ${response.status}`);
    }

    const payload = await response.json();
    return normalizeConfig(payload);
  } catch {
    return normalizeConfig(null);
  }
}
