// Audible alarm + spoken voice alerts for the admin dashboard.
// Browser-only (Web Audio + SpeechSynthesis). All calls are safe no-ops on the server or
// when the APIs are unavailable, and every call is wrapped so a failure never breaks the UI.

let audioCtx: AudioContext | null = null;

function ctx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    if (!audioCtx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      audioCtx = new AC();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
    return audioCtx;
  } catch {
    return null;
  }
}

/** A single beep. */
function beep(freq: number, durationMs: number, startAt: number, volume = 0.18) {
  const ac = ctx();
  if (!ac) return;
  try {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = 'square';
    osc.frequency.value = freq;
    gain.gain.value = volume;
    osc.connect(gain);
    gain.connect(ac.destination);
    const t = ac.currentTime + startAt;
    osc.start(t);
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + durationMs / 1000);
    osc.stop(t + durationMs / 1000);
  } catch {
    // ignore
  }
}

/** Urgent three-tone alarm (for logouts / dead sessions). */
export function playAlarm() {
  beep(880, 180, 0);
  beep(660, 180, 0.22);
  beep(990, 260, 0.44);
}

/** Softer two-tone chime (for new/updated containers). */
export function playChime() {
  beep(587, 150, 0);
  beep(784, 220, 0.16, 0.14);
}

/** Speak a short message (best-effort; cancels any queued speech first). */
export function speak(message: string) {
  if (typeof window === 'undefined') return;
  try {
    const synth = window.speechSynthesis;
    if (!synth) return;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(message);
    u.rate = 1;
    u.pitch = 1;
    u.volume = 1;
    synth.speak(u);
  } catch {
    // ignore
  }
}

/** Alarm + voice together, used for the most urgent alerts. */
export function alarmWithVoice(message: string) {
  playAlarm();
  speak(message);
}

/**
 * Browsers block audio until the user interacts with the page. Call this once from a click
 * so later programmatic alarms are allowed to play.
 */
export function primeAudio() {
  ctx();
  try {
    window.speechSynthesis?.resume?.();
  } catch {
    // ignore
  }
}

/** Ask once for permission to show desktop notifications (safe to call repeatedly). */
export function requestNotifyPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  try {
    if (Notification.permission === 'default') Notification.requestPermission().catch(() => {});
  } catch {
    // ignore
  }
}

/**
 * Show a desktop/OS notification (appears even when the browser tab is in the background,
 * as long as a tab is still open). `tag` collapses repeats of the same alert.
 */
export function notify(title: string, body: string, tag?: string) {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  try {
    if (Notification.permission !== 'granted') return;
    const n = new Notification(title, {
      body,
      tag,
      renotify: Boolean(tag),
      requireInteraction: true,
    } as NotificationOptions);
    n.onclick = () => {
      try {
        window.focus();
        n.close();
      } catch {
        // ignore
      }
    };
  } catch {
    // ignore
  }
}
