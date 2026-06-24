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
  signal — it knows "movement in region X", not posture/gesture/identity.
- **Zone calibration** — with the phone held still, you tap the grid to mark
  **off-limits zones** (where movement is not allowed). Selection + sensitivity
  persist on-device (localStorage).
- **Sensitivity** — Low / Medium / High set how much movement (fraction of a
  zone's pixels changing) counts as a trigger.
- **Alert** — when **armed**, any off-limits zone whose motion crosses the
  sensitivity threshold for several consecutive frames plays a Web Audio alarm +
  vibration + on-screen banner.

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

1. Prop the phone up, pointed at the scene, and **keep it still** (moving the
   camera looks like motion everywhere).
2. **Start camera** → grant permission. The 4×4 grid appears over the live view.
3. **Tap the zones where movement is not allowed** (they turn blue). Pick a
   **sensitivity**.
4. **Arm watch.** Any movement in an off-limits zone → alarm + vibration + banner.
   Disarm to edit zones again.

## Project layout

```
src/
  camera/      CameraView.web.tsx (getUserMedia) · *.native.tsx stub · shared types
  detection/   motion.ts (frame-diff zone scoring) · types.ts   [pure, shared]
  labeling/    thresholds.ts (isTriggered/triggeringZones) · types.ts (ZoneConfig)
  engine/      useMotionEngine.ts (frame -> score -> trigger -> alert) · zoneStore.ts
  alert/       alertWeb.ts (Web Audio + vibration)
  ui/          ZoneOverlay.tsx
App.tsx        main screen
scripts/       selftest.ts (headless logic checks)
```
