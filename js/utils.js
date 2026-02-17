export function getFileExtension(fileName = '') {
  const normalized = String(fileName).trim().toLowerCase();
  const lastDot = normalized.lastIndexOf('.');
  if (lastDot === -1 || lastDot === normalized.length - 1) {
    return '';
  }
  return normalized.slice(lastDot + 1);
}

export function stripFileExtension(fileName = '') {
  const normalized = String(fileName);
  const lastDot = normalized.lastIndexOf('.');
  if (lastDot <= 0) {
    return normalized;
  }
  return normalized.slice(0, lastDot);
}

export function clamp(value, min, max) {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.min(max, Math.max(min, value));
}

export function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '0 B';
  }

  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let index = 0;

  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }

  if (index === 0) {
    return `${value} ${units[index]}`;
  }

  return `${value.toFixed(1)} ${units[index]}`;
}

export function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
