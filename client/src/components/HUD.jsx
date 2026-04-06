import { useCosmosStore } from "../stores/cosmosStore";

export default function HUD() {
  const { self, users, activeRooms, connected, socket } = useCosmosStore();
  if (!self) return null;

  const connCount  = Object.keys(activeRooms).length;
  const otherUsers = users.filter((u) => u.socketId !== self.socketId);

  // Teleport near target user — puts you within proximity radius immediately
  const teleportNear = (target) => {
    const angle  = Math.random() * Math.PI * 2;
    const offset = 60 + Math.random() * 60; // 60–120 px (inside the 150 px radius)
    const nx = Math.max(20, Math.min(
      useCosmosStore.getState().worldSize.width  - 20,
      Math.round(target.position.x + Math.cos(angle) * offset)
    ));
    const ny = Math.max(20, Math.min(
      useCosmosStore.getState().worldSize.height - 20,
      Math.round(target.position.y + Math.sin(angle) * offset)
    ));
    useCosmosStore.getState().updateSelfPosition({ x: nx, y: ny });
    socket?.emit("user:move", { x: nx, y: ny });
  };

  return (
    <>
      {/* ── Top-left: logo + stats + controls ──────────────────────────────── */}
      <div style={{ position: "fixed", top: 16, left: 16, zIndex: 50, display: "flex", flexDirection: "column", gap: 8 }}>

        <div style={pill}>
          <CosmosIcon />
          <span style={{ fontFamily: "'Space Mono',monospace", fontSize: 13, fontWeight: 700, letterSpacing: "0.08em", color: "#e8f0ff" }}>COSMOS</span>
          <StatusDot on={connected} />
        </div>

        <div style={card}>
          <StatRow icon="👥" label="In cosmos"  value={otherUsers.length + 1} />
          <StatRow icon="🔗" label="Connected"  value={connCount} hi={connCount > 0} />
          <StatRow icon="📍" label="Position"
            value={`${Math.round(self.position?.x || 0)}, ${Math.round(self.position?.y || 0)}`}
            mono />
        </div>

        <div style={{ ...card, padding: "7px 12px" }}>
          <span style={{ fontSize: 10, color: "rgba(232,240,255,0.28)", fontFamily: "'Space Mono',monospace" }}>
            WASD / ↑↓←→ to move
          </span>
        </div>
      </div>

      {/* ── Top-right: self identity badge ─────────────────────────────────── */}
      <div style={{ ...pill, position: "fixed", top: 16, right: 16, zIndex: 50 }}>
        <AvatarCircle color={self.avatarColor} letter={self.username?.[0]} size={28} />
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#e8f0ff" }}>{self.username}</div>
          <div style={{ fontSize: 10, color: "rgba(232,240,255,0.35)" }}>You</div>
        </div>
      </div>

      {/* ── Right panel: online players list (click = teleport near) ──────── */}
      {otherUsers.length > 0 && (
        <div style={{
          position: "fixed", top: 76, right: 16, zIndex: 50,
          display: "flex", flexDirection: "column", gap: 5, width: 190,
        }}>
          <div style={{ fontSize: 9, color: "rgba(232,240,255,0.25)", fontFamily: "'Space Mono',monospace", letterSpacing: "0.07em", marginLeft: 4 }}>
            PLAYERS ONLINE
          </div>
          {otherUsers.map((u) => {
            const isConn = Object.values(activeRooms).some((r) => r.withUser?.socketId === u.socketId);
            return (
              <button
                key={u.socketId}
                onClick={() => teleportNear(u)}
                title={isConn ? `Chatting with ${u.username}` : `Click to move near ${u.username}`}
                style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "7px 10px",
                  background: isConn ? "rgba(68,255,145,0.1)" : "rgba(10,16,30,0.85)",
                  border: `1px solid ${isConn ? "rgba(68,255,145,0.3)" : "rgba(77,159,255,0.14)"}`,
                  borderRadius: 10, backdropFilter: "blur(14px)",
                  cursor: "pointer", textAlign: "left", width: "100%",
                  transition: "background 0.15s, border-color 0.15s",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = isConn ? "rgba(68,255,145,0.17)" : "rgba(77,159,255,0.08)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = isConn ? "rgba(68,255,145,0.1)" : "rgba(10,16,30,0.85)"; }}
              >
                <AvatarCircle color={u.avatarColor} letter={u.username?.[0]} size={22} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#e8f0ff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {u.username}
                  </div>
                  <div style={{ fontSize: 10, color: isConn ? "#44ff91" : "rgba(232,240,255,0.32)" }}>
                    {isConn ? "● chatting" : "tap to find →"}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* ── Bottom-left: active connection badges ──────────────────────────── */}
      {connCount > 0 && (
        <div style={{ position: "fixed", bottom: 16, left: 16, zIndex: 50, display: "flex", flexDirection: "column", gap: 7 }}>
          {Object.entries(activeRooms).map(([rid, room]) => (
            <ConnBadge key={rid} room={room} />
          ))}
        </div>
      )}
    </>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatRow({ icon, label, value, hi, mono }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 4 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
        <span style={{ fontSize: 11 }}>{icon}</span>
        <span style={{ fontSize: 11, color: "rgba(232,240,255,0.4)" }}>{label}</span>
      </div>
      <span style={{
        fontSize: 12, fontWeight: 600,
        color: hi ? "#44ff91" : "rgba(232,240,255,0.85)",
        fontFamily: (hi || mono) ? "'Space Mono',monospace" : "inherit",
      }}>
        {value}
      </span>
    </div>
  );
}

function AvatarCircle({ color, letter, size = 28 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: color || "#4d9fff",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.42, fontWeight: 700, color: "#fff", flexShrink: 0,
      boxShadow: `0 0 8px ${color || "#4d9fff"}55`,
    }}>
      {(letter || "?").toUpperCase()}
    </div>
  );
}

function StatusDot({ on }) {
  return (
    <div style={{
      width: 7, height: 7, borderRadius: "50%",
      background: on ? "#44ff91" : "#ff4466",
      boxShadow: on ? "0 0 7px #44ff91" : "none",
      transition: "all 0.3s",
    }} />
  );
}

function ConnBadge({ room }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8, padding: "7px 12px",
      background: "rgba(10,16,30,0.9)",
      border: "1px solid rgba(68,255,145,0.22)",
      borderRadius: 10, backdropFilter: "blur(14px)",
      boxShadow: "0 0 14px rgba(68,255,145,0.07)",
      animation: "fadeIn 0.3s ease-out",
    }}>
      <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#44ff91", boxShadow: "0 0 7px #44ff91", flexShrink: 0 }} />
      <AvatarCircle color={room.withUser?.avatarColor} letter={room.withUser?.username?.[0]} size={20} />
      <span style={{ fontSize: 11, color: "rgba(232,240,255,0.78)" }}>{room.withUser?.username}</span>
    </div>
  );
}

function CosmosIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10.5" stroke="rgba(77,159,255,0.55)" strokeWidth="1.5"/>
      <circle cx="12" cy="12" r="4"    fill="rgba(77,159,255,0.85)"/>
      <circle cx="12" cy="12" r="2"    fill="#fff"/>
      <ellipse cx="12" cy="12" rx="9" ry="3.5" stroke="rgba(77,159,255,0.4)" strokeWidth="1" fill="none" transform="rotate(-20 12 12)"/>
    </svg>
  );
}

const pill = {
  display: "flex", alignItems: "center", gap: 8,
  padding: "8px 14px",
  background: "rgba(10,16,30,0.88)",
  border: "1px solid rgba(77,159,255,0.16)",
  borderRadius: 30, backdropFilter: "blur(16px)",
};

const card = {
  padding: "10px 14px",
  background: "rgba(10,16,30,0.78)",
  border: "1px solid rgba(77,159,255,0.1)",
  borderRadius: 12, backdropFilter: "blur(16px)",
};
