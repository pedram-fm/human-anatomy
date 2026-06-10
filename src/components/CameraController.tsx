'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useThree, useFrame } from '@react-three/fiber';
import { useViewerStore } from '@/store/useViewerStore';

// camera-controls instance — only the bits we use.
interface Controls {
  fitToBox: (
    box: THREE.Box3,
    enableTransition: boolean,
    opts?: { paddingTop?: number; paddingLeft?: number; paddingBottom?: number; paddingRight?: number },
  ) => void;
  rotateTo: (azimuth: number, polar: number, enableTransition: boolean) => void;
  minDistance: number;
  maxDistance: number;
  distance: number;
}

/**
 * Camera behaviour:
 *  - On load / resize (and "Reset"), frame the WHOLE figure so a full-size human always
 *    fits — works on any aspect ratio incl. tall phone screens.
 *  - Clamp zoom-out to just past that full-body framing, so the camera can never pull back
 *    far enough to make the figure smaller than "full human" (per request).
 *  - focusNonce -> smoothly frame the selected structure (deep zoom-in is allowed).
 *  - viewNonce  -> snap to a preset anatomical direction (front/back/left/right).
 */
export function CameraController() {
  const controls = useThree((s) => s.controls) as unknown as Controls | null;
  const scene = useThree((s) => s.scene);
  const size = useThree((s) => s.size);

  const selectedId = useViewerStore((s) => s.selectedId);
  const focusNonce = useViewerStore((s) => s.focusNonce);
  const resetNonce = useViewerStore((s) => s.resetNonce);
  const viewNonce = useViewerStore((s) => s.viewNonce);
  const viewDir = useViewerStore((s) => s.viewDir);

  const pendingFocus = useRef(false);
  const pendingFrameAll = useRef(true); // frame the whole body on first load
  const tries = useRef(0);

  // bounding box of everything currently rendered with a structure id
  const worldBox = (onlyId?: string) => {
    scene.updateMatrixWorld(true); // ensure group transforms are baked before measuring
    const box = new THREE.Box3();
    let found = false;
    scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh || !m.visible) return;
      const id = m.userData.structureId as string | null;
      if (!id) return;
      if (onlyId && id !== onlyId) return;
      box.expandByObject(m);
      found = true;
    });
    return found && !box.isEmpty() ? box : null;
  };

  const frameAll = (transition: boolean) => {
    if (!controls) return false;
    const box = worldBox();
    if (!box) return false;
    const pad = box.getSize(new THREE.Vector3()).y * 0.07; // ~7% breathing room top/bottom
    controls.minDistance = 0.02; // allow deep zoom-in for tiny structures
    controls.maxDistance = Infinity; // temporarily, so fit isn't clamped
    controls.fitToBox(box, transition, {
      paddingTop: pad, paddingBottom: pad, paddingLeft: pad, paddingRight: pad,
    });
    // cap zoom-out to ~just beyond the full-body framing distance
    controls.maxDistance = controls.distance * 1.1;
    return true;
  };

  // first load: frame the whole body once meshes exist
  useFrame(() => {
    if (pendingFrameAll.current) {
      if (frameAll(false)) { pendingFrameAll.current = false; tries.current = 0; }
      else if (++tries.current > 300) pendingFrameAll.current = false;
      return;
    }
    if (pendingFocus.current && controls && selectedId) {
      const box = worldBox(selectedId);
      if (box) {
        const pad = Math.max(box.getSize(new THREE.Vector3()).length() * 0.3, 0.02);
        controls.fitToBox(box, true, {
          paddingTop: pad, paddingBottom: pad, paddingLeft: pad, paddingRight: pad,
        });
        pendingFocus.current = false;
      } else if (++tries.current > 180) pendingFocus.current = false;
    }
  });

  useEffect(() => {
    if (focusNonce > 0 && selectedId) { pendingFocus.current = true; tries.current = 0; }
  }, [focusNonce, selectedId]);

  useEffect(() => {
    if (resetNonce > 0) { pendingFocus.current = false; pendingFrameAll.current = true; tries.current = 0; }
  }, [resetNonce]);

  // keep the full figure framed when the viewport changes (e.g. phone rotation, resize)
  useEffect(() => {
    if (!selectedId) { pendingFrameAll.current = true; tries.current = 0; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size.width, size.height]);

  // preset anatomical views (azimuth, polar) — front/back/right/left
  useEffect(() => {
    if (viewNonce === 0 || !controls) return;
    const dirs: Record<string, [number, number]> = {
      front: [0, Math.PI / 2],
      back: [Math.PI, Math.PI / 2],
      right: [Math.PI / 2, Math.PI / 2],
      left: [-Math.PI / 2, Math.PI / 2],
    };
    const d = dirs[viewDir];
    if (d) controls.rotateTo(d[0], d[1], true);
  }, [viewNonce, viewDir, controls]);

  return null;
}
