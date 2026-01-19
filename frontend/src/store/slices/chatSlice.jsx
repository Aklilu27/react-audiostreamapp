import { createSlice } from '@reduxjs/toolkit';

const chatSlice = createSlice({
  name: 'chat',
  initialState: {
    messages: [],
    users: [],
    isConnected: false,
  },
  reducers: {
    addMessage: (state, action) => {
      state.messages.push(action.payload);
    },
    setUsers: (state, action) => {
      state.users = action.payload;
    },
    setConnectionStatus: (state, action) => {
      state.isConnected = action.payload;
    },
  },
});

export const { addMessage, setUsers, setConnectionStatus } = chatSlice.actions;
export default chatSlice.reducer;