import { useStore } from '../store';
import type { MeasurementType, Unit } from '../types';

const UNITS_BY_TYPE: Record<MeasurementType, Unit[]> = {
  linear: ['lf', 'ft'],
  area: ['sf', 'sy'],
  count: ['ea'],
};

const WALL_HEIGHT_OPTIONS = [
  { label: 'None (measure LF)', value: '' },
  { label: '8 ft', value: '8' },
  { label: '9 ft', value: '9' },
  { label: '10 ft', value: '10' },
];

export function ConditionsPanel() {
  const conditions = useStore((s) => s.project.conditions);
  const activeConditionId = useStore((s) => s.activeConditionId);
  const setActive = useStore((s) => s.setActiveCondition);
  const addCondition = useStore((s) => s.addCondition);
  const updateCondition = useStore((s) => s.updateCondition);
  const removeCondition = useStore((s) => s.removeCondition);
  const setTool = useStore((s) => s.setTool);
  const activePageId = useStore((s) => s.activePageId);
  const pages = useStore((s) => s.project.pages);
  const toast = useStore((s) => s.toast);

  return (
    <div className="flex flex-col flex-1 min-h-0 border-b border-[#222837]">
      <div className="px-3 py-2 flex items-center justify-between">
        <div className="text-xs uppercase tracking-wider text-muted">Conditions</div>
        <div className="flex gap-1">
          <button
            className="text-xs px-2 py-1 rounded bg-[#2a3142] hover:bg-[#343c52]"
            onClick={() => addCondition({ type: 'linear' })}
            title="Add linear condition"
          >
            + Linear
          </button>
          <button
            className="text-xs px-2 py-1 rounded bg-[#2a3142] hover:bg-[#343c52]"
            onClick={() => addCondition({ type: 'area' })}
          >
            + Area
          </button>
          <button
            className="text-xs px-2 py-1 rounded bg-[#2a3142] hover:bg-[#343c52]"
            onClick={() => addCondition({ type: 'count' })}
          >
            + Count
          </button>
        </div>
      </div>
      <div className="scroll-y flex-1">
        {conditions.length === 0 && (
          <div className="px-3 py-4 text-muted text-sm">
            Create a condition to start measuring (e.g. "Drywall", "Carpet", "Receptacles").
          </div>
        )}
        {conditions.map((c) => {
          const active = c.id === activeConditionId;
          return (
            <div
              key={c.id}
              className={`px-3 py-2 border-t border-[#222837] cursor-pointer ${
                active ? 'bg-[#1a1f2b]' : 'hover:bg-[#1a1f2b]'
              } ${c.hidden ? 'opacity-60' : ''}`}
              onClick={() => {
                setActive(c.id);
                const page = pages.find((p) => p.id === activePageId);
                if (!page) {
                  toast('Upload or select a plan first.', 'info');
                  return;
                }
                if (!page.scale) {
                  toast('Set the page scale first — Calibrate tool is active.', 'info');
                  setTool('calibrate');
                  return;
                }
                setTool(c.type);
              }}
            >
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  className="h-6 w-7 p-0 border-0 bg-transparent cursor-pointer"
                  value={c.color}
                  onChange={(e) => updateCondition(c.id, { color: e.target.value })}
                  onClick={(e) => e.stopPropagation()}
                />
                <input
                  className="flex-1 text-sm"
                  value={c.name}
                  onChange={(e) => updateCondition(c.id, { name: e.target.value })}
                  onClick={(e) => e.stopPropagation()}
                />
                <button
                  className={`text-sm px-1 ${c.hidden ? 'text-muted' : 'text-accent'} hover:brightness-125`}
                  onClick={(e) => {
                    e.stopPropagation();
                    updateCondition(c.id, { hidden: !c.hidden });
                  }}
                  title={c.hidden ? 'Show condition (currently hidden)' : 'Hide condition'}
                  aria-label={c.hidden ? 'Show' : 'Hide'}
                >
                  {c.hidden ? (
                    // eye off
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a19.8 19.8 0 0 1 5.06-5.94"/><path d="M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a19.86 19.86 0 0 1-2.16 3.19"/><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                  ) : (
                    // eye
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  )}
                </button>
                <button
                  className="text-muted hover:text-rose-400"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`Delete condition "${c.name}" and all its measurements?`))
                      removeCondition(c.id);
                  }}
                  title="Delete condition"
                >
                  ✕
                </button>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                <label className="flex flex-col gap-1">
                  <span className="text-muted">Type</span>
                  <select
                    value={c.type}
                    onChange={(e) =>
                      updateCondition(c.id, { type: e.target.value as MeasurementType })
                    }
                    onClick={(e) => e.stopPropagation()}
                  >
                    <option value="linear">Linear</option>
                    <option value="area">Area</option>
                    <option value="count">Count</option>
                  </select>
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-muted">Unit</span>
                  <select
                    value={c.unit}
                    onChange={(e) => updateCondition(c.id, { unit: e.target.value as Unit })}
                    onClick={(e) => e.stopPropagation()}
                    disabled={c.type === 'linear' && !!c.wallHeight}
                  >
                    {UNITS_BY_TYPE[c.type].map((u) => (
                      <option key={u} value={u}>
                        {u.toUpperCase()}
                      </option>
                    ))}
                    {c.type === 'linear' && c.wallHeight && (
                      <option value="sf">SF</option>
                    )}
                  </select>
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-muted">Waste %</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.5}
                    value={c.wastePct}
                    onChange={(e) =>
                      updateCondition(c.id, { wastePct: Number(e.target.value) || 0 })
                    }
                    onClick={(e) => e.stopPropagation()}
                  />
                </label>
                {c.type === 'linear' && (
                  <label className="flex flex-col gap-1 col-span-3">
                    <span className="text-muted">
                      Wall height{' '}
                      <span className="text-[10px]">(Length × Height → SF)</span>
                    </span>
                    <select
                      value={c.wallHeight ?? ''}
                      onChange={(e) =>
                        updateCondition(c.id, {
                          wallHeight: e.target.value ? Number(e.target.value) : undefined,
                        })
                      }
                      onClick={(e) => e.stopPropagation()}
                    >
                      {WALL_HEIGHT_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <label className="flex flex-col gap-1 col-span-3">
                  <span className="text-muted">Unit cost ($/{c.unit})</span>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={c.unitCost}
                    onChange={(e) =>
                      updateCondition(c.id, { unitCost: Number(e.target.value) || 0 })
                    }
                    onClick={(e) => e.stopPropagation()}
                  />
                </label>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
