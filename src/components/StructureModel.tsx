'use client';

import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useGLTF } from '@react-three/drei';
import { useViewerStore } from '../store/useViewerStore';
import {
  DRACO_DECODER_PATH, byId, resolveStructureId, isDepthVisible, type SystemId, type Depth,
} from '../data/catalog';

/**
 * One anatomical system layer (e.g. skeletal, muscular) loaded from its GLB.
 * Tags every mesh with its structure id, owns per-mesh materials, and reacts to
 * hover / selection (recolor) and muscle depth sublayers (visibility).
 * Geometry is rendered in raw model coordinates — <Anatomy> applies the shared fit.
 */
export function StructureModel({
  url,
  system,
  baseColor,
}: {
  url: string;
  system: SystemId;
  baseColor: string;
}) {
  const { scene } = useGLTF(url, DRACO_DECODER_PATH);

  const selectedId = useViewerStore((s) => s.selectedId);
  const hoveredId = useViewerStore((s) => s.hoveredId);
  const muscleDepth = useViewerStore((s) => s.muscleDepth);
  const isolate = useViewerStore((s) => s.isolate);
  const xray = useViewerStore((s) => s.xray);

  const model = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      const id = resolveStructureId(mesh.name);
      mesh.userData.structureId = id;
      mesh.userData.depth = (id && byId.get(id)?.depth) || 'unknown';
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.material = new THREE.MeshStandardMaterial({
        color: baseColor,
        roughness: 0.65,
        metalness: 0.04,
      });
    });
    return clone;
  }, [scene, baseColor]);

  // Visibility (depth sublayers + isolate) and appearance (hover/select recolor, x-ray).
  useEffect(() => {
    model.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      const id = mesh.userData.structureId as string | null;
      const mat = mesh.material as THREE.MeshStandardMaterial;
      if (!mat) return;

      const depthOk =
        system === 'muscular' ? isDepthVisible(mesh.userData.depth as Depth, muscleDepth) : true;
      const isSel = !!id && id === selectedId;
      mesh.visible = depthOk && (!(isolate && selectedId) || isSel);

      // recolor
      if (isSel) {
        mat.color.set('#e8483b');
        mat.emissive.set('#5a1009');
        mat.emissiveIntensity = 0.9;
      } else if (id && id === hoveredId) {
        mat.color.set('#d98a82');
        mat.emissive.set('#3a1410');
        mat.emissiveIntensity = 0.6;
      } else {
        mat.color.set(baseColor);
        mat.emissive.set('#000000');
        mat.emissiveIntensity = 0;
      }

      // x-ray: fade everything that isn't the selection so deeper structures show through
      const ghost = xray && !isSel && !!selectedId;
      mat.transparent = ghost;
      mat.opacity = ghost ? 0.18 : 1;
      mat.depthWrite = !ghost;
    });
  }, [model, system, baseColor, selectedId, hoveredId, muscleDepth, isolate, xray]);

  return <primitive object={model} dispose={null} />;
}
