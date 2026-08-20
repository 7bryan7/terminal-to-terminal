import { useState } from "react";
import Head from "next/head";
import Link from "next/link";
import dynamic from "next/dynamic";

const ChatRoom = dynamic(() => import("./direct-terminal"), {
  ssr: false,
  loading: () => (
    <div className="chat-container">
      <div className="chat-loading">Connecting to chat...</div>
    </div>
  ),
});

export default function DirectRoom() {
  const [status, setStatus] = useState("Connecting...");
  const [connected, setConnected] = useState(false);

  return (
    <>
      <Head>
        <title>Chat - SSH Chat</title>
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

      <ChatRoom onStatus={setStatus} onConnected={setConnected} />
    </>
  );
}
