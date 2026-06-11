import { create } from 'zustand';
import { byId, SYSTEMS, type SystemId } from '../data/catalog';

const INITIAL_LAYERS = Object.fromEntries(
  SYSTEMS.map((s) => [s.id, s.defaultOn]),
) as Record<SystemId, boolean>;

interface ViewerState {
  selectedId: string | null;
  hoveredId: string | null;
  searchQuery: string;
  /** Which system layers are rendered. Skeleton is the default base layer. */
  visibleLayers: Record<SystemId, boolean>;
  /** Muscle sublayer visibility. 'unknown'-depth muscles are always shown regardless. */
  muscleDepth: { superficial: boolean; deep: boolean };
  /** Show only the selected structure (hide everything else). */
  isolate: boolean;
  /** X-ray: render non-selected structures translucent so deeper ones show through. */
  xray: boolean;
  /** Incremented to signal the 3D camera to reset to its default framing. */
  resetNonce: number;
  /** Incremented to signal the camera to focus/frame the current selection. */
  focusNonce: number;
  /** Preset anatomical view direction + a nonce to trigger it. */
  viewNonce: number;
  viewDir: 'front' | 'back' | 'left' | 'right';

  toggleLayer: (system: SystemId) => void;
  toggleMuscleDepth: (kind: 'superficial' | 'deep') => void;
  toggleIsolate: () => void;
  toggleXray: () => void;
  /** Re-frame the camera on the current selection (without re-selecting). */
  focusSelection: () => void;
  /** Snap the camera to a preset anatomical view. */
  setView: (dir: 'front' | 'back' | 'left' | 'right') => void;
  setHoveredId: (id: string | null) => void;
  setSearchQuery: (query: string) => void;
  /** Select a structure; auto-enables its system layer so it's actually visible. */
  selectStructure: (id: string | null) => void;
  resetView: () => void;
}

export const useViewerStore = create<ViewerState>((set) => ({
  selectedId: null,
  hoveredId: null,
  searchQuery: '',
  visibleLayers: { ...INITIAL_LAYERS },
  muscleDepth: { superficial: true, deep: true },
  isolate: false,
  xray: false,
  resetNonce: 0,
  focusNonce: 0,
  viewNonce: 0,
  viewDir: 'front',

  toggleLayer: (system) =>
    set((s) => ({ visibleLayers: { ...s.visibleLayers, [system]: !s.visibleLayers[system] } })),

  toggleMuscleDepth: (kind) =>
    set((s) => ({ muscleDepth: { ...s.muscleDepth, [kind]: !s.muscleDepth[kind] } })),

  toggleIsolate: () => set((s) => ({ isolate: !s.isolate })),
  toggleXray: () => set((s) => ({ xray: !s.xray })),
  focusSelection: () => set((s) => (s.selectedId ? { focusNonce: s.focusNonce + 1 } : {})),
  setView: (dir) => set((s) => ({ viewDir: dir, viewNonce: s.viewNonce + 1 })),

  setHoveredId: (id) => set({ hoveredId: id }),
  setSearchQuery: (query) => set({ searchQuery: query }),

  selectStructure: (id) =>
    set((s) => {
      if (!id) return { selectedId: null };
      const struct = byId.get(id);
      const layers = { ...s.visibleLayers };
      const depth = { ...s.muscleDepth };
      if (struct) {
        layers[struct.system] = true; // make sure the selection is on screen
        // if the muscle's depth sublayer is off, turn it on so it's visible
        if (struct.system === 'muscular' && struct.depth !== 'unknown') depth[struct.depth] = true;
      }
      return {
        selectedId: id,
        visibleLayers: layers,
        muscleDepth: depth,
        focusNonce: s.focusNonce + 1,
      };
    }),

  resetView: () =>
    set((state) => ({
      selectedId: null,
      hoveredId: null,
      isolate: false,
      resetNonce: state.resetNonce + 1,
    })),
}));
