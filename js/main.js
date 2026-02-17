import { isAvifFile } from './utils.js';
import { convertAvifToPng, createPreviewPngBlob } from './converter.js';
import {
  appendResult,
  clearResults,
  createMessageRow,
  createPendingResultRow,
  finalizePendingRowWithResult,
  setPendingRowPreview,
  setPendingRowError,
  setPendingRowState,
  setStatus,
  setupDropZone,
} from './ui.js';

const fileInput = document.getElementById('file-input');
const dropZone = document.getElementById('drop-zone');
const statusEl = document.getElementById('status');
const convertButton = document.getElementById('convert-btn');
const clearButton = document.getElementById('clear-btn');
const themeButton = document.getElementById('theme-btn');
const resultsEl = document.getElementById('results');
let queuedEntries = [];
let skippedCount = 0;
let isConverting = false;
let selectionToken = 0;
const THEME_STORAGE_KEY = 'avif-converter-theme';

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  themeButton.textContent = theme === 'dark' ? 'Light Theme' : 'Dark Theme';
}

function getStatusText(completed, total) {
  if (completed === 0 && total === 0) {
    return 'Converting...';
  }
  return `Converted ${completed}/${total} files.`;
}

function resetQueueState() {
  queuedEntries = [];
  skippedCount = 0;
  isConverting = false;
  convertButton.disabled = true;
}

const savedTheme = localStorage.getItem(THEME_STORAGE_KEY) || document.documentElement.getAttribute('data-theme') || 'light';
applyTheme(savedTheme);

themeButton.addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  const next = current === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  localStorage.setItem(THEME_STORAGE_KEY, next);
});

clearButton.addEventListener('click', () => {
  selectionToken += 1;
  resetQueueState();
  clearResults(resultsEl);
  setStatus(statusEl, 'Pick one or more AVIF files to begin.');
  clearButton.disabled = true;
});

convertButton.addEventListener('click', async () => {
  if (isConverting || queuedEntries.length === 0) {
    return;
  }

  isConverting = true;
  convertButton.disabled = true;

  let completed = 0;
  let failed = 0;
  const total = queuedEntries.length;

  for (const entry of queuedEntries) {
    if (entry.done) {
      continue;
    }

    const { file, row } = entry;

    try {
      setPendingRowState(row, 'Converting...');
      const result = await convertAvifToPng(file);
      finalizePendingRowWithResult(row, result);
      entry.done = true;
      completed += 1;
      setStatus(statusEl, getStatusText(completed, total));
    } catch (error) {
      entry.done = true;
      failed += 1;
      setPendingRowError(row, `${file.name} — ${error.message}`);
    }
  }

  isConverting = false;
  queuedEntries = [];

  if (completed === 0) {
    setStatus(statusEl, 'No AVIF files converted.');
    clearButton.disabled = resultsEl.children.length === 0;
    return;
  }

  setStatus(
    statusEl,
    `Done: ${completed} converted${failed ? `, ${failed} failed` : ''}${skippedCount ? `, ${skippedCount} skipped` : ''}.`
  );
  clearButton.disabled = false;
});

setupDropZone(dropZone, fileInput, async (files) => {
  const incoming = [...files];
  fileInput.value = '';

  if (!incoming.length) {
    setStatus(statusEl, 'No files selected.');
    return;
  }

  const token = ++selectionToken;
  isConverting = false;
  clearResults(resultsEl);
  convertButton.disabled = true;

  const supported = incoming.filter(isAvifFile);
  const unsupported = incoming.filter((file) => !isAvifFile(file));
  skippedCount = unsupported.length;

  if (!supported.length) {
    setStatus(statusEl, 'Please add at least one .avif file.');
    unsupported.forEach((file) => appendResult(resultsEl, createMessageRow(`Skipped: ${file.name} (not AVIF)`)));
    clearButton.disabled = unsupported.length === 0;
    return;
  }

  queuedEntries = supported.map((file) => ({
    file,
    row: createPendingResultRow(file),
    done: false,
  }));

  for (const entry of queuedEntries) {
    appendResult(resultsEl, entry.row);
  }

  if (unsupported.length) {
    unsupported.forEach((file) => appendResult(resultsEl, createMessageRow(`Skipped: ${file.name} (not AVIF)`)));
  }

  clearButton.disabled = false;
  setStatus(statusEl, `Preparing previews for ${supported.length} file(s)...`);
  for (const entry of queuedEntries) {
    if (token !== selectionToken) {
      return;
    }

    const { file, row } = entry;

    try {
      const previewBlob = await createPreviewPngBlob(file);
      if (token !== selectionToken) {
        return;
      }
      setPendingRowPreview(row, previewBlob, file.size);
      setPendingRowState(row, 'Ready to convert');
    } catch {
      if (token !== selectionToken) {
        return;
      }
      setPendingRowPreview(row, null, file.size);
      setPendingRowState(row, 'Preview unavailable');
    }
  }

  if (token !== selectionToken) {
    return;
  }

  setStatus(
    statusEl,
    `Ready: ${supported.length} file(s) prepared${unsupported.length ? `, ${unsupported.length} skipped` : ''}. Click Convert.`
  );
  convertButton.disabled = false;
});

if (!('createImageBitmap' in window)) {
  setStatus(statusEl, 'Preview and conversion need a modern browser with image bitmap support.');
}
