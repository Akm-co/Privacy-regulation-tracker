import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';
import toast from 'react-hot-toast';

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const { user, isAuthenticated } = useAuth();

  // Initialize socket connection
  useEffect(() => {
    const socketInstance = io(window.location.origin, {
      auth: {
        token: localStorage.getItem('accessToken')
      },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    });

    socketInstance.on('connect', () => {
      console.log('Socket connected');
      setConnected(true);
    });

    socketInstance.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      setConnected(false);
    });

    socketInstance.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      setConnected(false);
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, []);

  // Update auth token when user changes
  useEffect(() => {
    if (socket && isAuthenticated) {
      socket.auth = { token: localStorage.getItem('accessToken') };
      socket.disconnect().connect();
    }
  }, [socket, isAuthenticated]);

  // Subscribe to user channels when authenticated
  useEffect(() => {
    if (!socket || !isAuthenticated || !user) return;

    // Subscribe to region updates
    if (user.preferences?.watchedRegions?.length) {
      socket.emit('subscribe', user.preferences.watchedRegions.map(r => `region:${r}`));
    }
  }, [socket, isAuthenticated, user]);

  // Handle real-time updates
  useEffect(() => {
    if (!socket) return;

    // New regulatory update
    socket.on('update:new', (update) => {
      const isHighImpact = ['high', 'critical'].includes(update.impactLevel);

      // Show toast for high-impact updates
      if (isHighImpact) {
        toast(
          <div className="flex items-start gap-3">
            <div className={`mt-1 w-2 h-2 rounded-full ${
              update.impactLevel === 'critical' ? 'bg-red-500' : 'bg-orange-500'
            }`} />
            <div>
              <p className="font-medium">{update.title}</p>
              <p className="text-sm text-gray-400">
                {update.regions?.map(r => r.code).join(', ')}
              </p>
            </div>
          </div>,
          {
            duration: 6000,
            position: 'top-right',
            icon: null
          }
        );
      }

      // Add to notifications
      setNotifications(prev => [
        {
          id: update.id,
          type: 'update',
          title: update.title,
          message: update.summary?.substring(0, 100),
          impactLevel: update.impactLevel,
          timestamp: new Date(),
          read: false
        },
        ...prev.slice(0, 49) // Keep last 50
      ]);
      setUnreadCount(prev => prev + 1);
    });

    // New enforcement
    socket.on('enforcement:new', (enforcement) => {
      toast(
        <div>
          <p className="font-medium">New Enforcement Action</p>
          <p className="text-sm">{enforcement.company}: ${enforcement.fineAmountUSD?.toLocaleString()}</p>
        </div>,
        { duration: 5000 }
      );

      setNotifications(prev => [
        {
          id: enforcement.id,
          type: 'enforcement',
          title: `${enforcement.company} - Fine`,
          message: `$${enforcement.fineAmountUSD?.toLocaleString()} by ${enforcement.authority}`,
          timestamp: new Date(),
          read: false
        },
        ...prev.slice(0, 49)
      ]);
      setUnreadCount(prev => prev + 1);
    });

    // User-specific notifications
    socket.on('notification', (notification) => {
      setNotifications(prev => [
        { ...notification, read: false },
        ...prev.slice(0, 49)
      ]);
      setUnreadCount(prev => prev + 1);

      toast(notification.title, {
        duration: 4000,
        icon: notification.icon || null
      });
    });

    return () => {
      socket.off('update:new');
      socket.off('enforcement:new');
      socket.off('notification');
    };
  }, [socket]);

  // Subscribe to a channel
  const subscribe = useCallback((channels) => {
    if (socket && connected) {
      socket.emit('subscribe', channels);
    }
  }, [socket, connected]);

  // Unsubscribe from a channel
  const unsubscribe = useCallback((channels) => {
    if (socket && connected) {
      socket.emit('unsubscribe', channels);
    }
  }, [socket, connected]);

  // Mark notifications as read
  const markAsRead = useCallback((notificationId) => {
    setNotifications(prev =>
      prev.map(n =>
        n.id === notificationId ? { ...n, read: true } : n
      )
    );
    setUnreadCount(prev => Math.max(0, prev - 1));
  }, []);

  // Mark all as read
  const markAllAsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
  }, []);

  // Clear notifications
  const clearNotifications = useCallback(() => {
    setNotifications([]);
    setUnreadCount(0);
  }, []);

  const value = {
    socket,
    connected,
    notifications,
    unreadCount,
    subscribe,
    unsubscribe,
    markAsRead,
    markAllAsRead,
    clearNotifications
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
}
