export interface RGB {
  r: number;
  g: number;
  b: number;
}
export function colorDistance(a: RGB, b: RGB) {
  return Math.hypot(a.r - b.r, a.g - b.g, a.b - b.b) / Math.sqrt(3);
}
export function alphaForColor(
  color: RGB,
  target: RGB,
  tolerance: number,
  feather: number,
) {
  const distance = colorDistance(color, target);
  if (distance <= tolerance) return 0;
  if (feather <= 0 || distance >= tolerance + feather) return 255;
  return (255 * (distance - tolerance)) / feather;
}
export function applyAlphaMask(
  pixels: Uint8ClampedArray,
  target: RGB,
  tolerance: number,
  feather: number,
) {
  const result = new Uint8ClampedArray(pixels);
  for (let index = 0; index < result.length; index += 4) {
    const alpha = alphaForColor(
      { r: result[index], g: result[index + 1], b: result[index + 2] },
      target,
      tolerance,
      feather,
    );
    result[index + 3] = Math.round((result[index + 3] * alpha) / 255);
  }
  return result;
}
export function hexToRgb(hex: string): RGB {
  const value = Number.parseInt(hex.replace("#", ""), 16);
  return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 };
}
export function rgbToHex({ r, g, b }: RGB) {
  return `#${[r, g, b].map((value) => Math.round(value).toString(16).padStart(2, "0")).join("")}`;
}
