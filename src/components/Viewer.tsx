'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { CameraControls, ContactShadows } from '@react-three/drei';
import { RotateCcw, List, X, Maximize, Minimize } from 'lucide-react';
import { Anatomy } from './Anatomy';
import { CameraController } from './CameraController';
import { Sidebar } from './Sidebar';
import { LayersPanel } from './LayersPanel';
import { Button } from '@/components/ui/button';
import { useViewerStore } from '../store/useViewerStore';

function CameraToolbar({
  isFullscreen,
  onToggleFullscreen,
}: {
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
}) {
  const resetView = useViewerStore((s) => s.resetView);
  const setView = useViewerStore((s) => s.setView);
  const views = ['front', 'back', 'left', 'right'] as const;
  return (
    <div className="absolute top-4 left-4 z-20 flex flex-col gap-2">
      <div className="flex gap-2">
        <Button variant="secondary" size="sm" className="gap-2 shadow-md" onClick={resetView}>
          <RotateCcw className="h-4 w-4" /> Fit body
        </Button>
        <Button
          variant="secondary"
          size="icon"
          className="h-8 w-8 shadow-md"
          onClick={onToggleFullscreen}
          title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
        >
          {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
        </Button>
      </div>
      <div className="flex gap-1 rounded-md border bg-background/90 backdrop-blur p-1 shadow-md">
        {views.map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className="px-1.5 sm:px-2 py-1 text-xs rounded hover:bg-accent capitalize"
          >
            {v}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Viewer() {
  const [panelOpen, setPanelOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Fullscreen: prefer the native API; iPhone Safari has no element fullscreen,
  // so fall back to an emulated fixed-overlay mode.
  const [nativeFullscreen, setNativeFullscreen] = useState(false);
  const [fakeFullscreen, setFakeFullscreen] = useState(false);
  const isFullscreen = nativeFullscreen || fakeFullscreen;

  useEffect(() => {
    const onChange = () => setNativeFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  useEffect(() => {
    if (!fakeFullscreen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden'; // lock page scroll behind the overlay
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFakeFullscreen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [fakeFullscreen]);

  const toggleFullscreen = () => {
    const el = rootRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else if (fakeFullscreen) {
      setFakeFullscreen(false);
    } else if (el.requestFullscreen) {
      el.requestFullscreen().catch(() => setFakeFullscreen(true));
    } else {
      setFakeFullscreen(true);
    }
  };

  return (
    <div
      ref={rootRef}
      className={`flex h-full w-full overflow-hidden bg-zinc-950 text-foreground ${
        // `relative` keeps absolutely-positioned children (the structures drawer) anchored
        // to the viewer box; without it they escape to the page viewport and shift around
        // when fullscreen toggles the root between positioned and static.
        fakeFullscreen ? 'fixed inset-0 z-[100]' : 'relative'
      }`}
    >
      {/* 3D Viewport */}
      <div className="relative flex-1 cursor-grab active:cursor-grabbing">
        <Canvas
          shadows
          dpr={[1, 1.75]}
          gl={{ antialias: true, powerPreference: 'high-performance' }}
          performance={{ min: 0.5 }}
          camera={{ position: [0, 0, 3], fov: 40 }}
        >
          <color attach="background" args={['#09090b']} />

          <ambientLight intensity={0.6} />
          <hemisphereLight args={['#ffffff', '#3a3a4a', 0.7]} />
          <directionalLight position={[5, 8, 6]} intensity={1.3} castShadow />
          <directionalLight position={[-5, 3, -4]} intensity={0.5} />

          <Suspense fallback={null}>
            <Anatomy />
            <ContactShadows position={[0, -1.05, 0]} opacity={0.4} scale={4} blur={2.6} far={2} />
          </Suspense>

          <CameraControls makeDefault />
          <CameraController />
        </Canvas>

        <CameraToolbar isFullscreen={isFullscreen} onToggleFullscreen={toggleFullscreen} />
        <LayersPanel />

        {/* mobile: open structure list */}
        <Button
          variant="secondary"
          size="sm"
          className="absolute bottom-4 right-4 z-20 gap-2 shadow-md md:hidden"
          onClick={() => setPanelOpen(true)}
        >
          <List className="h-4 w-4" /> Structures
        </Button>

        <div className="absolute bottom-4 left-4 right-28 text-[11px] text-muted-foreground pointer-events-none hidden sm:block">
          <p>Drag to rotate • Pinch/scroll to zoom • Two-finger / right-drag to pan</p>
        </div>
      </div>

      {/* backdrop (mobile, when drawer open) */}
      {panelOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={() => setPanelOpen(false)}
        />
      )}

      {/* Sidebar: static panel on md+, slide-over drawer on mobile */}
      <div
        className={`absolute inset-y-0 right-0 z-40 w-80 max-w-[88vw] transform transition-transform duration-200
          md:static md:z-10 md:max-w-none md:translate-x-0
          ${panelOpen ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}`}
      >
        {panelOpen && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-3 -left-12 h-9 w-9 rounded-full bg-background/90 shadow md:hidden"
            onClick={() => setPanelOpen(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
        <Sidebar />
      </div>
    </div>
  );
}
