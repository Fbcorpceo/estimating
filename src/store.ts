import { create } from 'zustand';
import { v4 as uuid } from 'uuid';
import type {
  Condition,
  Measurement,
  PageScale,
  PlanPage,
  Point,
  Project,
  ToolMode,
} from './types';
import { db } from './db';
import {
  deleteProjectCloud,
  downloadPdf,
  listProjects as cloudListProjects,
  loadProject as cloudLoadProject,
  upsertProject as cloudUpsertProject,
  uploadPdf,
} from './cloud';

const DEFAULT_COLORS = [
  '#4f8cff',
  '#ff6b6b',
  '#ffd166',
  '#06d6a0',
  '#c77dff',
  '#f78c6b',
  '#7ee787',
  '#ff9ff3',
];

function newProject(name = 'Untitled Project'): Project {
  const now = Date.now();
  return {
    id: uuid(),
    name,
    createdAt: now,
    updatedAt: now,
    pages: [],
    conditions: [],
    measurements: [],
    pdfFiles: [],
  };
}

export interface AuthContext {
  userId: string;
  workspaceId: string;
  email: string;
}

interface State {
  project: Project;
  activePageId: string | null;
  activeConditionId: string | null;
  tool: ToolMode;
  draftPoints: Point[];
  calibDraft: { p1?: Point; p2?: Point };
  rectDraft: { start?: Point; end?: Point };
  selectedMeasurementId: string | null;
  recentProjects: { id: string; name: string; updatedAt: number }[];
  toasts: { id: string; message: string; kind: 'info' | 'success' | 'error' }[];
  undoStack: (
    | { kind: 'add_measurement'; id: string }
    | { kind: 'add_count_point'; id: string }
  )[];
  // Auth / workspace info, set after sign in.
  auth: AuthContext | null;
  // PDF bytes cache keyed by fileId, populated on upload or on-demand fetch.
  pdfBytesCache: Record<string, ArrayBuffer>;
  // True while the most-recent cloud save is in flight.
  saving: boolean;
  saveError: string | null;

  // actions
  toast: (message: string, kind?: 'info' | 'success' | 'error') => void;
  dismissToast: (id: string) => void;
  undo: () => void;
  setAuthContext: (a: AuthContext | null) => Promise<void>;
  loadOrCreate: () => Promise<void>;
  newProject: () => Promise<void>;
  openProject: (id: string) => Promise<void>;
  renameProject: (name: string) => void;
  deleteProject: (id: string) => Promise<void>;
  ensurePdfBytes: (fileId: string) => Promise<ArrayBuffer | null>;

  addImagePage: (name: string, dataUrl: string, width: number, height: number) => void;
  addPdfPages: (
    name: string,
    fileId: string,
    data: ArrayBuffer,
    pages: { width: number; height: number }[]
  ) => void;
  removePage: (pageId: string) => void;
  setActivePage: (pageId: string | null) => void;
  renamePage: (pageId: string, name: string) => void;
  replacePagePdf: (pageId: string, data: ArrayBuffer, pageIndex: number, width: number, height: number, fileName: string) => void;
  replacePageImage: (pageId: string, dataUrl: string, width: number, height: number) => void;

  setTool: (t: ToolMode) => void;
  setActiveCondition: (id: string | null) => void;
  addCondition: (c?: Partial<Condition>) => string;
  updateCondition: (id: string, patch: Partial<Condition>) => void;
  removeCondition: (id: string) => void;

  // drawing
  pushDraftPoint: (p: Point) => void;
  popDraftPoint: () => void;
  clearDraft: () => void;
  commitDraft: () => void; // commits current draft to a measurement
  addCountMarker: (p: Point) => void;

  // calibration
  setCalibPoint: (which: 'p1' | 'p2', p: Point) => void;
  setRectDraft: (d: { start?: Point; end?: Point }) => void;
  commitRect: () => void;
  clearCalib: () => void;
  applyCalibration: (realDistance: number) => void;
  clearPageScale: () => void;

  selectMeasurement: (id: string | null) => void;
  removeMeasurement: (id: string) => void;
  removeMeasurementPoint: (mId: string, idx: number) => void;

  refreshRecent: () => Promise<void>;
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleSave(get: () => State, setFn: (patch: Partial<State>) => void) {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    const { project, auth } = get();
    if (!auth) return;
    setFn({ saving: true, saveError: null });
    try {
      project.updatedAt = Date.now();
      await cloudUpsertProject(auth.workspaceId, project, auth.userId);
      setFn({ saving: false });
      await get().refreshRecent();
    } catch (e) {
      const msg = (e as Error).message || 'Save failed';
      setFn({ saving: false, saveError: msg });
      get().toast(`Sync failed: ${msg}`, 'error');
    }
  }, 500);
}

export const useStore = create<State>((set, get) => ({
  project: newProject(),
  activePageId: null,
  activeConditionId: null,
  tool: 'pan',
  draftPoints: [],
  calibDraft: {},
  rectDraft: {},
  selectedMeasurementId: null,
  recentProjects: [],
  toasts: [],
  undoStack: [],
  auth: null,
  pdfBytesCache: {},
  saving: false,
  saveError: null,

  setAuthContext: async (a) => {
    set({ auth: a });
    if (a) {
      await get().loadOrCreate();
    }
  },

  ensurePdfBytes: async (fileId) => {
    const { pdfBytesCache, project } = get();
    const cached = pdfBytesCache[fileId];
    if (cached && cached.byteLength > 0) return cached;
    const file = project.pdfFiles.find((f) => f.id === fileId);
    if (!file) return null;
    // In-memory bytes from a recent upload
    if (file.data && file.data.byteLength > 0) {
      set((s) => ({ pdfBytesCache: { ...s.pdfBytesCache, [fileId]: file.data } }));
      return file.data;
    }
    if (!file.storagePath) return null;
    try {
      const bytes = await downloadPdf(file.storagePath);
      set((s) => ({ pdfBytesCache: { ...s.pdfBytesCache, [fileId]: bytes } }));
      return bytes;
    } catch (e) {
      console.error('PDF download failed', e);
      return null;
    }
  },

  toast: (message, kind = 'info') => {
    const id = uuid();
    set((s) => ({ toasts: [...s.toasts, { id, message, kind }] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, 3500);
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

  undo: () => {
    const { undoStack, project } = get();
    if (undoStack.length === 0) {
      get().toast('Nothing to undo.', 'info');
      return;
    }
    const entry = undoStack[undoStack.length - 1];
    if (entry.kind === 'add_measurement') {
      set((s) => ({
        project: {
          ...s.project,
          measurements: s.project.measurements.filter((m) => m.id !== entry.id),
        },
        undoStack: s.undoStack.slice(0, -1),
        selectedMeasurementId: s.selectedMeasurementId === entry.id ? null : s.selectedMeasurementId,
      }));
    } else {
      // add_count_point — pop the last point from that measurement
      const target = project.measurements.find((m) => m.id === entry.id);
      if (!target) {
        set((s) => ({ undoStack: s.undoStack.slice(0, -1) }));
        return;
      }
      const nextPoints = target.points.slice(0, -1);
      set((s) => ({
        project: {
          ...s.project,
          measurements:
            nextPoints.length === 0
              ? s.project.measurements.filter((m) => m.id !== entry.id)
              : s.project.measurements.map((m) =>
                  m.id === entry.id ? { ...m, points: nextPoints } : m
                ),
        },
        undoStack: s.undoStack.slice(0, -1),
      }));
    }
    scheduleSave(get, set);
  },

  loadOrCreate: async () => {
    const auth = get().auth;
    if (!auth) return;
    try {
      const list = await cloudListProjects(auth.workspaceId);
      set({ recentProjects: list });
      if (list.length > 0) {
        await get().openProject(list[0].id);
      } else {
        await get().newProject();
      }
    } catch (e) {
      get().toast(`Couldn't load projects: ${(e as Error).message}`, 'error');
    }
  },

  newProject: async () => {
    const auth = get().auth;
    if (!auth) return;
    const p = newProject();
    set({
      project: p,
      activePageId: null,
      activeConditionId: null,
      tool: 'pan',
      draftPoints: [],
      calibDraft: {},
      rectDraft: {},
      selectedMeasurementId: null,
      undoStack: [],
      pdfBytesCache: {},
    });
    try {
      await cloudUpsertProject(auth.workspaceId, p, auth.userId);
      await get().refreshRecent();
    } catch (e) {
      get().toast(`Couldn't create project: ${(e as Error).message}`, 'error');
    }
  },

  openProject: async (id) => {
    const p = await cloudLoadProject(id);
    if (!p) return;
    set({
      project: p,
      activePageId: p.pages[0]?.id ?? null,
      activeConditionId: p.conditions[0]?.id ?? null,
      tool: 'pan',
      draftPoints: [],
      calibDraft: {},
      rectDraft: {},
      selectedMeasurementId: null,
      undoStack: [],
      pdfBytesCache: {},
    });
  },

  renameProject: (name) => {
    set((s) => ({ project: { ...s.project, name } }));
    scheduleSave(get, set);
  },

  deleteProject: async (id) => {
    try {
      await deleteProjectCloud(id);
      if (get().project.id === id) {
        await get().loadOrCreate();
      } else {
        await get().refreshRecent();
      }
    } catch (e) {
      get().toast(`Delete failed: ${(e as Error).message}`, 'error');
    }
  },

  addImagePage: (name, dataUrl, width, height) => {
    const page: PlanPage = {
      id: uuid(),
      name,
      source: { kind: 'image', dataUrl, width, height },
    };
    set((s) => ({
      project: { ...s.project, pages: [...s.project.pages, page] },
      activePageId: page.id,
      tool: 'calibrate',
      calibDraft: {},
      draftPoints: [],
    }));
    scheduleSave(get, set);
  },

  addPdfPages: (name, fileId, data, pages) => {
    const newPages: PlanPage[] = pages.map((p, i) => ({
      id: uuid(),
      name: pages.length > 1 ? `${name} — p${i + 1}` : name,
      source: { kind: 'pdf', fileId, pageIndex: i, width: p.width, height: p.height },
    }));
    set((s) => ({
      project: {
        ...s.project,
        pdfFiles: [...s.project.pdfFiles, { id: fileId, name, data }],
        pages: [...s.project.pages, ...newPages],
      },
      activePageId: newPages[0]?.id ?? s.activePageId,
      tool: 'calibrate',
      calibDraft: {},
      draftPoints: [],
      pdfBytesCache: { ...s.pdfBytesCache, [fileId]: data },
    }));
    // Kick off Storage upload in the background; once done, set the
    // storagePath on the pdfFile so future sessions can fetch it.
    const auth = get().auth;
    if (auth) {
      const projectId = get().project.id;
      uploadPdf(auth.workspaceId, projectId, fileId, name, data)
        .then((path) => {
          set((s) => ({
            project: {
              ...s.project,
              pdfFiles: s.project.pdfFiles.map((f) =>
                f.id === fileId ? { ...f, storagePath: path } : f
              ),
            },
          }));
          scheduleSave(get, set);
        })
        .catch((e) => {
          get().toast(`PDF upload failed: ${(e as Error).message}`, 'error');
        });
    }
    scheduleSave(get, set);
  },

  removePage: (pageId) => {
    set((s) => {
      const pages = s.project.pages.filter((p) => p.id !== pageId);
      const measurements = s.project.measurements.filter((m) => m.pageId !== pageId);
      // also drop unreferenced pdf files
      const usedFileIds = new Set(
        pages.filter((p) => p.source.kind === 'pdf').map((p) => (p.source as any).fileId)
      );
      const pdfFiles = s.project.pdfFiles.filter((f) => usedFileIds.has(f.id));
      const activePageId = s.activePageId === pageId ? pages[0]?.id ?? null : s.activePageId;
      return {
        project: { ...s.project, pages, measurements, pdfFiles },
        activePageId,
      };
    });
    scheduleSave(get, set);
  },

  setActivePage: (pageId) => {
    const page = get().project.pages.find((p) => p.id === pageId);
    const needsCalibration = !!page && !page.scale;
    set((s) => ({
      activePageId: pageId,
      draftPoints: [],
      calibDraft: {},
      selectedMeasurementId: null,
      tool: needsCalibration ? 'calibrate' : s.tool,
    }));
  },

  renamePage: (pageId, name) => {
    set((s) => ({
      project: {
        ...s.project,
        pages: s.project.pages.map((p) => (p.id === pageId ? { ...p, name } : p)),
      },
    }));
    scheduleSave(get, set);
  },

  replacePagePdf: (pageId, data, pageIndex, width, height, fileName) => {
    const fileId = uuid();
    set((s) => {
      const pages = s.project.pages.map((p) =>
        p.id === pageId
          ? {
              ...p,
              source: { kind: 'pdf' as const, fileId, pageIndex, width, height },
            }
          : p
      );
      const usedFileIds = new Set(
        pages.filter((p) => p.source.kind === 'pdf').map((p) => (p.source as any).fileId)
      );
      const pdfFiles = s.project.pdfFiles.filter((f) => usedFileIds.has(f.id));
      pdfFiles.push({ id: fileId, name: fileName, data });
      return {
        project: { ...s.project, pages, pdfFiles },
        pdfBytesCache: { ...s.pdfBytesCache, [fileId]: data },
      };
    });
    const auth = get().auth;
    if (auth) {
      const projectId = get().project.id;
      uploadPdf(auth.workspaceId, projectId, fileId, fileName, data)
        .then((path) => {
          set((s) => ({
            project: {
              ...s.project,
              pdfFiles: s.project.pdfFiles.map((f) =>
                f.id === fileId ? { ...f, storagePath: path } : f
              ),
            },
          }));
          scheduleSave(get, set);
        })
        .catch((e) => {
          get().toast(`PDF upload failed: ${(e as Error).message}`, 'error');
        });
    }
    scheduleSave(get, set);
  },

  replacePageImage: (pageId, dataUrl, width, height) => {
    set((s) => ({
      project: {
        ...s.project,
        pages: s.project.pages.map((p) =>
          p.id === pageId
            ? { ...p, source: { kind: 'image' as const, dataUrl, width, height } }
            : p
        ),
      },
    }));
    scheduleSave(get, set);
  },

  setTool: (t) => {
    set({ tool: t, draftPoints: [], calibDraft: {}, rectDraft: {} });
  },

  setActiveCondition: (id) => set({ activeConditionId: id }),

  addCondition: (c) => {
    const idx = get().project.conditions.length;
    const cond: Condition = {
      id: uuid(),
      name: c?.name ?? `Condition ${idx + 1}`,
      type: c?.type ?? 'area',
      color: c?.color ?? DEFAULT_COLORS[idx % DEFAULT_COLORS.length],
      unit: c?.unit ?? (c?.type === 'linear' ? 'lf' : c?.type === 'count' ? 'ea' : 'sf'),
      unitCost: c?.unitCost ?? 0,
      wastePct: c?.wastePct ?? 0,
    };
    set((s) => ({
      project: { ...s.project, conditions: [...s.project.conditions, cond] },
      activeConditionId: cond.id,
    }));
    scheduleSave(get, set);
    return cond.id;
  },

  updateCondition: (id, patch) => {
    set((s) => ({
      project: {
        ...s.project,
        conditions: s.project.conditions.map((c) => {
          if (c.id !== id) return c;
          const next = { ...c, ...patch };
          // keep unit consistent with type if type changed
          if (patch.type && !patch.unit) {
            next.unit = patch.type === 'linear' ? 'lf' : patch.type === 'count' ? 'ea' : 'sf';
            // Changing away from linear clears the wall height
            if (patch.type !== 'linear') next.wallHeight = undefined;
          }
          // For linear conditions, wallHeight drives the unit.
          if (next.type === 'linear' && 'wallHeight' in patch) {
            next.unit = patch.wallHeight ? 'sf' : 'lf';
          }
          return next;
        }),
      },
    }));
    scheduleSave(get, set);
  },

  removeCondition: (id) => {
    set((s) => ({
      project: {
        ...s.project,
        conditions: s.project.conditions.filter((c) => c.id !== id),
        measurements: s.project.measurements.filter((m) => m.conditionId !== id),
      },
      activeConditionId:
        s.activeConditionId === id
          ? s.project.conditions.find((c) => c.id !== id)?.id ?? null
          : s.activeConditionId,
    }));
    scheduleSave(get, set);
  },

  pushDraftPoint: (p) => set((s) => ({ draftPoints: [...s.draftPoints, p] })),
  popDraftPoint: () => set((s) => ({ draftPoints: s.draftPoints.slice(0, -1) })),
  clearDraft: () => set({ draftPoints: [] }),

  commitDraft: () => {
    const { draftPoints, project, activeConditionId, activePageId, tool } = get();
    if (!activePageId || !activeConditionId) return;
    if (draftPoints.length < 2) return;
    if (tool === 'area' && draftPoints.length < 3) return;
    const cond = project.conditions.find((c) => c.id === activeConditionId);
    if (!cond) return;
    if ((cond.type === 'linear' && tool !== 'linear') || (cond.type === 'area' && tool !== 'area'))
      return;
    const m: Measurement = {
      id: uuid(),
      conditionId: cond.id,
      pageId: activePageId,
      points: draftPoints,
    };
    set((s) => ({
      project: { ...s.project, measurements: [...s.project.measurements, m] },
      draftPoints: [],
      undoStack: [...s.undoStack, { kind: 'add_measurement' as const, id: m.id }].slice(-50),
    }));
    scheduleSave(get, set);
  },

  addCountMarker: (p) => {
    const { project, activeConditionId, activePageId } = get();
    if (!activePageId || !activeConditionId) return;
    const cond = project.conditions.find((c) => c.id === activeConditionId);
    if (!cond || cond.type !== 'count') return;
    // group all count markers per (page, condition) into one Measurement
    const existing = project.measurements.find(
      (m) => m.pageId === activePageId && m.conditionId === cond.id
    );
    if (existing) {
      set((s) => ({
        project: {
          ...s.project,
          measurements: s.project.measurements.map((m) =>
            m.id === existing.id ? { ...m, points: [...m.points, p] } : m
          ),
        },
        undoStack: [...s.undoStack, { kind: 'add_count_point' as const, id: existing.id }].slice(-50),
      }));
    } else {
      const m: Measurement = {
        id: uuid(),
        conditionId: cond.id,
        pageId: activePageId,
        points: [p],
      };
      set((s) => ({
        project: { ...s.project, measurements: [...s.project.measurements, m] },
        undoStack: [...s.undoStack, { kind: 'add_measurement' as const, id: m.id }].slice(-50),
      }));
    }
    scheduleSave(get, set);
  },

  setCalibPoint: (which, p) =>
    set((s) => ({ calibDraft: { ...s.calibDraft, [which]: p } })),
  clearCalib: () => set({ calibDraft: {} }),

  setRectDraft: (d) => set({ rectDraft: d }),
  commitRect: () => {
    const { rectDraft, project, activeConditionId, activePageId } = get();
    if (!activePageId || !activeConditionId) return;
    if (!rectDraft.start || !rectDraft.end) return;
    const { start, end } = rectDraft;
    const minX = Math.min(start.x, end.x);
    const maxX = Math.max(start.x, end.x);
    const minY = Math.min(start.y, end.y);
    const maxY = Math.max(start.y, end.y);
    if (maxX - minX < 2 || maxY - minY < 2) {
      set({ rectDraft: {} });
      return;
    }
    const cond = project.conditions.find((c) => c.id === activeConditionId);
    if (!cond || cond.type !== 'area') {
      set({ rectDraft: {} });
      return;
    }
    const m: Measurement = {
      id: uuid(),
      conditionId: cond.id,
      pageId: activePageId,
      points: [
        { x: minX, y: minY },
        { x: maxX, y: minY },
        { x: maxX, y: maxY },
        { x: minX, y: maxY },
      ],
    };
    set((s) => ({
      project: { ...s.project, measurements: [...s.project.measurements, m] },
      rectDraft: {},
      undoStack: [...s.undoStack, { kind: 'add_measurement' as const, id: m.id }].slice(-50),
    }));
    scheduleSave(get, set);
  },

  applyCalibration: (realDistance) => {
    const { calibDraft, activePageId, project, activeConditionId } = get();
    if (!activePageId || !calibDraft.p1 || !calibDraft.p2 || realDistance <= 0) return;
    const scale: PageScale = {
      p1: calibDraft.p1,
      p2: calibDraft.p2,
      realDistance,
    };
    const activeCond = project.conditions.find((c) => c.id === activeConditionId);
    const nextTool: ToolMode = activeCond ? activeCond.type : 'pan';
    set((s) => ({
      project: {
        ...s.project,
        pages: s.project.pages.map((p) => (p.id === activePageId ? { ...p, scale } : p)),
      },
      calibDraft: {},
      tool: nextTool,
    }));
    get().toast(
      activeCond
        ? `Scale set to ${realDistance.toFixed(2)} ft — drawing ${activeCond.name}`
        : `Scale set to ${realDistance.toFixed(2)} ft`,
      'success'
    );
    scheduleSave(get, set);
  },

  clearPageScale: () => {
    const { activePageId } = get();
    if (!activePageId) return;
    set((s) => ({
      project: {
        ...s.project,
        pages: s.project.pages.map((p) =>
          p.id === activePageId ? { ...p, scale: undefined } : p
        ),
      },
    }));
    scheduleSave(get, set);
  },

  selectMeasurement: (id) => set({ selectedMeasurementId: id }),

  removeMeasurement: (id) => {
    set((s) => ({
      project: {
        ...s.project,
        measurements: s.project.measurements.filter((m) => m.id !== id),
      },
      selectedMeasurementId: s.selectedMeasurementId === id ? null : s.selectedMeasurementId,
    }));
    scheduleSave(get, set);
  },

  removeMeasurementPoint: (mId, idx) => {
    set((s) => {
      const next = s.project.measurements
        .map((m) => {
          if (m.id !== mId) return m;
          const points = m.points.filter((_, i) => i !== idx);
          return { ...m, points };
        })
        .filter((m) => m.points.length > 0);
      return { project: { ...s.project, measurements: next } };
    });
    scheduleSave(get, set);
  },

  refreshRecent: async () => {
    const auth = get().auth;
    if (!auth) return;
    try {
      const list = await cloudListProjects(auth.workspaceId);
      set({ recentProjects: list });
    } catch (e) {
      console.error('refreshRecent failed', e);
    }
  },
}));

// Expose legacy Dexie access for migration.
export async function listLegacyProjects(): Promise<Project[]> {
  return db.projects.orderBy('updatedAt').reverse().toArray();
}

export async function clearLegacyProject(id: string): Promise<void> {
  await db.projects.delete(id);
}
