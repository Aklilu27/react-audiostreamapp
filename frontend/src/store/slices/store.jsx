import { configureStore } from '@reduxjs/toolkit';
import chatReducer from './chatSlice';
import roomReducer from './roomSlice';
import authReducer from './authSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    chat: chatReducer,
    room: roomReducer,
  },
});