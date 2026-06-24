# MotionSensor

On-device "security camera": watches the phone camera, detects motion, lets you
label movements as **allowed** / **not-allowed**, and fires a **same-device**
alert (sound + vibration + banner) when not-allowed motion is detected.

This is the **web / PWA preview build** (Expo + React Native Web). It runs in a
browser today so it can be tried on an iPhone over HTTPS with no Mac, no Apple
Developer account, and no App Store. The code is structured so the camera +
detection layer can later be swapped for a native iOS implementation
(react-native-vision-camera) while the UI, motion-zone logic, thresholds,
labeling, and persistence carry over.

## What works in this build

- **Tier-1 motion detection** — each camera frame is downscaled to grayscale and
  diffed against the previous frame; the image is split into a 4×4 grid and each
  zone gets a motion score (fraction of changed pixels). This is the *only*
  signal — it knows "sustained motion in region X", not posture/gesture/identity.
- **Labeling loop** — significant motion auto-captures a frame (or tap **Capture**).
  Tag it allowed / not-allowed and pick which zones to watch. Examples persist in
  IndexedDB on-device.
- **Derived thresholds** — per-zone alert thresholds are computed from your labels
  so allowed motion stays below and not-allowed motion trips the alert.
- **Alert** — when **armed**, a watched zone over its threshold for several
  consecutive frames plays a Web Audio alarm + vibration + on-screen banner.

### Verified constraints (by design)

- **Foreground-only**: a browser cannot run the camera in the background; the app
  watches only while open and on-screen.
- **HTTPS required**: `getUserMedia` only works on a secure origin (so: a deployed
  HTTPS URL, not plain-HTTP LAN).
- **iOS Safari** does not persist camera permission for standalone PWAs — Safari
  may re-prompt each launch.
- OS-level push / lock-screen alerts and multi-device alerting are **out of scope**
  here (would need a Home-Screen-installed PWA + Web Push, or a backend).

## Run locally (developer machine)

```bash
npm install
npm run web        # opens the Metro web dev server
npm test           # headless logic tests (motion + thresholds), via bun
npm run typecheck  # tsc --noEmit
npm run build:web  # static export to ./dist
```

`npm run web` serves on `localhost`, where the camera is allowed. To test on a
phone you need HTTPS — use the GitHub Pages deploy below.

## Try it on your iPhone (GitHub Pages)

A workflow at `.github/workflows/deploy-web.yml` builds the static web export on
every push to `main` and publishes it to the **`gh-pages`** branch (needs only
`contents: write`, so CI is green on its own). The Pages *source* must be
selected once — the default Actions token cannot enable Pages itself.

1. The workflow runs on `main` and creates/updates the `gh-pages` branch.
2. One-time (repo must be public): **Settings → Pages → Build and deployment →
   Source: Deploy from a branch → Branch: `gh-pages` / `(root)`** → Save.
3. Open `https://<owner>.github.io/MotionSensor/` in Safari on your iPhone and
   **Allow** camera access. The path is **case-sensitive** and must match the
   repo name exactly (`MotionSensor`, not `motionsensor`).

> The export uses `EXPO_BASE_URL=/MotionSensor` (exact repo-name case) so assets
> resolve under the project-pages subpath. For root hosting (Netlify/Vercel),
> build without that env.

## How to use it

1. **Start camera** → grant permission. The grid overlay shows live motion.
2. Move in front of the camera — a **capture** pops up. Tag a benign movement
   **Allowed**; tag the movement you care about **Not allowed** and confirm its
   zones.
3. Once at least one zone is watched, **Arm watch**. Reproduce the not-allowed
   motion → alarm + banner. Allowed-type motion stays silent.

## Project layout

```
src/
  camera/      CameraView.web.tsx (getUserMedia) · *.native.tsx stub · shared types
  detection/   motion.ts (frame-diff zone scoring) · types.ts   [pure, shared]
  labeling/    types.ts · thresholds.ts (derive config) · repository (IndexedDB)
  engine/      useMotionEngine.ts (frame -> score -> trigger -> alert orchestration)
  alert/       alertWeb.ts (Web Audio + vibration)
  ui/          ZoneOverlay.tsx · LabelModal.tsx
App.tsx        main screen
scripts/       selftest.ts (headless logic checks)
```
