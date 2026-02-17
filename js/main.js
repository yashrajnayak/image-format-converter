import {
  INPUT_ACCEPT,
  createPreviewBlob,
  convertImageFile,
  getOutputFormatById,
  getSupportedOutputFormats,
  inferConvertibleInputFormatId,
  isSupportedInputFile,
} from './converter.js';
import { createPreviewTile, setupDropZone } from './ui.js';
import { sleep } from './utils.js';

const fileInput = document.getElementById('file-input');
const dropZone = document.getElementById('drop-zone');
const dropZonePreviewEl = document.getElementById('drop-zone-preview');
const formatControl = document.getElementById('format-control');
const formatSelect = document.getElementById('format-select');
const statusEl = document.getElementById('status');
const convertButton = document.getElementById('convert-btn');
const clearButton = document.getElementById('clear-btn');
const root = document.documentElement;
const toggle = document.getElementById('themeSwitch');

const THEME_KEY = 'ys-theme';

const state = {
  entries: [],
  skippedCount: 0,
  isConverting: false,
  selectionToken: 0,
  nextEntryId: 0,
  mode: 'convert',
  outputFormats: [],
  outputFormatsSignature: '',
  objectUrls: new Set(),
};

const setStatus = (text) => {
  statusEl.textContent = text;
};

const setTheme = (theme) => {
  root.setAttribute('data-theme', theme);
  localStorage.setItem(THEME_KEY, theme);
};

const rememberObjectUrl = (blob) => {
  const url = URL.createObjectURL(blob);
  state.objectUrls.add(url);
  return url;
};

const releaseObjectUrl = (url) => {
  if (!url || !state.objectUrls.has(url)) {
    return;
  }

  URL.revokeObjectURL(url);
  state.objectUrls.delete(url);
};

const triggerDownload = (url, filename) => {
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noreferrer';
  anchor.style.display = 'none';
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
};

const getPendingEntries = () => state.entries.filter((entry) => !entry.converted && !entry.failed);
const getConvertedEntries = () => state.entries.filter((entry) => entry.converted && entry.downloadUrl);

function getSelectedOutputFormat() {
  return getOutputFormatById(formatSelect.value, state.outputFormats);
}

function getFilteredOutputFormats() {
  if (state.entries.length !== 1) {
    return state.outputFormats;
  }

  const currentInputFormatId = inferConvertibleInputFormatId(state.entries[0].file);
  if (!currentInputFormatId) {
    return state.outputFormats;
  }

  return state.outputFormats.filter((format) => format.id !== currentInputFormatId);
}

function syncFormatOptions() {
  const formats = getFilteredOutputFormats();
  const signature = formats.map((format) => format.id).join('|');
  const selectedBefore = formatSelect.value;

  if (signature !== state.outputFormatsSignature) {
    formatSelect.textContent = '';
    formats.forEach((format) => {
      const option = document.createElement('option');
      option.value = format.id;
      option.textContent = format.label;
      formatSelect.append(option);
    });
    state.outputFormatsSignature = signature;

    if (formats.length) {
      formatSelect.value = formats.some((format) => format.id === selectedBefore)
        ? selectedBefore
        : formats[0].id;
    }
  }

  return formats;
}

function setPrimaryMode(mode) {
  state.mode = mode;
  if (mode !== 'download') {
    convertButton.textContent = 'Convert';
    return;
  }

  convertButton.textContent = getConvertedEntries().length > 1 ? 'Download All' : 'Download';
}

function clearDropZonePreviewContainer() {
  dropZone.classList.remove('has-preview');
  dropZone.classList.remove('has-single-preview');
  dropZonePreviewEl.textContent = '';
  dropZonePreviewEl.style.removeProperty('--drop-zone-columns');
  dropZonePreviewEl.style.removeProperty('--drop-zone-rows');
}

function updateDropZonePreviewLayout() {
  const count = state.entries.length;
  if (!count) {
    clearDropZonePreviewContainer();
    return;
  }

  const width = Math.max(dropZonePreviewEl.clientWidth, 1);
  const height = Math.max(dropZonePreviewEl.clientHeight, 1);
  const ratio = width / height;

  const columns = count === 1
    ? 1
    : Math.min(count, Math.max(2, Math.ceil(Math.sqrt(count * ratio))));
  const rows = Math.max(1, Math.ceil(count / columns));

  dropZone.classList.add('has-preview');
  dropZone.classList.toggle('has-single-preview', count === 1);
  dropZonePreviewEl.style.setProperty('--drop-zone-columns', String(columns));
  dropZonePreviewEl.style.setProperty('--drop-zone-rows', String(rows));
}

function updateControls() {
  const availableFormats = syncFormatOptions();
  const hasAvailableFormats = availableFormats.length > 0;
  const hasEntries = state.entries.length > 0;
  if (formatControl) {
    formatControl.hidden = !hasEntries;
  }
  convertButton.hidden = !hasEntries;
  clearButton.hidden = !hasEntries;

  if (state.isConverting) {
    convertButton.disabled = true;
    clearButton.disabled = true;
    formatSelect.disabled = true;
    return;
  }

  const hasConverted = getConvertedEntries().length > 0;
  const hasPending = getPendingEntries().length > 0;

  if (state.mode === 'download') {
    convertButton.disabled = !hasConverted;
  } else {
    convertButton.disabled = !hasPending || !hasAvailableFormats;
  }

  clearButton.disabled = !hasEntries;
  formatSelect.disabled = !hasEntries || !hasAvailableFormats;
}

function updateReadyStatus() {
  if (state.isConverting) {
    return;
  }

  if (!state.entries.length) {
    setStatus('');
    updateControls();
    return;
  }

  const availableFormats = syncFormatOptions();

  const pendingCount = getPendingEntries().length;
  const convertedCount = getConvertedEntries().length;

  if (state.mode === 'download') {
    const actionLabel = convertedCount > 1 ? 'Download All' : 'Download';
    setStatus(
      `Conversion complete: ${convertedCount} ready${state.skippedCount ? `, ${state.skippedCount} skipped` : ''}. Click ${actionLabel} to save ${convertedCount > 1 ? 'all files' : 'the file'}.`
    );
    updateControls();
    return;
  }

  if (!availableFormats.length) {
    setStatus('No alternative target format is available for this file.');
    updateControls();
    return;
  }

  setStatus(
    `Ready: ${pendingCount} file(s) to convert${state.skippedCount ? `, ${state.skippedCount} skipped` : ''}. Target format: ${getSelectedOutputFormat()?.label || 'unknown'}.`
  );
  updateControls();
}

function disposeEntry(entry) {
  releaseObjectUrl(entry.previewUrl);
  releaseObjectUrl(entry.downloadUrl);
  entry.tile.destroy();
}

function clearEntries() {
  state.entries.forEach((entry) => disposeEntry(entry));
  state.entries = [];
  clearDropZonePreviewContainer();
}

function resetConvertedState(statusMessage) {
  state.entries.forEach((entry) => {
    releaseObjectUrl(entry.downloadUrl);
    entry.downloadUrl = null;
    entry.outputName = null;
    entry.converted = false;
    entry.failed = false;
    entry.tile.hideDownload();
    entry.tile.setRemoveVisible(true);
    entry.tile.setRemoveDisabled(false);
    entry.tile.setProcessing(false);
  });

  setPrimaryMode('convert');
  if (statusMessage) {
    setStatus(statusMessage);
  }
  updateReadyStatus();
}

function removeEntry(entryId) {
  if (state.isConverting) {
    return;
  }

  const index = state.entries.findIndex((entry) => entry.id === entryId);
  if (index === -1) {
    return;
  }

  const [entry] = state.entries.splice(index, 1);
  disposeEntry(entry);

  updateDropZonePreviewLayout();

  if (!state.entries.length) {
    state.skippedCount = 0;
    setPrimaryMode('convert');
  }

  updateReadyStatus();
}

function createEntry(file) {
  const entry = {
    id: ++state.nextEntryId,
    file,
    previewUrl: null,
    downloadUrl: null,
    outputName: null,
    converted: false,
    failed: false,
    tile: null,
  };

  entry.tile = createPreviewTile({
    name: file.name,
    onRemove: () => removeEntry(entry.id),
  });

  return entry;
}

async function downloadAllConverted() {
  const converted = getConvertedEntries();
  if (!converted.length) {
    return;
  }

  for (const entry of converted) {
    triggerDownload(entry.downloadUrl, entry.outputName);
    await sleep(45);
  }

  setStatus(converted.length > 1 ? `Download started for ${converted.length} files.` : 'Download started.');
}

async function runConversion() {
  const pending = getPendingEntries();
  if (!pending.length) {
    return;
  }

  const outputFormat = getSelectedOutputFormat();
  if (!outputFormat) {
    setStatus('No alternative target format is available for this file.');
    return;
  }

  state.isConverting = true;
  state.entries.forEach((entry) => {
    entry.tile.setRemoveDisabled(true);
    entry.tile.setDownloadDisabled(true);
    entry.tile.hideDownload();
  });
  updateControls();

  let completed = 0;
  let failed = 0;
  const total = pending.length;

  setStatus(`Converting ${completed}/${total} file(s) to ${outputFormat.label}...`);

  for (const entry of pending) {
    entry.tile.setProcessing(true);

    try {
      const result = await convertImageFile(entry.file, { format: outputFormat });

      entry.converted = true;
      entry.failed = false;
      entry.outputName = result.outputName;

      releaseObjectUrl(entry.downloadUrl);
      entry.downloadUrl = rememberObjectUrl(result.blob);
      completed += 1;
    } catch {
      entry.failed = true;
      entry.converted = false;
      entry.tile.setFallback('Conversion failed');
      failed += 1;
    } finally {
      entry.tile.setProcessing(false);
      setStatus(`Converting ${completed}/${total} file(s) to ${outputFormat.label}...`);
    }
  }

  state.isConverting = false;

  const converted = getConvertedEntries();
  const showTileDownloads = converted.length > 1;

  state.entries.forEach((entry) => {
    entry.tile.setRemoveVisible(false);

    if (entry.converted && showTileDownloads) {
      entry.tile.showDownload(() => {
        if (entry.downloadUrl) {
          triggerDownload(entry.downloadUrl, entry.outputName);
        }
      });
    } else {
      entry.tile.hideDownload();
    }

    entry.tile.setDownloadDisabled(false);
  });

  setPrimaryMode(converted.length ? 'download' : 'convert');

  setStatus(
    `Done: ${completed} converted${failed ? `, ${failed} failed` : ''}${state.skippedCount ? `, ${state.skippedCount} skipped` : ''}.`
  );

  updateReadyStatus();
}

async function handleIncomingFiles(fileList) {
  const incoming = [...fileList];
  fileInput.value = '';

  if (!incoming.length) {
    setStatus('No files selected.');
    return;
  }

  const token = ++state.selectionToken;

  state.isConverting = false;
  state.skippedCount = 0;
  setPrimaryMode('convert');
  clearEntries();
  updateControls();

  const supported = incoming.filter(isSupportedInputFile);
  const unsupported = incoming.filter((file) => !isSupportedInputFile(file));
  state.skippedCount = unsupported.length;

  if (!supported.length) {
    setStatus(`Please add supported image files.${unsupported.length ? ` ${unsupported.length} skipped.` : ''}`);
    updateControls();
    return;
  }

  state.entries = supported.map((file) => createEntry(file));

  state.entries.forEach((entry) => {
    dropZonePreviewEl.append(entry.tile.element);
  });

  updateDropZonePreviewLayout();
  setStatus(`Preparing previews for ${state.entries.length} file(s)...`);
  updateControls();

  for (const entry of state.entries) {
    if (token !== state.selectionToken) {
      return;
    }

    const activeEntry = state.entries.find((candidate) => candidate.id === entry.id);
    if (!activeEntry) {
      continue;
    }

    try {
      const previewBlob = await createPreviewBlob(activeEntry.file);
      if (token !== state.selectionToken) {
        return;
      }

      const stillPresent = state.entries.find((candidate) => candidate.id === activeEntry.id);
      if (!stillPresent) {
        continue;
      }

      releaseObjectUrl(stillPresent.previewUrl);
      stillPresent.previewUrl = rememberObjectUrl(previewBlob);
      stillPresent.tile.setPreview(stillPresent.previewUrl, stillPresent.file.name);
    } catch {
      if (token !== state.selectionToken) {
        return;
      }

      const stillPresent = state.entries.find((candidate) => candidate.id === activeEntry.id);
      if (!stillPresent) {
        continue;
      }

      stillPresent.tile.setFallback('Preview unavailable');
    }
  }

  if (token !== state.selectionToken) {
    return;
  }

  updateReadyStatus();
}

function bindToolbarEvents() {
  formatSelect.addEventListener('change', () => {
    if (getConvertedEntries().length > 0 || state.mode === 'download') {
      resetConvertedState('Output format changed. Click Convert to re-run.');
      return;
    }

    updateReadyStatus();
  });

  convertButton.addEventListener('click', async () => {
    if (state.mode === 'download') {
      await downloadAllConverted();
      return;
    }

    await runConversion();
  });

  clearButton.addEventListener('click', () => {
    state.selectionToken += 1;
    state.isConverting = false;
    state.skippedCount = 0;
    setPrimaryMode('convert');
    clearEntries();
    updateReadyStatus();
  });
}

async function initOutputFormats() {
  state.outputFormats = await getSupportedOutputFormats();
  state.outputFormatsSignature = '';
  syncFormatOptions();
}

function initTheme() {
  const initialTheme = localStorage.getItem(THEME_KEY) || 'light';
  setTheme(initialTheme);

  toggle?.addEventListener('click', () => {
    const nextTheme = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
  });
}

async function init() {
  initTheme();

  fileInput.accept = INPUT_ACCEPT;

  await initOutputFormats();
  bindToolbarEvents();

  setupDropZone(dropZone, fileInput, handleIncomingFiles);

  window.addEventListener('resize', () => {
    updateDropZonePreviewLayout();
  });

  setPrimaryMode('convert');
  setStatus('');
  updateControls();

  if (!('createImageBitmap' in window)) {
    setStatus('This browser cannot decode image previews. Please use a modern browser.');
  }
}

init().catch(() => {
  setStatus('Failed to initialize converter. Please refresh the page.');
});
