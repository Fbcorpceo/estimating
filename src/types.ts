export type ToolMode =
  | 'pan'
  | 'calibrate'
  | 'linear'
  | 'area'
  | 'rect'
  | 'count';

export type MeasurementType = 'linear' | 'area' | 'count';

export type Unit =
  | 'ft' // linear
  | 'lf' // linear feet (alias for ft in linear context)
  | 'sf' // square feet
  | 'sy' // square yards
  | 'ea'; // each (count)

export interface Point {
  x: number; // image-space pixels
  y: number;
}

export interface Condition {
  id: string;
  name: string;
  type: MeasurementType;
  color: string;
  unit: Unit;
  unitCost: number; // $ per unit
  wastePct: number; // 0..100
  // Only meaningful for linear conditions. When set, the quantity is
  // computed as Length (ft) × wallHeight (ft) = area in SF, and the
  // condition is priced per SF.
  wallHeight?: number;
}

export interface Measurement {
  id: string;
  conditionId: string;
  pageId: string;
  points: Point[]; // for linear: polyline; for area: polygon; for count: single point per marker
  // counts can either be one Measurement per marker, or multi-point. We use multi-point: each point is one count.
  note?: string;
}

export interface PageScale {
  // Two image-space points and the real-world distance between them
  p1: Point;
  p2: Point;
  realDistance: number; // in feet
}

export interface PlanPage {
  id: string;
  name: string;
  // For PDFs we store the source ArrayBuffer + page index. For images, just the dataURL.
  source:
    | { kind: 'image'; dataUrl: string; width: number; height: number }
    | { kind: 'pdf'; fileId: string; pageIndex: number; width: number; height: number };
  scale?: PageScale;
}

export interface PdfFile {
  id: string;
  name: string;
  data: ArrayBuffer;
}

export interface Project {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  pages: PlanPage[];
  conditions: Condition[];
  measurements: Measurement[];
  pdfFiles: PdfFile[]; // raw PDF data referenced by pages
}
