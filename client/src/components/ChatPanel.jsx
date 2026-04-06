import { useState, useRef, useEffect, useCallback } from "react";
import { useCosmosStore } from "../stores/cosmosStore";

// ─── Message bubble ───────────────────────────────────────────────────────────
function Bubble({ msg, isSelf }) {
  const time = new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return (
    <div style={{
      display: "flex",
      flexDirection: isSelf ? "row-reverse" : "row",
      gap: 7, marginBottom: 10, alignItems: "flex-end",
    }}>
      <div style={{
        width: 26, height: 26, borderRadius: "50%",
        background: msg.avatarColor || "#4d9fff",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 10, fontWeight: 700, color: "#fff", flexShrink: 0,
      }}>
        {(msg.senderName?.[0] || "?").toUpperCase()}
      </div>
      <div style={{ maxWidth: "76%", display: "flex", flexDirection: "column", alignItems: isSelf ? "flex-end" : "flex-start" }}>
        {!isSelf && (
          <span style={{ fontSize: 10, color: "rgba(232,240,255,0.38)", marginBottom: 3, marginLeft: 4 }}>
            {msg.senderName}
          </span>
        )}
        <div style={{
          padding: "8px 12px",
          borderRadius: isSelf ? "13px 13px 3px 13px" : "13px 13px 13px 3px",
          background: isSelf
            ? "linear-gradient(135deg, rgba(77,159,255,0.88), rgba(100,70,220,0.88))"
            : "rgba(255,255,255,0.08)",
          border: isSelf ? "none" : "1px solid rgba(255,255,255,0.07)",
          color: "#e8f0ff", fontSize: 13.5, lineHeight: 1.45, wordBreak: "break-word",
        }}>
          {msg.message}
        </div>
        <span style={{ fontSize: 9, color: "rgba(232,240,255,0.22)", marginTop: 3, marginInline: 4 }}>
          {time}
        </span>
      </div>
    </div>
  );
}

// ─── Animated typing dots ─────────────────────────────────────────────────────
function TypingDots() {
  return (
    <span style={{ display: "inline-flex", gap: 3, alignItems: "center" }}>
      {[0, 1, 2].map((i) => (
        <span key={i} style={{
          width: 4, height: 4, borderRadius: "50%",
          background: "rgba(77,159,255,0.6)",
          display: "inline-block",
          animation: "float 1s ease-in-out infinite",
          animationDelay: `${i * 0.18}s`,
        }} />
      ))}
    </span>
  );
}

// ─── Main ChatPanel ───────────────────────────────────────────────────────────
export default function ChatPanel() {
  const [input,   setInput]   = useState("");
  const [typing,  setTyping_] = useState(false);

  const msgsEnd     = useRef(null);
  const typingTimer = useRef(null);
  const inputRef    = useRef(null);

  const { socket, self, activeRooms, activeRoomId, setActiveRoomId, typingUsers } =
    useCosmosStore();

  const rooms       = Object.entries(activeRooms);
  const currentRoom = activeRoomId ? activeRooms[activeRoomId] : null;

  // Auto-scroll on new messages
  useEffect(() => {
    msgsEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [currentRoom?.messages?.length]);

  // Re-focus input when room tab changes
  useEffect(() => {
    if (currentRoom) setTimeout(() => inputRef.current?.focus(), 80);
  }, [activeRoomId]);

  // Send a message
  const send = useCallback(() => {
    const text = input.trim();
    if (!text || !activeRoomId || !socket) return;
    socket.emit("chat:message", { roomId: activeRoomId, message: text });
    setInput("");
    if (typing) {
      socket.emit("chat:typing", { roomId: activeRoomId, isTyping: false });
      setTyping_(false);
    }
    clearTimeout(typingTimer.current);
  }, [input, activeRoomId, socket, typing]);

  // Handle input changes + typing indicator
  const onChange = (e) => {
    setInput(e.target.value);
    if (!socket || !activeRoomId) return;
    if (!typing) {
      setTyping_(true);
      socket.emit("chat:typing", { roomId: activeRoomId, isTyping: true });
    }
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      setTyping_(false);
      socket.emit("chat:typing", { roomId: activeRoomId, isTyping: false });
    }, 1800);
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  // Panel only renders when there are active connections
  if (rooms.length === 0) return null;

  // Who is typing in the current room (excluding self)
  const whoTyping = Object.entries(typingUsers[activeRoomId] || {})
    .filter(([sid]) => sid !== self?.socketId)
    .map(([, name]) => name);

  return (
    <div style={{
      position: "fixed", right: 16, bottom: 16,
      width: 320, zIndex: 100,
      display: "flex", flexDirection: "column",
      maxHeight: "calc(100vh - 120px)",
      background: "rgba(9,15,28,0.94)",
      border: "1px solid rgba(77,159,255,0.18)",
      borderRadius: 16, overflow: "hidden",
      backdropFilter: "blur(24px)",
      boxShadow: "0 8px 40px rgba(0,0,0,0.55)",
      animation: "slideRight 0.3s ease-out",
    }}>

      {/* ── Room tabs ──────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", borderBottom: "1px solid rgba(77,159,255,0.1)", overflowX: "auto", flexShrink: 0 }}>
        {rooms.map(([rid, room]) => {
          const active = rid === activeRoomId;
          return (
            <button key={rid} onClick={() => setActiveRoomId(rid)} style={{
              flex: rooms.length === 1 ? 1 : "0 0 auto",
              padding: "10px 13px",
              background: active ? "rgba(77,159,255,0.1)" : "transparent",
              border: "none",
              borderBottom: `2px solid ${active ? "rgba(77,159,255,0.8)" : "transparent"}`,
              color: active ? "#e8f0ff" : "rgba(232,240,255,0.38)",
              fontSize: 11, fontFamily: "'DM Sans',sans-serif",
              fontWeight: active ? 600 : 400,
              cursor: "pointer", whiteSpace: "nowrap",
              display: "flex", alignItems: "center", gap: 5, transition: "all 0.12s",
            }}>
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: room.withUser?.avatarColor || "#4d9fff", flexShrink: 0 }} />
              {room.withUser?.username || "Chat"}
              {room.unread > 0 && (
                <span style={{
                  background: "#ff4466", color: "#fff",
                  fontSize: 9, fontWeight: 700,
                  padding: "1px 5px", borderRadius: 8,
                }}>
                  {room.unread}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Connection status header ────────────────────────────────────────── */}
      {currentRoom && (
        <div style={{
          padding: "8px 13px", flexShrink: 0,
          borderBottom: "1px solid rgba(77,159,255,0.07)",
          display: "flex", alignItems: "center", gap: 7,
        }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#44ff91", boxShadow: "0 0 6px #44ff91" }} />
          <span style={{ fontSize: 11, color: "rgba(232,240,255,0.45)" }}>
            Connected with <strong style={{ color: "rgba(232,240,255,0.88)" }}>{currentRoom.withUser?.username}</strong>
          </span>
        </div>
      )}

      {/* ── Message list ───────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 12px 4px", minHeight: 180 }}>
        {!currentRoom ? (
          <p style={{ textAlign: "center", color: "rgba(232,240,255,0.2)", fontSize: 12, marginTop: 40 }}>
            Select a conversation
          </p>
        ) : currentRoom.messages.length === 0 ? (
          <div style={{ textAlign: "center", color: "rgba(232,240,255,0.22)", fontSize: 12, marginTop: 44 }}>
            <div style={{ fontSize: 24, marginBottom: 8 }}>👋</div>
            Say hello to {currentRoom.withUser?.username}!
          </div>
        ) : (
          currentRoom.messages.map((msg, i) => (
            <Bubble
              key={`${msg.timestamp}-${i}`}
              msg={msg}
              isSelf={msg.socketId === self?.socketId}
            />
          ))
        )}

        {/* Typing indicator */}
        {whoTyping.length > 0 && (
          <div style={{ fontSize: 11, color: "rgba(232,240,255,0.32)", display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
            <TypingDots />
            {whoTyping.join(", ")} {whoTyping.length === 1 ? "is" : "are"} typing…
          </div>
        )}
        <div ref={msgsEnd} />
      </div>

      {/* ── Message input ──────────────────────────────────────────────────── */}
      {currentRoom && (
        <div style={{ display: "flex", gap: 7, padding: "9px 10px", borderTop: "1px solid rgba(77,159,255,0.08)", flexShrink: 0 }}>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={onChange}
            onKeyDown={onKeyDown}
            placeholder="Type a message…"
            maxLength={500}
            style={{
              flex: 1, padding: "8px 11px",
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(77,159,255,0.16)",
              borderRadius: 8, color: "#e8f0ff",
              fontSize: 13, fontFamily: "'DM Sans',sans-serif", outline: "none",
              transition: "border-color 0.15s",
            }}
            onFocus={(e) => (e.target.style.borderColor = "rgba(77,159,255,0.5)")}
            onBlur={(e)  => (e.target.style.borderColor = "rgba(77,159,255,0.16)")}
          />
          <button
            onClick={send}
            disabled={!input.trim()}
            style={{
              padding: "8px 14px", flexShrink: 0,
              background: input.trim()
                ? "linear-gradient(135deg, rgba(77,159,255,0.9), rgba(100,70,220,0.9))"
                : "rgba(255,255,255,0.05)",
              border: "none", borderRadius: 8,
              color: input.trim() ? "#fff" : "rgba(255,255,255,0.18)",
              fontSize: 14, cursor: input.trim() ? "pointer" : "not-allowed",
              transition: "all 0.12s",
            }}
          >
            ↑
          </button>
        </div>
      )}
    </div>
  );
}
