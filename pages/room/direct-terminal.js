import { useEffect, useRef } from "react";

export default function DirectTerminal({ onStatus, onConnected }) {
  const termRef = useRef(null);

  useEffect(() => {
    let ws, term, fitAddon;

    const init = async () => {
      const { Terminal } = await import("xterm");
      const { FitAddon } = await import("xterm-addon-fit");
      await import("xterm/css/xterm.css");

      const params = new URLSearchParams(window.location.search);
      const bridgeBase = params.get("bridge");
      const pw = params.get("pw") || "";
      const roomName = params.get("name") || "Room";
      const hostName = params.get("host") || "Host";

      if (!bridgeBase) {
        onStatus("No bridge URL provided");
        return;
      }

      if (!termRef.current) {
        onStatus("Terminal container not ready");
        return;
      }

      document.title = `${roomName} - SSH Chat`;

      const wsUrl =
        bridgeBase.replace(/^http/, "ws") +
        (pw ? `?pw=${encodeURIComponent(pw)}` : "");

      term = new Terminal({
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

      fitAddon = new FitAddon();
      term.loadAddon(fitAddon);
      term.open(termRef.current);
      fitAddon.fit();

      term.writeln(
        `\x1b[1;36mConnecting to ${roomName}...\x1b[0m\r\n`
      );

      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        onStatus(`Connected to ${roomName}`);
        onConnected(true);
        term.writeln(
          `\x1b[1;32mConnected! Welcome to ${roomName}\x1b[0m\r\n`
        );
        term.writeln(`\x1b[90mHosted by ${hostName}\x1b[0m\r\n`);
        term.focus();
      };

      ws.onmessage = (event) => {
        term.write(event.data);
      };

      ws.onclose = (event) => {
        onConnected(false);
        if (event.code === 4001) {
          term.writeln(
            "\r\n\x1b[1;31mAccess denied: incorrect password\x1b[0m"
          );
          onStatus("Access denied");
        } else {
          term.writeln("\r\n\x1b[1;31mDisconnected from server\x1b[0m");
          onStatus("Disconnected");
        }
      };

      ws.onerror = () => {
        onStatus("Connection failed");
        term.writeln(
          "\r\n\x1b[1;31mFailed to connect. Is the host online?\x1b[0m"
        );
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
    };

    init();
  }, []);

  return <div ref={termRef} className="terminal-container" />;
}
