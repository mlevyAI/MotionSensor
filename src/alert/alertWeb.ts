// Web Audio + Vibration alert for the web/PWA build.
import { Alerter } from './alert';

class WebAlerter implements Alerter {
  private ctx: AudioContext | null = null;
  private active = false;

  async prime(): Promise<void> {
    if (!this.ctx) {
      const Ctor =
        (window as any).AudioContext || (window as any).webkitAudioContext;
      if (Ctor) this.ctx = new Ctor();
    }
    // iOS Safari starts the context suspended; resume under the user gesture.
    if (this.ctx && this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
  }

  fire(): void {
    this.beep();
    if ('vibrate' in navigator) {
      try {
        navigator.vibrate([200, 100, 200, 100, 200]);
      } catch {
        /* ignore */
      }
    }
  }

  /** A short urgent two-tone beep using oscillators. */
  private beep(): void {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    this.active = true;

    const gain = ctx.createGain();
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0.0001, now);

    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.connect(gain);

    // Alternate two pitches for an alarm-like cadence over ~1.2s.
    const beats = [880, 660, 880, 660];
    const beat = 0.28;
    beats.forEach((freq, i) => {
      const t = now + i * beat;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.25, t);
      gain.gain.setValueAtTime(0.0001, t + beat * 0.7);
    });

    osc.start(now);
    osc.stop(now + beats.length * beat);
    osc.onended = () => {
      this.active = false;
      gain.disconnect();
    };
  }

  stop(): void {
    this.active = false;
  }
}

export const alerter: Alerter = new WebAlerter();
