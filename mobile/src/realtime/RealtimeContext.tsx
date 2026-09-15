import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { AlertItem, TelemetryItem, WebSocketMessage } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { config } from '../config';

interface RealtimeContextType {
  isConnected: boolean;
  latestTelemetry: Record<number, TelemetryItem>;
  recentAlerts: AlertItem[];
  clearAlerts: () => void;
  removeAlert: (item: AlertItem) => void;
  reconnect: () => void;
}

const RealtimeContext = createContext<RealtimeContextType | undefined>(undefined);

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const { token, user } = useAuth();
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [latestTelemetry, setLatestTelemetry] = useState<
    Record<number, TelemetryItem>
  >({});
  const [recentAlerts, setRecentAlerts] = useState<AlertItem[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const backoffRef = useRef<number>(1000);

  const clearAlerts = useCallback(() => {
    setRecentAlerts([]);
  }, []);

  const removeAlert = useCallback((item: AlertItem) => {
    setRecentAlerts((prev) =>
      prev.filter((a) => {
        if (item.id && a.id) return a.id !== item.id;
        return !(
          a.device_id === item.device_id &&
          a.metric === item.metric &&
          a.timestamp === item.timestamp
        );
      })
    );
  }, []);

  const connect = useCallback(() => {
    if (!token || !user) return;

    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {
        // Ignored
      }
      wsRef.current = null;
    }

    const wsUrl = config.wsBaseUrl.replace(/^http/, 'ws');
    const fullUrl = `${wsUrl}/ws?token=${encodeURIComponent(token)}`;

    try {
      const ws = new WebSocket(fullUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        backoffRef.current = 1000;
      };

      ws.onmessage = (event) => {
        try {
          const msg: WebSocketMessage = JSON.parse(event.data);

          if (msg.type === 'telemetry' && msg.data) {
            const telemetry: TelemetryItem = {
              ...msg.data,
              device_id: msg.device_id,
              device_code: msg.device_code,
              timestamp: msg.data.timestamp || new Date().toISOString(),
            };

            setLatestTelemetry((prev) => ({
              ...prev,
              [msg.device_id]: telemetry,
            }));

            // If there are inline alerts in the telemetry packet
            if (msg.alerts && msg.alerts.length > 0) {
              setRecentAlerts((prev) => [...msg.alerts!, ...prev].slice(0, 100));
            }
          } else if (msg.type === 'alert') {
            if (msg.alerts && msg.alerts.length > 0) {
              setRecentAlerts((prev) => [...msg.alerts!, ...prev].slice(0, 100));
            } else if (msg.data) {
              const alertItem: AlertItem = {
                device_id: msg.device_id,
                device_code: msg.device_code,
                metric: msg.data.metric || 'alert',
                value: msg.data.value || 0,
                threshold: msg.data.threshold,
                rule_type: msg.data.rule_type,
                severity: msg.data.severity || 'warning',
                message: msg.data.message || 'Cảnh báo vi phạm ngưỡng',
                timestamp: msg.data.timestamp || new Date().toISOString(),
              };
              setRecentAlerts((prev) => [alertItem, ...prev].slice(0, 100));
            }
          }
        } catch {
          // Parse error ignored
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        wsRef.current = null;
        scheduleReconnect();
      };

      ws.onerror = () => {
        setIsConnected(false);
      };
    } catch {
      scheduleReconnect();
    }
  }, [token, user]);

  const scheduleReconnect = useCallback(() => {
    if (!token) return;
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    const nextDelay = Math.min(backoffRef.current * 1.5, 30000);
    backoffRef.current = nextDelay;
    reconnectTimeoutRef.current = setTimeout(() => {
      connect();
    }, nextDelay);
  }, [token, connect]);

  const reconnect = useCallback(() => {
    backoffRef.current = 1000;
    connect();
  }, [connect]);

  useEffect(() => {
    if (token && user) {
      connect();
    } else {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      setIsConnected(false);
      setLatestTelemetry({});
      setRecentAlerts([]);
    }

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [token, user, connect]);

  return (
    <RealtimeContext.Provider
      value={{
        isConnected,
        latestTelemetry,
        recentAlerts,
        clearAlerts,
        removeAlert,
        reconnect,
      }}
    >
      {children}
    </RealtimeContext.Provider>
  );
}

export function useRealtime(): RealtimeContextType {
  const context = useContext(RealtimeContext);
  if (!context) {
    throw new Error('useRealtime must be used within a RealtimeProvider');
  }
  return context;
}
