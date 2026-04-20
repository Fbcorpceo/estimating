import { useMemo, useState } from 'react';
import { useStore } from '../store';

const PRESETS: { label: string; feet: string; inches: string }[] = [
  { label: '1 ft', feet: '1', inches: '0' },
  { label: '5 ft', feet: '5', inches: '0' },
  { label: '10 ft', feet: '10', inches: '0' },
  { label: '20 ft', feet: '20', inches: '0' },
];

export function CalibrateDialog({ onClose }: { onClose: () => void }) {
  const calibDraft = useStore((s) => s.calibDraft);
  const applyCalibration = useStore((s) => s.applyCalibration);

  const pixelDistance = useMemo(() => {
    if (!calibDraft.p1 || !calibDraft.p2) return 0;
    return Math.hypot(
      calibDraft.p2.x - calibDraft.p1.x,
      calibDraft.p2.y - calibDraft.p1.y
    );
  }, [calibDraft.p1, calibDraft.p2]);

  const [feet, setFeet] = useState('10');
  const [inches, setInches] = useState('0');

  const f = parseFloat(feet) || 0;
  const i = parseFloat(inches) || 0;
  const total = f + i / 12;
  const invalid = total <= 0;

  function submit() {
    if (invalid) return;
    applyCalibration(total);
    onClose();
  }

  return (
    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
      <div className="bg-panel border border-[#2a3142] rounded-md p-4 w-[360px]">
        <div className="font-semibold text-ink mb-1">Set Page Scale</div>
        <div className="text-xs text-muted mb-3">
          The two points you picked are {pixelDistance.toFixed(1)} px apart. Enter their real-world
          distance.
        </div>
        <div className="grid grid-cols-2 gap-2 mb-3">
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-muted">Feet</span>
            <input
              type="number"
              value={feet}
              onChange={(e) => setFeet(e.target.value)}
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && submit()}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-muted">Inches</span>
            <input
              type="number"
              value={inches}
              onChange={(e) => setInches(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
            />
          </label>
        </div>
        <div className="flex flex-wrap gap-1 mb-3">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              className="px-2 py-1 rounded bg-[#2a3142] hover:bg-[#343c52] text-xs"
              onClick={() => {
                setFeet(p.feet);
                setInches(p.inches);
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex justify-end gap-2">
          <button
            className="px-3 py-1 rounded bg-[#2a3142] hover:bg-[#343c52]"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className={`px-3 py-1 rounded text-white ${
              invalid ? 'bg-[#2a3142] opacity-60 cursor-not-allowed' : 'bg-accent hover:bg-blue-500'
            }`}
            onClick={submit}
            disabled={invalid}
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}
