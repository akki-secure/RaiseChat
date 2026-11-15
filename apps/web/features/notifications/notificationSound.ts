let ctx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  return ctx;
}

/** 新着通知音: 柔らかい2音チャイム */
function playNewSound(ac: AudioContext) {
  const notes = [880, 1108.73]; // A5 → C#6
  notes.forEach((freq, i) => {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.type = 'sine';
    osc.frequency.value = freq;
    const start = ac.currentTime + i * 0.18;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.25, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.4);
    osc.start(start);
    osc.stop(start + 0.4);
  });
}

export function playNotificationSound() {
  try {
    const ac = getCtx();
    if (ac.state === 'suspended') ac.resume();
    playNewSound(ac);
  } catch {
    // ブラウザのAutoplay Policyで再生できない場合は無視
  }
}
