import { useState, useEffect } from "react";

export interface ExtractedColors {
  primary: [number, number, number];
  secondary: [number, number, number];
  primaryRgb: string;
  secondaryRgb: string;
  glowRgba: (alpha: number) => string;
  cssGradient: (isLight: boolean) => string;
}

const colorCache = new Map<string, ExtractedColors>();

export async function extractColorsFromImage(src: string): Promise<ExtractedColors | null> {
  if (!src) return null;
  if (colorCache.has(src)) {
    return colorCache.get(src)!;
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        const size = 36;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) {
          resolve(null);
          return;
        }

        ctx.drawImage(img, 0, 0, size, size);
        const imageData = ctx.getImageData(0, 0, size, size);
        const data = imageData.data;

        interface Bucket {
          count: number;
          score: number;
          rSum: number;
          gSum: number;
          bSum: number;
        }

        const buckets = new Map<string, Bucket>();

        for (let i = 0; i < data.length; i += 4) {
          const a = data[i + 3];
          if (a < 128) continue;

          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];

          const max = Math.max(r, g, b);
          const min = Math.min(r, g, b);
          const chroma = max - min;
          const lum = 0.299 * r + 0.587 * g + 0.114 * b;

          // Skip extremely dark or almost pure white/washed out pixels
          if (lum < 20) continue;
          if (lum > 240 && chroma < 20) continue;

          // Quantize into bins of 28
          const qr = Math.round(r / 28) * 28;
          const qg = Math.round(g / 28) * 28;
          const qb = Math.round(b / 28) * 28;
          const key = `${qr},${qg},${qb}`;

          // Weight favors vibrancy/chroma so colorful album art pops
          const weight = 1 + (chroma / 255) * 4;

          const existing = buckets.get(key);
          if (existing) {
            existing.count += 1;
            existing.score += weight;
            existing.rSum += r;
            existing.gSum += g;
            existing.bSum += b;
          } else {
            buckets.set(key, {
              count: 1,
              score: weight,
              rSum: r,
              gSum: g,
              bSum: b,
            });
          }
        }

        // If no colorful pixels passed the filter (e.g. grayscale art)
        if (buckets.size === 0) {
          for (let i = 0; i < data.length; i += 4) {
            if (data[i + 3] < 128) continue;
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const qr = Math.round(r / 32) * 32;
            const qg = Math.round(g / 32) * 32;
            const qb = Math.round(b / 32) * 32;
            const key = `${qr},${qg},${qb}`;
            const existing = buckets.get(key);
            if (existing) {
              existing.count += 1;
              existing.score += 1;
              existing.rSum += r;
              existing.gSum += g;
              existing.bSum += b;
            } else {
              buckets.set(key, {
                count: 1,
                score: 1,
                rSum: r,
                gSum: g,
                bSum: b,
              });
            }
          }
        }

        if (buckets.size === 0) {
          resolve(null);
          return;
        }

        const sorted = Array.from(buckets.values()).sort((a, b) => b.score - a.score);
        const top1 = sorted[0];
        const primary: [number, number, number] = [
          Math.round(top1.rSum / top1.count),
          Math.round(top1.gSum / top1.count),
          Math.round(top1.bSum / top1.count),
        ];

        // Find secondary color with significant color distance
        let secondary: [number, number, number] | null = null;
        for (let i = 1; i < sorted.length; i++) {
          const item = sorted[i];
          const r = Math.round(item.rSum / item.count);
          const g = Math.round(item.gSum / item.count);
          const b = Math.round(item.bSum / item.count);
          const dist = Math.sqrt(
            Math.pow(primary[0] - r, 2) +
            Math.pow(primary[1] - g, 2) +
            Math.pow(primary[2] - b, 2)
          );
          if (dist >= 50) {
            secondary = [r, g, b];
            break;
          }
        }

        // If no distinct second color, create a complimentary tone
        if (!secondary) {
          const lum = 0.299 * primary[0] + 0.587 * primary[1] + 0.114 * primary[2];
          if (lum < 110) {
            secondary = [
              Math.min(255, Math.round(primary[0] * 1.5 + 35)),
              Math.min(255, Math.round(primary[1] * 1.5 + 35)),
              Math.min(255, Math.round(primary[2] * 1.5 + 35)),
            ];
          } else {
            secondary = [
              Math.max(0, Math.round(primary[0] * 0.6)),
              Math.max(0, Math.round(primary[1] * 0.6)),
              Math.max(0, Math.round(primary[2] * 0.6)),
            ];
          }
        }

        const primaryRgb = `rgb(${primary[0]}, ${primary[1]}, ${primary[2]})`;
        const secondaryRgb = `rgb(${secondary[0]}, ${secondary[1]}, ${secondary[2]})`;

        const result: ExtractedColors = {
          primary,
          secondary,
          primaryRgb,
          secondaryRgb,
          glowRgba: (alpha: number) => `rgba(${primary[0]}, ${primary[1]}, ${primary[2]}, ${alpha})`,
          cssGradient: (isLight: boolean) => {
            const a1 = isLight ? 0.32 : 0.42;
            const a2 = isLight ? 0.14 : 0.2;
            return `radial-gradient(ellipse 95% 135% at 0% 50%, rgba(${primary[0]}, ${primary[1]}, ${primary[2]}, ${a1}) 0%, rgba(${secondary[0]}, ${secondary[1]}, ${secondary[2]}, ${a2}) 45%, transparent 75%)`;
          },
        };

        colorCache.set(src, result);
        resolve(result);
      } catch {
        resolve(null);
      }
    };

    img.onerror = () => resolve(null);
    img.src = src;
  });
}

export function useExtractedColors(src: string | null): ExtractedColors | null {
  const [colors, setColors] = useState<ExtractedColors | null>(() => {
    return src ? colorCache.get(src) || null : null;
  });

  useEffect(() => {
    if (!src) {
      setColors(null);
      return;
    }

    if (colorCache.has(src)) {
      setColors(colorCache.get(src)!);
      return;
    }

    let isCancelled = false;
    extractColorsFromImage(src).then((extracted) => {
      if (!isCancelled && extracted) {
        setColors(extracted);
      }
    });

    return () => {
      isCancelled = true;
    };
  }, [src]);

  return colors;
}
