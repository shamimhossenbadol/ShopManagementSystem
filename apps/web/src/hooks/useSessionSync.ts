'use client';

import { useEffect, useRef } from 'react';
import { apiRequest } from '@/lib/api';

export function useSessionSync() {
  const isRedirectingRef = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    let eventSource: EventSource | null = null;
    let heartbeatTimer: NodeJS.Timeout | null = null;

    const handleKickout = (reason: 'superseded' | 'logout') => {
      if (isRedirectingRef.current) return;
      isRedirectingRef.current = true;

      // Only broadcast and wipe cookies if the user explicitly performed a manual logout.
      // When a session is SUPERSEDED, another window/tab has just logged in with a fresh valid session.
      // Wiping cookies or broadcasting AUTH_LOGOUT would sabotage the newly active tab!
      if (reason === 'logout') {
        try {
          if (window.BroadcastChannel) {
            const ch = new BroadcastChannel('shop_pos_auth_sync');
            ch.postMessage({ type: 'AUTH_LOGOUT', reason });
            ch.close();
          }
          localStorage.setItem('shop_auth_sync_logout', Date.now().toString());
          localStorage.removeItem('auth_token');
        } catch {
          // ignore
        }
        document.cookie = 'auth_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; max-age=0;';
      }

      const param = reason === 'superseded' ? 'superseded=true' : 'logout=true';
      window.location.replace(`/login?${param}`);
    };

    // 1. Real-Time SSE Push Connection
    try {
      eventSource = new EventSource('/api/v1/auth/session-events');

      eventSource.addEventListener('SESSION_SUPERSEDED', () => {
        handleKickout('superseded');
      });

      eventSource.addEventListener('SESSION_TERMINATED', () => {
        handleKickout('logout');
      });

      eventSource.onerror = () => {
        // EventSource will auto-reconnect; heartbeat acts as fallback
      };
    } catch {
      // EventSource unsupported or blocked
    }

    // 2. Low-Latency 3-Second Heartbeat Backup
    const checkHeartbeat = async () => {
      if (isRedirectingRef.current) return;
      const res = await apiRequest('/auth/heartbeat');
      if (!res.success && (res.code === 'SESSION_SUPERSEDED' || res.message?.includes('logged out'))) {
        handleKickout('superseded');
      }
    };

    heartbeatTimer = setInterval(checkHeartbeat, 3000);

    return () => {
      if (eventSource) {
        eventSource.close();
      }
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
      }
    };
  }, []);
}
