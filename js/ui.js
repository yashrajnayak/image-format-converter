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

export function createPreviewTile({ name, onRemove }) {
  const card = document.createElement('figure');
  card.className = 'drop-zone-preview-card';

  const removeButton = document.createElement('button');
  removeButton.type = 'button';
  removeButton.className = 'drop-zone-preview-card__remove';
  removeButton.setAttribute('aria-label', `Remove ${name}`);
  removeButton.textContent = '×';
  removeButton.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    onRemove?.();
  });

  let media = document.createElement('div');
  media.className = 'drop-zone-preview-card__fallback';
  media.textContent = 'Preparing preview...';

  const downloadButton = document.createElement('button');
  downloadButton.type = 'button';
  downloadButton.className = 'drop-zone-preview-card__download ys-button ys-button--primary';
  downloadButton.textContent = 'Download';
  downloadButton.hidden = true;

  let onDownload = null;
  downloadButton.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    onDownload?.();
  });

  card.append(removeButton, media, downloadButton);

  return {
    element: card,
    setPreview(src, altText) {
      const image = document.createElement('img');
      image.className = 'drop-zone-preview-card__image';
      image.loading = 'lazy';
      image.alt = altText;
      image.src = src;
      image.addEventListener('error', () => {
        this.setFallback('Preview unavailable');
      });
      media.replaceWith(image);
      media = image;
    },
    setFallback(text = 'Preview unavailable') {
      const fallback = document.createElement('div');
      fallback.className = 'drop-zone-preview-card__fallback';
      fallback.textContent = text;
      media.replaceWith(fallback);
      media = fallback;
    },
    setProcessing(isProcessing) {
      card.classList.toggle('is-processing', isProcessing);
    },
    setRemoveVisible(visible) {
      removeButton.hidden = !visible;
    },
    setRemoveDisabled(disabled) {
      removeButton.disabled = disabled;
    },
    showDownload(handler) {
      onDownload = handler;
      downloadButton.hidden = false;
    },
    hideDownload() {
      onDownload = null;
      downloadButton.hidden = true;
    },
    setDownloadDisabled(disabled) {
      downloadButton.disabled = disabled;
    },
    destroy() {
      card.remove();
    },
  };
}
