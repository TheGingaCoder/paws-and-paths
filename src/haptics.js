export class Haptics {
  constructor(enabled = true) {
    this.enabled = enabled;
  }

  setEnabled(enabled) {
    this.enabled = enabled;
  }

  tap() {
    this.vibrate(12);
  }

  checkpoint() {
    this.vibrate([18, 32, 28]);
  }

  finish() {
    this.vibrate([80, 45, 120, 45, 180]);
  }

  vibrate(pattern) {
    if (!this.enabled || !navigator.vibrate) return;
    navigator.vibrate(pattern);
  }
}
