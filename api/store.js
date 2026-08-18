const rooms = {};

function getRoom(id) {
  return rooms[id] || null;
}

function getAllRooms() {
  const now = Date.now();
  for (const [id, room] of Object.entries(rooms)) {
    if (now - room.lastHeartbeat > 30000) {
      delete rooms[id];
    }
  }
  return Object.values(rooms).map((r) => ({
    id: r.id,
    name: r.name,
    host: r.host,
    passwordRequired: !!r.password,
    memberCount: r.memberCount || 0,
    createdAt: r.createdAt,
  }));
}

function createRoom({ id, name, host, password, bridgeUrl, secret }) {
  rooms[id] = {
    id,
    name,
    host: host || "Anonymous",
    password: password || null,
    bridgeUrl,
    memberCount: 0,
    secret,
    createdAt: Date.now(),
    lastHeartbeat: Date.now(),
  };
  return rooms[id];
}

function updateRoom(id, updates) {
  if (!rooms[id]) return null;
  Object.assign(rooms[id], updates, { lastHeartbeat: Date.now() });
  return rooms[id];
}

function deleteRoom(id) {
  delete rooms[id];
}

module.exports = { getRoom, getAllRooms, createRoom, updateRoom, deleteRoom };
