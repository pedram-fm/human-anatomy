# 3D Muscle Anatomy MVP

An interactive 3D web application to explore the human muscular system. Built with Next.js, React Three Fiber, and Tailwind CSS.

## 3D Model Source & License
- **Source**: [BodyParts3D, The Database Center for Life Science](https://dbarchive.biosciencedbc.jp/en/bodyparts3d/download.html)
- **License**: Creative Commons Attribution 4.0 International (CC-BY 4.0)
- **Attribution**: "BodyParts3D, © The Database Center for Life Science licensed under CC Attribution 4.0 International"
- **Processing**: The model was compiled by downloading the IS-A tree OBJ models (99% reduction), extracting ~44 major superficial skeletal muscles, mapping their coordinates, computing smooth normals, and combining them into an optimized quantized GLB file (~4.8MB).

## What Works
- **3D Viewer**: OrbitControls support panning (Right Click + Drag), zooming (Scroll), and rotating (Left Click + Drag) around the 3D model.
- **Interactive Meshes**: The skeletal muscles are interactive. 
  - Hovering over a muscle highlights it subtly.
  - Clicking on a muscle selects it, highlighting it brightly and updating the sidebar.
- **Sidebar**:
  - Displays a list of available muscles.
  - Features a search box to filter muscles by English or Persian names.
  - Selecting a muscle (either from the 3D model or the list) displays detailed information including name, region, FMA ID, and BodyParts3D file ID.
- **State Management**: Zustand manages the selected/hovered states globally across the Canvas and Sidebar.

## What's Stubbed / Out of Scope
- Deep muscles are excluded to keep the MVP focused and lightweight.
- Male/female switch is not implemented.
- The UI contains stubbed sections (like descriptions which are auto-generated templates) that can be easily replaced with real medical descriptions.
- No backend, database, authentication, or subscriptions. All data is statically bundled in `src/data/muscles.ts`.
- Full i18n framework is not used, though data objects contain both English and Persian names.

## Getting Started

1. Ensure you have Node.js installed (v18+).
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the development server:
   ```bash
   npm run dev
   ```
4. Open [http://localhost:3000](http://localhost:3000) in your browser.
