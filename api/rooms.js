import crypto from "crypto";

const globalRooms = globalThis.__roomStore || (globalThis.__roomStore = {});

function hashPassword(pw) {
  return crypto.createHash("sha256").update(pw).digest("hex").slice(0, 16);
}

function cleanupStale() {
  const now = Date.now();
  for (const [id, room] of Object.entries(globalRooms)) {
    if (now - room.lastHeartbeat > 30000) {
      delete globalRooms[id];
    }
  }
}

export default function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  cleanupStale();

  if (req.method === "GET") {
    const { id } = req.query;

    if (id) {
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

    const list = Object.values(globalRooms).map((r) => ({
      id: r.id,
      name: r.name,
      host: r.host,
      passwordRequired: !!r.password,
      memberCount: r.memberCount || 0,
      createdAt: r.createdAt,
    }));
    return res.status(200).json({ rooms: list });
  }

  if (req.method === "POST") {
    const { name, host, password, bridgeUrl } = req.body;

    if (!name || !bridgeUrl) {
      return res.status(400).json({ error: "name and bridgeUrl required" });
    }

    const id = crypto.randomBytes(8).toString("hex");
    const secret = crypto.randomBytes(16).toString("hex");

    globalRooms[id] = {
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

    return res.status(201).json({ room: globalRooms[id] });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
