import { useEffect } from 'react';
import { getSocket } from '../lib/socket.js';
import { useAuthStore } from '../stores/auth.js';

const IDLE_TIMEOUT = 5 * 60 * 1000; // 5 minutes
const HIDDEN_IDLE_TIMEOUT = 60 * 1000; // 1 minute when tab hidden

export function usePresence(active: boolean) {
  const setStatus = useAuthStore((s) => s.setStatus);

  useEffect(() => {
    if (!active) return;

    let idleTimer: ReturnType<typeof setTimeout>;
    let isIdle = false;

    function getOverride(): string | null {
      return localStorage.getItem('presenceOverride');
    }

    function emitStatus(status: string) {
      getSocket()?.emit('presence:status', { status });
      setStatus(status);
    }

    function emitAuto(status: string) {
      if (getOverride()) return;
      emitStatus(status);
    }

    function startIdleTimer(timeout: number) {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        isIdle = true;
        emitAuto('idle');
      }, timeout);
    }

    function onActivity() {
      if (getOverride()) return;
      if (isIdle) {
        isIdle = false;
        emitAuto('online');
      }
      startIdleTimer(IDLE_TIMEOUT);
    }

    // Set initial status
    const override = getOverride();
    if (override) {
      emitStatus(override);
    } else {
      emitStatus('online');
      startIdleTimer(IDLE_TIMEOUT);
    }

    // Re-emit on socket reconnect
    function onConnect() {
      const ov = getOverride();
      if (ov) {
        emitStatus(ov);
      } else {
        isIdle = false;
        emitStatus('online');
        startIdleTimer(IDLE_TIMEOUT);
      }
    }

    const socket = getSocket();
    socket?.on('connect', onConnect);

    // Activity tracking (throttled to 1s)
    let lastActivity = 0;
    function handleActivity() {
      const now = Date.now();
      if (now - lastActivity < 1000) return;
      lastActivity = now;
      onActivity();
    }

    const events = ['mousemove', 'keydown', 'mousedown', 'touchstart', 'scroll'];
    events.forEach((e) => window.addEventListener(e, handleActivity, { passive: true }));

    // Tab visibility — idle faster when hidden, wake on visible
    function handleVisibility() {
      if (document.hidden) {
        if (!getOverride() && !isIdle) {
          startIdleTimer(HIDDEN_IDLE_TIMEOUT);
        }
      } else {
        onActivity();
      }
    }
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearTimeout(idleTimer);
      socket?.off('connect', onConnect);
      events.forEach((e) => window.removeEventListener(e, handleActivity));
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [active, setStatus]);
}
