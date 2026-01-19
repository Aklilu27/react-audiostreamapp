import { createSlice } from '@reduxjs/toolkit';

const roomSlice = createSlice({
  name: 'room',
  initialState: {
    currentRoom: null,
    rooms: [],
    participants: [],
  },
  reducers: {
    setCurrentRoom: (state, action) => {
      state.currentRoom = action.payload;
    },
    setRooms: (state, action) => {
      state.rooms = action.payload;
    },
    addParticipant: (state, action) => {
      state.participants.push(action.payload);
    },
  },
});

export const { setCurrentRoom, setRooms, addParticipant } = roomSlice.actions;
export default roomSlice.reducer;