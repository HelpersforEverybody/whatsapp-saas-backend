// frontend/src/hooks/useSocket.js
import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';

// picks backend from runtime or build-time
const getBackendUrl = () => {
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE) return import.meta.env.VITE_API_BASE;
  if (typeof window !== 'undefined' && window.__API_BASE) return window.__API_BASE;
  return 'https://whatsapp-saas-backend-f9ot.onrender.com';
};

export function useSocket({ url } = {}) {
  const backend = url || getBackendUrl();
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const listenersRef = useRef(new Map()); // event -> Set(cb)

  useEffect(() => {
    // create socket instance
    try {
      socketRef.current = io(backend, {
        path: '/socket.io',
        transports: ['websocket', 'polling'],
        autoConnect: true,
      });
    } catch (e) {
      console.error('Socket init error', e);
      return () => {};
    }

    const s = socketRef.current;

    s.on('connect', () => {
      setConnected(true);
      console.info('Socket connected', s.id);
    });
    s.on('disconnect', (reason) => {
      setConnected(false);
      console.info('Socket disconnected', reason);
    });
    s.on('connect_error', (err) => {
      console.warn('Socket connect_error', err && err.message);
    });

    // global dispatcher for any events we subscribe to
    s.onAny((eventName, payload) => {
      const callbacks = listenersRef.current.get(eventName);
      if (callbacks && callbacks.size) {
        callbacks.forEach(cb => {
          try { cb(payload); } catch (e) { console.error('socket listener error', e); }
        });
      }
    });

    // cleanup
    return () => {
      try {
        s.off();
        s.disconnect();
      } catch (e) {}
      socketRef.current = null;
      setConnected(false);
    };
  }, [backend]);

  const joinOrder = useCallback((orderId) => {
    if (!socketRef.current) return;
    socketRef.current.emit('joinOrder', { orderId });
  }, []);

  const leaveOrder = useCallback((orderId) => {
    if (!socketRef.current) return;
    try {
      socketRef.current.emit('leaveOrder', { orderId });
    } catch (e) {}
  }, []);

  // on(event, cb) returns an unsubscribe function
  const on = useCallback((eventName, cb) => {
    if (!listenersRef.current.has(eventName)) listenersRef.current.set(eventName, new Set());
    listenersRef.current.get(eventName).add(cb);

    // return cleanup
    return () => {
      const s = listenersRef.current.get(eventName);
      if (!s) return;
      s.delete(cb);
      if (s.size === 0) listenersRef.current.delete(eventName);
    };
  }, []);

  return {
    socket: socketRef.current,
    connected,
    joinOrder,
    leaveOrder,
    on,
  };
}
