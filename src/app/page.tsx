import { Viewer } from '@/components/Viewer';

// The Viewer fills its parent (h-full), so the page supplies the viewport height.
export default function Home() {
  return (
    <main className="h-[100dvh]">
      <Viewer />
    </main>
  );
}
