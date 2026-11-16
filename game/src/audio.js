// All sound is synthesized with WebAudio: no audio files, nothing fetched.
// The context starts on the first user gesture (a click or key press), and M
// toggles mute. Every effect is a short oscillator or noise burst with a fast
// envelope, so nothing lingers and nothing allocates per call.

export function createAudio() {
  let context = null;
  let master = null;
  let muted = false;

  function ensure() {
    if (context !== null) return true;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return false;
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = 0.14;
      master.connect(context.destination);
      return true;
    } catch {
      return false;
    }
  }

  /** One oscillator blip: `type`, start/end frequency, length, loudness. */
  function blip(type, from, to, seconds, volume) {
    if (!ensure() || muted || context.state === 'suspended') return;
    const now = context.currentTime;
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), now + seconds);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + seconds);
    osc.connect(gain);
    gain.connect(master);
    osc.start(now);
    osc.stop(now + seconds + 0.02);
  }

  /** A short burst of filtered noise: hits, deaths and the boss roar. */
  function noise(seconds, volume, cutoff) {
    if (!ensure() || muted || context.state === 'suspended') return;
    const now = context.currentTime;
    const length = Math.max(1, Math.floor(context.sampleRate * seconds));
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = context.createBufferSource();
    source.buffer = buffer;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    const gain = context.createGain();
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + seconds);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start(now);
  }

  return {
    unlock() { ensure(); if (context && context.state === 'suspended') context.resume().catch(() => {}); },
    toggleMute() { muted = !muted; return muted; },
    isMuted() { return muted; },
    shoot() { blip('square', 880, 420, 0.07, 0.16); },
    hit() { blip('triangle', 320, 180, 0.06, 0.2); },
    enemyDie() { noise(0.16, 0.25, 900); blip('sine', 300, 60, 0.18, 0.22); },
    pickup() { blip('sine', 660, 990, 0.09, 0.14); },
    hurt() { noise(0.2, 0.3, 500); blip('sawtooth', 160, 70, 0.22, 0.25); },
    levelUp() { blip('sine', 523, 523, 0.1, 0.2); setTimeout(() => blip('sine', 659, 659, 0.1, 0.2), 90); setTimeout(() => blip('sine', 784, 784, 0.16, 0.22), 180); },
    dash() { noise(0.12, 0.18, 2400); },
    boss() { blip('sawtooth', 90, 45, 0.7, 0.3); noise(0.5, 0.2, 300); },
    victory() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => blip('sine', f, f, 0.22, 0.22), i * 130)); },
    gameOver() { [392, 330, 262, 196].forEach((f, i) => setTimeout(() => blip('triangle', f, f * 0.94, 0.25, 0.2), i * 160)); },
  };
}
