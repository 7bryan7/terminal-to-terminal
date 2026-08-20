#!/usr/bin/env node

const { execSync, spawn } = require("child_process");
const crypto = require("crypto");
const https = require("https");
const http = require("http");
const path = require("path");
const fs = require("fs");
const { install: installCloudflared, bin: cloudflaredBin } = require("cloudflared");

const args = process.argv.slice(2);
const command = args[0];

function parseArg(flag) {
  const idx = args.indexOf(flag);
  if (idx !== -1 && idx + 1 < args.length) return args[idx + 1];
  return null;
}

function printUsage() {
  console.log(`
  SSH Chat Web - Room Management CLI

  Usage:
    npx bryanterminalsshchat create [options]   Create and host a chat room
    npx bryanterminalsshchat stop               Stop the current room

  Create Options:
    --name <name>       Room name (required)
    --password <pw>     Room password (optional)
    --host <name>       Your display name (default: Anonymous)
    --bridge-port <port> Chat server port (default: 3001)
    --api <url>         Registry API URL

  Examples:
    npx bryanterminalsshchat create --name "Study Group" --password secret123
    npx bryanterminalsshchat create --name "Project Chat" --host Alice
  `);
}

function hashPassword(pw) {
  return crypto.createHash("sha256").update(pw).digest("hex").slice(0, 16);
}

function apiUrl() {
  return new URL(parseArg("--api") || "https://terminal-to-terminal.vercel.app");
}

function apiRequest(method, apiPath, data) {
  return new Promise((resolve, reject) => {
    const base = apiUrl();
    const body = data ? JSON.stringify(data) : null;
    const isHttps = base.protocol === "https:";
    const transport = isHttps ? https : http;

    const options = {
      hostname: base.hostname,
      port: base.port || (isHttps ? 443 : 80),
      path: apiPath,
      method,
      headers: {
        "Content-Type": "application/json",
        ...(body ? { "Content-Length": Buffer.byteLength(body) } : {}),
      },
    };

    const req = transport.request(options, (res) => {
      let result = "";
      res.on("data", (chunk) => (result += chunk));
      res.on("end", () => {
        try {
          resolve(JSON.parse(result));
        } catch {
          resolve({ raw: result });
        }
      });
    });
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

async function createRoom() {
  const roomName = parseArg("--name");
  const password = parseArg("--password");
  const hostName = parseArg("--host") || "Anonymous";
  const bridgePort = parseInt(parseArg("--bridge-port") || "3001", 10);

  if (!roomName) {
    console.error("  Error: --name is required");
    printUsage();
    process.exit(1);
  }

  console.log("\n  SSH Chat Web - Room Creator\n");
  console.log("  Checking prerequisites...\n");

  console.log(`  [ok] Node.js ${process.version} found`);

  console.log("\n  Starting services...\n");

  console.log(`  [1/3] Starting chat server on port ${bridgePort}...`);
  const bridgeEnv = {
    ...process.env,
    BRIDGE_PORT: bridgePort,
    ROOM_PASSWORD: password ? hashPassword(password) : "",
    ROOM_NAME: roomName,
    ROOM_HOST: hostName,
  };

  const bridgeProc = spawn(
    "node",
    [path.join(__dirname, "..", "bridge", "server.js")],
    {
      stdio: ["ignore", "pipe", "pipe"],
      env: bridgeEnv,
    }
  );

  bridgeProc.on("error", (err) => {
    console.error(`  Error starting chat server: ${err.message}`);
    process.exit(1);
  });

  bridgeProc.stdout.on("data", () => {});
  bridgeProc.stderr.on("data", () => {});

  await new Promise((r) => setTimeout(r, 1500));
  console.log("  [ok] Chat server ready");

  console.log("  [2/3] Starting Cloudflare tunnel...");

  if (!fs.existsSync(cloudflaredBin)) {
    console.log("  Downloading cloudflared (one-time)...");
    try {
      await installCloudflared(cloudflaredBin);
      console.log("  [ok] Cloudflared installed");
    } catch (err) {
      console.error(`  Error installing cloudflared: ${err.message}`);
      process.exit(1);
    }
  }

  console.log("  [ok] Cloudflared ready");

  let publicUrl = null;
  const cloudflaredProc = spawn(
    cloudflaredBin,
    ["tunnel", "--url", `http://localhost:${bridgePort}`],
    { stdio: ["ignore", "pipe", "pipe"] }
  );

  publicUrl = await new Promise((resolve) => {
    let resolved = false;
    let output = "";

    const onData = (chunk) => {
      output += chunk.toString();
      const m = output.match(/https:\/\/[a-z0-9\-]+\.trycloudflare\.com/);
      if (m && !resolved) {
        resolved = true;
        resolve(m[0]);
      }
    };

    cloudflaredProc.stdout.on("data", onData);
    cloudflaredProc.stderr.on("data", onData);

    cloudflaredProc.on("error", () => {
      if (!resolved) resolve(null);
    });
    cloudflaredProc.on("close", () => {
      if (!resolved) resolve(null);
    });

    setTimeout(() => {
      if (!resolved) {
        try {
          cloudflaredProc.kill("SIGTERM");
        } catch {}
        resolve(null);
      }
    }, 20000);
  });

  if (!publicUrl) {
    console.log("  [!!] Failed to start Cloudflare tunnel.\n");
    console.log("  Make sure cloudflared is installed and try again.\n");
    process.exit(1);
  }

  console.log(`  [ok] Tunnel: ${publicUrl}`);

  console.log("  [3/3] Registering room on website...");

  const passwordHash = password ? hashPassword(password) : null;
  let registeredRoom = null;

  try {
    registeredRoom = await apiRequest("POST", "/api/rooms", {
      name: roomName,
      host: hostName,
      password: passwordHash,
      bridgeUrl: publicUrl,
    });
    if (registeredRoom.room) {
      console.log("  [ok] Room registered on website");
    } else {
      console.log(`  [!!] API error: ${JSON.stringify(registeredRoom)}`);
    }
  } catch (err) {
    console.log(`  [!!] Could not register on central API: ${err.message}`);
  }

  const roomId = registeredRoom?.room?.id || "local";
  const roomSecret = registeredRoom?.room?.secret;

  console.log("\n  =============================================");
  console.log("  Room is live!");
  console.log("  =============================================\n");
  console.log(`  Room Name : ${roomName}`);
  console.log(`  Host      : ${hostName}`);
  console.log(`  Password  : ${password || "(none)"}`);
  console.log(`  Room ID   : ${roomId}`);
  console.log("");
  console.log("  Share this URL with your friends:");
  console.log(`  \x1b[1;32m${publicUrl}\x1b[0m`);
  console.log("");
  console.log("  They paste it on the website to join!");
  console.log("\n  Press Ctrl+C to stop the room.\n");

  let connectionCount = 0;

  bridgeProc.stdout.on("data", (data) => {
    const msg = data.toString();
    const match = msg.match(/\((\d+) online\)/);
    if (match) connectionCount = parseInt(match[1], 10);
  });

  let heartbeatInterval = null;
  if (roomSecret) {
    heartbeatInterval = setInterval(async () => {
      try {
        await apiRequest("PUT", `/api/rooms?id=${roomId}`, {
          memberCount: connectionCount,
          secret: roomSecret,
        });
      } catch {
        // silent
      }
    }, 10000);
  }

  const cleanup = async () => {
    console.log("\n\n  Shutting down room...");
    if (heartbeatInterval) clearInterval(heartbeatInterval);

    try {
      await apiRequest("DELETE", `/api/rooms?id=${roomId}`);
      console.log("  [ok] Room unregistered from website");
    } catch {
      // silent
    }

    try {
      bridgeProc.kill("SIGTERM");
    } catch {}
    try {
      cloudflaredProc.kill("SIGTERM");
    } catch {}

    setTimeout(() => {
      console.log("  Room stopped.\n");
      process.exit(0);
    }, 1000);
  };

  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);
}

async function stopRoom() {
  console.log("Stopping chat server...");
  try {
    execSync("pkill -f 'bridge/server.js'", { stdio: "ignore" });
  } catch {}
  console.log("All processes stopped.");
}

if (command === "create") {
  createRoom().catch((err) => {
    console.error("Error:", err.message);
    process.exit(1);
  });
} else if (command === "stop") {
  stopRoom();
} else {
  printUsage();
}
