// Shared non-destructive Set Look — deterministic pixel transforms, alpha untouched.

export interface SetLook {
  brightness: number; // -100..100
  contrast: number; // -100..100
  saturation: number; // -100..100
  warmth: number; // -100..100
}

export const DEFAULT_LOOK: SetLook = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  warmth: 0,
};

export function isDefaultLook(look: SetLook): boolean {
  return (
    look.brightness === 0 &&
    look.contrast === 0 &&
    look.saturation === 0 &&
    look.warmth === 0
  );
}

const clamp = (value: number) => Math.max(0, Math.min(255, value));

export function applyLook(
  pixels: Uint8ClampedArray,
  look: SetLook,
): Uint8ClampedArray {
  const result = new Uint8ClampedArray(pixels);
  if (isDefaultLook(look)) return result;
  const contrastFactor = Math.tan(((look.contrast / 100) * Math.PI) / 4 + Math.PI / 4);
  const saturationFactor = 1 + look.saturation / 100;
  const warmthShift = (look.warmth / 100) * 40;
  for (let index = 0; index < result.length; index += 4) {
    let r = result[index] + look.brightness + warmthShift;
    let g = result[index + 1] + look.brightness;
    let b = result[index + 2] + look.brightness - warmthShift;
    r = (r - 128) * contrastFactor + 128;
    g = (g - 128) * contrastFactor + 128;
    b = (b - 128) * contrastFactor + 128;
    const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    r = luma + (r - luma) * saturationFactor;
    g = luma + (g - luma) * saturationFactor;
    b = luma + (b - luma) * saturationFactor;
    result[index] = clamp(Math.round(r));
    result[index + 1] = clamp(Math.round(g));
    result[index + 2] = clamp(Math.round(b));
  }
  return result;
}
