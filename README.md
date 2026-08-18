# SSH Chat Web

**Browser-based terminal chat rooms powered by SSH tunneling**

A real-time chat application that bridges SSH-based terminal chat to web browsers. One person hosts a room from their laptop using SSH; everyone else joins through a web browser with zero SSH knowledge.

## Architecture

```
┌──────────────────────────────────────────────────────┐
│              HOST LAPTOP                              │
│                                                       │
│  ┌───────────┐  ┌──────────┐  ┌──────────────────┐  │
│  │ ssh-chat  │←→│ Bridge   │←→│ Pinggy Tunnel    │  │
│  │ (SSH)     │  │ (WS↔SSH) │  │ (NAT Traversal)  │  │
│  └───────────┘  └──────────┘  └──────────────────┘  │
│                                                       │
└──────────────────────────────────────────────────────┘
                         │
                    SSH / TCP
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
   - **ssh-chat server** (Go-based SSH chat server on localhost)
   - **WebSocket bridge** (translates browser WebSocket ↔ SSH)
   - **Pinggy tunnel** (exposes the bridge to the internet)
5. Room appears on the website for others to join

### Room Joining (Members)

1. Visit the website
2. Browse active rooms in the list
3. Click **Join Room** and enter the password
4. Chat in a browser-based terminal (xterm.js) — no SSH client needed

## Features

- **Zero SSH knowledge required** for joining — just open a browser
- **Password-protected rooms** — share passwords privately with your group
- **Public room listing** — all active rooms visible on the homepage
- **Real-time member count** — see how many people are in each room
- **Full terminal emulation** — xterm.js with colors, cursor, and keyboard support
- **One-command setup** — host runs a single CLI command to start everything
- **Auto-cleanup** — rooms disappear when the host goes offline
- **Dark terminal theme** — modern UI with terminal aesthetics

## Network Concepts Demonstrated

| Layer | Protocol/Concept | Where in the Project |
|-------|-----------------|---------------------|
| **Transport** | TCP 3-way handshake | SSH connections, WebSocket upgrades |
| **Transport** | Reliable data transfer | SSH protocol, TCP sockets |
| **Application** | SSH Protocol | ssh-chat server ↔ bridge |
| **Application** | WebSocket (HTTP Upgrade) | Browser ↔ bridge (full-duplex) |
| **Application** | HTTP/HTTPS | Frontend serving, room registry API |
| **Application** | TLS/SSL | HTTPS on Vercel, WSS for secure WebSocket |
| **Network** | NAT Traversal | Pinggy TCP tunnel (bypasses router firewall) |
| **Network** | DNS Resolution | pinggy.io hostname → host IP address |
| **Network** | IP Routing | Packets traverse multiple hops across the internet |
| **Network** | Port Multiplexing | Multiple services on different ports (2222, 3001) |
| **Application** | Socket Programming | Bridge multiplexes WebSocket ↔ SSH connections |

## Project Structure

```
CN-miniproject/
├── package.json              # Dependencies and scripts
├── next.config.js            # Next.js configuration
├── README.md                 # This file
│
├── api/                      # Vercel Serverless Functions
│   ├── rooms.js              # Room registry (list, create)
│   ├── rooms/
│   │   └── [id].js           # Room detail, heartbeat, delete
│   └── store.js              # In-memory room store
│
├── pages/                    # Next.js Pages (Frontend)
│   ├── _app.js               # App wrapper
│   ├── index.js              # Home — browse active rooms
│   ├── create.js             # Create room — setup guide
│   └── room/
│       └── [id].js           # Chat room — xterm.js terminal
│
├── bridge/
│   └── server.js             # WebSocket ↔ SSH bridge server
│
├── cli/
│   └── index.js              # CLI tool for room creation
│
├── styles/
│   └── globals.css           # Global styles (dark theme)
│
├── components/               # React components (if needed)
├── public/                   # Static assets
└── utils/                    # Shared utilities
```

## Tech Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Frontend | Next.js 14 | React-based web application |
| Terminal UI | xterm.js 5.x | Browser terminal emulator |
| Chat Server | ssh-chat | Go-based SSH chat server |
| Bridge | Node.js + ws + ssh2 | WebSocket-to-SSH translation |
| Tunnel | Pinggy | Free TCP tunnel for NAT traversal |
| Hosting | Vercel | Frontend + serverless API |
| Styling | Custom CSS | Dark terminal theme |

## Prerequisites

### For Host (Room Creator)

- **Node.js** (v18+) — https://nodejs.org
- **Go** (latest) — https://go.dev/dl/ (for installing ssh-chat)
- **Pinggy** (optional) — https://pinggy.io (for exposing the tunnel)

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

After deployment, note your Vercel URL (e.g., `https://ssh-chat.vercel.app`).

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
6. Share the room password with your group

#### Option B: Using the CLI Directly

```bash
# Create a room with password
node cli/index.js create --name "Study Group" --password mypass123 --host Alice

# Create a room without password
node cli/index.js create --name "Project Chat" --host Bob

# With custom ports
node cli/index.js create --name "Gaming" --ssh-port 2222 --bridge-port 3001

# Stop a running room
node cli/index.js stop
```

#### Option C: Using npx

```bash
npx sshchat create --name "Study Group" --password mypass123
```

### Joining a Room (Members)

1. Visit the deployed website
2. Browse the **Active Rooms** list
3. Click **Join Room** next to the desired room
4. Enter the room password (if required)
5. Start chatting in the browser terminal

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
  "bridgeUrl": "abc123.pinggy.io:443"
}
```

Response:
```json
{
  "room": {
    "id": "a1b2c3d4e5f6g7h8",
    "name": "Study Group",
    "host": "Alice",
    "passwordRequired": true,
    "bridgeUrl": "abc123.pinggy.io:443",
    "secret": "server-side-secret-for-heartbeat"
  }
}
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `NEXT_PUBLIC_API_URL` | `""` | API base URL (set for local dev) |
| `BRIDGE_PORT` | `3001` | WebSocket bridge port |
| `SSH_HOST` | `127.0.0.1` | SSH server hostname |
| `SSH_PORT` | `2222` | SSH server port |
| `ROOM_PASSWORD` | `null` | Password hash for room access |

## Limitations

- **Host must stay online** — the room dies when the host's laptop shuts down
- **In-memory room registry** — room data may be lost on Vercel cold starts (acceptable for demo)
- **Single SSH server** — each room runs one ssh-chat instance
- **No message history** — chat is real-time only (no persistence)

## Future Improvements

- Persistent room storage (Redis/database)
- Message history and replay
- Multiple rooms per host
- File sharing over chat
- Voice/video integration
- Mobile-optimized terminal
- Room admin controls (kick, mute)
- HTTPS WebSocket certificates

## Network Flow Diagram

```
Browser Keyboard Input
        │
        ▼
    WebSocket (WS)
        │
        ▼
  Bridge Server (port 3001)
        │
        ▼
    SSH Client
        │
        ▼
  ssh-chat Server (port 2222)
        │
        ▼
  All connected clients receive message
```

### Packet Journey

```
1. Browser sends keystroke "H"
2. Encrypted in WSS frame (TLS)
3. Traverses internet → Pinggy tunnel
4. Arrives at bridge server
5. Bridge converts to SSH data packet
6. Forwarded to ssh-chat via TCP
7. ssh-chat broadcasts to all connected SSH sessions
8. Other browser clients receive via WebSocket
```

## License

MIT — Built as a Computer Networks mini-project demonstrating SSH tunneling, WebSocket protocol, NAT traversal, and browser-based terminal emulation.

## Credits

- [ssh-chat](https://github.com/shazow/ssh-chat) — SSH chat server by shazow
- [xterm.js](https://xtermjs.org/) — Terminal emulator for the browser
- [Pinggy](https://pinggy.io/) — Free TCP tunnel service
- [Next.js](https://nextjs.org/) — React framework
