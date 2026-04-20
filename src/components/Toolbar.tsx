import { useStore } from '../store';
import type { ToolMode } from '../types';

const ALL_TOOLS: { id: ToolMode; label: string; hotkey: string; hint: string }[] = [
  { id: 'pan', label: 'Pan', hotkey: 'V', hint: 'Pan the view. Space+drag also pans.' },
  { id: 'calibrate', label: 'Calibrate', hotkey: 'C', hint: 'Click two points a known distance apart, then enter that distance.' },
  { id: 'linear', label: 'Linear', hotkey: 'L', hint: 'Click to add points along a line. Enter or double-click to finish. Backspace undoes. Esc cancels.' },
  { id: 'area', label: 'Area (polygon)', hotkey: 'A', hint: 'Click to add 3+ points around a shape. Enter or double-click to close. Backspace undoes. Esc cancels.' },
  { id: 'rect', label: 'Area (rect)', hotkey: 'R', hint: 'Click and drag to draw a rectangle. Release to finish.' },
  { id: 'count', label: 'Count', hotkey: 'N', hint: 'Each click drops a numbered marker.' },
];

export function Toolbar() {
  const tool = useStore((s) => s.tool);
  const setTool = useStore((s) => s.setTool);
  const activePageId = useStore((s) => s.activePageId);
  const activeConditionId = useStore((s) => s.activeConditionId);
  const project = useStore((s) => s.project);
  const undo = useStore((s) => s.undo);
  const undoCount = useStore((s) => s.undoStack.length);
  const cond = project.conditions.find((c) => c.id === activeConditionId);
  const page = project.pages.find((p) => p.id === activePageId);

  const isEnabled = (t: ToolMode): boolean => {
    if (t === 'pan' || t === 'calibrate') return true;
    if (!cond) return false;
    if (cond.type === 'linear') return t === 'linear';
    if (cond.type === 'area') return t === 'area' || t === 'rect';
    if (cond.type === 'count') return t === 'count';
    return false;
  };

  const activeHint = ALL_TOOLS.find((t) => t.id === tool)?.hint ?? '';

  return (
    <div className="flex flex-col border-b border-[#222837] bg-panel">
      <div className="flex items-center gap-2 h-10 px-2">
        {ALL_TOOLS.map((t) => {
          const enabled = isEnabled(t.id);
          return (
            <button
              key={t.id}
              disabled={!enabled}
              title={`${t.hint} (${t.hotkey})`}
              className={`px-3 py-1 rounded text-sm border ${
                tool === t.id
                  ? 'bg-accent border-accent text-white'
                  : enabled
                    ? 'bg-[#2a3142] border-transparent hover:bg-[#343c52] text-ink'
                    : 'bg-[#1a1f2b] border-transparent text-muted cursor-not-allowed'
              }`}
              onClick={() => setTool(t.id)}
            >
              {t.label}
            </button>
          );
        })}
        <div className="ml-2 text-xs text-muted">
          {!page && 'Upload or select a page to begin.'}
          {page && !page.scale && 'Page is not calibrated. Use the Calibrate tool to set scale.'}
          {page && page.scale && cond && `Active: ${cond.name} (${cond.type})`}
          {page && page.scale && !cond && 'Select or create a condition on the right.'}
        </div>
        <div className="flex-1" />
        <button
          className="px-3 py-1 rounded text-sm border border-transparent bg-[#2a3142] hover:bg-[#343c52] text-ink disabled:opacity-40 disabled:cursor-not-allowed"
          onClick={() => undo()}
          disabled={undoCount === 0}
          title="Undo last measurement (Ctrl/Cmd+Z)"
        >
          Undo
        </button>
      </div>
      {page && page.scale && (
        <div className="px-3 py-1 text-xs text-muted border-t border-[#222837] bg-[#1a1f2b]">
          <span className="text-ink font-medium">How to use {ALL_TOOLS.find((t) => t.id === tool)?.label ?? tool}:</span>{' '}
          {activeHint}
        </div>
      )}
    </div>
  );
}
