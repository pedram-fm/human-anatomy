'use client';

import { useEffect, useState } from 'react';
import { Eye, EyeOff, Layers, ScanLine, Crosshair, ChevronDown } from 'lucide-react';
import { useViewerStore } from '../store/useViewerStore';
import { SYSTEMS } from '../data/catalog';

export function LayersPanel() {
  const [open, setOpen] = useState(true);
  // One-time mount sync with the viewport width; window is unavailable during SSR,
  // so a state initializer can't do this.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setOpen(window.matchMedia('(min-width: 768px)').matches); }, []);

  const visibleLayers = useViewerStore((s) => s.visibleLayers);
  const muscleDepth = useViewerStore((s) => s.muscleDepth);
  const toggleLayer = useViewerStore((s) => s.toggleLayer);
  const toggleMuscleDepth = useViewerStore((s) => s.toggleMuscleDepth);
  const isolate = useViewerStore((s) => s.isolate);
  const xray = useViewerStore((s) => s.xray);
  const toggleIsolate = useViewerStore((s) => s.toggleIsolate);
  const toggleXray = useViewerStore((s) => s.toggleXray);
  const selectedId = useViewerStore((s) => s.selectedId);

  return (
    <div
      className={`absolute top-4 right-4 max-h-[85%] overflow-y-auto rounded-lg border bg-background/90 backdrop-blur shadow-lg p-2.5 text-sm ${
        open ? 'w-52 z-30' : 'w-auto z-20'
      }`}
    >
      <button
        onClick={() => setOpen((o) => !o)}
        className={`w-full flex items-center gap-2 font-semibold ${open ? 'mb-1' : ''}`}
      >
        <Layers className="h-4 w-4" /> Layers
        <ChevronDown className={`h-4 w-4 ml-auto transition-transform ${open ? '' : '-rotate-90'}`} />
      </button>

      {!open ? null : (
      <>
      <ul className="space-y-1">
        {SYSTEMS.map((s) => {
          const on = visibleLayers[s.id];
          return (
            <li key={s.id}>
              <button
                onClick={() => toggleLayer(s.id)}
                className="w-full flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-accent transition-colors"
              >
                <span className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full border" style={{ background: s.color }} />
                  {s.label}
                </span>
                {on ? (
                  <Eye className="h-4 w-4 text-foreground" />
                ) : (
                  <EyeOff className="h-4 w-4 text-muted-foreground" />
                )}
              </button>

              {/* muscle sublayers — superficial / deep (unknown is always visible) */}
              {s.id === 'muscular' && on && (
                <div className="ml-5 mt-1 space-y-1 border-l pl-2">
                  {(['superficial', 'deep'] as const).map((k) => (
                    <label
                      key={k}
                      className="flex items-center gap-2 cursor-pointer text-muted-foreground hover:text-foreground"
                    >
                      <input
                        type="checkbox"
                        checked={muscleDepth[k]}
                        onChange={() => toggleMuscleDepth(k)}
                        className="accent-current"
                      />
                      <span className="capitalize">{k}</span>
                    </label>
                  ))}
                  <p className="text-[11px] text-muted-foreground/70 pt-0.5">
                    Deep/intermediate stay visible
                  </p>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <div className="mt-3 pt-2 border-t space-y-1">
        <button
          onClick={toggleXray}
          className={`w-full flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors ${
            xray ? 'bg-accent text-foreground' : 'hover:bg-accent text-muted-foreground'
          }`}
        >
          <ScanLine className="h-4 w-4" /> X-ray
          <span className="ml-auto text-[11px]">{xray ? 'on' : 'off'}</span>
        </button>
        <button
          onClick={toggleIsolate}
          disabled={!selectedId}
          className={`w-full flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors disabled:opacity-40 ${
            isolate ? 'bg-accent text-foreground' : 'hover:bg-accent text-muted-foreground'
          }`}
        >
          <Crosshair className="h-4 w-4" /> Isolate selected
          <span className="ml-auto text-[11px]">{isolate ? 'on' : 'off'}</span>
        </button>
      </div>
      </>
      )}
    </div>
  );
}
