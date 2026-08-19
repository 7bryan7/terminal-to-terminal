import { useState, useEffect, useRef } from "react";
import Head from "next/head";
import Link from "next/link";
import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import "xterm/css/xterm.css";

export default function DirectRoom() {
  const [status, setStatus] = useState("Connecting...");
  const [connected, setConnected] = useState(false);
  const termRef = useRef(null);
  const termInstance = useRef(null);
  const wsRef = useRef(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const bridgeBase = params.get("bridge");
    const pw = params.get("pw") || "";
    const roomName = params.get("name") || "Room";
    const hostName = params.get("host") || "Host";

    if (!bridgeBase) {
      setStatus("No bridge URL provided");
      return;
    }

    document.title = `${roomName} - SSH Chat`;

    const wsUrl = bridgeBase.replace(/^http/, "ws") + (pw ? `?pw=${encodeURIComponent(pw)}` : "");

    const term = new Terminal({
      theme: {
        background: "#0d1117",
        foreground: "#e6edf3",
        cursor: "#58a6ff",
        selectionBackground: "#264f78",
      },
      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
      fontSize: 14,
      cursorBlink: true,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(termRef.current);
    fitAddon.fit();
    termInstance.current = term;

    term.writeln(`\x1b[1;36mConnecting to ${roomName}...\x1b[0m\r\n`);

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus(`Connected to ${roomName}`);
      setConnected(true);
      term.writeln(`\x1b[1;32mConnected! Welcome to ${roomName}\x1b[0m\r\n`);
      term.writeln(`\x1b[90mHosted by ${hostName}\x1b[0m\r\n`);
      term.focus();
    };

    ws.onmessage = (event) => {
      term.write(event.data);
    };

    ws.onclose = (event) => {
      setConnected(false);
      if (event.code === 4001) {
        term.writeln("\r\n\x1b[1;31mAccess denied: incorrect password\x1b[0m");
        setStatus("Access denied");
      } else {
        term.writeln("\r\n\x1b[1;31mDisconnected from server\x1b[0m");
        setStatus("Disconnected");
      }
    };

    ws.onerror = () => {
      setStatus("Connection failed");
      term.writeln("\r\n\x1b[1;31mFailed to connect. Is the host online?\x1b[0m");
    };

    term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    });

    const handleResize = () => fitAddon.fit();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      ws.close();
      term.dispose();
    };
  }, []);

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
        <div ref={termRef} className="terminal-container" />
      </main>
    </>
  );
}
