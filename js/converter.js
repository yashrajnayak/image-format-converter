function drawBitmapToCanvas(bitmap, width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Could not create canvas context.');
  }

  ctx.drawImage(bitmap, 0, 0, width, height);
  return canvas;
}

function canvasToPngBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((result) => {
      if (result) {
        resolve(result);
      } else {
        reject(new Error('Could not generate PNG output.'));
      }
    }, 'image/png');
  });
}

export async function createPreviewPngBlob(file, maxEdge = 360) {
  if (!file) {
    throw new Error('No file provided.');
  }

  let bitmap = null;

  try {
    bitmap = await createImageBitmap(file);
    const maxDimension = Math.max(bitmap.width, bitmap.height);
    const scale = maxDimension > maxEdge ? maxEdge / maxDimension : 1;
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = drawBitmapToCanvas(bitmap, width, height);
    return await canvasToPngBlob(canvas);
  } finally {
    if (bitmap && typeof bitmap.close === 'function') {
      bitmap.close();
    }
  }
}

export async function convertAvifToPng(file) {
  if (!file) {
    throw new Error('No file provided.');
  }

  let bitmap = null;

  try {
    bitmap = await createImageBitmap(file);

    const canvas = drawBitmapToCanvas(bitmap, bitmap.width, bitmap.height);
    const blob = await canvasToPngBlob(canvas);

    const outputName = file.name.toLowerCase().endsWith('.avif')
      ? `${file.name.slice(0, -5)}.png`
      : `${file.name}.png`;

    return {
      sourceName: file.name,
      outputName,
      sourceSize: file.size,
      width: bitmap.width,
      height: bitmap.height,
      size: blob.size,
      blob,
    };
  } finally {
    if (bitmap && typeof bitmap.close === 'function') {
      bitmap.close();
    }
  }
}
