const roomAccess = new Map();

const grantAccess = (roomId, userId) => {
  if (!roomAccess.has(roomId)) {
    roomAccess.set(roomId, new Set());
  }
  roomAccess.get(roomId).add(userId.toString());
};

const hasAccess = (roomId, userId) => {
  const set = roomAccess.get(roomId);
  if (!set) return false;
  return set.has(userId.toString());
};

const revokeAccess = (roomId, userId) => {
  const set = roomAccess.get(roomId);
  if (!set) return;
  set.delete(userId.toString());
  if (set.size === 0) {
    roomAccess.delete(roomId);
  }
};

const clearRoomAccess = (roomId) => {
  roomAccess.delete(roomId);
};

module.exports = {
  grantAccess,
  hasAccess,
  revokeAccess,
  clearRoomAccess
};
