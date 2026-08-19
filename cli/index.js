#!/usr/bin/env node

const { execSync, spawn } = require("child_process");
const readline = require("readline");
const crypto = require("crypto");
const https = require("https");
const http = require("http");
const path = require("path");
const fs = require("fs");
const os = require("os");

const args = process.argv.slice(2);
const command = args[0];
const IS_WINDOWS = os.platform() === "win32";

function parseArg(flag) {
  const idx = args.indexOf(flag);
  if (idx !== -1 && idx + 1 < args.length) return args[idx + 1];
  return null;
}

function printUsage() {
  console.log(`
  SSH Chat Web - Room Management CLI

  Usage:
    npx sshchat create [options]   Create and host a chat room
    npx sshchat stop               Stop the current room

  Create Options:
    --name <name>       Room name (required)
    --password <pw>     Room password (optional)
    --host <name>       Your display name (default: Anonymous)
    --ssh-port <port>   ssh-chat server port (default: 2222)
    --bridge-port <port> Bridge server port (default: 3001)
    --api <url>         Registry API URL

  Examples:
    npx sshchat create --name "Study Group" --password secret123
    npx sshchat create --name "Project Chat" --host Alice
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

function checkCommand(cmd) {
  try {
    const whichCmd = IS_WINDOWS ? `where ${cmd}` : `which ${cmd}`;
    execSync(whichCmd, { stdio: "ignore", stderr: "ignore" });
    return true;
  } catch {
    return false;
  }
}

const BIN_DIR = path.join(__dirname, "..", "bin");

function getSshChatPath() {
  if (IS_WINDOWS) {
    return path.join(BIN_DIR, "ssh-chat.exe");
  }
  return path.join(BIN_DIR, "ssh-chat");
}

function getArchitecture() {
  const arch = os.arch();
  const platform = os.platform();
  const goArch = arch === "arm64" ? "arm64" : arch === "arm" ? "armv6l" : "amd64";
  const goPlatform = platform === "win32" ? "windows" : platform === "darwin" ? "darwin" : "linux";
  const ext = IS_WINDOWS ? ".exe" : "";
  return { goArch, goPlatform, ext };
}

function downloadSshChat() {
  const { goArch, goPlatform, ext } = getArchitecture();
  const sshChatPath = getSshChatPath();

  console.log(`  [..] Downloading ssh-chat for ${goPlatform}/${goArch}...`);

  if (!fs.existsSync(BIN_DIR)) {
    fs.mkdirSync(BIN_DIR, { recursive: true });
  }

  const version = "v1.10";
  const filename = `ssh-chat-${goPlatform}_${goArch}`;
  const url = `https://github.com/shazow/ssh-chat/releases/download/${version}/${filename}.tgz`;

  return new Promise((resolve, reject) => {
    console.log(`  [..] Downloading from: ${url}`);

    const doDownload = (downloadUrl, redirectCount) => {
      if (redirectCount > 5) {
        reject(new Error("Too many redirects"));
        return;
      }

      const parsedUrl = new URL(downloadUrl);
      const transport = parsedUrl.protocol === "https:" ? https : http;

      transport
        .get(downloadUrl, (res) => {
          if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            doDownload(res.headers.location, redirectCount + 1);
            return;
          }

          if (res.statusCode !== 200) {
            reject(new Error(`Download failed with status ${res.statusCode}`));
            return;
          }

          const tgzPath = sshChatPath + ".tgz";
          const extractDir = path.join(BIN_DIR, "_extract");
          const file = fs.createWriteStream(tgzPath);
          res.pipe(file);

          file.on("finish", () => {
            file.close(() => {
              try {
                if (fs.existsSync(extractDir)) {
                  fs.rmSync(extractDir, { recursive: true, force: true });
                }
                fs.mkdirSync(extractDir, { recursive: true });
                execSync(`tar -xzf "${tgzPath}" -C "${extractDir}"`, { stdio: "ignore" });
                fs.unlinkSync(tgzPath);

                let binaryPath = null;
                const walk = (dir) => {
                  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
                    const full = path.join(dir, entry.name);
                    if (entry.isDirectory()) {
                      walk(full);
                    } else if (entry.name === "ssh-chat" || entry.name === "ssh-chat.exe") {
                      binaryPath = full;
                      return;
                    }
                  }
                };
                walk(extractDir);

                if (binaryPath) {
                  fs.copyFileSync(binaryPath, sshChatPath);
                  fs.chmodSync(sshChatPath, 0o755);
                }

                fs.rmSync(extractDir, { recursive: true, force: true });

                if (fs.existsSync(sshChatPath)) {
                  console.log("  [ok] ssh-chat downloaded successfully");
                  resolve(sshChatPath);
                } else {
                  reject(new Error("Download completed but binary not found"));
                }
              } catch (err) {
                reject(new Error(`Failed to extract: ${err.message}`));
              }
            });
          });

          file.on("error", (err) => {
            fs.unlink(tgzPath, () => {});
            reject(err);
          });
        })
        .on("error", reject);
    };

    doDownload(url, 0);
  });
}

async function installSshChat() {
  const sshChatPath = getSshChatPath();
  const hasGlobalSshChat = checkCommand("ssh-chat");

  if (hasGlobalSshChat) {
    console.log("  [ok] ssh-chat found (global)");
    return "ssh-chat";
  }

  if (fs.existsSync(sshChatPath)) {
    console.log("  [ok] ssh-chat found (local)");
    return sshChatPath;
  }

  console.log("  [..] ssh-chat not found. Installing...\n");

  if (checkCommand("go")) {
    console.log("  [..] Go found. Building ssh-chat from source...");
    try {
      const gopath = execSync("go env GOPATH", { encoding: "utf-8" }).trim();
      execSync("go install github.com/shazow/ssh-chat@latest", {
        stdio: "inherit",
        timeout: 120000,
      });
      console.log("  [ok] ssh-chat installed via Go");
      return "ssh-chat";
    } catch {
      console.log("  [!!] Go install failed, trying download instead...");
    }
  }

  try {
    return await downloadSshChat();
  } catch (err) {
    console.error(`  Error: Could not install ssh-chat: ${err.message}\n`);
    console.log("  Manual install options:");
    console.log("  1. Install Go from https://go.dev/dl/ then run:");
    console.log("     go install github.com/shazow/ssh-chat@latest");
    console.log("  2. Download binary from:");
    console.log("     https://github.com/shazow/ssh-chat/releases");
    console.log(`  3. Place the binary in: ${BIN_DIR}/\n`);
    process.exit(1);
  }
}

async function createRoom() {
  const roomName = parseArg("--name");
  const password = parseArg("--password");
  const hostName = parseArg("--host") || "Anonymous";
  const sshPort = parseInt(parseArg("--ssh-port") || "2222", 10);
  const bridgePort = parseInt(parseArg("--bridge-port") || "3001", 10);

  if (!roomName) {
    console.error("  Error: --name is required");
    printUsage();
    process.exit(1);
  }

  console.log("\n  SSH Chat Web - Room Creator\n");
  console.log("  Checking prerequisites...\n");

  console.log(`  [ok] Node.js ${process.version} found`);

  const sshChatCmd = await installSshChat();

  console.log("\n  Starting services...\n");

  console.log(`  [1/4] Starting ssh-chat server on port ${sshPort}...`);
  const sshProc = spawn(sshChatCmd, ["--listen", `:${sshPort}`], {
    stdio: ["ignore", "pipe", "pipe"],
  });

  sshProc.on("error", (err) => {
    console.error(`  Error starting ssh-chat: ${err.message}`);
    process.exit(1);
  });

  sshProc.stderr.on("data", () => {});

  await new Promise((r) => setTimeout(r, 2000));
  console.log("  [ok] ssh-chat server ready");

  console.log(`  [2/4] Starting WebSocket bridge on port ${bridgePort}...`);
  const bridgeEnv = {
    ...process.env,
    BRIDGE_PORT: bridgePort,
    SSH_HOST: "127.0.0.1",
    SSH_PORT: sshPort,
    ROOM_PASSWORD: password ? hashPassword(password) : "",
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
    console.error(`  Error starting bridge: ${err.message}`);
    process.exit(1);
  });

  bridgeProc.stdout.on("data", () => {});
  bridgeProc.stderr.on("data", () => {});

  await new Promise((r) => setTimeout(r, 1500));
  console.log("  [ok] Bridge server ready");

  console.log("  [3/4] Establishing Pinggy tunnel...");

  let pinggyUrl = null;
  try {
    if (checkCommand("pinggy")) {
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
    console.log("  To expose the bridge publicly, open a NEW terminal and run:\n");
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
          resolve(answer.trim() || `127.0.0.1:${bridgePort}`);
        }
      );
    });
  } else {
    console.log(`  [ok] Tunnel: ${pinggyUrl}`);
  }

  pinggyUrl = pinggyUrl
    .replace(/^tcp:\/\//, "")
    .replace(/^https?:\/\//, "")
    .replace(/\/+$/, "");

  console.log("  [4/4] Registering room on website...");

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
  console.log(`  SSH Port  : ${sshPort}`);
  console.log(`  Bridge    : ${pinggyUrl}`);
  console.log("");
  console.log("  Open the website and join from the browser!");
  if (registeredRoom?.room) {
    console.log(
      `  Direct link: https://ssh-chat.vercel.app/room/${roomId}`
    );
  }
  console.log("\n  Press Ctrl+C to stop the room.\n");

  let connectionCount = 0;

  bridgeProc.stdout.on("data", (data) => {
    const msg = data.toString();
    const connectMatch = msg.match(/Client connected \((\d+) active\)/);
    const disconnectMatch = msg.match(
      /Client disconnected.*\((\d+) active\)/
    );
    if (connectMatch)
      connectionCount = parseInt(connectMatch[1], 10);
    if (disconnectMatch)
      connectionCount = parseInt(disconnectMatch[1], 10);
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
      sshProc.kill("SIGTERM");
    } catch {}
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
  console.log("Stopping all SSH Chat processes...");
  try {
    execSync("pkill -f 'ssh-chat'", { stdio: "ignore" });
  } catch {}
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
