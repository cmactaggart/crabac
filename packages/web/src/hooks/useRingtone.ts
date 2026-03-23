import { useEffect, useRef } from 'react';
import { useCallStore } from '../stores/call.js';

/**
 * Plays a ringtone when there is an incoming call.
 * Uses the Web Audio API to generate a two-tone ring pattern
 * (similar to a classic phone ring) — no audio file needed.
 */
export function useRingtone() {
  const incomingCall = useCallStore((s) => s.incomingCall);
  const ctxRef = useRef<AudioContext | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!incomingCall) {
      // Stop ringtone
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (ctxRef.current) {
        ctxRef.current.close().catch(() => {});
        ctxRef.current = null;
      }
      return;
    }

    // Start ringtone
    const ctx = new AudioContext();
    ctxRef.current = ctx;

    function playRingBurst() {
      if (!ctxRef.current || ctxRef.current.state === 'closed') return;
      const ac = ctxRef.current;

      // Two-tone burst: 440Hz then 480Hz, each 0.2s, with a small gap
      const now = ac.currentTime;
      const gain = ac.createGain();
      gain.connect(ac.destination);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.linearRampToValueAtTime(0, now + 0.9);

      const osc1 = ac.createOscillator();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(440, now);
      osc1.connect(gain);
      osc1.start(now);
      osc1.stop(now + 0.4);

      const osc2 = ac.createOscillator();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(480, now + 0.45);
      osc2.connect(gain);
      osc2.start(now + 0.45);
      osc2.stop(now + 0.85);
    }

    // Play immediately, then repeat every 2.5s (ring-pause-ring pattern)
    playRingBurst();
    intervalRef.current = setInterval(playRingBurst, 2500);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      ctx.close().catch(() => {});
      ctxRef.current = null;
    };
  }, [incomingCall]);
}
