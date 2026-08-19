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

function sendCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function roomSummary(r) {
  return {
    id: r.id,
    name: r.name,
    host: r.host,
    passwordRequired: !!r.password,
    memberCount: r.memberCount || 0,
    createdAt: r.createdAt,
  };
}

export default function handler(req, res) {
  sendCors(res);

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  cleanupStale();

  const { id } = req.query;

  if (req.method === "GET" && id) {
    const room = globalRooms[id];
    if (!room) {
      return res.status(404).json({ error: "Room not found" });
    }
    return res.status(200).json({
      room: { ...roomSummary(room), bridgeUrl: room.bridgeUrl },
    });
  }

  if (req.method === "GET") {
    const list = Object.values(globalRooms).map(roomSummary);
    return res.status(200).json({ rooms: list });
  }

  if (req.method === "POST") {
    const { name, host, password, bridgeUrl } = req.body;

    if (!name || !bridgeUrl) {
      return res.status(400).json({ error: "name and bridgeUrl required" });
    }

    const rid = crypto.randomBytes(8).toString("hex");
    const secret = crypto.randomBytes(16).toString("hex");

    globalRooms[rid] = {
      id: rid,
      name,
      host: host || "Anonymous",
      password: password || null,
      bridgeUrl,
      memberCount: 0,
      secret,
      createdAt: Date.now(),
      lastHeartbeat: Date.now(),
    };

    return res.status(201).json({ room: globalRooms[rid] });
  }

  if ((req.method === "PUT" || req.method === "DELETE") && id) {
    const room = globalRooms[id];
    if (!room) {
      return res.status(404).json({ error: "Room not found" });
    }

    if (req.method === "DELETE") {
      delete globalRooms[id];
      return res.status(200).json({ ok: true });
    }

    const { memberCount, secret } = req.body || {};

    if (room.secret && room.secret !== secret) {
      return res.status(403).json({ error: "Invalid secret" });
    }

    if (typeof memberCount === "number") {
      room.memberCount = memberCount;
    }
    room.lastHeartbeat = Date.now();

    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
