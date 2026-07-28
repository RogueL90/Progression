# Face mesh (temporarily disabled for Expo Go / easier local runs)

Face mesh capture uses native modules that **Expo Go cannot load**:

- `react-native-vision-camera`
- `react-native-vision-camera-face-detector`
- (and related worklets / Skia for that path)

Those require a **custom development build** (`expo-dev-client` / `expo run:ios`).
Until the app is farther along, face mesh is **temporarily disabled** so you can
develop and test the rest of the app with **Expo Go** on a real phone (camera
works without a cable or Xcode destination fights).

## Current state

| Item | Status |
|------|--------|
| Feature flag | `FACE_MESH_ENABLED = false` in [`src/constants/featureFlags.ts`](../src/constants/featureFlags.ts) |
| Capture | Always uses `expo-camera` (no Vision Camera, no live mesh, no mesh sidecar on save) |
| Capture settings | “Show face mesh” toggle hidden |
| Viewer / timelapse | Still can render an existing `.mesh.json` overlay if one is already on disk |
| Expo Go | Supported for normal app flows while this flag is off |

## Day-to-day local workflow (flag off)

```bash
npx expo start
```

Scan the QR code with **Expo Go** on your iPhone. No `prebuild` / Xcode / simulator
required for core features (projects, capture with expo-camera, timeline, progress,
backup).

## How to re-enable face mesh (exact previous behavior)

### 1. Flip the flag

In [`src/constants/featureFlags.ts`](../src/constants/featureFlags.ts):

```ts
export const FACE_MESH_ENABLED = true;
```

### 2. Use a development build (not Expo Go)

Expo Go will crash or fail if Vision Camera is loaded. Build a custom client:

```bash
npx expo prebuild
npx expo run:ios --device
# or EAS:
# eas build --profile development --platform ios
npx expo start --dev-client
```

Confirm [`app.json`](../app.json) still has the `react-native-vision-camera` plugin
and iOS `deploymentTarget` ≥ `15.5` (required by the face-detector pod).

### 3. Confirm behavior after rebuild

On **selfie** / **side_profile** projects you should again get:

- Vision Camera capture path ([`FaceMeshCaptureView`](../src/components/FaceMeshCaptureView.tsx))
- Live mesh preview toggle in capture settings
- Mesh always saved as `{date}.mesh.json` when a face is detected at shutter
- Face / Mesh toggles on photo detail + progress timelapse

### 4. Production / App Store

App Store builds include native modules. With `FACE_MESH_ENABLED = true`, face mesh
works in production the same as in a dev client. Expo Go is never used in production.

## Code map (what was gated)

- [`src/app/projects/[projectId]/capture.tsx`](../src/app/projects/[projectId]/capture.tsx) — skips Vision Camera imports/path when flag is off
- Capture settings `showFaceMeshOption` only when flag is on and project is a face type

Implementation code under `src/components/FaceMeshCaptureView.tsx`, storage, and
viewer components was **not deleted** — only gated at the capture entry point.
