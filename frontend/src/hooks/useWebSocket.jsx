import { useEffect, useRef, useCallback } from 'react';
import { useDispatch } from 'react-redux';
import { addMessage, setConnectionStatus } from '../store/slices/chatSlice';

const useWebSocket = (url) => {
  const socketRef = useRef(null);
  const dispatch = useDispatch();

  const connect = useCallback(() => {
    socketRef.current = new WebSocket(url);

    socketRef.current.onopen = () => {
      console.log('WebSocket connected');
      dispatch(setConnectionStatus(true));
    };

    socketRef.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      dispatch(addMessage(data));
    };

    socketRef.current.onclose = () => {
      console.log('WebSocket disconnected');
      dispatch(setConnectionStatus(false));
    };

    socketRef.current.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  }, [url, dispatch]);

  const sendMessage = useCallback((message) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(message));
    }
  }, []);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.close();
    }
  }, []);

  useEffect(() => {
    connect();
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return { sendMessage, disconnect };
};

export default useWebSocket;