import { useStore } from '../store';

export function PagesPanel() {
  const pages = useStore((s) => s.project.pages);
  const activePageId = useStore((s) => s.activePageId);
  const setActivePage = useStore((s) => s.setActivePage);
  const removePage = useStore((s) => s.removePage);
  const renamePage = useStore((s) => s.renamePage);

  return (
    <div className="border-b border-[#222837]">
      <div className="px-3 py-2 text-xs uppercase tracking-wider text-muted">Pages</div>
      <div className="scroll-y max-h-48">
        {pages.length === 0 && (
          <div className="px-3 py-4 text-muted text-sm">No plans yet. Use Upload Plans.</div>
        )}
        {pages.map((p) => (
          <div
            key={p.id}
            className={`px-3 py-2 flex items-center gap-2 cursor-pointer hover:bg-[#1a1f2b] ${
              activePageId === p.id ? 'bg-[#1a1f2b]' : ''
            }`}
            onClick={() => setActivePage(p.id)}
          >
            <div
              className={`h-2 w-2 rounded-full ${p.scale ? 'bg-emerald-400' : 'bg-amber-400'}`}
              title={p.scale ? 'Calibrated' : 'Not calibrated'}
            />
            <input
              className="flex-1 bg-transparent border-0 px-1 py-0 text-ink text-sm"
              value={p.name}
              onChange={(e) => renamePage(p.id, e.target.value)}
              onClick={(e) => e.stopPropagation()}
            />
            <button
              className="text-muted hover:text-rose-400 text-sm"
              onClick={(e) => {
                e.stopPropagation();
                if (confirm(`Remove page "${p.name}"?`)) removePage(p.id);
              }}
              title="Remove page"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
