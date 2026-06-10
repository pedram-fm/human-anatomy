'use client';

import { Suspense, useMemo } from 'react';
import * as THREE from 'three';
import { useGLTF } from '@react-three/drei';
import type { ThreeEvent } from '@react-three/fiber';
import { StructureModel } from './StructureModel';
import { useViewerStore } from '@/store/useViewerStore';
import { SYSTEMS, SYSTEM_BY_ID } from '@/data/catalog';

const TARGET_HEIGHT = 2.0; // world units the whole figure should span vertically
const SKELETAL = SYSTEM_BY_ID.get('skeletal')!;

useGLTF.preload(SKELETAL.model);

/**
 * Holds every visible system layer under ONE shared transform so the layers stay
 * spatially aligned (all GLBs are exported in the same baked world space). The fit
 * is derived from the skeleton (always loaded), so it stays stable as layers toggle.
 */
export function Anatomy() {
  const { scene: skeleton } = useGLTF(SKELETAL.model); // fit reference — always loaded
  const visibleLayers = useViewerStore((s) => s.visibleLayers);
  const selectStructure = useViewerStore((s) => s.selectStructure);
  const setHoveredId = useViewerStore((s) => s.setHoveredId);

  const { fitScale, fitOffset } = useMemo(() => {
    const box = new THREE.Box3().setFromObject(skeleton);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);
    const scale = TARGET_HEIGHT / Math.max(size.y, 1e-4);
    return { fitScale: scale, fitOffset: center.clone().multiplyScalar(-scale) };
  }, [skeleton]);

  const onDown = (e: ThreeEvent<PointerEvent>) => {
    const id = (e.object as THREE.Mesh).userData.structureId as string | null;
    if (!id) return;
    e.stopPropagation();
    selectStructure(id);
  };
  const onOver = (e: ThreeEvent<PointerEvent>) => {
    const id = (e.object as THREE.Mesh).userData.structureId as string | null;
    if (!id) return;
    e.stopPropagation();
    document.body.style.cursor = 'pointer';
    setHoveredId(id);
  };
  const onOut = () => {
    document.body.style.cursor = 'auto';
    setHoveredId(null);
  };

  return (
    <group
      position={fitOffset}
      scale={fitScale}
      onPointerDown={onDown}
      onPointerOver={onOver}
      onPointerOut={onOut}
      dispose={null}
    >
      {SYSTEMS.filter((s) => visibleLayers[s.id]).map((s) => (
        <Suspense key={s.id} fallback={null}>
          <StructureModel url={s.model} system={s.id} baseColor={s.color} />
        </Suspense>
      ))}
    </group>
  );
}
