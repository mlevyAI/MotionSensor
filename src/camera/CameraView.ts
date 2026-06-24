// Type/resolution shim. Metro picks CameraView.web.tsx (web) or
// CameraView.native.tsx (native) automatically via platform extensions;
// this file only exists so `import './CameraView'` type-checks.
export * from './CameraView.web';
