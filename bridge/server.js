const http = require("http");
const { WebSocketServer } = require("ws");
const { Client } = require("ssh2");
const crypto = require("crypto");
const url = require("url");

const BRIDGE_PORT = process.env.BRIDGE_PORT || 3001;
const SSH_HOST = process.env.SSH_HOST || "127.0.0.1";
const SSH_PORT = process.env.SSH_PORT || 2222;
const ROOM_PASSWORD = process.env.ROOM_PASSWORD || null;
const ROOM_NAME = process.env.ROOM_NAME || "Chat Room";
const ROOM_HOST = process.env.ROOM_HOST || "Anonymous";

let activeConnections = 0;

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
  const params = url.parse(req.url, true).query;
  const clientPassword = params.pw || "";

  if (ROOM_PASSWORD) {
    const hash = crypto
      .createHash("sha256")
      .update(clientPassword)
      .digest("hex")
      .slice(0, 16);
    if (hash !== ROOM_PASSWORD) {
      ws.close(4001, "Incorrect password");
      return;
    }
  }

  activeConnections++;
  console.log(
    `[bridge] Client connected (${activeConnections} active)`
  );

  const sshConn = new Client();

  sshConn.on("ready", () => {
    console.log("[bridge] SSH connection ready");

    sshConn.shell({ term: "xterm-256color" }, (err, stream) => {
      if (err) {
        console.error("[bridge] Shell error:", err.message);
        ws.close(1011, "Shell error");
        return;
      }

      stream.on("close", () => {
        console.log("[bridge] SSH stream closed");
        ws.close(1000, "SSH stream closed");
      });

      stream.stderr.on("data", (data) => {
        ws.send(data.toString());
      });

      ws.on("message", (data) => {
        const msg = data.toString();
        stream.write(msg);
      });

      stream.on("data", (data) => {
        if (ws.readyState === ws.OPEN) {
          ws.send(data.toString());
        }
      });
    });
  });

  sshConn.on("error", (err) => {
    console.error("[bridge] SSH error:", err.message);
    if (ws.readyState === ws.OPEN) {
      ws.close(1011, "SSH connection failed: " + err.message);
    }
  });

  sshConn.on("close", () => {
    console.log("[bridge] SSH connection closed");
  });

  sshConn.connect({
    host: SSH_HOST,
    port: SSH_PORT,
    username: "chat",
    password: "chat",
    readyTimeout: 10000,
    algorithms: {
      kex: [
        "ecdh-sha2-nistp256",
        "ecdh-sha2-nistp384",
        "ecdh-sha2-nistp521",
        "diffie-hellman-group-exchange-sha256",
        "diffie-hellman-group14-sha256",
        "diffie-hellman-group14-sha1",
      ],
    },
  });

  ws.on("close", (code, reason) => {
    activeConnections--;
    console.log(
      `[bridge] Client disconnected (code: ${code}, ${activeConnections} active)`
    );
    sshConn.end();
  });

  ws.on("error", (err) => {
    console.error("[bridge] WebSocket error:", err.message);
    activeConnections--;
    sshConn.end();
  });
});

server.listen(BRIDGE_PORT, () => {
  console.log(`[bridge] WebSocket bridge listening on port ${BRIDGE_PORT}`);
  console.log(`[bridge] Connecting to SSH at ${SSH_HOST}:${SSH_PORT}`);
  console.log(`[bridge] Password protection: ${ROOM_PASSWORD ? "ON" : "OFF"}`);
});
