'use client';

import { useEffect, useRef } from 'react';
import { presenceApi, freightdeskApi, type FreightdeskContainerSession } from '@/lib/api';
import {
  alarmWithVoice,
  playChime,
  speak,
  notify,
  primeAudio,
  requestNotifyPermission
} from '@/lib/alarm';

/**
 * Global dashboard alert watcher. Mounted once in the DAT GO admin layout on every authenticated page.
 * This is why you hear the FD-container alerts while viewing the Cookies page and vice-versa.
 *
 * It watches two things and raises sound + voice + a desktop notification, de-duplicated so
 * nothing repeats until the condition clears and recurs:
 *   1. Session-death alerts  — > N users kicked off the same cookie (urgent alarm).
 *   2. New importable FD containers — new/changed cookies you can import (chime).
 *
 * The desktop notification fires even when the browser tab is in the background (as long as
 * a tab stays open), so an admin without headphones still sees it on their PC.
 */
export default function AlertsWatcher() {
  const seenDead = useRef<Set<string>>(new Set());
  const announcedImportable = useRef<Set<string>>(new Set());
  const importableSeeded = useRef(false);

  // Prime audio + ask for notification permission on the first interaction (one-time).
  useEffect(() => {
    const prime = () => {
      primeAudio();
      requestNotifyPermission();
    };
    requestNotifyPermission();
    window.addEventListener('pointerdown', prime, { once: true });
    window.addEventListener('keydown', prime, { once: true });
    return () => {
      window.removeEventListener('pointerdown', prime);
      window.removeEventListener('keydown', prime);
    };
  }, []);

  // Session-death alerts (poll every 10s).
  useEffect(() => {
    let stop = false;
    const tick = async () => {
      try {
        const status = await presenceApi.live();
        if (stop) return;
        const active = new Set(status.alerts.map((a) => a.cookieId));
        for (const a of status.alerts) {
          if (!seenDead.current.has(a.cookieId)) {
            seenDead.current.add(a.cookieId);
            const name = a.fileName || 'account';
            alarmWithVoice(`Warning. ${a.deadUsers} users logged out from cookie ${name}. Please switch the cookie.`);
            notify('⚠ DAT session logout alert', `${a.deadUsers} users logged out from ${name}. Switch this cookie to a working one.`, `dead:${a.cookieId}`);
          }
        }
        for (const k of Array.from(seenDead.current)) {
          if (!active.has(k)) seenDead.current.delete(k);
        }
      } catch {
        // ignore transient errors
      }
    };
    tick();
    const id = setInterval(tick, 10000);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, []);

  // New / changed FD containers to import (poll every 20s).
  useEffect(() => {
    let stop = false;
    const importable = (list: FreightdeskContainerSession[]) =>
      list.filter((s) => s.changeStatus === 'new' || s.changeStatus === 'changed').map((s) => s.container);
    const tick = async () => {
      try {
        const data = await freightdeskApi.getSessions();
        if (stop) return;
        const list = data.sessions || [];
        const now = importable(list);
        const nowSet = new Set(now);
        if (!importableSeeded.current) {
          // Seed on first run so existing importable containers don't all announce at once.
          importableSeeded.current = true;
        } else {
          const fresh = now.filter((c) => !announcedImportable.current.has(c));
          if (fresh.length) {
            playChime();
            const msg =
              `${fresh.length} new cookie${fresh.length > 1 ? 's' : ''} available to import: ` +
              `${fresh.slice(0, 8).join(', ')}${fresh.length > 8 ? '…' : ''}. You can import them from FD Containers.`;
            speak(msg);
            notify('🍪 New DAT cookies to import', msg, 'fd-new');
          }
        }
        announcedImportable.current = nowSet;
      } catch {
        // ignore transient errors
      }
    };
    tick();
    const id = setInterval(tick, 20000);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, []);

  return null;
}
