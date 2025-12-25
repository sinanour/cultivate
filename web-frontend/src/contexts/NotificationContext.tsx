import type { ReactNode } from 'react';
import { createContext, useState, useCallback } from 'react';
import Flashbar, { type FlashbarProps } from '@cloudscape-design/components/flashbar';

type NotificationType = 'success' | 'error' | 'warning' | 'info';

interface Notification {
  id: string;
  type: NotificationType;
  header?: string;
  content: string;
  dismissible?: boolean;
}

interface NotificationContextType {
  showNotification: (type: NotificationType, content: string, header?: string) => void;
  showSuccess: (content: string, header?: string) => void;
  showError: (content: string, header?: string) => void;
  showWarning: (content: string, header?: string) => void;
  showInfo: (content: string, header?: string) => void;
}

export const NotificationContext = createContext<NotificationContextType | null>(null);

interface NotificationProviderProps {
  children: ReactNode;
}

export function NotificationProvider({ children }: NotificationProviderProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const showNotification = useCallback((
    type: NotificationType,
    content: string,
    header?: string
  ) => {
    const id = `notification-${Date.now()}-${Math.random()}`;
    const notification: Notification = {
      id,
      type,
      header,
      content,
      dismissible: true,
    };

    setNotifications((prev) => [...prev, notification]);

    // Auto-dismiss after 5 seconds for non-error notifications
    if (type !== 'error') {
      setTimeout(() => {
        setNotifications((prev) => prev.filter((n) => n.id !== id));
      }, 5000);
    }
  }, []);

  const showSuccess = useCallback((content: string, header?: string) => {
    showNotification('success', content, header);
  }, [showNotification]);

  const showError = useCallback((content: string, header?: string) => {
    showNotification('error', content, header);
  }, [showNotification]);

  const showWarning = useCallback((content: string, header?: string) => {
    showNotification('warning', content, header);
  }, [showNotification]);

  const showInfo = useCallback((content: string, header?: string) => {
    showNotification('info', content, header);
  }, [showNotification]);

  const handleDismiss = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const flashbarItems: FlashbarProps.MessageDefinition[] = notifications.map((notification) => ({
    type: notification.type,
    header: notification.header,
    content: notification.content,
    dismissible: notification.dismissible,
    onDismiss: () => handleDismiss(notification.id),
    id: notification.id,
  }));

  const value = {
    showNotification,
    showSuccess,
    showError,
    showWarning,
    showInfo,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
      <div style={{ position: 'fixed', top: '60px', right: '20px', zIndex: 1000, maxWidth: '400px' }}>
        <Flashbar items={flashbarItems} />
      </div>
    </NotificationContext.Provider>
  );
}
