const imageInput = document.getElementById('imageInput');
const sourceCanvas = document.getElementById('sourceCanvas');
const skinCanvas = document.getElementById('skinCanvas');
const statusText = document.getElementById('statusText');
const downloadBtn = document.getElementById('downloadBtn');
const autoBtn = document.getElementById('autoBtn');
const sourceCtx = sourceCanvas.getContext('2d', { willReadFrequently: true });
const skinCtx = skinCanvas.getContext('2d', { willReadFrequently: true });

const controls = {
  scale: document.getElementById('scaleRange'),
  head: document.getElementById('headRange'),
  torso: document.getElementById('torsoRange'),
  arm: document.getElementById('armRange'),
  leg: document.getElementById('legRange'),
  foot: document.getElementById('footRange'),
  bg: document.getElementById('bgRange'),
  slim: document.getElementById('slimToggle'),
  overlay: document.getElementById('overlayToggle')
};

const outputs = {
  scale: document.getElementById('scaleValue'),
  head: document.getElementById('headValue'),
  torso: document.getElementById('torsoValue'),
  arm: document.getElementById('armValue'),
  leg: document.getElementById('legValue'),
  foot: document.getElementById('footValue'),
  bg: document.getElementById('bgValue')
};

let loadedImage = null;
let currentImageBitmap = null;

function updateOutputs() {
  Object.entries(outputs).forEach(([key, output]) => {
    output.textContent = `${controls[key].value}%`;
  });
}

function clearSourcePreview() {
  sourceCtx.clearRect(0, 0, sourceCanvas.width, sourceCanvas.height);
}

function fitImageToCanvas(img) {
  clearSourcePreview();
  const canvasRatio = sourceCanvas.width / sourceCanvas.height;
  const imageRatio = img.width / img.height;
  let drawWidth = sourceCanvas.width;
  let drawHeight = sourceCanvas.height;
  let x = 0;
  let y = 0;

  if (imageRatio > canvasRatio) {
    drawHeight = sourceCanvas.width / imageRatio;
    y = (sourceCanvas.height - drawHeight) / 2;
  } else {
    drawWidth = sourceCanvas.height * imageRatio;
    x = (sourceCanvas.width - drawWidth) / 2;
  }

  sourceCtx.drawImage(img, x, y, drawWidth, drawHeight);
}

function readImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function getVisibleBounds(ctx, width, height, bgThreshold) {
  const { data } = ctx.getImageData(0, 0, width, height);
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      const alpha = data[offset + 3];
      const brightness = (data[offset] + data[offset + 1] + data[offset + 2]) / 3;
      if (alpha > 24 && brightness > bgThreshold) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  if (maxX === -1) {
    return { x: 0, y: 0, width, height };
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1
  };
}

function extractSegments(bounds) {
  const scale = Number(controls.scale.value) / 100;
  const headRatio = Number(controls.head.value) / 100;
  const torsoRatio = Number(controls.torso.value) / 100;
  const armRatio = Number(controls.arm.value) / 100;
  const legRatio = Number(controls.leg.value) / 100;
  const footRatio = Number(controls.foot.value) / 100;

  const croppedHeight = bounds.height * scale;
  const croppedWidth = bounds.width * scale;
  const offsetX = bounds.x + (bounds.width - croppedWidth) / 2;
  const offsetY = bounds.y + (bounds.height - croppedHeight) / 2;

  const headHeight = croppedHeight * headRatio;
  const bodyHeight = croppedHeight * 0.34;
  const legHeight = croppedHeight - headHeight - bodyHeight - croppedHeight * footRatio;
  const torsoWidth = croppedWidth * torsoRatio;
  const armWidth = croppedWidth * armRatio;
  const legWidth = croppedWidth * legRatio;
  const centerX = offsetX + croppedWidth / 2;
  const bodyY = offsetY + headHeight;
  const legsY = bodyY + bodyHeight;

  return {
    head: { x: centerX - torsoWidth / 2, y: offsetY, width: torsoWidth, height: headHeight },
    body: { x: centerX - torsoWidth / 2, y: bodyY, width: torsoWidth, height: bodyHeight },
    leftArm: { x: centerX - torsoWidth / 2 - armWidth, y: bodyY, width: armWidth, height: bodyHeight },
    rightArm: { x: centerX + torsoWidth / 2, y: bodyY, width: armWidth, height: bodyHeight },
    leftLeg: { x: centerX - legWidth, y: legsY, width: legWidth, height: legHeight },
    rightLeg: { x: centerX, y: legsY, width: legWidth, height: legHeight }
  };
}

function cropRegion(rect) {
  const temp = document.createElement('canvas');
  temp.width = Math.max(1, Math.round(rect.width));
  temp.height = Math.max(1, Math.round(rect.height));
  const tempCtx = temp.getContext('2d', { willReadFrequently: true });
  tempCtx.imageSmoothingEnabled = false;
  tempCtx.drawImage(
    currentImageBitmap,
    rect.x,
    rect.y,
    rect.width,
    rect.height,
    0,
    0,
    temp.width,
    temp.height
  );
  return temp;
}

function tintCanvas(canvas, factor = 0.88) {
  const temp = document.createElement('canvas');
  temp.width = canvas.width;
  temp.height = canvas.height;
  const ctx = temp.getContext('2d');
  ctx.drawImage(canvas, 0, 0);
  const image = ctx.getImageData(0, 0, temp.width, temp.height);
  for (let i = 0; i < image.data.length; i += 4) {
    image.data[i] *= factor;
    image.data[i + 1] *= factor;
    image.data[i + 2] *= factor;
  }
  ctx.putImageData(image, 0, 0);
  return temp;
}

function drawFace(targetCtx, source, sx, sy, sw, sh, dx, dy, dw, dh, flip = false) {
  targetCtx.save();
  targetCtx.imageSmoothingEnabled = false;
  if (flip) {
    targetCtx.translate(dx + dw, dy);
    targetCtx.scale(-1, 1);
    targetCtx.drawImage(source, sx, sy, sw, sh, 0, 0, dw, dh);
  } else {
    targetCtx.drawImage(source, sx, sy, sw, sh, dx, dy, dw, dh);
  }
  targetCtx.restore();
}

function fillCube(targetCtx, canvas, map, overlayCanvas = null) {
  const sideSource = tintCanvas(canvas, 0.8);
  const backSource = tintCanvas(canvas, 0.7);

  drawFace(targetCtx, canvas, 0, 0, canvas.width, canvas.height, map.front.x, map.front.y, map.front.w, map.front.h);
  drawFace(targetCtx, sideSource, 0, 0, canvas.width, canvas.height, map.left.x, map.left.y, map.left.w, map.left.h, true);
  drawFace(targetCtx, sideSource, 0, 0, canvas.width, canvas.height, map.right.x, map.right.y, map.right.w, map.right.h);
  drawFace(targetCtx, backSource, 0, 0, canvas.width, canvas.height, map.back.x, map.back.y, map.back.w, map.back.h);

  const topSlice = Math.max(1, Math.round(canvas.height * 0.18));
  drawFace(targetCtx, canvas, 0, 0, canvas.width, topSlice, map.top.x, map.top.y, map.top.w, map.top.h);
  drawFace(targetCtx, backSource, 0, canvas.height - topSlice, canvas.width, topSlice, map.bottom.x, map.bottom.y, map.bottom.w, map.bottom.h);

  if (overlayCanvas) {
    targetCtx.globalAlpha = 0.72;
    fillCube(targetCtx, overlayCanvas, map);
    targetCtx.globalAlpha = 1;
  }
}

function createOverlay(canvas) {
  const overlay = document.createElement('canvas');
  overlay.width = canvas.width;
  overlay.height = canvas.height;
  const ctx = overlay.getContext('2d');
  ctx.drawImage(canvas, 0, 0);
  ctx.globalCompositeOperation = 'source-atop';
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.fillRect(0, 0, overlay.width, overlay.height);
  return overlay;
}

function generateSkin() {
  if (!loadedImage || !currentImageBitmap) {
    return;
  }

  const workCanvas = document.createElement('canvas');
  workCanvas.width = loadedImage.width;
  workCanvas.height = loadedImage.height;
  const workCtx = workCanvas.getContext('2d', { willReadFrequently: true });
  workCtx.imageSmoothingEnabled = true;
  workCtx.drawImage(loadedImage, 0, 0);

  const bgThreshold = Number(controls.bg.value) * 2.55;
  const bounds = getVisibleBounds(workCtx, workCanvas.width, workCanvas.height, bgThreshold);
  const segments = extractSegments(bounds);
  const slim = controls.slim.checked;
  const withOverlay = controls.overlay.checked;

  skinCtx.clearRect(0, 0, skinCanvas.width, skinCanvas.height);
  skinCtx.imageSmoothingEnabled = false;

  const armFaceW = slim ? 3 : 4;

  const maps = {
    head: {
      top: { x: 8, y: 0, w: 8, h: 8 },
      bottom: { x: 16, y: 0, w: 8, h: 8 },
      left: { x: 16, y: 8, w: 8, h: 8 },
      front: { x: 8, y: 8, w: 8, h: 8 },
      right: { x: 0, y: 8, w: 8, h: 8 },
      back: { x: 24, y: 8, w: 8, h: 8 }
    },
    body: {
      top: { x: 20, y: 16, w: 8, h: 4 },
      bottom: { x: 28, y: 16, w: 8, h: 4 },
      left: { x: 28, y: 20, w: 4, h: 12 },
      front: { x: 20, y: 20, w: 8, h: 12 },
      right: { x: 16, y: 20, w: 4, h: 12 },
      back: { x: 32, y: 20, w: 8, h: 12 }
    },
    rightArm: {
      top: { x: 44, y: 16, w: armFaceW, h: 4 },
      bottom: { x: 48, y: 16, w: armFaceW, h: 4 },
      left: { x: 48, y: 20, w: 4, h: 12 },
      front: { x: 44, y: 20, w: armFaceW, h: 12 },
      right: { x: 40, y: 20, w: 4, h: 12 },
      back: { x: 52, y: 20, w: armFaceW, h: 12 }
    },
    leftArm: {
      top: { x: 36, y: 48, w: armFaceW, h: 4 },
      bottom: { x: 40, y: 48, w: armFaceW, h: 4 },
      left: { x: 40, y: 52, w: 4, h: 12 },
      front: { x: 36, y: 52, w: armFaceW, h: 12 },
      right: { x: 32, y: 52, w: 4, h: 12 },
      back: { x: 44, y: 52, w: armFaceW, h: 12 }
    },
    rightLeg: {
      top: { x: 4, y: 16, w: 4, h: 4 },
      bottom: { x: 8, y: 16, w: 4, h: 4 },
      left: { x: 8, y: 20, w: 4, h: 12 },
      front: { x: 4, y: 20, w: 4, h: 12 },
      right: { x: 0, y: 20, w: 4, h: 12 },
      back: { x: 12, y: 20, w: 4, h: 12 }
    },
    leftLeg: {
      top: { x: 20, y: 48, w: 4, h: 4 },
      bottom: { x: 24, y: 48, w: 4, h: 4 },
      left: { x: 24, y: 52, w: 4, h: 12 },
      front: { x: 20, y: 52, w: 4, h: 12 },
      right: { x: 16, y: 52, w: 4, h: 12 },
      back: { x: 28, y: 52, w: 4, h: 12 }
    }
  };

  const overlays = {
    head: withOverlay ? createOverlay(cropRegion(segments.head)) : null,
    body: withOverlay ? createOverlay(cropRegion(segments.body)) : null,
    leftArm: withOverlay ? createOverlay(cropRegion(segments.leftArm)) : null,
    rightArm: withOverlay ? createOverlay(cropRegion(segments.rightArm)) : null,
    leftLeg: withOverlay ? createOverlay(cropRegion(segments.leftLeg)) : null,
    rightLeg: withOverlay ? createOverlay(cropRegion(segments.rightLeg)) : null
  };

  fillCube(skinCtx, cropRegion(segments.head), maps.head);
  fillCube(skinCtx, cropRegion(segments.body), maps.body);
  fillCube(skinCtx, cropRegion(segments.rightArm), maps.rightArm);
  fillCube(skinCtx, cropRegion(segments.leftArm), maps.leftArm);
  fillCube(skinCtx, cropRegion(segments.rightLeg), maps.rightLeg);
  fillCube(skinCtx, cropRegion(segments.leftLeg), maps.leftLeg);

  if (withOverlay) {
    fillCube(skinCtx, overlays.head, {
      top: { x: 40, y: 0, w: 8, h: 8 },
      bottom: { x: 48, y: 0, w: 8, h: 8 },
      left: { x: 48, y: 8, w: 8, h: 8 },
      front: { x: 40, y: 8, w: 8, h: 8 },
      right: { x: 32, y: 8, w: 8, h: 8 },
      back: { x: 56, y: 8, w: 8, h: 8 }
    });
    fillCube(skinCtx, overlays.body, {
      top: { x: 20, y: 32, w: 8, h: 4 },
      bottom: { x: 28, y: 32, w: 8, h: 4 },
      left: { x: 28, y: 36, w: 4, h: 12 },
      front: { x: 20, y: 36, w: 8, h: 12 },
      right: { x: 16, y: 36, w: 4, h: 12 },
      back: { x: 32, y: 36, w: 8, h: 12 }
    });
    fillCube(skinCtx, overlays.rightArm, {
      top: { x: 44, y: 32, w: armFaceW, h: 4 },
      bottom: { x: 48, y: 32, w: armFaceW, h: 4 },
      left: { x: 48, y: 36, w: 4, h: 12 },
      front: { x: 44, y: 36, w: armFaceW, h: 12 },
      right: { x: 40, y: 36, w: 4, h: 12 },
      back: { x: 52, y: 36, w: armFaceW, h: 12 }
    });
    fillCube(skinCtx, overlays.leftArm, {
      top: { x: 52, y: 48, w: armFaceW, h: 4 },
      bottom: { x: 56, y: 48, w: armFaceW, h: 4 },
      left: { x: 56, y: 52, w: 4, h: 12 },
      front: { x: 52, y: 52, w: armFaceW, h: 12 },
      right: { x: 48, y: 52, w: 4, h: 12 },
      back: { x: 60, y: 52, w: armFaceW, h: 12 }
    });
    fillCube(skinCtx, overlays.rightLeg, {
      top: { x: 4, y: 32, w: 4, h: 4 },
      bottom: { x: 8, y: 32, w: 4, h: 4 },
      left: { x: 8, y: 36, w: 4, h: 12 },
      front: { x: 4, y: 36, w: 4, h: 12 },
      right: { x: 0, y: 36, w: 4, h: 12 },
      back: { x: 12, y: 36, w: 4, h: 12 }
    });
    fillCube(skinCtx, overlays.leftLeg, {
      top: { x: 4, y: 48, w: 4, h: 4 },
      bottom: { x: 8, y: 48, w: 4, h: 4 },
      left: { x: 8, y: 52, w: 4, h: 12 },
      front: { x: 4, y: 52, w: 4, h: 12 },
      right: { x: 0, y: 52, w: 4, h: 12 },
      back: { x: 12, y: 52, w: 4, h: 12 }
    });
  }

  statusText.textContent = 'Skin generada. Ajusta los sliders si necesitas refinar el recorte.';
  downloadBtn.disabled = false;
}

Object.entries(controls).forEach(([key, control]) => {
  const eventName = control.type === 'checkbox' ? 'change' : 'input';
  control.addEventListener(eventName, () => {
    if (outputs[key]) {
      updateOutputs();
    }
    if (loadedImage) {
      generateSkin();
    }
  });
});

imageInput.addEventListener('change', async (event) => {
  const [file] = event.target.files;
  if (!file) {
    return;
  }

  try {
    loadedImage = await readImage(file);
    currentImageBitmap = loadedImage;
    fitImageToCanvas(loadedImage);
    statusText.textContent = 'Imagen cargada. Generando layout…';
    generateSkin();
  } catch (error) {
    console.error(error);
    statusText.textContent = 'No se pudo leer la imagen.';
  }
});

autoBtn.addEventListener('click', generateSkin);

downloadBtn.addEventListener('click', () => {
  const link = document.createElement('a');
  link.download = 'minecraft-skin.png';
  link.href = skinCanvas.toDataURL('image/png');
  link.click();
});

updateOutputs();
