// Web camera adapter: getUserMedia preview + downscaled frame sampling.
// Renders real DOM <video>/<canvas> (this file only bundles for web).
import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from 'react';
import { rgbaToGray } from '../detection/motion';
import { CameraHandle, CameraViewProps } from './types';

function CameraViewWeb(
  props: CameraViewProps,
  ref: React.Ref<CameraHandle>,
) {
  const { grid, active, sampleFps = 12, facingMode = 'environment', onStatus, onFrame } = props;

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const sampleCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastTickRef = useRef<number>(0);

  // Keep latest callbacks without restarting the stream.
  const onFrameRef = useRef(onFrame);
  const onStatusRef = useRef(onStatus);
  onFrameRef.current = onFrame;
  onStatusRef.current = onStatus;

  useImperativeHandle(ref, () => ({
    captureThumbnail(maxWidth = 200): string | null {
      const video = videoRef.current;
      if (!video || !video.videoWidth) return null;
      const aspect = video.videoHeight / video.videoWidth;
      const w = Math.min(maxWidth, video.videoWidth);
      const h = Math.round(w * aspect);
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const cx = c.getContext('2d');
      if (!cx) return null;
      cx.drawImage(video, 0, 0, w, h);
      try {
        return c.toDataURL('image/jpeg', 0.6);
      } catch {
        return null;
      }
    },
  }));

  useEffect(() => {
    if (!active) return;
    let cancelled = false;

    async function start() {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        onStatusRef.current?.('unsupported', 'getUserMedia unavailable (needs HTTPS)');
        return;
      }
      onStatusRef.current?.('requesting');
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          video.muted = true;
          video.setAttribute('playsinline', 'true');
          await video.play().catch(() => undefined);
        }
        onStatusRef.current?.('streaming');
        loop();
      } catch (err: any) {
        const name = err?.name || '';
        if (name === 'NotAllowedError' || name === 'SecurityError') {
          onStatusRef.current?.('denied', name);
        } else if (name === 'NotFoundError' || name === 'OverconstrainedError') {
          onStatusRef.current?.('notfound', name);
        } else {
          onStatusRef.current?.('error', String(err?.message || err));
        }
      }
    }

    function loop() {
      const interval = 1000 / sampleFps;
      const tick = (ts: number) => {
        rafRef.current = requestAnimationFrame(tick);
        if (ts - lastTickRef.current < interval) return;
        lastTickRef.current = ts;
        sampleFrame();
      };
      rafRef.current = requestAnimationFrame(tick);
    }

    function sampleFrame() {
      const video = videoRef.current;
      const canvas = sampleCanvasRef.current;
      if (!video || !canvas || !video.videoWidth) return;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, grid.sampleWidth, grid.sampleHeight);
      const img = ctx.getImageData(0, 0, grid.sampleWidth, grid.sampleHeight);
      const gray = rgbaToGray(img.data, grid.sampleWidth, grid.sampleHeight);
      onFrameRef.current?.(gray);
    }

    start();

    return () => {
      cancelled = true;
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      const video = videoRef.current;
      if (video) video.srcObject = null;
    };
    // Restart only when activation, fps, facing or grid sampling changes.
  }, [active, sampleFps, facingMode, grid.sampleWidth, grid.sampleHeight]);

  return (
    <div style={fill}>
      <video ref={videoRef} autoPlay muted playsInline style={videoStyle} />
      <canvas
        ref={sampleCanvasRef}
        width={grid.sampleWidth}
        height={grid.sampleHeight}
        style={{ display: 'none' }}
      />
    </div>
  );
}

const fill: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
};

const videoStyle: React.CSSProperties = {
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  background: '#000',
};

export const CameraView = forwardRef<CameraHandle, CameraViewProps>(CameraViewWeb);
