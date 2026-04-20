import type { Measurement, PageScale, Point } from './types';

export function pixelsPerFoot(scale: PageScale): number {
  const dx = scale.p2.x - scale.p1.x;
  const dy = scale.p2.y - scale.p1.y;
  const px = Math.hypot(dx, dy);
  if (scale.realDistance <= 0) return 0;
  return px / scale.realDistance;
}

export function polylineLengthPx(points: Point[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  }
  return total;
}

// Shoelace formula
export function polygonAreaPx(points: Point[]): number {
  if (points.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2;
}

export interface Quantity {
  value: number;
  unit: string;
}

// Returns measurement quantity in the condition's natural base unit.
// linear -> feet; area -> square feet; count -> each.
export function measurementBaseQuantity(
  m: Measurement,
  scale: PageScale | undefined,
  type: 'linear' | 'area' | 'count'
): number {
  if (type === 'count') return m.points.length;
  if (!scale) return 0;
  const ppf = pixelsPerFoot(scale);
  if (ppf <= 0) return 0;
  if (type === 'linear') {
    return polylineLengthPx(m.points) / ppf;
  }
  // area
  const areaPx2 = polygonAreaPx(m.points);
  return areaPx2 / (ppf * ppf);
}

export function convertQuantity(
  baseValue: number,
  type: 'linear' | 'area' | 'count',
  unit: string
): number {
  if (type === 'count') return baseValue;
  if (type === 'linear') {
    // base is ft
    if (unit === 'ft' || unit === 'lf') return baseValue;
    return baseValue;
  }
  // area: base is sf
  if (unit === 'sf') return baseValue;
  if (unit === 'sy') return baseValue / 9;
  return baseValue;
}
