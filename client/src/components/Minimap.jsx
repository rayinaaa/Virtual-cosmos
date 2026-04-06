import { useRef, useEffect } from "react";
import { useCosmosStore } from "../stores/cosmosStore";

const MW = 150, MH = 100;

export default function Minimap() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let raf;

    const draw = () => {
      const { self, users, worldSize, activeRooms } = useCosmosStore.getState();
      ctx.clearRect(0, 0, MW, MH);

      // Background
      ctx.fillStyle = "rgba(13,21,38,0.9)";
      ctx.fillRect(0, 0, MW, MH);

      // Grid lines
      ctx.strokeStyle = "rgba(77,159,255,0.1)";
      ctx.lineWidth = 0.5;
      for (let i = 1; i < 5; i++) {
        ctx.beginPath(); ctx.moveTo(i * MW / 5, 0); ctx.lineTo(i * MW / 5, MH); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, i * MH / 5); ctx.lineTo(MW, i * MH / 5); ctx.stroke();
      }

      if (!self) { raf = requestAnimationFrame(draw); return; }

      const connectedIds = new Set(
        Object.values(activeRooms).map((r) => r.withUser?.socketId)
      );
      const toX = (x) => (x / worldSize.width)  * MW;
      const toY = (y) => (y / worldSize.height) * MH;

      // Draw connection lines on minimap
      for (const room of Object.values(activeRooms)) {
        const other = users.find((u) => u.socketId === room.withUser?.socketId);
        if (!other) continue;
        ctx.beginPath();
        ctx.strokeStyle = "rgba(68,255,145,0.35)";
        ctx.lineWidth = 1;
        ctx.moveTo(toX(self.position.x), toY(self.position.y));
        ctx.lineTo(toX(other.position.x), toY(other.position.y));
        ctx.stroke();
      }

      // Other users
      for (const u of users) {
        if (u.socketId === self.socketId) continue;
        const near = connectedIds.has(u.socketId);
        const mx = toX(u.position.x), my = toY(u.position.y);
        ctx.beginPath();
        ctx.arc(mx, my, near ? 3 : 2, 0, Math.PI * 2);
        ctx.fillStyle = near ? u.avatarColor : (u.avatarColor + "70");
        ctx.fill();
        if (near) {
          ctx.strokeStyle = u.avatarColor;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }

      // Self (larger, always on top)
      const sx = toX(self.position.x), sy = toY(self.position.y);
      ctx.beginPath();
      ctx.arc(sx, sy, 4, 0, Math.PI * 2);
      ctx.fillStyle   = self.avatarColor || "#fff";
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.9)";
      ctx.lineWidth   = 1.5;
      ctx.stroke();

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Shift left when chat panel is open
  const hasChatOpen = useCosmosStore((s) => Object.keys(s.activeRooms).length > 0);

  return (
    <div style={{
      position: "fixed",
      bottom: 16,
      right: hasChatOpen ? 352 : 16,
      zIndex: 50,
      transition: "right 0.3s ease",
      background: "rgba(10,16,30,0.88)",
      border: "1px solid rgba(77,159,255,0.16)",
      borderRadius: 10, padding: 8,
      backdropFilter: "blur(16px)",
    }}>
      <div style={{ fontSize: 9, color: "rgba(232,240,255,0.25)", fontFamily: "'Space Mono',monospace", letterSpacing: "0.07em", marginBottom: 5 }}>
        MINIMAP
      </div>
      <canvas
        ref={canvasRef}
        width={MW} height={MH}
        style={{ display: "block", borderRadius: 5, border: "1px solid rgba(77,159,255,0.1)" }}
      />
      <div style={{ display: "flex", gap: 10, marginTop: 5 }}>
        {[
          { color: "#fff",        label: "You"       },
          { color: "#44ff91",     label: "Near"      },
          { color: "#4d9fff80",   label: "Others"    },
        ].map(({ color, label }) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 3 }}>
            <div style={{ width: 5, height: 5, borderRadius: "50%", background: color }} />
            <span style={{ fontSize: 8, color: "rgba(232,240,255,0.28)" }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
