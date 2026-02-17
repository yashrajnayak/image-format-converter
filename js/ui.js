import { formatBytes } from './utils.js';

const objectUrls = new Set();

function createPreviewCard(url, label) {
  const figure = document.createElement('figure');
  figure.className = 'result__preview-card';

  const image = document.createElement('img');
  image.src = url;
  image.alt = label;
  image.loading = 'lazy';
  image.className = 'result__preview-image';
  image.addEventListener('error', () => {
    const fallback = document.createElement('div');
    fallback.className = 'result__preview-fallback';
    fallback.textContent = 'Preview unavailable';
    image.replaceWith(fallback);
  });

  const caption = document.createElement('figcaption');
  caption.textContent = label;
  caption.className = 'result__preview-caption';

  figure.append(image, caption);
  return figure;
}

function createPreviewFallbackCard(label, text = 'Preview unavailable') {
  const figure = document.createElement('figure');
  figure.className = 'result__preview-card';

  const fallback = document.createElement('div');
  fallback.className = 'result__preview-fallback';
  fallback.textContent = text;

  const caption = document.createElement('figcaption');
  caption.textContent = label;
  caption.className = 'result__preview-caption';

  figure.append(fallback, caption);
  return figure;
}

function makeSafeObjectUrl(source) {
  const url = URL.createObjectURL(source);
  objectUrls.add(url);
  return url;
}

function formatFileSize(bytes) {
  return formatBytes(bytes);
}

export function setupDropZone(dropZoneEl, inputEl, onFiles) {
  const stop = (event) => {
    event.preventDefault();
    event.stopPropagation();
  };

  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach((type) => {
    dropZoneEl.addEventListener(type, stop);
  });

  dropZoneEl.addEventListener('dragover', () => {
    dropZoneEl.classList.add('is-dragging');
  });

  dropZoneEl.addEventListener('dragleave', () => {
    dropZoneEl.classList.remove('is-dragging');
  });

  dropZoneEl.addEventListener('drop', (event) => {
    dropZoneEl.classList.remove('is-dragging');
    onFiles?.(event.dataTransfer?.files || []);
  });

  const openPicker = (event) => {
    if (event.target === inputEl || event.defaultPrevented) {
      return;
    }

    if (
      event.target instanceof Element &&
      event.target.closest('a, button, input, select, textarea, [contenteditable="true"], [data-no-picker="true"]')
    ) {
      return;
    }

    inputEl.click();
  };

  dropZoneEl.addEventListener('click', openPicker);
  dropZoneEl.addEventListener('keydown', (event) => {
    if (event.target !== dropZoneEl) {
      return;
    }

    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }
    event.preventDefault();
    openPicker(event);
  });

  inputEl.addEventListener('change', () => {
    onFiles?.(inputEl.files);
  });
}

export function createPendingResultRow(file) {
  const row = document.createElement('article');
  row.className = 'result result--pending ys-card';

  const name = document.createElement('strong');
  name.textContent = `Queued: ${file.name}`;
  name.dataset.role = 'result-title';

  const meta = document.createElement('p');
  meta.className = 'result__meta';
  meta.dataset.role = 'result-meta';
  meta.textContent = `Original: ${formatFileSize(file.size)}`;

  const previews = document.createElement('div');
  previews.className = 'result__previews';
  previews.append(createPreviewFallbackCard(`Original (${formatFileSize(file.size)})`, 'Preparing preview...'));

  const status = document.createElement('p');
  status.className = 'result__meta result__state';
  status.textContent = 'Preparing preview...';
  status.dataset.state = 'pending';

  row.append(name, meta, previews, status);
  return row;
}

export function finalizePendingRowWithResult(row, result) {
  const title = row.querySelector('[data-role="result-title"]');
  const meta = row.querySelector('[data-role="result-meta"]');
  const status = row.querySelector('[data-state="pending"]');
  const previews = row.querySelector('.result__previews');

  if (title) {
    title.textContent = `${result.sourceName} → ${result.outputName}`;
  }

  if (meta) {
    meta.textContent = `${result.width}×${result.height} • ${formatFileSize(result.sourceSize)} → ${formatFileSize(result.size)}`;
  }

  if (status) {
    status.textContent = 'Converted';
    status.dataset.state = 'done';
  }

  previews?.remove();

  row.classList.remove('result--pending');
  row.classList.add('result--done');

  const oldActions = row.querySelector('.result__actions');
  if (oldActions) {
    oldActions.remove();
  }

  const outputUrl = makeSafeObjectUrl(result.blob);
  const actions = document.createElement('div');
  actions.className = 'result__actions';

  const link = document.createElement('a');
  link.className = 'ys-button ys-button--primary result__download';
  link.href = outputUrl;
  link.download = result.outputName;
  link.textContent = 'Download PNG';

  actions.append(link);
  row.append(actions);
}

export function setPendingRowPreview(row, previewBlob, sourceSize) {
  const previews = row.querySelector('.result__previews');
  if (!previews) {
    return;
  }

  const label = `Original (${formatFileSize(sourceSize)})`;
  previews.textContent = '';

  if (!previewBlob) {
    previews.append(createPreviewFallbackCard(label));
    return;
  }

  previews.append(createPreviewCard(makeSafeObjectUrl(previewBlob), label));
}

export function setPendingRowState(row, text, state = 'pending') {
  const status = row.querySelector('[data-state]');
  if (!status) {
    return;
  }

  status.textContent = text;
  status.dataset.state = state;
}

export function setPendingRowError(row, message) {
  setPendingRowState(row, `Failed: ${message}`, 'failed');
}


export function createMessageRow(text) {
  const row = document.createElement('article');
  row.className = 'result ys-card';
  row.textContent = text;
  return row;
}

export function setStatus(el, text) {
  if (el) {
    el.textContent = text;
  }
}

export function clearResults(container) {
  container.textContent = '';
  objectUrls.forEach((url) => URL.revokeObjectURL(url));
  objectUrls.clear();
}

export function appendResult(container, node) {
  container.appendChild(node);
}
