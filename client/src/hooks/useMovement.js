import { useEffect, useRef } from "react";
import { useCosmosStore } from "../stores/cosmosStore";

const SPEED        = 3;    // pixels per frame (~180px/s at 60fps)
const EMIT_RATE_MS = 50;   // send position to server at most every 50ms (20Hz)

export function useMovement() {
  const keys      = useRef(new Set());
  const lastEmit  = useRef(0);
  const rafHandle = useRef(null);

  useEffect(() => {
    const onKeyDown = (e) => {
      const tag = document.activeElement?.tagName?.toUpperCase();
      if (tag === "INPUT" || tag === "TEXTAREA") return; // don't steal chat input
      keys.current.add(e.key);
      // prevent page scroll with arrow keys
      if (["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(e.key))
        e.preventDefault();
    };
    const onKeyUp = (e) => keys.current.delete(e.key);

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup",   onKeyUp);

    const tick = () => {
      const { self, socket, worldSize, updateSelfPosition } = useCosmosStore.getState();

      if (self && socket?.connected) {
        let { x, y } = self.position;
        let moved = false;

        if (keys.current.has("ArrowUp")    || keys.current.has("w") || keys.current.has("W")) { y -= SPEED; moved = true; }
        if (keys.current.has("ArrowDown")  || keys.current.has("s") || keys.current.has("S")) { y += SPEED; moved = true; }
        if (keys.current.has("ArrowLeft")  || keys.current.has("a") || keys.current.has("A")) { x -= SPEED; moved = true; }
        if (keys.current.has("ArrowRight") || keys.current.has("d") || keys.current.has("D")) { x += SPEED; moved = true; }

        if (moved) {
          // Clamp to world
          x = Math.max(20, Math.min(worldSize.width  - 20, x));
          y = Math.max(20, Math.min(worldSize.height - 20, y));

          // Update local state immediately (smooth rendering)
          updateSelfPosition({ x, y });

          // Throttled emit to server
          const now = Date.now();
          if (now - lastEmit.current >= EMIT_RATE_MS) {
            socket.emit("user:move", { x, y });
            lastEmit.current = now;
          }
        }
      }

      rafHandle.current = requestAnimationFrame(tick);
    };

    rafHandle.current = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup",   onKeyUp);
      cancelAnimationFrame(rafHandle.current);
    };
  }, []);
}
