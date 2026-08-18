import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import Link from "next/link";

export default function ChatRoom() {
  const router = useRouter();
  const { id } = router.query;
  const [room, setRoom] = useState(null);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState("");
  const [showJoin, setShowJoin] = useState(true);
  const [joinPassword, setJoinPassword] = useState("");
  const terminalRef = useRef(null);
  const termInstance = useRef(null);
  const wsRef = useRef(null);

  const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

  const fetchRoom = useCallback(async () => {
    if (!id) return;
    try {
      const res = await fetch(`${API_BASE}/api/rooms/${id}`);
      if (res.ok) {
        const data = await res.json();
        setRoom(data.room);
      } else {
        setError("Room not found or has gone offline.");
      }
    } catch {
      setError("Failed to fetch room info.");
    }
  }, [id, API_BASE]);

  useEffect(() => {
    fetchRoom();
    const interval = setInterval(fetchRoom, 5000);
    return () => clearInterval(interval);
  }, [fetchRoom]);

  const connectToRoom = useCallback(async () => {
    if (!room || !room.bridgeUrl) return;

    setConnecting(true);
    setError("");

    try {
      const { Terminal } = await import("xterm");
      const { FitAddon } = await import("xterm-addon-fit");

      await import("xterm/css/xterm.css");

      if (termInstance.current) {
        termInstance.current.dispose();
      }

      const term = new Terminal({
        cursorBlink: true,
        fontSize: 15,
        fontFamily: '"JetBrains Mono", "Fira Code", "SF Mono", monospace',
        theme: {
          background: "#0a0e17",
          foreground: "#e2e8f0",
          cursor: "#38bdf8",
          cursorAccent: "#0a0e17",
          selectionBackground: "#1e3a5f",
          black: "#0a0e17",
          red: "#f87171",
          green: "#4ade80",
          yellow: "#fbbf24",
          blue: "#38bdf8",
          magenta: "#c084fc",
          cyan: "#22d3ee",
          white: "#e2e8f0",
        },
        allowProposedApi: true,
      });

      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);

      term.open(terminalRef.current);
      fitAddon.fit();

      termInstance.current = term;

      const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${wsProtocol}//${room.bridgeUrl}?room=${id}&pw=${encodeURIComponent(joinPassword)}`;

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        setConnecting(false);
        setShowJoin(false);

        const fitHandler = () => fitAddon.fit();
        window.addEventListener("resize", fitHandler);
        ws._fitHandler = fitHandler;
      };

      ws.onmessage = (event) => {
        if (typeof event.data === "string") {
          term.write(event.data);
        }
      };

      ws.onclose = (event) => {
        setConnected(false);
        if (event.code === 4001) {
          setError("Incorrect password.");
          setShowJoin(true);
        } else if (event.code === 4004) {
          setError("Room not found or offline.");
        } else {
          term.writeln("\r\n\x1b[31mConnection lost.\x1b[0m");
        }
      };

      ws.onerror = () => {
        setConnected(false);
        setError("WebSocket connection failed.");
      };

      term.onData((data) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(data);
        }
      });
    } catch (e) {
      setConnecting(false);
      setError("Failed to initialize terminal: " + e.message);
    }
  }, [room, id, joinPassword]);

  useEffect(() => {
    return () => {
      if (wsRef.current) wsRef.current.close();
      if (termInstance.current) termInstance.current.dispose();
    };
  }, []);

  const handleJoin = () => {
    if (room && room.passwordRequired && !joinPassword.trim()) {
      setError("Password is required");
      return;
    }
    connectToRoom();
  };

  const handleDisconnect = () => {
    if (wsRef.current) wsRef.current.close();
    setConnected(false);
    setShowJoin(true);
  };

  return (
    <>
      <Head>
        <title>{room ? room.name : "Chat Room"} - SSH Chat</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <header>
        <div className="container">
          <Link href="/" className="logo">
            <span className="prompt">&gt;</span> ssh-chat
          </Link>
          <nav>
            {connected && (
              <button
                className="btn btn-danger btn-sm"
                onClick={handleDisconnect}
              >
                Disconnect
              </button>
            )}
          </nav>
        </div>
      </header>

      <main className="room-page">
        {showJoin ? (
          <div className="join-overlay">
            <div className="join-card">
              <h2>Join Room</h2>
              {room ? (
                <>
                  <div className="room-name-display">{room.name}</div>
                  <p
                    style={{
                      color: "var(--text-muted)",
                      marginBottom: "20px",
                      fontSize: "0.9rem",
                    }}
                  >
                    Hosted by {room.host || "Anonymous"}
                    {room.passwordRequired && " &middot; Password required"}
                  </p>

                  {room.passwordRequired && (
                    <div className="form-group" style={{ textAlign: "left" }}>
                      <label>Password</label>
                      <input
                        type="password"
                        placeholder="Enter room password"
                        value={joinPassword}
                        onChange={(e) => {
                          setJoinPassword(e.target.value);
                          setError("");
                        }}
                        onKeyDown={(e) => e.key === "Enter" && handleJoin()}
                      />
                    </div>
                  )}

                  {error && (
                    <p
                      style={{
                        color: "var(--danger)",
                        fontSize: "0.85rem",
                        marginBottom: "16px",
                      }}
                    >
                      {error}
                    </p>
                  )}

                  <button
                    className="btn btn-primary btn-lg"
                    style={{ width: "100%" }}
                    onClick={handleJoin}
                    disabled={connecting}
                  >
                    {connecting ? "Connecting..." : "Join Chat"}
                  </button>
                </>
              ) : error ? (
                <p style={{ color: "var(--danger)" }}>{error}</p>
              ) : (
                <p style={{ color: "var(--text-muted)" }}>Loading room...</p>
              )}

              <div style={{ marginTop: "16px" }}>
                <Link
                  href="/"
                  style={{
                    color: "var(--text-muted)",
                    fontSize: "0.85rem",
                  }}
                >
                  Back to rooms
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <div
            className="terminal-container"
            style={{ height: "calc(100vh - 85px)" }}
          >
            <div className="terminal-header">
              <span className="title">
                <span style={{ color: "var(--success)" }}>&#9679;</span>
                {room?.name || "Room"}
              </span>
              <span className="members-count">
                <span className="dot"></span>
                Connected
              </span>
            </div>
            <div id="terminal" ref={terminalRef}></div>
          </div>
        )}
      </main>
    </>
  );
}
