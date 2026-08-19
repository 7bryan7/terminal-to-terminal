import { useState, useEffect, useCallback } from "react";
import Head from "next/head";
import Link from "next/link";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

export default function Home() {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [joinModal, setJoinModal] = useState(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [joinUrl, setJoinUrl] = useState("");
  const [joinError, setJoinError] = useState("");

  const fetchRooms = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/rooms`);
      if (res.ok) {
        const data = await res.json();
        setRooms(data.rooms || []);
      }
    } catch (e) {
      console.error("Failed to fetch rooms:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRooms();
    const interval = setInterval(fetchRooms, 5000);
    return () => clearInterval(interval);
  }, [fetchRooms]);

  const handleJoin = (room) => {
    if (!room.passwordRequired) {
      window.location.href = `/room/${room.id}`;
    } else {
      setJoinModal(room);
      setPassword("");
      setError("");
    }
  };

  const submitJoin = () => {
    if (!password.trim()) {
      setError("Password is required");
      return;
    }
    if (joinModal.bridgeUrl) {
      window.location.href = `/room/direct?bridge=${encodeURIComponent(joinModal.bridgeUrl)}&pw=${encodeURIComponent(password)}&name=${encodeURIComponent(joinModal.name)}&host=${encodeURIComponent(joinModal.host)}`;
    } else {
      window.location.href = `/room/${joinModal.id}?pw=${encodeURIComponent(password)}`;
    }
  };

  const handleJoinByUrl = async () => {
    const raw = joinUrl.trim().replace(/\/+$/, "");
    if (!raw) return;
    setJoinError("");

    const base = raw.startsWith("http") ? raw : `https://${raw}`;
    const wsBase = base.replace(/^http/, "ws");

    try {
      const res = await fetch(`${base}/room`);
      if (!res.ok) throw new Error("Room not found");
      const info = await res.json();

      if (info.passwordRequired) {
        setJoinModal({
          bridgeUrl: base,
          wsUrl: wsBase,
          name: info.name,
          host: info.host,
          passwordRequired: true,
        });
        setPassword("");
        setError("");
      } else {
        window.location.href = `/room/direct?bridge=${encodeURIComponent(base)}&name=${encodeURIComponent(info.name)}&host=${encodeURIComponent(info.host)}`;
      }
    } catch (e) {
      setJoinError("Cannot reach this room. Make sure the host is online and the URL is correct.");
    }
  };

  return (
    <>
      <Head>
        <title>SSH Chat - Browser-based Terminal Chat Rooms</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <header>
        <div className="container">
          <Link href="/" className="logo">
            <span className="prompt">&gt;</span> ssh-chat
          </Link>
          <nav>
            <Link href="/create" className="btn btn-primary">
              Create Room
            </Link>
          </nav>
        </div>
      </header>

      <main style={{ flex: 1 }}>
        <div className="container">
          <div className="hero">
            <h1>
              Terminal Chat, <span className="highlight">Browser Access</span>
            </h1>
            <p>
              Real-time SSH chat rooms accessible from any browser. No SSH
              client or terminal knowledge needed to join.
            </p>
          </div>

          <div className="section-header">
            <h2>Active Rooms</h2>
            <button className="btn btn-secondary btn-sm" onClick={fetchRooms}>
              Refresh
            </button>
          </div>

          <div className="join-url-section" style={{marginBottom: "2rem", padding: "1.5rem", border: "1px solid var(--border)", borderRadius: "8px", background: "var(--bg-secondary, rgba(255,255,255,0.03))"}}>
            <h3 style={{margin: "0 0 0.5rem", fontSize: "1.1rem"}}>Join a Room</h3>
            <p style={{margin: "0 0 1rem", fontSize: "0.85rem", opacity: 0.7}}>
              Paste the room URL shared by the host
            </p>
            <div style={{display: "flex", gap: "0.5rem"}}>
              <input
                type="text"
                placeholder="e.g., https://pouxz-27-5-231-89.free.pinggy.net"
                value={joinUrl}
                onChange={(e) => { setJoinUrl(e.target.value); setJoinError(""); }}
                onKeyDown={(e) => e.key === "Enter" && handleJoinByUrl()}
                style={{flex: 1, padding: "0.6rem 0.8rem", background: "var(--bg-primary, #0d1117)", border: "1px solid var(--border)", borderRadius: "6px", color: "var(--text, #e6edf3)", fontSize: "0.9rem"}}
              />
              <button className="btn btn-primary" onClick={handleJoinByUrl}>Join</button>
            </div>
            {joinError && <p style={{color: "var(--danger, #f85149)", fontSize: "0.8rem", marginTop: "0.5rem"}}>{joinError}</p>}
          </div>

          {loading ? (
            <div className="empty-state">
              <p>Loading rooms...</p>
            </div>
          ) : rooms.length === 0 ? (
            <div className="empty-state">
              <div className="icon">&#9776;</div>
              <h3>No active rooms</h3>
              <p>
                Create a room to get started. One person hosts, everyone joins
                from the browser.
              </p>
            </div>
          ) : (
            <div className="rooms-grid">
              {rooms.map((room) => (
                <div className="room-card" key={room.id}>
                  <div className="room-info">
                    <div className="room-name">{room.name}</div>
                    <div className="room-meta">
                      <span className="status">
                        <span className="dot"></span> Online
                      </span>
                      <span className="members">
                        {room.memberCount || 0} member
                        {(room.memberCount || 0) !== 1 ? "s" : ""}
                      </span>
                      {room.passwordRequired && (
                        <span style={{ color: "var(--warning)" }}>
                          &#128274; Password
                        </span>
                      )}
                      <span>
                        Hosted by {room.host || "Anonymous"}
                      </span>
                    </div>
                  </div>
                  <div className="room-actions">
                    <button
                      className="btn btn-success btn-sm"
                      onClick={() => handleJoin(room)}
                    >
                      Join Room
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      <footer className="footer">
        <div className="container">
          SSH Chat Web &mdash; Computer Networks Mini Project &mdash; SSH
          Tunneling + WebSocket + Browser Terminal
        </div>
      </footer>

      {joinModal && (
        <div className="modal-overlay" onClick={() => setJoinModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Join Room</h2>
            <p>Enter the password to join &quot;{joinModal.name}&quot;</p>
            <div className="form-group">
              <label>Password</label>
              <input
                type="password"
                placeholder="Enter room password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError("");
                }}
                onKeyDown={(e) => e.key === "Enter" && submitJoin()}
                autoFocus
              />
            </div>
            {error && (
              <p style={{ color: "var(--danger)", fontSize: "0.85rem" }}>
                {error}
              </p>
            )}
            <div className="form-actions">
              <button
                className="btn btn-secondary"
                onClick={() => setJoinModal(null)}
              >
                Cancel
              </button>
              <button className="btn btn-primary" onClick={submitJoin}>
                Join
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
