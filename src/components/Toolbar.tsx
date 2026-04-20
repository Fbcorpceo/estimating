import { useStore } from '../store';
import type { ToolMode } from '../types';

const TOOLS: { id: ToolMode; label: string; hotkey: string; hint: string }[] = [
  { id: 'pan', label: 'Pan', hotkey: 'V', hint: 'Pan / select. Space + drag also pans.' },
  { id: 'calibrate', label: 'Calibrate', hotkey: 'C', hint: 'Click two points then enter the real distance.' },
  { id: 'linear', label: 'Linear', hotkey: 'L', hint: 'Click to add points. Enter to finish, Esc to cancel.' },
  { id: 'area', label: 'Area', hotkey: 'A', hint: 'Click to add points (≥3). Enter to close, Esc to cancel.' },
  { id: 'count', label: 'Count', hotkey: 'N', hint: 'Each click adds a marker.' },
];

export function Toolbar() {
  const tool = useStore((s) => s.tool);
  const setTool = useStore((s) => s.setTool);
  const activePageId = useStore((s) => s.activePageId);
  const activeConditionId = useStore((s) => s.activeConditionId);
  const project = useStore((s) => s.project);
  const cond = project.conditions.find((c) => c.id === activeConditionId);
  const page = project.pages.find((p) => p.id === activePageId);

  return (
    <div className="flex items-center gap-2 h-10 px-2 border-b border-[#222837] bg-panel">
      {TOOLS.map((t) => {
        const enabled =
          t.id === 'pan' ||
          t.id === 'calibrate' ||
          (cond && t.id === cond.type) ||
          (!cond && false);
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
    </div>
  );
}
