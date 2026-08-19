import { useState, useEffect, useRef } from "react";
import Head from "next/head";
import Link from "next/link";
import dynamic from "next/dynamic";

const TerminalComponent = dynamic(() => import("./direct-terminal"), {
  ssr: false,
  loading: () => (
    <div style={{ padding: "2rem", color: "#8b949e" }}>Loading terminal...</div>
  ),
});

export default function DirectRoom() {
  const [status, setStatus] = useState("Connecting...");
  const [connected, setConnected] = useState(false);

  return (
    <>
      <Head>
        <title>Room - SSH Chat</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <header>
        <div className="container">
          <Link href="/" className="logo">
            <span className="prompt">&gt;</span> ssh-chat
          </Link>
          <div className="room-header-status">
            <span className={`status-dot ${connected ? "connected" : ""}`}></span>
            {status}
          </div>
        </div>
      </header>

      <main className="terminal-page">
        <TerminalComponent onStatus={setStatus} onConnected={setConnected} />
      </main>
    </>
  );
}
