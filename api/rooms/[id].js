import crypto from "crypto";

const globalRooms = globalThis.__roomStore || (globalThis.__roomStore = {});

export default function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const { id } = req.query;

  if (!id) {
    return res.status(400).json({ error: "Room ID required" });
  }

  if (req.method === "GET") {
    const room = globalRooms[id];
    if (!room) {
      return res.status(404).json({ error: "Room not found" });
    }
    return res.status(200).json({
      room: {
        id: room.id,
        name: room.name,
        host: room.host,
        passwordRequired: !!room.password,
        memberCount: room.memberCount || 0,
        bridgeUrl: room.bridgeUrl,
        createdAt: room.createdAt,
      },
    });
  }

  if (req.method === "PUT") {
    const { memberCount, secret } = req.body;
    const room = globalRooms[id];

    if (!room) {
      return res.status(404).json({ error: "Room not found" });
    }

    if (room.secret && room.secret !== secret) {
      return res.status(403).json({ error: "Invalid secret" });
    }

    if (typeof memberCount === "number") {
      room.memberCount = memberCount;
    }
    room.lastHeartbeat = Date.now();

    return res.status(200).json({ ok: true });
  }

  if (req.method === "DELETE") {
    const room = globalRooms[id];
    if (!room) {
      return res.status(204).end();
    }
    delete globalRooms[id];
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
