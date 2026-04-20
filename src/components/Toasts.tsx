import { useStore } from '../store';

export function Toasts() {
  const toasts = useStore((s) => s.toasts);
  const dismiss = useStore((s) => s.dismissToast);
  return (
    <div className="fixed top-14 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto px-3 py-2 rounded-md shadow-lg text-sm border ${
            t.kind === 'success'
              ? 'bg-emerald-600/90 border-emerald-400 text-white'
              : t.kind === 'error'
                ? 'bg-rose-600/90 border-rose-400 text-white'
                : 'bg-[#2a3142] border-[#3a4258] text-ink'
          }`}
          onClick={() => dismiss(t.id)}
          role="status"
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
