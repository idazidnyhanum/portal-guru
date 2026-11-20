class SoundFXManager {
  private ctx: AudioContext | null = null;
  private muted: boolean = false;

  constructor() {
    try {
      this.muted = localStorage.getItem('sdn_lt_muted') === '1';
    } catch {
      this.muted = false;
    }
  }

  private getContext(): AudioContext | null {
    if (this.muted) return null;
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  isMuted(): boolean {
    return this.muted;
  }

  setMuted(val: boolean): void {
    this.muted = val;
    try {
      localStorage.setItem('sdn_lt_muted', val ? '1' : '0');
    } catch {
      // ignore storage errors
    }
  }

  private tone(freq: number, duration: number, type: OscillatorType = 'sine', gainVal = 0.14, delay = 0): void {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(gainVal, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  playTap(): void {
    this.tone(540, 0.06, 'triangle', 0.08);
  }

  playCorrect(): void {
    this.tone(523.25, 0.12, 'triangle', 0.15, 0);
    this.tone(659.25, 0.14, 'triangle', 0.15, 0.08);
    this.tone(783.99, 0.22, 'sine', 0.16, 0.16);
  }

  playWrong(): void {
    this.tone(240, 0.14, 'sawtooth', 0.08, 0);
    this.tone(185, 0.18, 'sawtooth', 0.08, 0.11);
  }

  playBoost(): void {
    this.tone(587.33, 0.09, 'triangle', 0.15, 0);
    this.tone(783.99, 0.09, 'triangle', 0.15, 0.06);
    this.tone(987.77, 0.11, 'triangle', 0.16, 0.12);
    this.tone(1174.66, 0.24, 'sine', 0.18, 0.18);
  }

  playGallop(): void {
    this.tone(140, 0.05, 'triangle', 0.11, 0);
    this.tone(175, 0.04, 'triangle', 0.09, 0.07);
    this.tone(130, 0.05, 'triangle', 0.11, 0.14);
  }

  playVictory(): void {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((n, idx) => {
      this.tone(n, idx === notes.length - 1 ? 0.45 : 0.16, 'triangle', 0.18, idx * 0.11);
    });
  }
}

export const soundFX = new SoundFXManager();
