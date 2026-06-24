// Same-device alert for the web/PWA build.
// - Sound: Web Audio alarm (NOTE: iOS routes this through the ringer channel, so
//   the phone's silent switch mutes it — that's an OS limitation, not a bug).
// - Haptics: iOS exposes no vibration API to web pages; we best-effort the
//   community "switch toggle" haptic trick (iOS 18+) plus navigator.vibrate for
//   Android. Either may be a no-op depending on platform.
import { Alerter } from './alert';

class WebAlerter implements Alerter {
  private ctx: AudioContext | null = null;
  private hapticLabel: HTMLLabelElement | null = null;

  async prime(): Promise<void> {
    const Ctor = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!this.ctx && Ctor) this.ctx = new Ctor();
    if (this.ctx && this.ctx.state === 'suspended') {
      try {
        await this.ctx.resume();
      } catch {
        /* ignore */
      }
    }
    // Inaudible blip fully unlocks the audio channel on iOS under the gesture.
    this.blip();
    this.ensureHaptic();
  }

  fire(): void {
    // Context can get suspended between priming and the alert; revive it.
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => undefined);
    }
    this.alarm();
    this.haptic();
  }

  stop(): void {
    /* alarm is short and self-terminating */
  }

  // --- audio ---------------------------------------------------------------

  private blip(): void {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.connect(ctx.destination);
    const o = ctx.createOscillator();
    o.connect(g);
    o.start(now);
    o.stop(now + 0.02);
    o.onended = () => g.disconnect();
  }

  private alarm(): void {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const g = ctx.createGain();
    g.connect(ctx.destination);
    g.gain.setValueAtTime(0.0001, now);

    const o = ctx.createOscillator();
    o.type = 'square';
    o.connect(g);

    // ~1.8s two-tone alarm, loud.
    const beats = [880, 660, 880, 660, 880, 660, 880, 660];
    const beat = 0.22;
    beats.forEach((f, i) => {
      const t = now + i * beat;
      o.frequency.setValueAtTime(f, t);
      g.gain.setValueAtTime(0.5, t);
      g.gain.setValueAtTime(0.0001, t + beat * 0.65);
    });

    o.start(now);
    o.stop(now + beats.length * beat + 0.05);
    o.onended = () => g.disconnect();
  }

  // --- haptics (best effort) -----------------------------------------------

  private ensureHaptic(): void {
    if (this.hapticLabel || typeof document === 'undefined') return;
    const label = document.createElement('label');
    label.setAttribute('aria-hidden', 'true');
    label.style.cssText = 'position:absolute;left:-9999px;opacity:0;pointer-events:none;';
    const input = document.createElement('input');
    input.type = 'checkbox';
    // Safari renders this as a switch; toggling it emits a haptic tap on iOS 18+.
    input.setAttribute('switch', '');
    label.appendChild(input);
    document.body.appendChild(label);
    this.hapticLabel = label;
  }

  private haptic(): void {
    const label = this.hapticLabel;
    if (label) {
      let n = 0;
      const tick = () => {
        try {
          label.click();
        } catch {
          /* ignore */
        }
        n += 1;
        if (n < 6) setTimeout(tick, 110);
      };
      tick();
    }
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate([250, 120, 250, 120, 250]);
      } catch {
        /* ignore */
      }
    }
  }
}

export const alerter: Alerter = new WebAlerter();
