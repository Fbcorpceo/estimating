import { useMemo } from 'react';
import { useStore } from '../store';
import { convertQuantity, measurementBaseQuantity } from '../geometry';
import { formatMoney, formatNumber } from '../format';

interface ConditionRow {
  conditionId: string;
  name: string;
  type: 'linear' | 'area' | 'count';
  unit: string;
  unitCost: number;
  wastePct: number;
  baseQuantity: number; // in base unit
  displayQuantity: number; // in condition's unit
  withWaste: number; // displayQuantity * (1 + wastePct/100)
  cost: number;
  color: string;
}

export function EstimatePanel() {
  const project = useStore((s) => s.project);

  const rows: ConditionRow[] = useMemo(() => {
    const pageScale = new Map(project.pages.map((p) => [p.id, p.scale]));
    return project.conditions.map((c) => {
      const ms = project.measurements.filter((m) => m.conditionId === c.id);
      let base = 0;
      for (const m of ms) {
        base += measurementBaseQuantity(m, pageScale.get(m.pageId), c.type);
      }
      const display = convertQuantity(base, c.type, c.unit);
      const withWaste = display * (1 + c.wastePct / 100);
      const cost = withWaste * c.unitCost;
      return {
        conditionId: c.id,
        name: c.name,
        type: c.type,
        unit: c.unit,
        unitCost: c.unitCost,
        wastePct: c.wastePct,
        baseQuantity: base,
        displayQuantity: display,
        withWaste,
        cost,
        color: c.color,
      };
    });
  }, [project]);

  const total = rows.reduce((a, r) => a + r.cost, 0);

  function exportCsv() {
    const header = [
      'Condition',
      'Type',
      'Unit',
      'Quantity',
      'Waste %',
      'Quantity w/ Waste',
      'Unit Cost',
      'Cost',
    ];
    const lines = [header.join(',')];
    for (const r of rows) {
      lines.push(
        [
          csvEscape(r.name),
          r.type,
          r.unit,
          r.displayQuantity.toFixed(4),
          r.wastePct.toString(),
          r.withWaste.toFixed(4),
          r.unitCost.toFixed(2),
          r.cost.toFixed(2),
        ].join(',')
      );
    }
    lines.push(['Total', '', '', '', '', '', '', total.toFixed(2)].join(','));
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.name.replace(/[^a-z0-9-_ ]/gi, '_')}-estimate.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 flex items-center justify-between border-b border-[#222837]">
        <div className="text-xs uppercase tracking-wider text-muted">Estimate</div>
        <button
          className="text-xs px-2 py-1 rounded bg-[#2a3142] hover:bg-[#343c52]"
          onClick={exportCsv}
          disabled={rows.length === 0}
        >
          Export CSV
        </button>
      </div>
      <div className="scroll-y flex-1">
        {rows.length === 0 ? (
          <div className="px-3 py-4 text-muted text-sm">No conditions yet.</div>
        ) : (
          <table className="w-full text-xs">
            <thead className="text-muted">
              <tr>
                <th className="text-left px-2 py-1">Condition</th>
                <th className="text-right px-2 py-1">Qty</th>
                <th className="text-right px-2 py-1">+Waste</th>
                <th className="text-right px-2 py-1">$/U</th>
                <th className="text-right px-2 py-1">Cost</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.conditionId} className="border-t border-[#222837]">
                  <td className="px-2 py-1">
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-block h-2 w-2 rounded-full"
                        style={{ background: r.color }}
                      />
                      <span className="truncate">{r.name}</span>
                    </div>
                    <div className="text-muted">
                      {r.type} · {r.unit}
                    </div>
                  </td>
                  <td className="text-right px-2 py-1">{formatNumber(r.displayQuantity, 2)}</td>
                  <td className="text-right px-2 py-1">{formatNumber(r.withWaste, 2)}</td>
                  <td className="text-right px-2 py-1">{formatMoney(r.unitCost)}</td>
                  <td className="text-right px-2 py-1">{formatMoney(r.cost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div className="px-3 py-2 border-t border-[#222837] flex items-center justify-between">
        <div className="text-xs text-muted">Total</div>
        <div className="text-base font-semibold text-ink">{formatMoney(total)}</div>
      </div>
    </div>
  );
}

function csvEscape(s: string): string {
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}
