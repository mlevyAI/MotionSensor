// Shared camera adapter contract. The web build implements it with
// getUserMedia (CameraView.web.tsx); a future native build implements the same
// props/handle with react-native-vision-camera (CameraView.native.tsx).

import { GrayFrame, GridConfig } from '../detection/types';

export type CameraStatus =
  | 'idle'
  | 'requesting'
  | 'streaming'
  | 'denied'
  | 'notfound'
  | 'unsupported'
  | 'error';

export type CameraViewProps = {
  /** Grid the frames are sampled/downscaled to. */
  grid: GridConfig;
  /** Run the sampling loop when true; release the camera when false. */
  active: boolean;
  /** Target analysis frame rate (we deliberately analyze well below 60fps). */
  sampleFps?: number;
  facingMode?: 'environment' | 'user';
  onStatus?: (status: CameraStatus, detail?: string) => void;
  /** Called once per sampled frame with the downscaled grayscale buffer. */
  onFrame?: (frame: GrayFrame) => void;
};

/** Imperative handle exposed by the camera component. */
export interface CameraHandle {
  /** Grab the current frame as a small JPEG data-URL (evidence thumbnail). */
  captureThumbnail(maxWidth?: number): string | null;
}
