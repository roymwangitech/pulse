/**
 * Plays a short iPhone-style notification ding using the Web Audio API.
 * No external file needed — synthesized on the fly.
 */
export function playNotificationSound() {
  if (typeof window === 'undefined') return;
  try {
    const ctx = new AudioContext();

    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    // iPhone tri-tone style: two quick ascending tones
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(1046, ctx.currentTime);        // C6
    oscillator.frequency.setValueAtTime(1318, ctx.currentTime + 0.08); // E6
    oscillator.frequency.setValueAtTime(1568, ctx.currentTime + 0.16); // G6

    gainNode.gain.setValueAtTime(0, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.18, ctx.currentTime + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.4);

    oscillator.onended = () => ctx.close();
  } catch {
    // Silently ignore if AudioContext isn't available
  }
}
