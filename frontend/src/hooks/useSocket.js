// src/hooks/useSocket.js
import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';

export function useSocket({ url }) {
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!url) return;
    const s = io(url, { transports: ['websocket'] });
    socketRef.current = s;

    s.on('connect', () => setConnected(true));
    s.on('disconnect', () => setConnected(false));

    return () => {
      s.disconnect();
      socketRef.current = null;
    };
  }, [url]);

  const joinOrder = useCallback((orderId) => {
    socketRef.current?.emit('joinOrder', { orderId });
  }, []);

  const on = useCallback((event, cb) => {
    socketRef.current?.on(event, cb);
    return () => socketRef.current?.off(event, cb);
  }, []);

  return { socket: socketRef.current, connected, joinOrder, on };
}
