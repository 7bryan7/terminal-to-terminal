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
    window.location.href = `/room/${joinModal.id}?pw=${encodeURIComponent(password)}`;
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
