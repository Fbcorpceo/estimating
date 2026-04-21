import { useEffect, useMemo, useRef, useState } from 'react';
import { Stage, Layer, Image as KImage, Line, Circle, Text, Group, Rect } from 'react-konva';
import Konva from 'konva';
import { useStore } from '../store';
import { renderPdfPage } from '../pdf';
import { pixelsPerFoot, polygonAreaPx, polylineLengthPx } from '../geometry';
import type { PlanPage, Point } from '../types';
import { CalibrateDialog } from './CalibrateDialog';
import { formatNumber } from '../format';

interface Viewport {
  scale: number;
  tx: number;
  ty: number;
}

export function PlanCanvas() {
  const project = useStore((s) => s.project);
  const activePageId = useStore((s) => s.activePageId);
  const tool = useStore((s) => s.tool);
  const draftPoints = useStore((s) => s.draftPoints);
  const calibDraft = useStore((s) => s.calibDraft);
  const activeConditionId = useStore((s) => s.activeConditionId);
  const selectedMeasurementId = useStore((s) => s.selectedMeasurementId);

  const pushDraftPoint = useStore((s) => s.pushDraftPoint);
  const popDraftPoint = useStore((s) => s.popDraftPoint);
  const commitDraft = useStore((s) => s.commitDraft);
  const clearDraft = useStore((s) => s.clearDraft);
  const addCountMarker = useStore((s) => s.addCountMarker);
  const setCalibPoint = useStore((s) => s.setCalibPoint);
  const clearCalib = useStore((s) => s.clearCalib);
  const setTool = useStore((s) => s.setTool);
  const selectMeasurement = useStore((s) => s.selectMeasurement);
  const removeMeasurement = useStore((s) => s.removeMeasurement);
  const rectDraft = useStore((s) => s.rectDraft);
  const setRectDraft = useStore((s) => s.setRectDraft);
  const commitRect = useStore((s) => s.commitRect);
  const undo = useStore((s) => s.undo);
  const ensurePdfBytes = useStore((s) => s.ensurePdfBytes);

  const page = useMemo(
    () => project.pages.find((p) => p.id === activePageId) ?? null,
    [project.pages, activePageId]
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [viewport, setViewport] = useState<Viewport>({ scale: 1, tx: 0, ty: 0 });
  const [planImage, setPlanImage] = useState<HTMLCanvasElement | HTMLImageElement | null>(null);
  const [hover, setHover] = useState<Point | null>(null);
  const [showCalibDialog, setShowCalibDialog] = useState(false);
  const [spaceDown, setSpaceDown] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // resize observer
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setSize({ w: el.clientWidth, h: el.clientHeight });
    });
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  // load plan image when page changes
  useEffect(() => {
    let cancelled = false;
    setPlanImage(null);
    setLoadError(null);
    if (!page) return;
    if (page.source.kind === 'image') {
      const img = new Image();
      img.onload = () => {
        if (!cancelled) setPlanImage(img);
      };
      img.onerror = () => {
        if (!cancelled) setLoadError('The image could not be loaded. Please re-upload the plan.');
      };
      img.src = page.source.dataUrl;
    } else {
      const file = project.pdfFiles.find((f) => f.id === (page.source as any).fileId);
      if (!file) {
        setLoadError('PDF reference is missing. Please re-upload the PDF.');
        return;
      }
      (async () => {
        let bytes: ArrayBuffer | null = file.data && file.data.byteLength > 0 ? file.data : null;
        if (!bytes) {
          bytes = await ensurePdfBytes(file.id);
        }
        if (cancelled) return;
        if (!bytes) {
          if (file.storagePath) {
            setLoadError(
              "Couldn't download this PDF from the cloud. Re-upload or try again."
            );
          } else {
            setLoadError(
              'PDF data is missing for this page (legacy local save). Please re-upload the PDF — your measurements will be kept.'
            );
          }
          return;
        }
        try {
          const pageIdx = (page.source as { pageIndex: number }).pageIndex;
          const canvas = await renderPdfPage(bytes, pageIdx, 2);
          if (!cancelled) setPlanImage(canvas);
        } catch (e) {
          console.error('PDF render failed', e);
          if (!cancelled) setLoadError('The PDF failed to render. Try re-uploading the file.');
        }
      })();
    }
    return () => {
      cancelled = true;
    };
  }, [page, project.pdfFiles]);

  // fit-to-window when page changes
  useEffect(() => {
    if (!page || !planImage) return;
    const baseW = page.source.width;
    const baseH = page.source.height;
    const sx = (size.w - 40) / baseW;
    const sy = (size.h - 40) / baseH;
    const scale = Math.max(0.05, Math.min(sx, sy, 1));
    setViewport({
      scale,
      tx: (size.w - baseW * scale) / 2,
      ty: (size.h - baseH * scale) / 2,
    });
  }, [page, planImage, size.w, size.h]);

  // open calibration dialog when both points have been picked
  useEffect(() => {
    if (tool === 'calibrate' && calibDraft.p1 && calibDraft.p2) {
      setShowCalibDialog(true);
    }
  }, [tool, calibDraft.p1, calibDraft.p2]);

  // keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      )
        return;
      if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        undo();
        return;
      }
      if (e.code === 'Space') {
        if (!e.repeat) setSpaceDown(true);
      } else if (e.key === 'Escape') {
        clearDraft();
        clearCalib();
        setShowCalibDialog(false);
        selectMeasurement(null);
      } else if (e.key === 'Enter') {
        if (tool === 'linear' || tool === 'area') commitDraft();
      } else if (e.key === 'Backspace') {
        if (tool === 'linear' || tool === 'area') popDraftPoint();
      } else if (e.key === 'Delete' && selectedMeasurementId) {
        removeMeasurement(selectedMeasurementId);
      } else if (e.key === 'v' || e.key === 'V') setTool('pan');
      else if (e.key === 'c' || e.key === 'C') setTool('calibrate');
      else if (e.key === 'l' || e.key === 'L') setTool('linear');
      else if (e.key === 'a' || e.key === 'A') setTool('area');
      else if (e.key === 'r' || e.key === 'R') setTool('rect');
      else if (e.key === 'n' || e.key === 'N') setTool('count');
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') setSpaceDown(false);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [
    tool,
    selectedMeasurementId,
    clearDraft,
    clearCalib,
    commitDraft,
    popDraftPoint,
    removeMeasurement,
    selectMeasurement,
    setTool,
    undo,
  ]);

  function screenToImage(p: { x: number; y: number }): Point {
    return { x: (p.x - viewport.tx) / viewport.scale, y: (p.y - viewport.ty) / viewport.scale };
  }

  function handleWheel(e: Konva.KonvaEventObject<WheelEvent>) {
    e.evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;
    const oldScale = viewport.scale;
    const factor = e.evt.deltaY < 0 ? 1.1 : 1 / 1.1;
    const newScale = Math.max(0.05, Math.min(oldScale * factor, 20));
    const imgX = (pointer.x - viewport.tx) / oldScale;
    const imgY = (pointer.y - viewport.ty) / oldScale;
    setViewport({
      scale: newScale,
      tx: pointer.x - imgX * newScale,
      ty: pointer.y - imgY * newScale,
    });
  }

  // pan with right-mouse or space+left-mouse
  const panState = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    startTx: number;
    startTy: number;
  }>({ active: false, startX: 0, startY: 0, startTx: 0, startTy: 0 });

  function handleMouseDown(e: Konva.KonvaEventObject<MouseEvent>) {
    const stage = stageRef.current;
    if (!stage || !page) return;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;
    const isPan = tool === 'pan' || spaceDown || e.evt.button === 1 || e.evt.button === 2;
    if (isPan) {
      panState.current = {
        active: true,
        startX: pointer.x,
        startY: pointer.y,
        startTx: viewport.tx,
        startTy: viewport.ty,
      };
      return;
    }
    if (e.evt.button !== 0) return;
    // If the click landed on an existing measurement's node, select it
    // instead of adding a draft point. Each measurement Group is tagged
    // with name="m:<id>".
    let node: Konva.Node | null = e.target;
    while (node && node !== stage) {
      const nm = node.name?.();
      if (nm && nm.startsWith('m:')) {
        selectMeasurement(nm.slice(2));
        return;
      }
      node = node.getParent();
    }
    const ip = screenToImage(pointer);
    if (tool === 'calibrate') {
      if (!calibDraft.p1) setCalibPoint('p1', ip);
      else setCalibPoint('p2', ip);
    } else if (tool === 'linear' || tool === 'area') {
      pushDraftPoint(ip);
    } else if (tool === 'rect') {
      setRectDraft({ start: ip, end: ip });
    } else if (tool === 'count') {
      addCountMarker(ip);
    } else if (tool === 'pan') {
      // Clicking on empty space in pan mode deselects
      selectMeasurement(null);
    }
  }

  function handleMouseMove(e: Konva.KonvaEventObject<MouseEvent>) {
    const stage = stageRef.current;
    if (!stage) return;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;
    if (panState.current.active) {
      const dx = pointer.x - panState.current.startX;
      const dy = pointer.y - panState.current.startY;
      setViewport((v) => ({
        ...v,
        tx: panState.current.startTx + dx,
        ty: panState.current.startTy + dy,
      }));
      return;
    }
    const ip = screenToImage(pointer);
    setHover(ip);
    if (tool === 'rect' && rectDraft.start) {
      setRectDraft({ start: rectDraft.start, end: ip });
    }
    // ignore unused param warning
    void e;
  }

  function handleMouseUp() {
    panState.current.active = false;
    if (tool === 'rect' && rectDraft.start && rectDraft.end) {
      commitRect();
    }
  }

  function handleDoubleClick() {
    if (tool === 'linear' || tool === 'area') commitDraft();
  }

  const ppf = page?.scale ? pixelsPerFoot(page.scale) : 0;

  return (
    <div
      ref={containerRef}
      className="flex-1 relative bg-[#0d0f15] overflow-hidden"
      onContextMenu={(e) => e.preventDefault()}
    >
      {!page && (
        <div className="absolute inset-0 flex items-center justify-center text-muted">
          Upload a plan (PDF or image) to start.
        </div>
      )}
      {page && (
        <Stage
          ref={stageRef}
          width={size.w}
          height={size.h}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onDblClick={handleDoubleClick}
          style={{
            cursor:
              panState.current.active || spaceDown
                ? 'grabbing'
                : tool === 'pan'
                  ? 'grab'
                  : 'crosshair',
          }}
        >
          <Layer listening={false}>
            <Rect x={0} y={0} width={size.w} height={size.h} fill="#0d0f15" />
            {planImage && (
              <KImage
                image={planImage}
                x={viewport.tx}
                y={viewport.ty}
                width={page.source.width * viewport.scale}
                height={page.source.height * viewport.scale}
              />
            )}
          </Layer>

          <Layer>
            <MeasurementsLayer
              page={page}
              viewport={viewport}
              ppf={ppf}
              selectedId={selectedMeasurementId}
              onSelect={selectMeasurement}
            />
            <DraftLayer
              tool={tool}
              draftPoints={draftPoints}
              hover={hover}
              viewport={viewport}
              ppf={ppf}
              activeConditionColor={
                project.conditions.find((c) => c.id === activeConditionId)?.color ?? '#ffffff'
              }
            />
            <CalibrationOverlay
              calibDraft={calibDraft}
              viewport={viewport}
              hover={tool === 'calibrate' ? hover : null}
              tool={tool}
            />
            <RectDraftOverlay
              rectDraft={rectDraft}
              viewport={viewport}
              ppf={ppf}
              color={
                project.conditions.find((c) => c.id === activeConditionId)?.color ?? '#ffffff'
              }
              unit={project.conditions.find((c) => c.id === activeConditionId)?.unit ?? 'sf'}
              tool={tool}
            />
          </Layer>
        </Stage>
      )}

      {/* HUD */}
      <div className="absolute bottom-2 left-2 bg-[#1a1f2b]/90 border border-[#2a3142] rounded px-2 py-1 text-xs text-muted">
        Zoom {Math.round(viewport.scale * 100)}%
        {page?.scale && (
          <>
            {' · '}
            <span className="text-emerald-400">Calibrated</span>
            {' '}
            ({formatNumber(ppf, 2)} px/ft)
          </>
        )}
        {!page?.scale && page && <> · <span className="text-amber-400">Not calibrated</span></>}
      </div>

      {page && !page.scale && !loadError && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 px-4 py-2 rounded-md bg-amber-500/95 text-black text-sm font-medium shadow-lg pointer-events-none">
          Set the page scale first — click two points a known distance apart.
        </div>
      )}

      {page && loadError && <ReuploadBanner page={page} message={loadError} />}

      {selectedMeasurementId && (
        <SelectionToolbar
          measurementId={selectedMeasurementId}
          onDelete={() => removeMeasurement(selectedMeasurementId)}
          onDeselect={() => selectMeasurement(null)}
        />
      )}

      {showCalibDialog && (
        <CalibrateDialog
          onClose={() => {
            setShowCalibDialog(false);
            clearCalib();
          }}
        />
      )}
    </div>
  );
}

// ---------- Sublayers ----------

function MeasurementsLayer(props: {
  page: PlanPage;
  viewport: Viewport;
  ppf: number;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const { page, viewport, ppf, selectedId, onSelect } = props;
  const measurements = useStore((s) =>
    s.project.measurements.filter((m) => m.pageId === page.id)
  );
  const conditions = useStore((s) => s.project.conditions);
  const condById = useMemo(() => {
    const m = new Map<string, (typeof conditions)[number]>();
    conditions.forEach((c) => m.set(c.id, c));
    return m;
  }, [conditions]);

  const toScreen = (p: Point) => ({
    x: p.x * viewport.scale + viewport.tx,
    y: p.y * viewport.scale + viewport.ty,
  });

  return (
    <Group>
      {measurements.map((m) => {
        const cond = condById.get(m.conditionId);
        if (!cond) return null;
        if (cond.hidden) return null;
        const pts = m.points.map(toScreen);
        const isSelected = m.id === selectedId;
        const stroke = cond.color;
        if (cond.type === 'count') {
          return (
            <Group key={m.id} name={`m:${m.id}`}>
              {pts.map((p, i) => (
                <Group key={i}>
                  <Circle
                    x={p.x}
                    y={p.y}
                    radius={6}
                    fill={cond.color}
                    stroke="#fff"
                    strokeWidth={isSelected ? 2 : 1}
                    onClick={() => onSelect(m.id)}
                  />
                  <Text
                    x={p.x + 8}
                    y={p.y - 8}
                    text={String(i + 1)}
                    fontSize={11}
                    fill="#fff"
                    listening={false}
                  />
                </Group>
              ))}
            </Group>
          );
        }
        const flat = pts.flatMap((p) => [p.x, p.y]);
        if (cond.type === 'linear') {
          const lengthFt = ppf > 0 ? polylineLengthPx(m.points) / ppf : 0;
          const mid = pts[Math.floor(pts.length / 2)] ?? pts[0];
          const label = cond.wallHeight
            ? `${formatNumber(lengthFt * cond.wallHeight, 1)} sf · ${formatNumber(lengthFt, 1)} lf × ${cond.wallHeight}ft`
            : `${formatNumber(lengthFt, 2)} ${cond.unit}`;
          return (
            <Group key={m.id} name={`m:${m.id}`} onClick={() => onSelect(m.id)}>
              <Line
                points={flat}
                stroke={stroke}
                strokeWidth={isSelected ? 4 : 2}
                lineJoin="round"
                lineCap="round"
                hitStrokeWidth={12}
              />
              {pts.map((p, i) => (
                <Circle key={i} x={p.x} y={p.y} radius={3} fill={stroke} />
              ))}
              {ppf > 0 && <LabelBadge x={mid.x} y={mid.y} text={label} />}
            </Group>
          );
        }
        // area
        const areaSf = ppf > 0 ? polygonAreaPx(m.points) / (ppf * ppf) : 0;
        const display = cond.unit === 'sy' ? areaSf / 9 : areaSf;
        const cx = pts.reduce((a, p) => a + p.x, 0) / Math.max(1, pts.length);
        const cy = pts.reduce((a, p) => a + p.y, 0) / Math.max(1, pts.length);
        return (
          <Group key={m.id} name={`m:${m.id}`} onClick={() => onSelect(m.id)}>
            <Line
              points={flat}
              closed
              fill={stroke + '33'}
              stroke={stroke}
              strokeWidth={isSelected ? 4 : 2}
              lineJoin="round"
              hitStrokeWidth={12}
            />
            {pts.map((p, i) => (
              <Circle key={i} x={p.x} y={p.y} radius={3} fill={stroke} />
            ))}
            {ppf > 0 && (
              <LabelBadge x={cx} y={cy} text={`${formatNumber(display, 2)} ${cond.unit}`} />
            )}
          </Group>
        );
      })}
    </Group>
  );
}

function DraftLayer(props: {
  tool: string;
  draftPoints: Point[];
  hover: Point | null;
  viewport: Viewport;
  ppf: number;
  activeConditionColor: string;
}) {
  const { tool, draftPoints, hover, viewport, ppf, activeConditionColor } = props;
  if (draftPoints.length === 0) return null;
  if (tool !== 'linear' && tool !== 'area') return null;
  const toScreen = (p: Point) => ({
    x: p.x * viewport.scale + viewport.tx,
    y: p.y * viewport.scale + viewport.ty,
  });
  const pts = draftPoints.map(toScreen);
  const previewPts = hover ? [...pts, toScreen(hover)] : pts;
  const flat = previewPts.flatMap((p) => [p.x, p.y]);
  const lengthFt = ppf > 0 ? polylineLengthPx([...draftPoints, ...(hover ? [hover] : [])]) / ppf : 0;
  return (
    <Group listening={false}>
      <Line
        points={flat}
        closed={tool === 'area' && previewPts.length >= 3}
        stroke={activeConditionColor}
        strokeWidth={2}
        dash={[6, 4]}
        fill={tool === 'area' ? activeConditionColor + '22' : undefined}
      />
      {pts.map((p, i) => (
        <Circle key={i} x={p.x} y={p.y} radius={3} fill={activeConditionColor} />
      ))}
      {hover && ppf > 0 && (
        <LabelBadge
          x={toScreen(hover).x}
          y={toScreen(hover).y - 14}
          text={
            tool === 'linear'
              ? `${formatNumber(lengthFt, 2)} lf`
              : previewPts.length >= 3
                ? `${formatNumber(
                    polygonAreaPx([...draftPoints, hover]) / (ppf * ppf),
                    2
                  )} sf`
                : ''
          }
        />
      )}
    </Group>
  );
}

function CalibrationOverlay(props: {
  calibDraft: { p1?: Point; p2?: Point };
  hover: Point | null;
  tool: string;
  viewport: Viewport;
}) {
  const { calibDraft, hover, tool, viewport } = props;
  if (tool !== 'calibrate') return null;
  const toScreen = (p: Point) => ({
    x: p.x * viewport.scale + viewport.tx,
    y: p.y * viewport.scale + viewport.ty,
  });
  const a = calibDraft.p1 ? toScreen(calibDraft.p1) : null;
  const b = calibDraft.p2 ? toScreen(calibDraft.p2) : hover ? toScreen(hover) : null;
  return (
    <Group listening={false}>
      {a && b && (
        <Line
          points={[a.x, a.y, b.x, b.y]}
          stroke="#ffd166"
          strokeWidth={2}
          dash={[6, 4]}
        />
      )}
      {a && <Circle x={a.x} y={a.y} radius={5} fill="#ffd166" />}
      {b && calibDraft.p2 && <Circle x={b.x} y={b.y} radius={5} fill="#ffd166" />}
    </Group>
  );
}

function ReuploadBanner({ page, message }: { page: PlanPage; message: string }) {
  const replacePagePdf = useStore((s) => s.replacePagePdf);
  const replacePageImage = useStore((s) => s.replacePageImage);
  const toast = useStore((s) => s.toast);
  const inputRef = useRef<HTMLInputElement>(null);
  const expectingPdf = page.source.kind === 'pdf';
  const pageIndex = expectingPdf ? (page.source as { pageIndex: number }).pageIndex : 0;

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const file = files[0];
    if (expectingPdf) {
      if (file.type !== 'application/pdf') {
        toast('This page was a PDF — please upload a PDF to restore it.', 'error');
        return;
      }
      const buf = await file.arrayBuffer();
      try {
        const { loadPdfMetadata } = await import('../pdf');
        const pages = await loadPdfMetadata(buf);
        const target = pages[pageIndex] ?? pages[0];
        if (!target) {
          toast('PDF has no pages.', 'error');
          return;
        }
        replacePagePdf(
          page.id,
          buf,
          target.pageIndex,
          target.width,
          target.height,
          file.name
        );
        toast('Plan restored. Your measurements are intact.', 'success');
      } catch (e) {
        toast(`Failed to read PDF: ${(e as Error).message}`, 'error');
      }
    } else {
      if (!file.type.startsWith('image/')) {
        toast('This page was an image — please upload an image.', 'error');
        return;
      }
      const dataUrl = await new Promise<string>((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result as string);
        r.onerror = () => rej(r.error);
        r.readAsDataURL(file);
      });
      const dims = await new Promise<{ w: number; h: number }>((res, rej) => {
        const img = new Image();
        img.onload = () => res({ w: img.naturalWidth, h: img.naturalHeight });
        img.onerror = () => rej(new Error('Image failed to load'));
        img.src = dataUrl;
      });
      replacePageImage(page.id, dataUrl, dims.w, dims.h);
      toast('Plan restored. Your measurements are intact.', 'success');
    }
    if (inputRef.current) inputRef.current.value = '';
  }

  return (
    <div className="absolute inset-0 flex items-center justify-center p-6">
      <div className="max-w-md bg-[#1a1f2b] border border-amber-500 rounded-md p-4 text-center">
        <div className="text-amber-400 font-semibold mb-2">Plan data missing</div>
        <div className="text-sm text-muted mb-4">{message}</div>
        <button
          className="px-4 py-2 rounded bg-accent hover:bg-blue-500 text-white text-sm"
          onClick={() => inputRef.current?.click()}
        >
          {expectingPdf ? 'Re-upload PDF' : 'Re-upload image'}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept={expectingPdf ? 'application/pdf' : 'image/*'}
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>
    </div>
  );
}

function SelectionToolbar(props: {
  measurementId: string;
  onDelete: () => void;
  onDeselect: () => void;
}) {
  const { measurementId, onDelete, onDeselect } = props;
  const project = useStore((s) => s.project);
  const m = project.measurements.find((mm) => mm.id === measurementId);
  const cond = m ? project.conditions.find((c) => c.id === m.conditionId) : null;
  const page = m ? project.pages.find((p) => p.id === m.pageId) : null;
  if (!m || !cond) return null;
  const ppf = page?.scale ? pixelsPerFoot(page.scale) : 0;
  let quantity = 0;
  let unit = cond.unit;
  if (cond.type === 'linear' && ppf > 0) {
    const lengthFt = polylineLengthPx(m.points) / ppf;
    if (cond.wallHeight) {
      quantity = lengthFt * cond.wallHeight;
      unit = 'sf';
    } else {
      quantity = lengthFt;
    }
  } else if (cond.type === 'area' && ppf > 0) {
    const sf = polygonAreaPx(m.points) / (ppf * ppf);
    quantity = cond.unit === 'sy' ? sf / 9 : sf;
  } else if (cond.type === 'count') {
    quantity = m.points.length;
  }
  return (
    <div className="absolute bottom-14 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-[#1a1f2b] border border-[#2a3142] rounded-md px-3 py-2 shadow-lg text-sm">
      <span
        className="inline-block h-2 w-2 rounded-full"
        style={{ background: cond.color }}
      />
      <span className="text-ink font-medium">{cond.name}</span>
      <span className="text-muted">
        {formatNumber(quantity, 2)} {unit}
      </span>
      <button
        className="ml-2 px-2 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white text-xs"
        onClick={onDelete}
        title="Delete measurement (Del)"
      >
        Delete
      </button>
      <button
        className="px-2 py-1 rounded bg-[#2a3142] hover:bg-[#343c52] text-ink text-xs"
        onClick={onDeselect}
        title="Deselect (Esc)"
      >
        Deselect
      </button>
    </div>
  );
}

function RectDraftOverlay(props: {
  rectDraft: { start?: Point; end?: Point };
  viewport: Viewport;
  ppf: number;
  color: string;
  unit: string;
  tool: string;
}) {
  const { rectDraft, viewport, ppf, color, unit, tool } = props;
  if (tool !== 'rect' || !rectDraft.start || !rectDraft.end) return null;
  const { start, end } = rectDraft;
  const x1 = Math.min(start.x, end.x);
  const y1 = Math.min(start.y, end.y);
  const x2 = Math.max(start.x, end.x);
  const y2 = Math.max(start.y, end.y);
  const sx = x1 * viewport.scale + viewport.tx;
  const sy = y1 * viewport.scale + viewport.ty;
  const sw = (x2 - x1) * viewport.scale;
  const sh = (y2 - y1) * viewport.scale;
  const areaPx2 = (x2 - x1) * (y2 - y1);
  const areaSf = ppf > 0 ? areaPx2 / (ppf * ppf) : 0;
  const display = unit === 'sy' ? areaSf / 9 : areaSf;
  return (
    <Group listening={false}>
      <Rect x={sx} y={sy} width={sw} height={sh} fill={color + '22'} stroke={color} strokeWidth={2} dash={[6, 4]} />
      {ppf > 0 && (
        <LabelBadge
          x={sx + sw / 2}
          y={sy + sh / 2}
          text={`${formatNumber(display, 2)} ${unit}`}
        />
      )}
    </Group>
  );
}

function LabelBadge({ x, y, text }: { x: number; y: number; text: string }) {
  if (!text) return null;
  const padX = 4;
  const padY = 2;
  const charW = 6.5;
  const w = text.length * charW + padX * 2;
  const h = 16;
  return (
    <Group listening={false} x={x - w / 2} y={y - h - 6}>
      <Rect width={w} height={h} cornerRadius={3} fill="#000a" />
      <Text x={padX} y={padY} text={text} fontSize={11} fill="#fff" />
    </Group>
  );
}
