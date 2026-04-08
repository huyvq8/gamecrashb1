import { useEffect, useMemo, useState } from "react";

function chromaKeyWhiteToAlpha(img: HTMLImageElement, threshold = 245): string | null {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  ctx.drawImage(img, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const isWhiteish = r >= threshold && g >= threshold && b >= threshold;
    if (isWhiteish) {
      data[i + 3] = 0; // set alpha to transparent
    }
  }
  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL("image/png");
}

export function useChromaKeyImage(src: string | null, options?: { whiteThreshold?: number }): string | null {
  const [processed, setProcessed] = useState<string | null>(null);
  const threshold = options?.whiteThreshold ?? 245;
  const cacheKey = useMemo(() => (src ? `${src}|${threshold}` : null), [src, threshold]);

  useEffect(() => {
    let cancelled = false;
    if (!src) {
      setProcessed(null);
      return;
    }
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (cancelled) return;
      try {
        const out = chromaKeyWhiteToAlpha(img, threshold);
        setProcessed(out);
      } catch {
        setProcessed(src);
      }
    };
    img.onerror = () => {
      if (!cancelled) setProcessed(src);
    };
    img.src = src;
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey]);

  return processed;
}

