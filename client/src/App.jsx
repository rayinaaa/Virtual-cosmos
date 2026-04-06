import { useCosmosStore } from "./stores/cosmosStore";
import { useSocket }       from "./hooks/useSocket";
import { useMovement }     from "./hooks/useMovement";
import LoginScreen         from "./components/LoginScreen";
import CosmosCanvas        from "./components/CosmosCanvas";
import ChatPanel           from "./components/ChatPanel";
import HUD                 from "./components/HUD";
import Minimap             from "./components/Minimap";

function CosmosWorld() {
  useMovement(); // keyboard loop — only active in-world
  return (
    <div style={{ width: "100vw", height: "100vh", overflow: "hidden", position: "relative" }}>
      <CosmosCanvas />   {/* PixiJS WebGL canvas — background layer */}
      <HUD />            {/* stats, player list, connection badges */}
      <ChatPanel />      {/* proximity chat — only renders when connected to someone */}
      <Minimap />        {/* overview map */}
    </div>
  );
}

export default function App() {
  useSocket(); // socket lives for entire app lifetime
  const phase = useCosmosStore((s) => s.phase);
  return phase === "cosmos" ? <CosmosWorld /> : <LoginScreen />;
}
