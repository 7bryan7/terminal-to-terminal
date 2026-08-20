# SSH Chat Web

**Browser-based chat rooms powered by Cloudflare tunnels**

A real-time chat application where one person hosts a room from their laptop using a Cloudflare tunnel; everyone else joins through a web browser with zero setup.

## Architecture

```
┌──────────────────────────────────────────────────────┐
│              HOST LAPTOP                              │
│                                                       │
│  ┌───────────┐  ┌──────────────────────────────────┐  │
│  │ Chat      │←→│ Cloudflare Tunnel                │  │
│  │ Server    │  │ (trycloudflare.com)              │  │
│  │ (WS)      │  │ NAT Traversal                    │  │
│  └───────────┘  └──────────────────────────────────┘  │
│                                                       │
└──────────────────────────────────────────────────────┘
                         │
                    HTTPS / WSS
                         │
┌──────────────────────────────────────────────────────┐
│              VERCEL (Cloud)                           │
│                                                       │
│  ┌──────────────┐  ┌──────────────┐                  │
│  │ Next.js UI   │  │ Room Registry│                  │
│  │ (Frontend)   │  │ (Serverless) │                  │
│  └──────────────┘  └──────────────┘                  │
│                                                       │
└──────────────────────────────────────────────────────┘
                         ▲
                    HTTPS / WSS
                         │
┌──────────────────────────────────────────────────────┐
│              USER BROWSERS                            │
│                                                       │
│  Open website → Browse rooms → Enter password → Chat  │
│                                                       │
└──────────────────────────────────────────────────────┘
```

## How It Works

### Room Creation (Host)

1. Open the website and click **Create Room**
2. Enter room name, optional password, and display name
3. Copy the generated command and run it in your terminal
4. The command starts:
   - **Chat server** (Node.js WebSocket server on localhost)
   - **Cloudflare tunnel** (exposes the chat server to the internet via trycloudflare.com)
5. Room appears on the website for others to join

### Room Joining (Members)

1. Visit the website
2. Browse active rooms in the list (or paste the tunnel URL shared by the host)
3. Click **Join Room** and enter the password
4. Chat in the browser with WhatsApp-style message bubbles

## Features

- **Zero setup required** for joining — just open a browser
- **Password-protected rooms** — share passwords privately with your group
- **Public room listing** — all active rooms visible on the homepage
- **Real-time member count** — see how many people are in each room
- **WhatsApp-style UI** — chat bubbles, typing indicators, join/leave notifications
- **One-command setup** — host runs a single CLI command to start everything
- **Auto-cleanup** — rooms disappear when the host goes offline
- **No accounts needed** — cloudflared Quick Tunnel requires no sign-up, binary auto-downloaded

## Network Concepts Demonstrated

| Layer | Protocol/Concept | Where in the Project |
|-------|-----------------|---------------------|
| **Transport** | TCP 3-way handshake | WebSocket connections, cloudflared tunnel |
| **Transport** | Reliable data transfer | WebSocket protocol, TCP sockets |
| **Application** | WebSocket (HTTP Upgrade) | Browser ↔ chat server (full-duplex) |
| **Application** | HTTP/HTTPS | Frontend serving, room registry API |
| **Application** | TLS/SSL | HTTPS on Vercel, WSS for secure WebSocket |
| **Network** | NAT Traversal | Cloudflare Quick Tunnel (bypasses router firewall) |
| **Network** | DNS Resolution | trycloudflare.com hostname → host IP address |
| **Network** | IP Routing | Packets traverse multiple hops across the internet |
| **Application** | Socket Programming | Chat server multiplexes WebSocket connections |

## Project Structure

```
CN-miniproject/
├── package.json              # Dependencies and scripts
├── next.config.js            # Next.js configuration
├── README.md                 # This file
│
├── api/                      # Vercel Serverless Functions
│   ├── rooms.js              # Room registry (list, create, detail)
│   └── store.js              # In-memory room store
│
├── pages/                    # Next.js Pages (Frontend)
│   ├── _app.js               # App wrapper
│   ├── index.js              # Home — browse active rooms
│   ├── create.js             # Create room — setup guide
│   └── room/
│       ├── [id].js           # Room redirect
│       ├── direct.js         # Chat room wrapper
│       └── direct-terminal.js # WhatsApp-style chat UI
│
├── bridge/
│   └── server.js             # WebSocket chat server
│
├── cli/
│   └── index.js              # CLI tool for room creation
│
├── styles/
│   └── globals.css           # Global styles + chat UI
│
└── public/                   # Static assets
```

## Tech Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Frontend | Next.js 14 | React-based web application |
| Chat UI | Custom CSS | WhatsApp-style chat bubbles |
| Chat Server | Node.js + ws | WebSocket-based real-time messaging |
| Tunnel | cloudflared (npm) | Auto-downloaded Quick Tunnel for NAT traversal |
| Hosting | Vercel | Frontend + serverless API |
| Styling | Custom CSS | Dark theme with chat interface |

## Prerequisites

### For Host (Room Creator)

- **Node.js** (v18+) — https://nodejs.org
- **cloudflared** — auto-downloaded on first run (no manual install needed)

The CLI automatically downloads the cloudflared binary (~40MB) the first time you create a room. It is cached in `node_modules` for subsequent runs.

### For Members (Room Joiners)

- Any modern web browser (Chrome, Firefox, Safari, Edge)

## Installation

### 1. Clone and Install

```bash
git clone <repository-url>
cd CN-miniproject
npm install
```

### 2. Deploy Frontend to Vercel

```bash
# Option A: Vercel CLI
npx vercel

# Option B: Push to GitHub and connect on vercel.com
# Import the repository on vercel.com/dashboard
```

After deployment, note your Vercel URL (e.g., `https://terminal-to-terminal.vercel.app`).

### 3. Run Locally (Development)

```bash
npm run dev
```

Visit http://localhost:3000

## Usage

### Creating a Room (Host)

#### Option A: Using the Web UI

1. Visit the website and click **Create Room**
2. Fill in room name, password (optional), and display name
3. Copy the generated command
4. Paste and run it in your terminal
5. Wait for "Room is live!" message
6. Share the tunnel URL with your group

#### Option B: Using the CLI Directly

```bash
# Create a room with password
npx bryanterminalsshchat create --name "Study Group" --password mypass123 --host Alice

# Create a room without password
npx bryanterminalsshchat create --name "Project Chat" --host Bob

# With custom port
npx bryanterminalsshchat create --name "Gaming" --bridge-port 3001

# Stop a running room
npx bryanterminalsshchat stop
```

#### What Happens

```
$ npx bryanterminalsshchat create --name "Study Group" --password secret

  [1/3] Starting chat server on port 3001...
  [ok] Chat server ready
  [2/3] Starting Cloudflare tunnel...
  [ok] Tunnel: https://rapid-hills-film.trycloudflare.com
  [3/3] Registering room on website...
  [ok] Room registered on website

  =============================================
    Room is live!
  =============================================

  Share this URL with your friends:
  https://rapid-hills-film.trycloudflare.com
```

### Joining a Room (Members)

1. Visit the deployed website
2. Browse the **Active Rooms** list, or paste the tunnel URL shared by the host
3. Click **Join Room** next to the desired room
4. Enter the room password (if required)
5. Start chatting in the browser

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/rooms` | List all active rooms |
| POST | `/api/rooms` | Register a new room |
| GET | `/api/rooms?id=<id>` | Get room details |
| PUT | `/api/rooms?id=<id>` | Update room heartbeat |
| DELETE | `/api/rooms?id=<id>` | Remove a room |

### POST /api/rooms

```json
{
  "name": "Study Group",
  "host": "Alice",
  "password": "sha256hash",
  "bridgeUrl": "https://rapid-hills-film.trycloudflare.com"
}
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `NEXT_PUBLIC_API_URL` | `""` | API base URL (set for local dev) |
| `BRIDGE_PORT` | `3001` | Chat server port |
| `ROOM_PASSWORD` | `null` | Password hash for room access |

## Limitations

- **Host must stay online** — the room dies when the host's laptop shuts down
- **In-memory room registry** — room data may be lost on Vercel cold starts (acceptable for demo)
- **Quick Tunnel limits** — 200 concurrent requests, random subdomain changes each restart
- **No message persistence** — messages are stored in memory (last 50 per room)

## Network Flow Diagram

```
Browser sends message
        │
        ▼
    WebSocket (WSS)
        │
        ▼
  Cloudflare Tunnel (trycloudflare.com)
        │
        ▼
  Chat Server (port 3001)
        │
        ▼
  Broadcasts to all connected WebSocket clients
```

### Packet Journey

```
1. Browser sends message "Hello" over WebSocket
2. Encrypted in WSS frame (TLS)
3. Traverses internet → Cloudflare edge → tunnel
4. Arrives at chat server on host's laptop
5. Chat server broadcasts to all connected clients
6. Other browser clients receive via WebSocket
```

## License

MIT — Built as a Computer Networks mini-project demonstrating NAT traversal, WebSocket protocol, and browser-based real-time chat.

## Credits

- [Cloudflare](https://www.cloudflare.com/) — Quick Tunnel for NAT traversal
- [Next.js](https://nextjs.org/) — React framework
