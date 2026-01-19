export const API_ENDPOINTS = {
  CHAT: {
    MESSAGES: '/chat/messages',
    SEND: '/chat/send',
  },
  ROOMS: {
    LIST: '/rooms',
    CREATE: '/rooms',
    JOIN: '/rooms/join',
  },
  AUTH: {
    LOGIN: '/auth/login',
    REGISTER: '/auth/register',
    LOGOUT: '/auth/logout',
  },
};

export const WEBSOCKET_CONFIG = {
  URL: import.meta.env.VITE_WS_URL || 'ws://localhost:8080',
  RECONNECT_INTERVAL: 5000,
  MAX_RECONNECT_ATTEMPTS: 10,
};

export const MESSAGE_TYPES = {
  TEXT: 'text',
  IMAGE: 'image',
  FILE: 'file',
  SYSTEM: 'system',
};