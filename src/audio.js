export class AudioFeedback {
  constructor() {
    this.context = null;
    this.enabled = true;
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    if (!enabled && this.context?.state === "running") this.context.suspend();
  }

  unlock() {
    if (!this.enabled) return;
    if (!this.context) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) {
        this.enabled = false;
        return;
      }
      this.context = new AudioContext();
    }
    if (this.context.state === "suspended") this.context.resume();
  }

  tap() {
    this.playTone({ frequency: 320, duration: 0.045, gain: 0.028, type: "sine" });
  }

  success() {
    this.playSequence([
      { frequency: 420, duration: 0.07, gain: 0.04 },
      { frequency: 560, duration: 0.08, gain: 0.045, delay: 0.07 }
    ]);
  }

  checkpoint() {
    this.playSequence([
      { frequency: 520, duration: 0.06, gain: 0.045 },
      { frequency: 700, duration: 0.08, gain: 0.05, delay: 0.06 },
      { frequency: 880, duration: 0.1, gain: 0.045, delay: 0.14 }
    ]);
  }

  finish() {
    this.playSequence([
      { frequency: 392, duration: 0.09, gain: 0.05 },
      { frequency: 523, duration: 0.1, gain: 0.055, delay: 0.09 },
      { frequency: 659, duration: 0.12, gain: 0.055, delay: 0.19 },
      { frequency: 784, duration: 0.18, gain: 0.05, delay: 0.32 }
    ]);
  }

  playSequence(notes) {
    notes.forEach((note) => this.playTone(note));
  }

  playTone({ frequency, duration, gain, delay = 0, type = "triangle" }) {
    if (!this.context || !this.enabled) return;
    const start = this.context.currentTime + delay;
    const oscillator = this.context.createOscillator();
    const gainNode = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    gainNode.gain.setValueAtTime(0.0001, start);
    gainNode.gain.exponentialRampToValueAtTime(gain, start + 0.012);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gainNode);
    gainNode.connect(this.context.destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
  }
}
