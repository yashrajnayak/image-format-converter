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

export const DEFAULT_APP_CONFIG = Object.freeze({
  features: DEFAULT_FEATURE_FLAGS,
  limits: DEFAULT_LIMITS,
});

const CONFIG_URL = new URL('../config/app-config.json', import.meta.url);

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

function normalizeConfig(payload) {
  const input = payload && typeof payload === 'object' ? payload : {};
  const rawFeatures = input.features && typeof input.features === 'object' ? input.features : {};
  const rawLimits = input.limits && typeof input.limits === 'object' ? input.limits : {};

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

  return { features, limits };
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
