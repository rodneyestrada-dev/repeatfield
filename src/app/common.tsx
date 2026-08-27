import { useEffect, useState } from "react";

export function useImage(src: string | null) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    if (!src) {
      setImg(null);
      return;
    }
    const i = new Image();
    i.onload = () => setImg(i);
    i.src = src;
    return () => setImg(null);
  }, [src]);
  return img;
}

export function acceptUpload(
  file: File | undefined,
  setSrc: (updater: (old: string | null) => string | null) => void,
  onName?: (name: string) => void,
) {
  if (!file) return;
  if (
    !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
    !file.size
  )
    return;
  const url = URL.createObjectURL(file);
  setSrc((old) => {
    if (old?.startsWith("blob:")) URL.revokeObjectURL(old);
    return url;
  });
  onName?.(file.name);
}

export function Range({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (n: number) => void;
}) {
  return (
    <label className="range">
      <span>
        {label}
        <output>
          {value}
          {label.toLowerCase().includes("rotation") ? "°" : ""}
        </output>
      </span>
      <input
        aria-label={label}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}

export function downloadCanvas(canvas: HTMLCanvasElement, filename: string) {
  canvas.toBlob((blob) => {
    if (!blob) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }, "image/png");
}
