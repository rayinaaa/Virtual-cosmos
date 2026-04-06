import { useState } from "react";
import { useCosmosStore } from "../stores/cosmosStore";

const SAMPLE_NAMES = ["Orion","Nova","Lyra","Atlas","Vega","Solaris","Nebula","Zenith","Quasar","Pulsar"];

export default function LoginScreen() {
  const [username, setUsername] = useState(
    () => SAMPLE_NAMES[Math.floor(Math.random() * SAMPLE_NAMES.length)]
  );
  const [error, setError] = useState("");

  const { socket, connected } = useCosmosStore();

  const join = () => {
    const name = username.trim();
    if (!name)           { setError("Please enter a name.");        return; }
    if (name.length > 20){ setError("Name must be 20 chars or less."); return; }
    if (!socket || !connected) { setError("Still connecting to server…"); return; }
    socket.emit("user:join", { username: name });
  };

  const onKey = (e) => {
    setError("");
    if (e.key === "Enter") join();
  };

  return (
    <div style={{
      position: "fixed", inset: 0,
      background: "#070b14",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      {/* Animated stars */}
      <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
        {Array.from({ length: 80 }, (_, i) => (
          <div key={i} style={{
            position: "absolute",
            left:   `${Math.random() * 100}%`,
            top:    `${Math.random() * 100}%`,
            width:  Math.random() < 0.2 ? 2 : 1,
            height: Math.random() < 0.2 ? 2 : 1,
            borderRadius: "50%",
            background: `rgba(168,196,248,${0.2 + Math.random() * 0.5})`,
            animation: `float ${3 + Math.random() * 4}s ease-in-out infinite`,
            animationDelay: `${Math.random() * 5}s`,
          }} />
        ))}
      </div>

      {/* Background glow */}
      <div style={{
        position: "absolute", width: 600, height: 600, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(30,60,120,0.35) 0%, transparent 70%)",
        top: "50%", left: "50%", transform: "translate(-50%,-50%)",
        filter: "blur(40px)", pointerEvents: "none",
      }} />

      {/* Card */}
      <div style={{
        position: "relative", zIndex: 10,
        width: "min(420px, 90vw)",
        padding: "44px 40px",
        background: "rgba(13,21,38,0.88)",
        border: "1px solid rgba(77,159,255,0.18)",
        borderRadius: 20,
        backdropFilter: "blur(20px)",
        boxShadow: "0 0 60px rgba(20,50,110,0.4), 0 24px 48px rgba(0,0,0,0.4)",
        animation: "fadeIn 0.4s ease-out",
      }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 14 }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10.5" stroke="rgba(77,159,255,0.55)" strokeWidth="1.5"/>
              <circle cx="12" cy="12" r="4" fill="rgba(77,159,255,0.85)"/>
              <circle cx="12" cy="12" r="2" fill="#fff"/>
              <ellipse cx="12" cy="12" rx="9" ry="3.5" stroke="rgba(77,159,255,0.4)" strokeWidth="1" fill="none" transform="rotate(-20 12 12)"/>
            </svg>
            <span style={{ fontFamily: "'Space Mono',monospace", fontSize: 28, fontWeight: 700, letterSpacing: "0.1em", color: "#e8f0ff" }}>
              COSMOS
            </span>
          </div>
          <p style={{ fontSize: 13, color: "rgba(232,240,255,0.45)", lineHeight: 1.65 }}>
            A virtual space where proximity creates connection.<br/>
            Move close to others to start chatting.
          </p>
        </div>

        {/* Name input */}
        <label style={{ display: "block", fontSize: 10, letterSpacing: "0.1em", color: "rgba(232,240,255,0.4)", marginBottom: 8, fontFamily: "'Space Mono',monospace", textTransform: "uppercase" }}>
          Your Name
        </label>
        <input
          autoFocus
          type="text"
          value={username}
          onChange={(e) => { setUsername(e.target.value); setError(""); }}
          onKeyDown={onKey}
          maxLength={20}
          placeholder="Enter your name…"
          style={{
            display: "block", width: "100%", padding: "13px 16px",
            background: "rgba(255,255,255,0.05)",
            border: `1px solid ${error ? "rgba(255,70,70,0.6)" : "rgba(77,159,255,0.22)"}`,
            borderRadius: 10, color: "#e8f0ff", fontSize: 15,
            fontFamily: "'DM Sans',sans-serif", outline: "none",
            boxSizing: "border-box", transition: "border-color 0.2s",
            marginBottom: 6,
          }}
          onFocus={(e) => (e.target.style.borderColor = "rgba(77,159,255,0.6)")}
          onBlur={(e)  => (e.target.style.borderColor = error ? "rgba(255,70,70,0.6)" : "rgba(77,159,255,0.22)")}
        />
        {error && (
          <p style={{ color: "rgba(255,90,90,0.9)", fontSize: 12, marginBottom: 10 }}>{error}</p>
        )}

        {/* Join button */}
        <button
          onClick={join}
          disabled={!connected}
          style={{
            display: "block", width: "100%", padding: "14px",
            marginTop: 10,
            background: connected
              ? "linear-gradient(135deg, rgba(77,159,255,0.9) 0%, rgba(120,80,255,0.9) 100%)"
              : "rgba(255,255,255,0.07)",
            border: "none", borderRadius: 10,
            color: connected ? "#fff" : "rgba(255,255,255,0.3)",
            fontSize: 15, fontWeight: 600, fontFamily: "'DM Sans',sans-serif",
            cursor: connected ? "pointer" : "not-allowed",
            transition: "transform 0.15s, background 0.2s",
          }}
          onMouseEnter={(e) => { if (connected) e.currentTarget.style.transform = "translateY(-1px)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; }}
        >
          {connected ? "Enter Cosmos →" : "Connecting to server…"}
        </button>

        {/* Server status */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7, marginTop: 18 }}>
          <div style={{
            width: 7, height: 7, borderRadius: "50%",
            background: connected ? "#44ff91" : "#ff4466",
            boxShadow: connected ? "0 0 8px #44ff91" : "none",
            transition: "all 0.3s",
          }} />
          <span style={{ fontSize: 12, color: "rgba(232,240,255,0.35)" }}>
            {connected ? "Server connected" : "Connecting…"}
          </span>
        </div>

        {/* Controls hint */}
        <div style={{ marginTop: 22, paddingTop: 18, borderTop: "1px solid rgba(77,159,255,0.1)", textAlign: "center", fontSize: 12, color: "rgba(232,240,255,0.28)" }}>
          Use&nbsp;
          {["W","A","S","D"].map((k) => (
            <kbd key={k} style={{
              padding: "2px 6px", margin: "0 2px",
              background: "rgba(77,159,255,0.1)",
              border: "1px solid rgba(77,159,255,0.2)",
              borderRadius: 4, fontFamily: "'Space Mono',monospace", fontSize: 10,
            }}>{k}</kbd>
          ))}
          &nbsp;or arrow keys to move
        </div>
      </div>
    </div>
  );
}
