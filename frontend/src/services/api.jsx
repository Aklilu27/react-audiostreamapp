import axios from 'axios';

// Use Vite env variable instead of process.env
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL
  || (import.meta.env.PROD ? '/api' : 'http://localhost:5000/api');

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (!error.response) {
      console.error('API Error: Network/No response', error.message);
      return Promise.reject({
        message: 'Network error. Check that the API server is running and VITE_API_BASE_URL is correct.'
      });
    }

    const responseData = error.response?.data;
    const normalizedMessage =
      responseData?.message ||
      responseData?.error ||
      responseData?.errors?.[0]?.msg ||
      responseData?.errors?.[0]?.message ||
      error.message ||
      'An error occurred while contacting the server.';

    // Handle 401 Unauthorized
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/';
    }

    console.error('API Error:', responseData || error.message);
    return Promise.reject(
      typeof responseData === 'object' && responseData !== null
        ? { ...responseData, message: normalizedMessage }
        : { message: normalizedMessage }
    );
  }
);

// Chat API
export const chatService = {
  getMessages: (roomId) => api.get(`chat/${roomId}/messages`),
  sendMessage: (roomId, message) => api.post(`chat/${roomId}/send`, message),
  getRooms: () => api.get('rooms'),
  createRoom: (roomData) => api.post('rooms', roomData),
  getRoom: (roomId) => api.get(`rooms/${roomId}`),
  joinRoom: (roomId, payload) => api.post(`rooms/${roomId}/join`, payload),
  deleteRoom: (roomId) => api.delete(`rooms/${roomId}`),
};

// Auth API
export const authService = {
  login: (credentials) => api.post('auth/login', credentials),
  register: (userData) => api.post('auth/register', userData),
  logout: () => api.post('auth/logout'),
  verifyToken: () => api.get('auth/verify'),
};

// User API
export const userService = {
  getProfile: () => api.get('users/profile'),
  updateProfile: (userData) => api.put('users/profile', userData),
  changePassword: (passwordData) => api.put('users/change-password', passwordData),
};

export default api;
