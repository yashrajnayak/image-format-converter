export function isAvifFile(file) {
  if (!file || !file.name) {
    return false;
  }

  const type = (file.type || '').toLowerCase();
  const name = file.name.toLowerCase();
  return type === 'image/avif' || name.endsWith('.avif');
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
