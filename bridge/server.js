const http = require("http");
const { WebSocketServer } = require("ws");
const crypto = require("crypto");
const url = require("url");

const BRIDGE_PORT = process.env.BRIDGE_PORT || 3001;
const ROOM_PASSWORD = process.env.ROOM_PASSWORD || null;
const ROOM_NAME = process.env.ROOM_NAME || "Chat Room";
const ROOM_HOST = process.env.ROOM_HOST || "Anonymous";

const MAX_HISTORY = 50;

let activeConnections = 0;
let clients = new Map();
let messageHistory = [];
let typingTimers = new Map();

function broadcast(msg, excludeWs) {
  const data = JSON.stringify(msg);
  for (const [ws] of clients) {
    if (ws !== excludeWs && ws.readyState === ws.OPEN) {
      ws.send(data);
    }
  }
}

function broadcastAll(msg) {
  const data = JSON.stringify(msg);
  for (const [ws] of clients) {
    if (ws.readyState === ws.OPEN) {
      ws.send(data);
    }
  }
}

function getUserList() {
  return Array.from(clients.values()).map((c) => c.name);
}

function timestamp() {
  const now = new Date();
  return now.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

const server = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(200);
    return res.end();
  }

  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(
      JSON.stringify({
        status: "ok",
        connections: activeConnections,
        uptime: process.uptime(),
      })
    );
  }

  if (req.url === "/room") {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(
      JSON.stringify({
        name: ROOM_NAME,
        host: ROOM_HOST,
        passwordRequired: !!ROOM_PASSWORD,
        memberCount: activeConnections,
        uptime: Math.floor(process.uptime()),
      })
    );
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not found" }));
});

const wss = new WebSocketServer({ server });

wss.on("connection", (ws, req) => {
  let authenticated = false;

  const timeout = setTimeout(() => {
    if (!authenticated) {
      ws.close(4002, "Authentication timeout");
    }
  }, 5000);

  ws.on("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return ws.send(JSON.stringify({ type: "error", text: "Invalid message" }));
    }

    if (!authenticated) {
      if (msg.type !== "auth") {
        return ws.send(JSON.stringify({ type: "error", text: "Send auth first" }));
      }

      const name = (msg.name || "").trim().slice(0, 20) || "Anonymous";

      if (ROOM_PASSWORD) {
        const clientHash = crypto
          .createHash("sha256")
          .update((msg.pw || "").trim())
          .digest("hex")
          .slice(0, 16);
        if (clientHash !== ROOM_PASSWORD) {
          clearTimeout(timeout);
          return ws.close(4001, "Incorrect password");
        }
      }

      clearTimeout(timeout);
      authenticated = true;
      activeConnections++;
      clients.set(ws, { name });

      console.log(
        `[chat] ${name} joined (${activeConnections} online)`
      );

      const history = messageHistory.slice(-MAX_HISTORY);

      ws.send(
        JSON.stringify({
          type: "welcome",
          name,
          users: getUserList(),
          messages: history,
          room: { name: ROOM_NAME, host: ROOM_HOST },
        })
      );

      broadcastAll({
        type: "join",
        user: name,
        users: getUserList(),
        time: timestamp(),
      });

      return;
    }

    if (msg.type === "message") {
      const text = (msg.text || "").trim();
      if (!text || text.length > 2000) return;

      const user = clients.get(ws).name;
      const chatMsg = {
        type: "message",
        user,
        text,
        time: timestamp(),
      };

      messageHistory.push(chatMsg);
      if (messageHistory.length > MAX_HISTORY) {
        messageHistory = messageHistory.slice(-MAX_HISTORY);
      }

      broadcastAll(chatMsg);

      if (typingTimers.has(user)) {
        clearTimeout(typingTimers.get(user));
        typingTimers.delete(user);
      }
      return;
    }

    if (msg.type === "typing") {
      const user = clients.get(ws).name;

      broadcast(
        { type: "typing", user },
        ws
      );

      if (typingTimers.has(user)) {
        clearTimeout(typingTimers.get(user));
      }
      typingTimers.set(
        user,
        setTimeout(() => {
          typingTimers.delete(user);
          broadcast({ type: "typing-stop", user });
        }, 3000)
      );
      return;
    }
  });

  ws.on("close", () => {
    const info = clients.get(ws);
    if (info) {
      activeConnections--;
      const user = info.name;
      clients.delete(ws);
      console.log(
        `[chat] ${user} left (${activeConnections} online)`
      );

      if (typingTimers.has(user)) {
        clearTimeout(typingTimers.get(user));
        typingTimers.delete(user);
      }

      broadcastAll({
        type: "leave",
        user,
        users: getUserList(),
        time: timestamp(),
      });
    }
  });

  ws.on("error", (err) => {
    console.error("[chat] WebSocket error:", err.message);
  });
});

server.listen(BRIDGE_PORT, () => {
  console.log(`[chat] Chat server listening on port ${BRIDGE_PORT}`);
  console.log(`[chat] Password protection: ${ROOM_PASSWORD ? "ON" : "OFF"}`);
});
