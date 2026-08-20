import { useEffect, useRef, useState, useCallback } from "react";

export default function ChatRoom({ onStatus, onConnected }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [users, setUsers] = useState([]);
  const [roomInfo, setRoomInfo] = useState({ name: "Room", host: "Host" });
  const [typingUser, setTypingUser] = useState(null);
  const [myName, setMyName] = useState("");
  const myNameRef = useRef("");
  const [disconnected, setDisconnected] = useState(false);
  const [disconnectReason, setDisconnectReason] = useState("");
  const wsRef = useRef(null);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const shouldAutoScroll = useRef(true);

  const scrollToBottom = useCallback(() => {
    if (shouldAutoScroll.current && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, typingUser, scrollToBottom]);

  const handleScroll = useCallback(() => {
    const el = messagesContainerRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    shouldAutoScroll.current = atBottom;
  }, []);

  useEffect(() => {
    let ws;

    const init = async () => {
      const params = new URLSearchParams(window.location.search);
      const bridgeBase = params.get("bridge");
      const pw = params.get("pw") || "";
      const roomName = params.get("name") || "Chat Room";
      const hostName = params.get("host") || "Host";

      if (!bridgeBase) {
        onStatus("No bridge URL provided");
        return;
      }

      const wsUrl =
        bridgeBase.replace(/^http/, "ws") +
        (pw ? `?pw=${encodeURIComponent(pw)}` : "");

      onStatus("Connecting...");

      ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setDisconnected(false);
        onConnected(true);
        ws.send(
          JSON.stringify({
            type: "auth",
            pw,
            name: params.get("myname") || "",
          })
        );
      };

      ws.onmessage = (event) => {
        let msg;
        try {
          msg = JSON.parse(event.data);
        } catch {
          return;
        }

        if (msg.type === "welcome") {
          setMyName(msg.name);
          myNameRef.current = msg.name;
          setUsers(msg.users);
          setRoomInfo(msg.room || { name: roomName, host: hostName });
          setMessages(
            msg.messages.map((m) => ({
              ...m,
              isMine: m.user === msg.name,
              isSystem: false,
            }))
          );
          onStatus(`Connected to ${msg.room?.name || roomName}`);
          return;
        }

        if (msg.type === "message") {
          setMessages((prev) => [
            ...prev,
            {
              ...msg,
              isMine: msg.user === myNameRef.current,
              isSystem: false,
            },
          ]);
          setTypingUser((prev) => (prev === msg.user ? null : prev));
          return;
        }

        if (msg.type === "join") {
          setUsers(msg.users);
          setMessages((prev) => [
            ...prev,
            {
              type: "join",
              text: `${msg.user} joined`,
              time: msg.time,
              isSystem: true,
            },
          ]);
          return;
        }

        if (msg.type === "leave") {
          setUsers(msg.users);
          setMessages((prev) => [
            ...prev,
            {
              type: "leave",
              text: `${msg.user} left`,
              time: msg.time,
              isSystem: true,
            },
          ]);
          return;
        }

        if (msg.type === "typing") {
          if (msg.user !== myNameRef.current) setTypingUser(msg.user);
          return;
        }

        if (msg.type === "typing-stop") {
          setTypingUser((prev) => (prev === msg.user ? null : prev));
          return;
        }

        if (msg.type === "error") {
          onStatus(msg.text);
        }
      };

      ws.onclose = (event) => {
        onConnected(false);
        setDisconnected(true);
        if (event.code === 4001) {
          setDisconnectReason("Access denied: incorrect password");
          onStatus("Access denied");
        } else if (event.code === 4002) {
          setDisconnectReason("Authentication timeout");
          onStatus("Auth timeout");
        } else {
          setDisconnected(true);
          setDisconnectReason("Disconnected from server");
          onStatus("Disconnected");
        }
      };

      ws.onerror = () => {
        onStatus("Connection failed");
        setDisconnected(true);
        setDisconnectReason("Failed to connect. Is the host online?");
      };
    };

    init();

    return () => {
      if (ws) ws.close();
    };
  }, []);

  const sendMessage = useCallback(() => {
    const text = input.trim();
    if (!text || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN)
      return;
    wsRef.current.send(JSON.stringify({ type: "message", text }));
    setInput("");
  }, [input]);

  const handleTyping = useCallback(() => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ type: "typing" }));
  }, []);

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      } else {
        handleTyping();
      }
    },
    [sendMessage, handleTyping]
  );

  if (disconnected) {
    return (
      <div className="chat-container">
        <div className="chat-header">
          <div className="chat-header-info">
            <div className="chat-room-name">{roomInfo.name}</div>
            <div className="chat-room-subtitle">Disconnected</div>
          </div>
        </div>
        <div className="chat-disconnect">
          <div className="disconnect-icon">&#128683;</div>
          <p>{disconnectReason}</p>
          <button
            className="btn btn-primary"
            onClick={() => window.location.reload()}
          >
            Reconnect
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-container">
      <div className="chat-header">
        <div className="chat-header-info">
          <div className="chat-room-name">{roomInfo.name}</div>
          <div className="chat-room-subtitle">
            {users.length > 0
              ? `${users.length} online\u00A0\u00A0\u00B7\u00A0\u00A0${users.join(", ")}`
              : "Connecting..."}
          </div>
        </div>
        <div className="chat-header-status">
          <span className="status-dot connected"></span>
        </div>
      </div>

      <div
        className="chat-messages"
        ref={messagesContainerRef}
        onScroll={handleScroll}
      >
        <div className="chat-messages-inner">
          {messages.length === 0 && (
            <div className="chat-welcome">
              <div className="chat-welcome-icon">&#128172;</div>
              <p>Welcome to {roomInfo.name}</p>
              <span>Messages are end-to-end through the host</span>
            </div>
          )}

          {messages.map((msg, i) =>
            msg.isSystem ? (
              <div key={i} className={`chat-system ${msg.type}`}>
                <span>{msg.text}</span>
                <span className="chat-system-time">{msg.time}</span>
              </div>
            ) : msg.isMine ? (
              <div key={i} className="chat-bubble mine">
                <div className="bubble-text">{msg.text}</div>
                <div className="bubble-time">{msg.time}</div>
              </div>
            ) : (
              <div key={i} className="chat-bubble theirs">
                <div className="bubble-user">{msg.user}</div>
                <div className="bubble-text">{msg.text}</div>
                <div className="bubble-time">{msg.time}</div>
              </div>
            )
          )}

          {typingUser && (
            <div className="chat-typing">
              <span className="typing-user">{typingUser}</span> is typing
              <span className="typing-dots">
                <span>.</span>
                <span>.</span>
                <span>.</span>
              </span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="chat-input-area">
        <div className="chat-input-wrapper">
          <input
            type="text"
            className="chat-input"
            placeholder="Type a message..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
          />
          <button
            className="chat-send"
            onClick={sendMessage}
            disabled={!input.trim()}
          >
            &#10148;
          </button>
        </div>
      </div>
    </div>
  );
}
