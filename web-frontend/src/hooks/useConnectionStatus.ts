import { useState, useEffect } from 'react';
import { ConnectionMonitor } from '../services/offline/connection-monitor.service';

export function useConnectionStatus() {
  const [isOnline, setIsOnline] = useState(ConnectionMonitor.isOnline());

  useEffect(() => {
    // Initialize connection monitor
    ConnectionMonitor.initialize();

    // Subscribe to connection changes
    const unsubscribe = ConnectionMonitor.subscribe((online) => {
      setIsOnline(online);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  return { isOnline };
}
