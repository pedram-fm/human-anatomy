<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Downstream sync — massage-app

This repo is the **source of truth** for the 3D anatomy viewer. The viewer core is mirrored
into the massage-app project's developer panel (`/developer/anatomy`).

- After changing anything under `src/components` (except `ui/`), `src/store`, `src/data`,
  or the system GLBs in `public/models`, run `scripts/sync-to-massage-app.sh` to copy the
  changes downstream, then run massage-app's typecheck/lint and follow its git workflow
  (branch → push → PR → deploy).
- Keep synced files portable so they stay byte-identical in both projects:
  intra-feature imports stay **relative** (`../store/...`, `../data/...`, `./Component`),
  the UI kit is imported as `@/components/ui/*` (each project resolves its own shadcn kit
  with the same component API), and only use packages both projects have
  (three, @react-three/fiber, @react-three/drei, zustand, lucide-react).
- Project-specific code lives downstream only: massage-app's `page.tsx` wrapper (panel
  height, `dir="ltr"`), its nav item, and dependency wiring.
