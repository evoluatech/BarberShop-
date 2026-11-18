import {FaceAlignmentMetrics, VirtualHairstyleId} from '@/lib/types/domain';

export interface LiveHeadBox {
  cx: number; // 0..1 horizontal center in display frame
  cy: number; // 0..1 vertical center of head/face in display frame
  w: number; // 0..1 relative head width
  h: number; // 0..1 relative head height (crown to chin)
  rollRad: number; // head tilt angle in radians (-0.28..0.28)
}

export interface LiveOverlayOptions {
  styleId: VirtualHairstyleId | null;
  styleName: string;
  compatibilityScore?: number;
  headBox: LiveHeadBox;
  alignment?: FaceAlignmentMetrics;
  showCutOverlay: boolean;
  showGuides: boolean;
  detectedHairType?: string;
  faceShape?: string;
  liveHairHex?: string;
}

export interface ContinuousSampleResult {
  headBox: LiveHeadBox;
  avgLum: number;
  lightingOk: boolean;
  brightnessLabel: 'Ideal' | 'Escura' | 'Muito clara';
  framingOk: boolean;
  liveHairHex: string;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function parseHexToRgb(hex: string): {r: number; g: number; b: number} {
  const clean = hex.replace('#', '').trim();
  if (/^[0-9a-fA-F]{6}$/.test(clean)) {
    return {
      r: parseInt(clean.slice(0, 2), 16),
      g: parseInt(clean.slice(2, 4), 16),
      b: parseInt(clean.slice(4, 6), 16),
    };
  }
  return {r: 28, g: 24, b: 22};
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (v: number) =>
    clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function rgba(rgb: {r: number; g: number; b: number}, alpha: number): string {
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${clamp(alpha, 0, 1).toFixed(3)})`;
}

/**
 * Computes normalized source crop rectangle matching CSS `object-cover`
 * so Canvas tracking and AR overlays map 1:1 onto the visible `<video>`.
 */
export function computeObjectCoverCrop(
  videoW: number,
  videoH: number,
  targetW: number,
  targetH: number
): {sx: number; sy: number; sw: number; sh: number} {
  if (!videoW || !videoH || !targetW || !targetH) {
    return {sx: 0, sy: 0, sw: videoW || 1, sh: videoH || 1};
  }
  const videoAspect = videoW / videoH;
  const targetAspect = targetW / targetH;
  if (videoAspect > targetAspect) {
    const sw = videoH * targetAspect;
    const sx = (videoW - sw) / 2;
    return {sx, sy: 0, sw, sh: videoH};
  }
  const sh = videoW / targetAspect;
  const sy = (videoH - sh) / 2;
  return {sx: 0, sy, sw: videoW, sh};
}

/**
 * Converts Gemini's FaceAlignmentMetrics (measured on un-mirrored frame)
 * into a display-space LiveHeadBox baseline for real-time AR tracking.
 */
export function alignmentToMirroredHeadBox(
  alignment?: FaceAlignmentMetrics,
  mirrored = true
): LiveHeadBox {
  if (!alignment) {
    return {cx: 0.5, cy: 0.45, w: 0.42, h: 0.56, rollRad: 0};
  }
  const topY = clamp(alignment.topY, 0.06, 0.36);
  const chinY = clamp(alignment.chinY, topY + 0.28, 0.92);
  const h = clamp(chinY - topY, 0.34, 0.72);
  const w = clamp(alignment.widthRatio || h * 0.76, 0.24, 0.62);
  const cx = clamp(mirrored ? 1 - alignment.centerX : alignment.centerX, 0.2, 0.8);
  const cy = clamp(topY + h * 0.5, 0.22, 0.75);
  return {cx, cy, w, h, rollRad: 0};
}

/**
 * Measures continuous head position, dynamic scale, tilt angle, lighting quality,
 * and live crown hair tone from the active video frame without static captures.
 */
export function analyzeContinuousCameraFrame(
  ctx: CanvasRenderingContext2D,
  sampleW: number,
  sampleH: number,
  anchor: LiveHeadBox
): ContinuousSampleResult {
  const data = ctx.getImageData(0, 0, sampleW, sampleH).data;
  const minX = Math.max(4, Math.floor((anchor.cx - anchor.w * 0.7) * sampleW));
  const maxX = Math.min(sampleW - 4, Math.ceil((anchor.cx + anchor.w * 0.7) * sampleW));
  const minY = Math.max(4, Math.floor((anchor.cy - anchor.h * 0.58) * sampleH));
  const maxY = Math.min(
    sampleH - 4,
    Math.ceil((anchor.cy + anchor.h * 0.58) * sampleH)
  );

  let weightedX = 0;
  let weightedY = 0;
  let totalWeight = 0;
  let lumSum = 0;
  let lumCount = 0;
  let centerEnergy = 0;
  let edgeEnergy = 0;

  // Estimate left/right vertical mass balance for head tilt (roll)
  let leftEyeY = 0;
  let leftWeight = 0;
  let rightEyeY = 0;
  let rightWeight = 0;

  // Estimate live head span within upper-mid facial band
  let spanMinX = maxX;
  let spanMaxX = minX;

  // Sample crown region for real-time hair shade
  let hairR = 0;
  let hairG = 0;
  let hairB = 0;
  let hairCount = 0;

  const midX = anchor.cx * sampleW;
  const crownEndY = (anchor.cy - anchor.h * 0.22) * sampleH;
  const cheekStartY = (anchor.cy - anchor.h * 0.2) * sampleH;
  const cheekEndY = (anchor.cy + anchor.h * 0.12) * sampleH;

  for (let y = minY; y < maxY; y += 2) {
    for (let x = minX; x < maxX; x += 2) {
      const idx = (y * sampleW + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];

      const nextIdx = (y * sampleW + Math.min(sampleW - 1, x + 2)) * 4;
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      const lum2 =
        0.299 * data[nextIdx] + 0.587 * data[nextIdx + 1] + 0.114 * data[nextIdx + 2];

      lumSum += lum;
      lumCount++;

      const diff = Math.abs(lum - lum2);
      const isSkinHint = r > g && g > b * 0.85 && lum > 52 && lum < 238;

      if (
        x >= sampleW * 0.28 &&
        x <= sampleW * 0.72 &&
        y >= sampleH * 0.22 &&
        y <= sampleH * 0.74
      ) {
        centerEnergy += diff;
      } else {
        edgeEnergy += diff;
      }

      if (y <= crownEndY && lum < 125 && !isSkinHint) {
        hairR += r;
        hairG += g;
        hairB += b;
        hairCount++;
      }

      const featureContrast = Math.min(35, diff) * 0.08;
      const weight = (isSkinHint ? 1.7 : 0.35) + featureContrast;

      weightedX += x * weight;
      weightedY += y * weight;
      totalWeight += weight;

      if (isSkinHint && y >= cheekStartY && y <= cheekEndY) {
        if (x < spanMinX) spanMinX = x;
        if (x > spanMaxX) spanMaxX = x;
      }

      if (y >= cheekStartY && y <= cheekEndY && featureContrast > 0.7) {
        if (x < midX) {
          leftEyeY += y * featureContrast;
          leftWeight += featureContrast;
        } else {
          rightEyeY += y * featureContrast;
          rightWeight += featureContrast;
        }
      }
    }
  }

  const avgLum = lumCount > 0 ? lumSum / lumCount : 120;
  let brightnessLabel: ContinuousSampleResult['brightnessLabel'] = 'Ideal';
  let lightingOk = true;
  if (avgLum < 48) {
    brightnessLabel = 'Escura';
    lightingOk = false;
  } else if (avgLum > 228) {
    brightnessLabel = 'Muito clara';
    lightingOk = false;
  }

  const framingOk = centerEnergy > Math.max(edgeEnergy * 0.42, 1600) && avgLum >= 48;

  const detectedCx =
    totalWeight > 10 ? clamp(weightedX / totalWeight / sampleW, 0.2, 0.8) : anchor.cx;
  const detectedCy =
    totalWeight > 10 ? clamp(weightedY / totalWeight / sampleH, 0.22, 0.76) : anchor.cy;

  // Dynamic head width scale when skin span is stable
  const rawSpanW = (spanMaxX - spanMinX) / sampleW;
  const liveW =
    rawSpanW >= 0.2 && rawSpanW <= 0.65
      ? clamp(anchor.w * 0.65 + rawSpanW * 0.35, 0.24, 0.62)
      : anchor.w;
  const liveH = clamp(anchor.h * 0.65 + liveW * 1.32 * 0.35, 0.34, 0.74);

  // Estimate head roll angle from left vs right high-contrast feature elevation
  let rollRad = 0;
  if (leftWeight > 8 && rightWeight > 8) {
    const ly = leftEyeY / leftWeight;
    const ry = rightEyeY / rightWeight;
    const dx = Math.max(12, liveW * sampleW * 0.42);
    rollRad = clamp(Math.atan2(ry - ly, dx) * 0.65, -0.26, 0.26);
  }

  const liveHairHex =
    hairCount >= 12
      ? rgbToHex(hairR / hairCount, hairG / hairCount, hairB / hairCount)
      : '#1F1A17';

  return {
    headBox: {
      cx: anchor.cx * 0.35 + detectedCx * 0.65,
      cy: anchor.cy * 0.35 + detectedCy * 0.65,
      w: liveW,
      h: liveH,
      rollRad,
    },
    avgLum,
    lightingOk,
    brightnessLabel,
    framingOk,
    liveHairHex,
  };
}

/**
 * Draws the live AR haircut / beard / visagism projection directly over the active video feed,
 * tracking head position, scale, and roll tilt in real time.
 */
export function drawLiveCutAROverlay(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  opts: LiveOverlayOptions
): void {
  ctx.clearRect(0, 0, width, height);
  if (!opts.showCutOverlay && !opts.showGuides) return;

  const {headBox, alignment, styleId} = opts;
  const hairRgb = parseHexToRgb(
    alignment?.hairColorHex || opts.liveHairHex || '#1C1714'
  );

  // Compute live anatomical coordinates anchored to the tracked head box
  const rawHeadH = Math.max(
    0.28,
    (alignment?.chinY ?? 0.72) - (alignment?.topY ?? 0.14)
  );
  const hairlineRatio = alignment
    ? clamp((alignment.hairlineY - alignment.topY) / rawHeadH, 0.16, 0.34)
    : 0.22;
  const earRatio = alignment
    ? clamp((alignment.earY - alignment.topY) / rawHeadH, 0.44, 0.6)
    : 0.52;
  const jawWidthRatio = alignment
    ? clamp(
        (alignment.jawRightX - alignment.jawLeftX) /
          Math.max(0.2, alignment.widthRatio),
        0.68,
        0.94
      )
    : 0.82;
  const templeSpanRatio = alignment
    ? clamp(
        (alignment.templeRightX - alignment.templeLeftX) /
          Math.max(0.2, alignment.widthRatio),
        0.78,
        1.0
      )
    : 0.92;

  const pivotX = headBox.cx * width;
  const pivotY = headBox.cy * height;
  const headW = headBox.w * width;
  const headH = headBox.h * height;

  // Draw inside head-centered rotated coordinate frame so the overlay tilts naturally with head roll
  ctx.save();
  ctx.translate(pivotX, pivotY);
  ctx.rotate(headBox.rollRad || 0);

  const cx = 0;
  const topY = -headH * 0.5;
  const chinY = headH * 0.5;
  const hairlineY = topY + headH * hairlineRatio;
  const earY = topY + headH * earRatio;
  const jawY = topY + headH * 0.77;
  const browY = hairlineY + headH * 0.14;

  const halfTemple = (headW * templeSpanRatio) / 2;
  const halfJaw = (headW * jawWidthRatio) / 2;
  const templeL = cx - halfTemple;
  const templeR = cx + halfTemple;
  const jawL = cx - halfJaw;
  const jawR = cx + halfJaw;

  if (opts.showCutOverlay && styleId) {
    const hasHairCut = styleId !== 'barba-desenhada';

    if (hasHairCut) {
      if (
        styleId === 'corte-degrade' ||
        styleId === 'combo-corte-barba' ||
        styleId === 'corte-barba-sobrancelha'
      ) {
        // Textured lifted crown silhouette
        const crownLift = headH * 0.085;
        const topGrad = ctx.createLinearGradient(
          0,
          topY - crownLift,
          0,
          hairlineY + headH * 0.04
        );
        topGrad.addColorStop(0, rgba(hairRgb, 0.68));
        topGrad.addColorStop(0.6, rgba(hairRgb, 0.44));
        topGrad.addColorStop(1, rgba(hairRgb, 0.04));

        ctx.beginPath();
        ctx.moveTo(templeL - headW * 0.02, hairlineY + headH * 0.03);
        ctx.bezierCurveTo(
          templeL - headW * 0.04,
          topY - crownLift * 0.55,
          cx - headW * 0.25,
          topY - crownLift * 1.15,
          cx,
          topY - crownLift * 1.05
        );
        ctx.bezierCurveTo(
          cx + headW * 0.25,
          topY - crownLift * 1.15,
          templeR + headW * 0.04,
          topY - crownLift * 0.55,
          templeR + headW * 0.02,
          hairlineY + headH * 0.03
        );
        ctx.quadraticCurveTo(
          cx,
          hairlineY - headH * 0.025,
          templeL - headW * 0.02,
          hairlineY + headH * 0.03
        );
        ctx.closePath();
        ctx.fillStyle = topGrad;
        ctx.fill();

        // Subtle textured hair strand highlights at crown
        ctx.strokeStyle = 'rgba(247, 147, 30, 0.38)';
        ctx.lineWidth = 1.4;
        for (let i = -3; i <= 3; i++) {
          const sx = cx + i * (headW * 0.095);
          ctx.beginPath();
          ctx.moveTo(sx, hairlineY - headH * 0.01);
          ctx.quadraticCurveTo(
            sx + headW * 0.025,
            topY + headH * 0.04,
            sx + headW * 0.015,
            topY - crownLift * 0.55
          );
          ctx.stroke();
        }

        // Left & right skin-fade side gradient strips (high/mid fade graduation)
        const fadeWidth = headW * 0.13;
        const fadeBottomY = earY + headH * 0.04;
        [templeL - fadeWidth * 0.45, templeR - fadeWidth * 0.55].forEach((sideX) => {
          const fGrad = ctx.createLinearGradient(
            0,
            topY + headH * 0.05,
            0,
            fadeBottomY
          );
          fGrad.addColorStop(0, rgba(hairRgb, 0.62));
          fGrad.addColorStop(0.55, rgba(hairRgb, 0.28));
          fGrad.addColorStop(1, 'rgba(247, 147, 30, 0.0)');
          ctx.fillStyle = fGrad;
          ctx.beginPath();
          ctx.roundRect(
            sideX,
            topY + headH * 0.05,
            fadeWidth,
            fadeBottomY - (topY + headH * 0.05),
            8
          );
          ctx.fill();
        });
      } else if (styleId === 'corte-social') {
        const crownLift = headH * 0.05;
        const socialGrad = ctx.createLinearGradient(
          0,
          topY - crownLift,
          0,
          hairlineY + headH * 0.02
        );
        socialGrad.addColorStop(0, rgba(hairRgb, 0.64));
        socialGrad.addColorStop(1, rgba(hairRgb, 0.1));

        ctx.beginPath();
        ctx.moveTo(templeL, hairlineY + headH * 0.02);
        ctx.quadraticCurveTo(templeL, topY - crownLift, cx, topY - crownLift);
        ctx.quadraticCurveTo(
          templeR,
          topY - crownLift,
          templeR,
          hairlineY + headH * 0.02
        );
        ctx.quadraticCurveTo(
          cx,
          hairlineY - headH * 0.01,
          templeL,
          hairlineY + headH * 0.02
        );
        ctx.closePath();
        ctx.fillStyle = socialGrad;
        ctx.fill();

        // Crisp side-part accent line
        ctx.strokeStyle = 'rgba(247, 147, 30, 0.78)';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(cx - headW * 0.24, hairlineY);
        ctx.quadraticCurveTo(
          cx - headW * 0.19,
          topY + headH * 0.07,
          cx - headW * 0.12,
          topY - crownLift * 0.45
        );
        ctx.stroke();
        ctx.setLineDash([]);

        // Clean tapered sideburns
        ctx.strokeStyle = rgba(hairRgb, 0.55);
        ctx.lineWidth = Math.max(4, headW * 0.045);
        ctx.beginPath();
        ctx.moveTo(templeL, hairlineY);
        ctx.lineTo(templeL - headW * 0.01, earY + headH * 0.03);
        ctx.moveTo(templeR, hairlineY);
        ctx.lineTo(templeR + headW * 0.01, earY + headH * 0.03);
        ctx.stroke();
      } else if (styleId === 'corte-tesoura') {
        const crownLift = headH * 0.11;
        const sideExtra = headW * 0.075;
        const tesouraGrad = ctx.createLinearGradient(0, topY - crownLift, 0, earY);
        tesouraGrad.addColorStop(0, rgba(hairRgb, 0.66));
        tesouraGrad.addColorStop(0.7, rgba(hairRgb, 0.25));
        tesouraGrad.addColorStop(1, rgba(hairRgb, 0.0));

        ctx.beginPath();
        ctx.moveTo(templeL - sideExtra, earY - headH * 0.02);
        ctx.bezierCurveTo(
          templeL - sideExtra * 1.2,
          topY,
          cx - headW * 0.34,
          topY - crownLift,
          cx,
          topY - crownLift * 1.08
        );
        ctx.bezierCurveTo(
          cx + headW * 0.34,
          topY - crownLift,
          templeR + sideExtra * 1.2,
          topY,
          templeR + sideExtra,
          earY - headH * 0.02
        );
        ctx.quadraticCurveTo(
          templeR - headW * 0.02,
          hairlineY,
          cx,
          hairlineY - headH * 0.01
        );
        ctx.quadraticCurveTo(
          templeL + headW * 0.02,
          hairlineY,
          templeL - sideExtra,
          earY - headH * 0.02
        );
        ctx.closePath();
        ctx.fillStyle = tesouraGrad;
        ctx.fill();
      }
    }

    const hasBeardCut =
      styleId === 'barba-desenhada' ||
      styleId === 'combo-corte-barba' ||
      styleId === 'corte-barba-sobrancelha';

    if (hasBeardCut) {
      const cheekTopY = earY + headH * 0.02;
      const mouthY = chinY - headH * 0.17;
      const beardGrad = ctx.createLinearGradient(0, cheekTopY, 0, chinY + headH * 0.02);
      beardGrad.addColorStop(0, rgba(hairRgb, 0.24));
      beardGrad.addColorStop(0.55, rgba(hairRgb, 0.52));
      beardGrad.addColorStop(1, rgba(hairRgb, 0.65));

      ctx.beginPath();
      ctx.moveTo(templeL - headW * 0.015, earY - headH * 0.01);
      ctx.lineTo(jawL - headW * 0.02, jawY);
      ctx.quadraticCurveTo(cx, chinY + headH * 0.055, jawR + headW * 0.02, jawY);
      ctx.lineTo(templeR + headW * 0.015, earY - headH * 0.01);
      ctx.quadraticCurveTo(
        cx + headW * 0.22,
        mouthY - headH * 0.03,
        cx + headW * 0.14,
        mouthY + headH * 0.01
      );
      ctx.quadraticCurveTo(
        cx,
        mouthY + headH * 0.03,
        cx - headW * 0.14,
        mouthY + headH * 0.01
      );
      ctx.quadraticCurveTo(
        cx - headW * 0.22,
        mouthY - headH * 0.03,
        templeL - headW * 0.015,
        earY - headH * 0.01
      );
      ctx.closePath();
      ctx.fillStyle = beardGrad;
      ctx.fill();

      ctx.strokeStyle = 'rgba(247, 147, 30, 0.72)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(templeL - headW * 0.015, earY);
      ctx.lineTo(jawL - headW * 0.015, jawY);
      ctx.quadraticCurveTo(cx, chinY + headH * 0.045, jawR + headW * 0.015, jawY);
      ctx.lineTo(templeR + headW * 0.015, earY);
      ctx.stroke();
    }

    if (styleId === 'corte-barba-sobrancelha') {
      const browSpan = headW * 0.21;
      const innerGap = headW * 0.08;
      ctx.strokeStyle = 'rgba(247, 147, 30, 0.82)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx - innerGap, browY);
      ctx.quadraticCurveTo(
        cx - innerGap - browSpan * 0.6,
        browY - headH * 0.024,
        cx - innerGap - browSpan,
        browY + headH * 0.008
      );
      ctx.moveTo(cx + innerGap, browY);
      ctx.quadraticCurveTo(
        cx + innerGap + browSpan * 0.6,
        browY - headH * 0.024,
        cx + innerGap + browSpan,
        browY + headH * 0.008
      );
      ctx.stroke();
    }
  }

  // Architectural visagism framing guides
  if (opts.showGuides) {
    ctx.save();
    ctx.setLineDash([4, 6]);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    ctx.moveTo(cx, topY - headH * 0.06);
    ctx.lineTo(cx, chinY + headH * 0.05);
    ctx.stroke();
    ctx.restore();

    const tick = Math.max(8, headW * 0.06);
    ctx.strokeStyle = '#F7931E';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - tick, topY - headH * 0.04);
    ctx.lineTo(cx + tick, topY - headH * 0.04);
    ctx.moveTo(templeL - tick * 0.5, hairlineY);
    ctx.lineTo(templeL + tick * 0.5, hairlineY);
    ctx.moveTo(templeR - tick * 0.5, hairlineY);
    ctx.lineTo(templeR + tick * 0.5, hairlineY);
    ctx.moveTo(jawL - tick * 0.3, jawY);
    ctx.lineTo(jawL, jawY + tick * 0.6);
    ctx.moveTo(jawR + tick * 0.3, jawY);
    ctx.lineTo(jawR, jawY + tick * 0.6);
    ctx.stroke();
  }

  ctx.restore();
}
