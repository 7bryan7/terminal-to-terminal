import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import Link from "next/link";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

export default function RoomRedirect() {
  const router = useRouter();
  const { id } = router.query;
  const [status, setStatus] = useState("Loading room...");
  const [error, setError] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [roomData, setRoomData] = useState(null);

  useEffect(() => {
    if (!id) return;

    const fetchRoom = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/rooms?id=${id}`);
        if (!res.ok) throw new Error("Room not found");
        const json = await res.json();
        const data = json.room;
        setRoomData(data);

        if (!data.passwordRequired) {
          window.location.href = `/room/direct?bridge=${encodeURIComponent(data.bridgeUrl)}&name=${encodeURIComponent(data.name)}&host=${encodeURIComponent(data.host)}`;
        } else {
          setShowPassword(true);
          setStatus("");
        }
      } catch (err) {
        setError("Room not found or has expired.");
        setStatus("");
      }
    };

    fetchRoom();
  }, [id]);

  const handleJoin = () => {
    if (!roomData) return;
    window.location.href = `/room/direct?bridge=${encodeURIComponent(roomData.bridgeUrl)}&pw=${encodeURIComponent(password)}&name=${encodeURIComponent(roomData.name)}&host=${encodeURIComponent(roomData.host)}`;
  };

  return (
    <>
      <Head>
        <title>Join Room - SSH Chat</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <header>
        <div className="container">
          <Link href="/" className="logo">
            <span className="prompt">&gt;</span> ssh-chat
          </Link>
        </div>
      </header>

      <main style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {status && <p style={{ color: "var(--text-muted)" }}>{status}</p>}
        {error && (
          <div style={{ textAlign: "center" }}>
            <p style={{ color: "var(--danger)", marginBottom: "16px" }}>{error}</p>
            <Link href="/" className="btn btn-secondary">Back to Home</Link>
          </div>
        )}
        {showPassword && roomData && (
          <div className="join-card">
            <h2>{roomData.name}</h2>
            <div className="room-name-display">Hosted by {roomData.host}</div>
            <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", marginBottom: "24px" }}>
              This room requires a password
            </p>
            <div className="form-group">
              <input
                type="password"
                placeholder="Enter room password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleJoin()}
                autoFocus
              />
            </div>
            <div className="form-actions">
              <Link href="/" className="btn btn-secondary">Cancel</Link>
              <button className="btn btn-primary" onClick={handleJoin}>Join</button>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
