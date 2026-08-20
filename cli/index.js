#!/usr/bin/env node

const { execSync, spawn } = require("child_process");
const readline = require("readline");
const crypto = require("crypto");
const https = require("https");
const http = require("http");
const path = require("path");
const os = require("os");

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

  console.log("  [2/3] Establishing Pinggy tunnel...");

  let pinggyUrl = null;
  try {
    if (execSync("which pinggy", { stdio: "ignore", stderr: "ignore" })) {
      const output = execSync(`pinggy -p ${bridgePort}`, {
        encoding: "utf-8",
        timeout: 15000,
      });
      const match = output.match(/([a-z0-9\-]+\.pinggy\.io)(?::(\d+))?/);
      if (match) {
        pinggyUrl = match[2] ? `${match[1]}:${match[2]}` : match[1];
      }
    }
  } catch {
    // Pinggy CLI not available
  }

  if (!pinggyUrl) {
    console.log("  [!!] Pinggy CLI not found.\n");
    console.log("  To expose the chat publicly, open a NEW terminal and run:\n");
    console.log(`    ssh -p 443 -R0:localhost:${bridgePort} http@free.pinggy.io\n`);
    console.log("  Copy the https:// URL it gives you and paste it below.\n");

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    pinggyUrl = await new Promise((resolve) => {
      rl.question(
        "  Paste the Pinggy HTTPS URL: ",
        (answer) => {
          rl.close();
          resolve(answer.trim() || null);
        }
      );
    });

    if (!pinggyUrl) {
      console.log("\n  [!!] No tunnel URL provided.");
      console.log("  Room will run locally but no one can join from the browser.\n");
      process.exit(1);
    }
  } else {
    console.log(`  [ok] Tunnel: ${pinggyUrl}`);
  }

  pinggyUrl = pinggyUrl
    .replace(/^tcp:\/\//, "")
    .replace(/^https?:\/\//, "")
    .replace(/\/+$/, "");

  console.log("  [3/3] Registering room on website...");

  const passwordHash = password ? hashPassword(password) : null;
  let registeredRoom = null;

  try {
    registeredRoom = await apiRequest("POST", "/api/rooms", {
      name: roomName,
      host: hostName,
      password: passwordHash,
      bridgeUrl: pinggyUrl,
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
  console.log(`  \x1b[1;32m${pinggyUrl}\x1b[0m`);
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
